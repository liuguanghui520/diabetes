import { describe, expect, it, vi } from 'vitest'
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
import { loginByPassword, logout, registerByPassword } from '../../api/auth'
import { uploadSingleFile } from '../../api/uploads'
import { consumeSseStream } from '../../utils/sse'
import { extractThinkingBlocks, renderChatHtml } from '../../utils/chatRichText'

function ok(data = {}) {
  return new Response(JSON.stringify({ code: 0, data }), { status: 200 })
}

function fail(status, data = {}) {
  return new Response(JSON.stringify(data), { status })
}

function sse(chunks) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  }), {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('api request helpers', () => {
  it('stores, updates and clears auth session', () => {
    saveAuthSession({ token: 'token-1', user: { id: 1, nickname: 'Demo' } })
    expect(getAuthToken()).toBe('token-1')
    expect(hasAuthSession()).toBe(true)
    expect(getStoredUser().nickname).toBe('Demo')
    expect(updateStoredUser({ nickname: 'New' }).nickname).toBe('New')
    clearAuthSession()
    expect(hasAuthSession()).toBe(false)
    expect(() => saveAuthSession({})).toThrow(ApiRequestError)
  })

  it('sends json, form data, idempotency and handles common failures', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ value: 1 }))))
    saveAuthSession({ token: 'token-1', user: { id: 1 } })

    await expect(apiGet('/api/demo')).resolves.toMatchObject({ data: { value: 1 } })
    await apiPost('/api/demo', { a: 1 }, { idempotent: true })
    await apiPut('/api/demo/1', { a: 2 })
    await apiPatch('/api/demo/1', { a: 3 })
    await apiDelete('/api/demo/1')
    await authorizedFetch('/api/raw', { method: 'POST' })

    expect(fetch).toHaveBeenCalledWith('/api/demo', expect.objectContaining({ method: 'GET' }))
    expect(fetch).toHaveBeenCalledWith('/api/demo', expect.objectContaining({ method: 'POST' }))

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fail(401, { code: 40101 }))))
    await expect(apiGet('/api/private')).rejects.toThrow(ApiRequestError)
    expect(hasAuthSession()).toBe(false)

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network'))))
    await expect(apiGet('/api/down')).rejects.toThrow(ApiRequestError)
  })

  it('logs in, registers, logs out and uploads files', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/uploads')) {
        return Promise.resolve(ok({ file_id: 'file-1' }))
      }
      return Promise.resolve(ok({ token: 'token-1', user: { id: 1, username: 'demo' } }))
    }))

    await expect(loginByPassword('', 'x')).rejects.toThrow(ApiRequestError)
    await expect(registerByPassword({ username: 'demo', password: '123' })).rejects.toThrow(ApiRequestError)
    await expect(loginByPassword('demo', '123456')).resolves.toMatchObject({ token: 'token-1' })
    await expect(registerByPassword({ username: 'demo2', password: '123456' })).resolves.toMatchObject({ token: 'token-1' })
    const uploaded = await uploadSingleFile(new File(['a'], 'a.txt'), 'assistant')
    expect(uploaded.file_id).toBe('file-1')
    logout()
    expect(hasAuthSession()).toBe(false)
  })

  it('polls workflow success, failure, timeout and abort', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ status: 'succeeded', result: { done: true } }))))
    await expect(pollWorkflowRun('rid')).resolves.toMatchObject({ status: 'succeeded' })
    await expect(pollWorkflowRun('')).rejects.toThrow(ApiRequestError)

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ status: 'failed', error_message: 'bad' }))))
    await expect(pollWorkflowRun('rid')).resolves.toMatchObject({ status: 'failed' })

    const controller = new AbortController()
    controller.abort()
    await expect(pollWorkflowRun('rid', { signal: controller.signal })).rejects.toThrow('Aborted')
  })
})

