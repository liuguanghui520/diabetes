import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { errors } from '../../http/errors.js'
import { authMiddleware } from '../auth/auth.js'
import { proxyDifySse, writeSse } from './sse.js'
import { buildAuthorizedUserContext } from '../privacy/authorization.js'
import { sanitizeAttachmentPayload } from '../uploads/routes.js'

const chatSchema = z.object({
  conversation_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
  message: z.string().min(1).max(4000),
  history: z.array(z.unknown()).optional(),
  attachments: z.array(z.unknown()).optional(),
})

const doctorChatSchema = chatSchema.extend({
  attachments: z.array(z.unknown()).optional()
})

export async function streamDifyChat({
  req,
  res,
  store,
  difyClient,
  conversation,
  appType,
  doctorId = null,
  inputs = {}
}) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.socket?.setNoDelay?.(true)
  res.flushHeaders?.()
  res.flush?.()

  let fullAnswer = ''
  let difyConversationId = conversation.dify_conversation_id || ''
  let difyMessageId = null

  const ping = setInterval(() => {
    writeSse(res, 'ping', { ts: Date.now() })
  }, 15000)

  try {
    await store.createMessage({
      conversation_id: conversation.id,
      role: 'user',
      content: req.body.message,
      metadata: {
        attachments: req.body.attachments || []
      }
    })

    const difyResponse = await difyClient.chatStream({
      appType,
      query: req.body.message,
      inputs: {
        user_id: String(req.user.id),
        app_type: appType,
        doctor_id: doctorId ? String(doctorId) : '',
        ...inputs
      },
      conversationId: difyConversationId,
      user: req.user.id,
      signal: req.signal
    })
    await proxyDifySse({
      response: difyResponse,
      res,
      onDelta(delta) {
        fullAnswer += delta
      },
      async onEnd(event) {
        difyConversationId = event.conversation_id || difyConversationId
        difyMessageId = event.message_id || event.id || null

        await store.updateConversation(conversation.id, {
          dify_conversation_id: difyConversationId,
          title: conversation.title || req.body.message.slice(0, 40)
        })

        if (fullAnswer) {
          await store.createMessage({
            conversation_id: conversation.id,
            role: 'assistant',
            content: fullAnswer,
            dify_message_id: difyMessageId,
            metadata: {
              dify_conversation_id: difyConversationId
            }
          })
        }

        writeSse(res, 'message_end', {
          conversation_id: conversation.id,
          dify_conversation_id: difyConversationId,
          dify_message_id: difyMessageId
        })
      }
    })
  } catch (error) {
    if (!res.destroyed && !res.writableEnded) {
      writeSse(res, 'error', {
        message: error.message || 'AI 服务暂时不可用'
      })
    }
  } finally {
    clearInterval(ping)

    if (!res.destroyed && !res.writableEnded) {
      res.end()
    }
  }
}

function assertDoctorConversation(conversation, doctorId) {
  if (!conversation) {
    throw errors.notFound('会话不存在')
  }

  if (conversation.app_type !== 'doctor') {
    throw errors.notFound('医生会话不存在')
  }

  if (Number(conversation.doctor_id || 0) !== Number(doctorId || 0)) {
    throw errors.notFound('该会话不属于当前医生')
  }
}

