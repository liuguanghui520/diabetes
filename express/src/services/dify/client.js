import { readFileSync } from 'node:fs'
import { errors } from '../../http/errors.js'
import { maskSensitive, safeJson } from '../../utils/json.js'

function getWorkflowOutputs(data) {
  return data?.data?.outputs || data?.outputs || data?.data || data
}

function getWorkflowRunId(payload) {
  return payload?.workflow_run_id || payload?.data?.workflow_run_id || payload?.data?.id || null
}

function getWorkflowTaskId(payload) {
  return payload?.task_id || payload?.data?.task_id || null
}

function getTotalTokens(payload) {
  return payload?.data?.total_tokens || payload?.metadata?.usage?.total_tokens || null
}

function getLogAppCode(appCode) {
  return appCode === 'risk' ? 'risk_assessment' : appCode
}

function scheduleBackground(task) {
  if (typeof setImmediate === 'function') {
    setImmediate(task)
    return
  }

  setTimeout(task, 0)
}

export function createDifyClient(config, overrides = {}) {
  const fetchImpl = overrides.fetch || globalThis.fetch

  async function request(path, apiKey, body, { signal } = {}) {
    if (!apiKey) {
      throw errors.difyUnavailable('Dify API Key 未配置')
    }

    const timeout = AbortSignal.timeout(config.dify.timeoutMs)
    const finalSignal = signal || timeout
    const response = await fetchImpl(`${config.dify.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: finalSignal
    })

    if (!response.ok) {
      throw errors.difyUnavailable(`Dify 请求失败：HTTP ${response.status}`)
    }

    return response
  }

  async function executeWorkflow(appCode, inputs, user, { signal, files } = {}) {
    const apiKey = config.dify.apiKeys[appCode]
    const body = {
      inputs,
      response_mode: 'blocking',
      user: String(user)
    }
    if (files) body.files = files

    const response = await request('/v1/workflows/run', apiKey, body, { signal })
    const payload = await response.json()
    const outputs = getWorkflowOutputs(payload)

    return {
      raw: payload,
      outputs,
      workflow_run_id: getWorkflowRunId(payload),
      task_id: getWorkflowTaskId(payload),
      total_tokens: getTotalTokens(payload)
    }
  }

  async function createRunningLog({ appCode, inputs, user, requestId, store }) {
    if (!store?.createDifyLog) {
      return null
    }

    try {
      return await store.createDifyLog({
        user_id: Number.isFinite(Number(user)) ? Number(user) : null,
        app_code: getLogAppCode(appCode),
        app_type: 'workflow',
        request_id: requestId || null,
        inputs: maskSensitive(inputs),
        outputs: {},
        status: 'running'
      })
    } catch (error) {
      console.error(`[dify] failed to create running log: ${error?.message || error}`)
      return null
    }
  }

  async function finishLog({ log, appCode, inputs, user, requestId, store, patch }) {
    if (!store) {
      return null
    }

    try {
      if (log?.id && store.updateDifyLog) {
        return await store.updateDifyLog(log.id, patch)
      }

      if (store.createDifyLog) {
        return await store.createDifyLog({
          user_id: Number.isFinite(Number(user)) ? Number(user) : null,
          app_code: getLogAppCode(appCode),
          app_type: 'workflow',
          request_id: requestId || null,
          inputs: maskSensitive(inputs),
          ...patch
        })
      }
    } catch (error) {
      console.error(`[dify] failed to finish log: ${error?.message || error}`)
    }

    return null
  }

  return {
    async uploadFile({ appCode, filePath, fileName, mimeType, user }) {
      const apiKey = config.dify.apiKeys[appCode]
      if (!apiKey) {
        throw errors.difyUnavailable('Dify API Key 未配置')
      }

      const fileBuffer = readFileSync(filePath)
      const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' })
      const formData = new FormData()
      formData.append('file', blob, fileName)
      formData.append('user', String(user))

      const response = await fetchImpl(`${config.dify.baseUrl}/v1/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw errors.difyUnavailable(`Dify 文件上传失败：HTTP ${response.status}`)
      }

      const payload = await response.json()
      return payload.id
    },

    async runWorkflow(appCode, inputs, user, { requestId, store } = {}) {
      const started = Date.now()
      const result = await executeWorkflow(appCode, inputs, user)

      await store?.createDifyLog?.({
        user_id: Number.isFinite(Number(user)) ? Number(user) : null,
        app_code: getLogAppCode(appCode),
        app_type: 'workflow',
        request_id: requestId || null,
        workflow_run_id: result.workflow_run_id,
        task_id: result.task_id,
        inputs: maskSensitive(inputs),
        outputs: maskSensitive(result.outputs),
        status: 'succeeded',
        elapsed_time: (Date.now() - started) / 1000,
        total_tokens: result.total_tokens
      })

      return result
    },

    async enqueueWorkflow(appCode, inputs, user, { requestId, store, onSuccess, onFailure, files } = {}) {
      const started = Date.now()
      const log = await createRunningLog({ appCode, inputs, user, requestId, store })

      scheduleBackground(async () => {
        try {
          const workflowResult = await executeWorkflow(appCode, inputs, user, { files })
          const domainResult = await onSuccess?.(workflowResult)

          await finishLog({
            log,
            appCode,
            inputs,
            user,
            requestId,
            store,
            patch: {
              workflow_run_id: workflowResult.workflow_run_id,
              task_id: workflowResult.task_id,
              outputs: maskSensitive({
                workflow_outputs: workflowResult.outputs,
                result: domainResult || null
              }),
              status: 'succeeded',
              elapsed_time: (Date.now() - started) / 1000,
              total_tokens: workflowResult.total_tokens,
              error_message: null
            }
          })
        } catch (error) {
          let failureResult = null

          try {
            failureResult = await onFailure?.(error)
          } catch (callbackError) {
            failureResult = {
              callback_error: callbackError?.message || String(callbackError)
            }
          }

          await finishLog({
            log,
            appCode,
            inputs,
            user,
            requestId,
            store,
            patch: {
              outputs: maskSensitive({
                result: failureResult || null
              }),
              status: 'failed',
              elapsed_time: (Date.now() - started) / 1000,
              error_message: error?.message || String(error)
            }
          })
        }
      })

      return {
        request_id: requestId || null,
        status: 'processing',
        log_id: log?.id || null
      }
    },

    async chatStream({ appType, query, inputs, conversationId, user, signal }) {
      const apiKey = config.dify.apiKeys[appType]
      const body = {
        query,
        inputs,
        response_mode: 'streaming',
        conversation_id: conversationId || '',
        user: String(user)
      }

      return request('/v1/chat-messages', apiKey, body, { signal })
    },

    normalizeWorkflowAdvice(outputs, fallback) {
      const parsed = safeJson(outputs, outputs)
      const advice = parsed?.advice || parsed?.data?.advice || parsed || fallback

      return {
        summary: String(advice?.summary || fallback.summary || ''),
        diet: Array.isArray(advice?.diet) ? advice.diet : [],
        exercise: Array.isArray(advice?.exercise) ? advice.exercise : [],
        review: Array.isArray(advice?.review) ? advice.review : [],
        warning: String(advice?.warning || fallback.warning || '本结果仅用于健康管理参考，不作为医学诊断。'),
        next_steps: Array.isArray(advice?.next_steps) ? advice.next_steps : undefined
      }
    }
  }
}
