import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiRequestError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  authorizedFetch,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  hasAuthSession,
  pollWorkflowRun,
  saveAuthSession,
  updateStoredUser,
} from '../../api/request'

function ok(data = {}, status = 200) {
  return new Response(JSON.stringify({ code: 0, data }), { status })
}

function failWithCode(status, code, message = '') {
  return new Response(JSON.stringify({ code, message, data: null }), { status })
}

function failRaw(status, body = '') {
  return new Response(body, { status })
}

beforeEach(() => {
  clearAuthSession()
})

// ============================================================
// ApiRequestError
// ============================================================
describe('ApiRequestError', () => {
  it('constructs with all fields', () => {
    const err = new ApiRequestError('msg', {
      status: 400,
      code: 40001,
      traceId: 'trace-1',
      data: { detail: 'x' },
    })
    expect(err.name).toBe('ApiRequestError')
    expect(err.message).toBe('msg')
    expect(err.status).toBe(400)
    expect(err.code).toBe(40001)
    expect(err.traceId).toBe('trace-1')
    expect(err.data).toEqual({ detail: 'x' })
  })

  it('defaults missing fields', () => {
    const err = new ApiRequestError('msg')
    expect(err.status).toBe(0)
    expect(err.code).toBeNull()
    expect(err.traceId).toBe('')
    expect(err.data).toBeNull()
  })
})

// ============================================================
// Session helpers
// ============================================================
describe('session helpers', () => {
  it('getStoredUser returns null for invalid JSON', () => {
    localStorage.setItem('diabetesAuthUser', 'not-json{')
    expect(getStoredUser()).toBeNull()
  })

  it('getStoredUser returns null when not set', () => {
    expect(getStoredUser()).toBeNull()
  })

  it('hasAuthSession returns false without session', () => {
    expect(hasAuthSession()).toBe(false)
  })

  it('getAuthToken returns empty string without session', () => {
    expect(getAuthToken()).toBe('')
  })

  it('saveAuthSession throws for missing token', () => {
    expect(() => saveAuthSession({})).toThrow(ApiRequestError)
    expect(() => saveAuthSession({ token: 't' })).toThrow(ApiRequestError)
    expect(() => saveAuthSession({ user: {} })).toThrow(ApiRequestError)
  })

  it('saveAuthSession dispatches auth-changed event', () => {
    const handler = vi.fn()
    window.addEventListener('diabetes:auth-changed', handler)
    saveAuthSession({ token: 't', user: { id: 1 } })
    expect(handler).toHaveBeenCalled()
    window.removeEventListener('diabetes:auth-changed', handler)
  })

  it('updateStoredUser returns null when no user stored', () => {
    expect(updateStoredUser({ nickname: 'X' })).toBeNull()
  })

  it('updateStoredUser handles null/undefined patch', () => {
    saveAuthSession({ token: 't', user: { id: 1, nickname: 'Demo' } })
    const result = updateStoredUser(null)
    expect(result.nickname).toBe('Demo')
  })

  it('updateStoredUser merges partial data', () => {
    saveAuthSession({ token: 't', user: { id: 1, nickname: 'Demo', age: 20 } })
    const result = updateStoredUser({ nickname: 'New' })
    expect(result.nickname).toBe('New')
    expect(result.age).toBe(20)
  })

  it('clearAuthSession dispatches auth-changed with loggedIn false', () => {
    saveAuthSession({ token: 't', user: { id: 1 } })
    const handler = vi.fn()
    window.addEventListener('diabetes:auth-changed', handler)
    clearAuthSession()
    expect(handler).toHaveBeenCalled()
    expect(hasAuthSession()).toBe(false)
    window.removeEventListener('diabetes:auth-changed', handler)
  })
})

