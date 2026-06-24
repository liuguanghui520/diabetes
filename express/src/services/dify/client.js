import { errors } from '../../http/errors.js'
import { maskSensitive, safeJson } from '../../utils/json.js'

function getWorkflowOutputs(data) {
  return data?.data?.outputs || data?.outputs || data?.data || data
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

  return {
    async runWorkflow(appCode, inputs, user, { requestId, store } = {}) {
      const apiKey = config.dify.apiKeys[appCode]
      const body = {
        inputs,
        response_mode: 'blocking',
        user: String(user)
      }

      const started = Date.now()
      const response = await request('/v1/workflows/run', apiKey, body)
      const payload = await response.json()
      const outputs = getWorkflowOutputs(payload)

      await store?.createDifyLog?.({
        user_id: Number.isFinite(Number(user)) ? Number(user) : null,
        app_code: appCode === 'risk' ? 'risk_assessment' : appCode,
        app_type: 'workflow',
        request_id: requestId || null,
        workflow_run_id: payload?.workflow_run_id || payload?.data?.workflow_run_id || payload?.data?.id || null,
        task_id: payload?.task_id || payload?.data?.task_id || null,
        inputs: maskSensitive(inputs),
        outputs: maskSensitive(outputs),
        status: 'succeeded',
        elapsed_time: (Date.now() - started) / 1000,
        total_tokens: payload?.data?.total_tokens || payload?.metadata?.usage?.total_tokens || null
      })

      return {
        raw: payload,
        outputs,
        workflow_run_id: payload?.workflow_run_id || payload?.data?.workflow_run_id || payload?.data?.id || null
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