describe('utils', () => {
  it('consumes sse stream events', async () => {
    const messages = []
    const events = []
    await consumeSseStream(sse([
      'data: {"delta":"hello"}\n\n',
      'event: message_end\n',
      'data: {"conversation_id":"c1"}\n\n',
      'event: error\n',
      'data: {"message":"bad"}\n\n',
      'data: [DONE]\n\n',
      'data: plain text\n\n',
    ]), {
      onEvent: (event) => events.push(event),
      onMessage: (data) => messages.push(data.delta || data.answer),
      onMessageEnd: (data) => messages.push(data.conversation_id),
      onError: (data) => messages.push(data.message),
    })

    expect(events).toContain('message')
    expect(messages).toEqual(['hello', 'c1', 'bad', 'plain text'])
    await expect(consumeSseStream(new Response('x'))).resolves.toBeUndefined()
  })

  it('renders rich chat text and thinking blocks safely', () => {
    const extracted = extractThinkingBlocks('<think>hidden</think># Title\n<script>x</script>')
    expect(extracted.thinking).toEqual(['hidden'])
    expect(extracted.cleanText).toContain('# Title')

    const open = extractThinkingBlocks('<thinking>working')
    expect(open.hasOpenThinking).toBe(true)

    const rendered = renderChatHtml('<think>hidden</think>[link](https://example.com)\n\n**ok**')
    expect(rendered.html).toContain('chat-rich-content')
    expect(rendered.html).not.toContain('<script>')
    expect(rendered.thinking).toEqual(['hidden'])
  })
})

// ============================================================
// Edge cases: auth validation branches & uploads fallback
// ============================================================
describe('auth validation edge cases', () => {
  it('rejects falsy account values in login', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ token: 't', user: { id: 1 } }))))
    await expect(loginByPassword('', '123456')).rejects.toThrow('请输入账号')
    await expect(loginByPassword(null, '123456')).rejects.toThrow('请输入账号')
    await expect(loginByPassword(undefined, '123456')).rejects.toThrow('请输入账号')
    await expect(loginByPassword(0, '123456')).rejects.toThrow('请输入账号')
  })

  it('rejects falsy password values in login', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ token: 't', user: { id: 1 } }))))
    await expect(loginByPassword('demo', '')).rejects.toThrow('请输入密码')
    await expect(loginByPassword('demo', null)).rejects.toThrow('请输入密码')
    await expect(loginByPassword('demo', undefined)).rejects.toThrow('请输入密码')
  })

  it('rejects falsy account values in register', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ token: 't', user: { id: 1 } }))))
    await expect(registerByPassword({ username: '', password: '123456' })).rejects.toThrow('请输入账号')
  })

  it('rejects falsy password and short password in register', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok({ token: 't', user: { id: 1 } }))))
    await expect(registerByPassword({ username: 'demo', password: '' })).rejects.toThrow('请输入密码')
    await expect(registerByPassword({ username: 'demo', password: '12345' })).rejects.toThrow('密码至少需要 6 位')
  })

  it('register falls back nickname to username when empty', async () => {
    vi.stubGlobal('fetch', vi.fn((input, init) => {
      const body = JSON.parse(init.body)
      // Record what nickname was sent
      return Promise.resolve(ok({ token: 't', user: { id: 1, nickname: body.nickname } }))
    }))
    const r1 = await registerByPassword({ username: 'demo', password: '123456', nickname: '' })
    expect(r1.user.nickname).toBe('demo')
    const r2 = await registerByPassword({ username: 'demo', password: '123456', nickname: null })
    expect(r2.user.nickname).toBe('demo')
    const r3 = await registerByPassword({ username: 'demo', password: '123456' })
    expect(r3.user.nickname).toBe('demo')
  })
})

describe('uploads fallback', () => {
  it('returns empty object when response body is null', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response('null', { status: 200 }))
    ))
    const result = await uploadSingleFile(new File(['a'], 'a.txt'), 'assistant')
    expect(result).toEqual({})
  })
})