// ============================================================
// normalizeUserFacingMessage branches via apiGet
// ============================================================
describe('normalizeUserFacingMessage branches', () => {
  it('404 status → user-friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(404, 0))))
    await expect(apiGet('/api/x')).rejects.toThrow('你要找的内容暂时没找到')
  })

  it('40401 business code → user-friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 40401))))
    await expect(apiGet('/api/x')).rejects.toThrow('你要找的内容暂时没找到')
  })

  it('400 status → user-friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(400, 0))))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('40001 business code → user-friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 40001))))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('40002 business code → user-friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 40002))))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('40003 business code → user-friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 40003))))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('401 with specific message keeps original', async () => {
    saveAuthSession({ token: 't', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(401, 0, '账号或密码错误'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('账号或密码错误')
  })

  it('401 with generic token message → generic message', async () => {
    saveAuthSession({ token: 't', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(401, 0, 'Token已失效'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('登录状态已失效')
  })

  it('40101 business code with generic message', async () => {
    saveAuthSession({ token: 't', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(200, 40101, '未登录'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('登录状态已失效')
  })

  it('40101 clears auth session', async () => {
    saveAuthSession({ token: 't', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(200, 40101))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow(ApiRequestError)
    expect(hasAuthSession()).toBe(false)
  })

  it('403 status → permission message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(403, 0))))
    await expect(apiGet('/api/x')).rejects.toThrow('当前操作暂时不可用')
  })

  it('40301 business code → permission message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 40301))))
    await expect(apiGet('/api/x')).rejects.toThrow('当前操作暂时不可用')
  })

  it('40302 business code → permission message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 40302))))
    await expect(apiGet('/api/x')).rejects.toThrow('当前操作暂时不可用')
  })

  it('409 status → conflict message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(409, 0))))
    await expect(apiGet('/api/x')).rejects.toThrow('当前内容已发生变化')
  })

  it('40901 business code → conflict message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 40901))))
    await expect(apiGet('/api/x')).rejects.toThrow('当前内容已发生变化')
  })

  it('429 status → rate limit message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(429, 0))))
    await expect(apiGet('/api/x')).rejects.toThrow('操作太频繁了')
  })

  it('42901 business code → rate limit message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 42901))))
    await expect(apiGet('/api/x')).rejects.toThrow('操作太频繁了')
  })

  it('42902 business code → rate limit message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 42902))))
    await expect(apiGet('/api/x')).rejects.toThrow('操作太频繁了')
  })

  it('500 status → server error message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(500, 0))))
    await expect(apiGet('/api/x')).rejects.toThrow('服务暂时有点忙')
  })

  it('50001 business code → server error message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 50001))))
    await expect(apiGet('/api/x')).rejects.toThrow('服务暂时有点忙')
  })

  it('50002 business code → server error message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 50002))))
    await expect(apiGet('/api/x')).rejects.toThrow('服务暂时有点忙')
  })

  it('50201 business code → server error message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(200, 50201))))
    await expect(apiGet('/api/x')).rejects.toThrow('服务暂时有点忙')
  })

  it('unknown status without message → default message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(failWithCode(418, 0, ''))))
    await expect(apiGet('/api/x')).rejects.toThrow('请求失败，HTTP 状态码：418')
  })

  it('raw message with "参数错误" → remapped', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(418, 0, '参数错误：缺少字段'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('raw message with "not found" → remapped', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(418, 0, 'Resource not found'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('raw message with "invalid" → remapped', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(418, 0, 'Invalid request'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('raw message with "bad request" → remapped', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(418, 0, 'Bad Request format'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('raw message with "404" → remapped', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(418, 0, 'Error 404 occurred'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('提交的信息不完整或格式不对')
  })

  it('plain raw message passed through', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(418, 0, 'Custom server error'))
    ))
    await expect(apiGet('/api/x')).rejects.toThrow('Custom server error')
  })
})

// ============================================================
// handleApiResult branch: non-zero code in success response
// ============================================================
describe('handleApiResult edge cases', () => {
  it('payload with code=0 and data=null', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 0, data: null }), { status: 200 }))
    ))
    const result = await apiGet('/api/x')
    // data=null is nullish, so ?? falls through to payload
    expect(result.data).toEqual({ code: 0, data: null })
    expect(result.code).toBe(0)
  })

  it('payload without code field treats data as payload', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ items: [1, 2] }), { status: 200 }))
    ))
    const result = await apiGet('/api/x')
    expect(result.data).toEqual({ items: [1, 2] })
  })

  it('payload null with 200 status', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response('null', { status: 200 }))
    ))
    const result = await apiGet('/api/x')
    expect(result.code).toBe(0)
    expect(result.data).toBeNull()
  })

  it('empty response body', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response('', { status: 200 }))
    ))
    const result = await apiGet('/api/x')
    expect(result.data).toBeNull()
  })

  it('non-JSON response body', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response('plain text response', { status: 200 }))
    ))
    const result = await apiGet('/api/x')
    expect(result.data).toBe('plain text response')
  })
})

