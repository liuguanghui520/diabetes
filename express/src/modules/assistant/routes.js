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

async function streamDifyChat({
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
  res.flushHeaders?.()

  await store.createMessage({
    conversation_id: conversation.id,
    role: 'user',
    content: req.body.message,
    metadata: {
      attachments: req.body.attachments || []
    }
  })

  let fullAnswer = ''
  let difyConversationId = conversation.dify_conversation_id || ''
  let difyMessageId = null

  const ping = setInterval(() => {
    writeSse(res, 'ping', { ts: Date.now() })
  }, 15000)

  try {
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
    writeSse(res, 'error', {
      message: error.message || 'AI 服务暂时不可用'
    })
  } finally {
    clearInterval(ping)
    res.end()
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
      },
    })
  }))

  router.post('/doctors/:doctorId/chat', sensitiveLimiter, auth, validate(doctorChatSchema), asyncHandler(async (req, res) => {
    req.body.attachments = await sanitizeAttachmentPayload(
      store,
      req.user.id,
      req.body.attachments,
    )

    const doctorId = Number(req.params.doctorId)
    const conversation = await store.createConversation({
      user_id: req.user.id,
      app_type: 'doctor',
      doctor_id: Number.isFinite(doctorId) ? doctorId : null,
      dify_conversation_id: null,
      title: req.body.message.slice(0, 40)
    })

    await store.createConsultationOrder?.({
      user_id: req.user.id,
      doctor_id: Number.isFinite(doctorId) ? doctorId : null,
      conversation_id: conversation.id,
      title: req.body.message.slice(0, 80),
      priority: 'normal'
    })

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
      },
    })
  }))

  router.get('/assistant/conversations', auth, asyncHandler(async (req, res) => {
    sendOk(res, await store.listConversations(req.user.id, 'assistant'))
  }))

  router.get('/assistant/conversations/:conversationId/messages', auth, asyncHandler(async (req, res) => {
    sendOk(res, await store.listMessages(req.user.id, req.params.conversationId))
  }))
}