export function registerAssistantRoutes(router, deps, options = {}) {
  const auth = authMiddleware(deps)
  const { store, difyClient } = deps
  const sensitiveLimiter = options.sensitiveLimiter || ((_req, _res, next) => next())

  router.post('/assistant/chat', sensitiveLimiter, auth, validate(chatSchema), asyncHandler(async (req, res) => {
    req.body.attachments = await sanitizeAttachmentPayload(
      store,
      req.user.id,
      req.body.attachments,
    )

    // 上传附件到 Dify，获取 upload_file_id 用于 local_file 方式传递
    let difyFileObj = null
    const firstAttachment = req.body.attachments?.[0]
    if (firstAttachment?.storage_path) {
      try {
        const uploadFileId = await difyClient.uploadFile({
          appCode: 'assistant',
          filePath: firstAttachment.storage_path,
          fileName: firstAttachment.file_name || 'file',
          mimeType: firstAttachment.mime_type || 'application/octet-stream',
          user: String(req.user.id),
        })
        const fileType = String(firstAttachment.mime_type || '').startsWith('image/')
          ? 'image'
          : 'document'
        difyFileObj = {
          type: fileType,
          transfer_method: 'local_file',
          upload_file_id: uploadFileId,
        }
      } catch (error) {
        console.error(`[dify] assistant file upload failed: ${error?.message || error}`)
      }
    }

    let conversation = null

    if (req.body.conversation_id) {
      conversation = await store.findConversation(req.user.id, req.body.conversation_id)

      if (!conversation) {
        throw errors.notFound('会话不存在')
      }
    } else {
      conversation = await store.createConversation({
        user_id: req.user.id,
        app_type: 'assistant',
        doctor_id: null,
        dify_conversation_id: null,
        title: req.body.message.slice(0, 40)
      })
    }

    await streamDifyChat({
      req,
      res,
      store,
      difyClient,
      conversation,
      appType: 'assistant',
      inputs: {
        authorized_context: await buildAuthorizedUserContext({
          store,
          userId: req.user.id,
          scope: 'assistant',
        }),
        attachments: req.body.attachments || [],
        ...(difyFileObj ? { file: difyFileObj } : {}),
      },
    })
  }))

  router.post('/doctors/:doctorId/chat', sensitiveLimiter, auth, validate(doctorChatSchema), asyncHandler(async (req, res) => {
    req.body.attachments = await sanitizeAttachmentPayload(
      store,
      req.user.id,
      req.body.attachments,
    )

    // 上传附件到 Dify，获取 upload_file_id 用于 local_file 方式传递
    let difyFileObj = null
    const firstAttachment = req.body.attachments?.[0]
    if (firstAttachment?.storage_path) {
      try {
        const uploadFileId = await difyClient.uploadFile({
          appCode: 'doctor',
          filePath: firstAttachment.storage_path,
          fileName: firstAttachment.file_name || 'file',
          mimeType: firstAttachment.mime_type || 'application/octet-stream',
          user: String(req.user.id),
        })
        const fileType = String(firstAttachment.mime_type || '').startsWith('image/')
          ? 'image'
          : 'document'
        difyFileObj = {
          type: fileType,
          transfer_method: 'local_file',
          upload_file_id: uploadFileId,
        }
      } catch (error) {
        console.error(`[dify] doctor file upload failed: ${error?.message || error}`)
      }
    }

    const doctorId = Number(req.params.doctorId)
    let conversation = null
    let isNewConversation = false

    if (req.body.conversation_id) {
      conversation = await store.findConversation(req.user.id, req.body.conversation_id)
      assertDoctorConversation(conversation, doctorId)
    } else {
      conversation = await store.createConversation({
        user_id: req.user.id,
        app_type: 'doctor',
        doctor_id: Number.isFinite(doctorId) ? doctorId : null,
        dify_conversation_id: null,
        title: req.body.message.slice(0, 40)
      })
      isNewConversation = true
    }

    if (isNewConversation) {
      await store.createConsultationOrder?.({
        user_id: req.user.id,
        doctor_id: Number.isFinite(doctorId) ? doctorId : null,
        conversation_id: conversation.id,
        title: req.body.message.slice(0, 80),
        priority: 'normal'
      })
    }

    await streamDifyChat({
      req,
      res,
      store,
      difyClient,
      conversation,
      appType: 'doctor',
      doctorId,
      inputs: {
        attachments: req.body.attachments || [],
        ...(difyFileObj ? { file: difyFileObj } : {}),
      },
    })
  }))

  router.get('/doctors/:doctorId/conversations', auth, asyncHandler(async (req, res) => {
    const doctorId = Number(req.params.doctorId)

    sendOk(res, {
      items: await store.listConversations(req.user.id, 'doctor', {
        doctorId: Number.isFinite(doctorId) ? doctorId : null,
      }),
    })
  }))

  router.get('/doctors/:doctorId/conversations/:conversationId/messages', auth, asyncHandler(async (req, res) => {
    const doctorId = Number(req.params.doctorId)
    const conversation = await store.findConversation(req.user.id, req.params.conversationId)

    assertDoctorConversation(conversation, doctorId)
    sendOk(res, await store.listMessages(req.user.id, req.params.conversationId))
  }))

  router.get('/assistant/conversations', auth, asyncHandler(async (req, res) => {
    sendOk(res, await store.listConversations(req.user.id, 'assistant'))
  }))

  router.get('/assistant/conversations/:conversationId/messages', auth, asyncHandler(async (req, res) => {
    sendOk(res, await store.listMessages(req.user.id, req.params.conversationId))
  }))
}