// ============================================================
// apiRequest option branches
// ============================================================
describe('apiRequest option branches', () => {
  it('builds URL with absolute path (no leading slash)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiGet('api/demo')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/demo'),
      expect.any(Object),
    )
  })

  it('builds URL with absolute http URL', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiGet('https://external.example.com/api/data')
    expect(fetch).toHaveBeenCalledWith(
      'https://external.example.com/api/data',
      expect.any(Object),
    )
  })

  it('sends request without auth token when auth=false', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiPost('/api/public', { x: 1 }, { auth: false })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.get('Authorization')).toBeNull()
  })

  it('sends request with auth token when authenticated', async () => {
    saveAuthSession({ token: 'my-token', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiGet('/api/private')
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.get('Authorization')).toBe('Bearer my-token')
  })

  it('adds Idempotency-Key for POST with idempotent=true', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiPost('/api/demo', { a: 1 }, { idempotent: true })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.has('Idempotency-Key')).toBe(true)
  })

  it('adds Idempotency-Key for PUT with idempotent=true', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiPut('/api/demo/1', { a: 1 }, { idempotent: true })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.has('Idempotency-Key')).toBe(true)
  })

  it('adds Idempotency-Key for PATCH with idempotent=true', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiPatch('/api/demo/1', { a: 1 }, { idempotent: true })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.has('Idempotency-Key')).toBe(true)
  })

  it('adds Idempotency-Key for DELETE with idempotent=true', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiDelete('/api/demo/1', { idempotent: true })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.has('Idempotency-Key')).toBe(true)
  })

  it('does not add Idempotency-Key for GET', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiGet('/api/demo', { idempotent: true })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.has('Idempotency-Key')).toBe(false)
  })

  it('respects pre-set Idempotency-Key header', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiPost('/api/demo', { a: 1 }, {
      idempotent: true,
      headers: { 'Idempotency-Key': 'pre-set-key' },
    })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.get('Idempotency-Key')).toBe('pre-set-key')
  })

  it('handles AbortError from fetch', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    )))
    await expect(apiGet('/api/x', { signal: controller.signal }))
      .rejects.toThrow()
  })

  it('handles network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network'))))
    await expect(apiGet('/api/x')).rejects.toThrow('无法连接后端服务')
  })

  it('apiRequest with FormData body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ file_id: 'f1' }))))
    const formData = new FormData()
    formData.append('file', new File(['a'], 'a.txt'))
    await apiPost('/api/upload', formData)
    const callBody = fetch.mock.calls[0][1].body
    expect(callBody instanceof FormData).toBe(true)
  })

  it('apiRequest with URLSearchParams body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    const params = new URLSearchParams({ key: 'value' })
    await apiPost('/api/search', params)
    const callBody = fetch.mock.calls[0][1].body
    expect(callBody instanceof URLSearchParams).toBe(true)
  })

  it('apiRequest skips body for undefined data', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiGet('/api/demo')
    const callOptions = fetch.mock.calls[0][1]
    expect(callOptions.body).toBeUndefined()
  })
})

// ============================================================
// createIdempotencyKey fallback (without crypto.randomUUID)
// ============================================================
describe('createIdempotencyKey fallback', () => {
  it('generates key without crypto.randomUUID', async () => {
    const originalCrypto = globalThis.crypto
    // Remove randomUUID to force fallback
    const mockCrypto = {
      getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto),
    }
    vi.stubGlobal('crypto', mockCrypto)

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    await apiPost('/api/demo', { a: 1 }, { idempotent: true })

    const callHeaders = fetch.mock.calls[0][1].headers
    const key = callHeaders.get('Idempotency-Key')
    expect(key).toBeTruthy()
    expect(key).toMatch(/^idem_/)

    vi.stubGlobal('crypto', originalCrypto)
  })
})

// ============================================================
// authorizedFetch branches
// ============================================================
describe('authorizedFetch', () => {
  it('returns raw fetch response', async () => {
    const response = ok({ value: 1 })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)))
    const result = await authorizedFetch('/api/raw')
    expect(result instanceof Response).toBe(true)
    const json = await result.json()
    expect(json.data.value).toBe(1)
  })

  it('adds auth header when authenticated', async () => {
    saveAuthSession({ token: 'tok', user: { id: 1 } })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({}))))
    await authorizedFetch('/api/raw', { method: 'POST' })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.get('Authorization')).toBe('Bearer tok')
  })

  it('skips auth when auth=false', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({}))))
    await authorizedFetch('/api/raw', { auth: false })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.get('Authorization')).toBeNull()
  })

  it('adds Idempotency-Key when idempotent=true', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({}))))
    await authorizedFetch('/api/raw', { method: 'POST', idempotent: true })
    const callHeaders = fetch.mock.calls[0][1].headers
    expect(callHeaders.has('Idempotency-Key')).toBe(true)
  })

  it('handles AbortError', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    )))
    await expect(authorizedFetch('/api/raw')).rejects.toThrow()
  })

  it('handles network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('fail'))))
    await expect(authorizedFetch('/api/raw')).rejects.toThrow('无法连接后端服务')
  })

  it('sends FormData body via authorizedFetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({}))))
    const fd = new FormData()
    fd.append('f', new File(['x'], 'x.txt'))
    await authorizedFetch('/api/upload', { method: 'POST', body: fd })
    const callBody = fetch.mock.calls[0][1].body
    expect(callBody instanceof FormData).toBe(true)
  })
})

// ============================================================
// pollWorkflowRun timeout
// ============================================================
describe('pollWorkflowRun timeout', () => {
  it('throws timeout when workflow never completes', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(ok({ status: 'running' })),
    ))

    const promise = pollWorkflowRun('rid', { intervalMs: 10, timeoutMs: 50 })
    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(60)
    // Flush any pending microtasks
    await Promise.resolve()

    await expect(promise).rejects.toThrow('仍在处理中')
    vi.useRealTimers()
  })

  it('aborts mid-delay to cover signal listener', async () => {
    vi.useFakeTimers()
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn(() => {
      callCount++
      return Promise.resolve(ok({ status: 'running' }))
    }))

    const controller = new AbortController()
    const promise = pollWorkflowRun('rid', { intervalMs: 100, timeoutMs: 5000, signal: controller.signal })

    // Advance past first fetch + start of setTimeout
    await vi.advanceTimersByTimeAsync(110)
    // Now abort during the setTimeout delay
    controller.abort()
    // Advance to trigger the abort rejection
    await vi.advanceTimersByTimeAsync(10)

    await expect(promise).rejects.toThrow('Aborted')
    vi.useRealTimers()
  })

  it('throws for empty requestId', async () => {
    await expect(pollWorkflowRun('')).rejects.toThrow('缺少 workflow request_id')
  })

  it('throws for undefined requestId', async () => {
    await expect(pollWorkflowRun(null)).rejects.toThrow('缺少 workflow request_id')
  })
})

// ============================================================
// dispatchAuthExpiredEvent via 401 response
// ============================================================
describe('auth expired event', () => {
  it('dispatches diabetes:auth-expired on 401', async () => {
    saveAuthSession({ token: 't', user: { id: 1 } })
    const handler = vi.fn()
    window.addEventListener('diabetes:auth-expired', handler)

    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(failWithCode(401, 0, 'Token失效')),
    ))
    await expect(apiGet('/api/x')).rejects.toThrow(ApiRequestError)
    expect(handler).toHaveBeenCalled()
    window.removeEventListener('diabetes:auth-expired', handler)
  })
})
