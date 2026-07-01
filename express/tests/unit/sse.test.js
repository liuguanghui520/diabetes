import { describe, expect, it, vi } from 'vitest'
import { proxyDifySse, writeSse } from '../../src/modules/assistant/sse.js'

function createMockResponse(events) {
  const text = events.map(([evt, data]) => {
    const lines = [`event: ${evt}`, `data: ${JSON.stringify(data)}`, '']
    return lines.join('\n')
  }).join('\n')

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function createMockRes() {
  const chunks = []
  return {
    chunks,
    destroyed: false,
    writableEnded: false,
    write(chunk) {
      chunks.push(chunk)
      return true
    },
    flush() {},
    on() {},
    off() {},
    end() {
      this.writableEnded = true
    },
  }
}

describe('proxyDifySse', () => {
  it('forwards message deltas', async () => {
    const response = createMockResponse([
      ['message', { event: 'message', answer: 'Hello' }],
      ['message_end', { event: 'message_end', conversation_id: 'c1', message_id: 'm1' }],
    ])

    const res = createMockRes()
    const deltas = []
    let endCalled = false

    await proxyDifySse({
      response,
      res,
      onDelta(d) {
        deltas.push(d)
      },
      async onEnd(e) {
        endCalled = true
      },
    })

    expect(deltas).toEqual(['Hello'])
    expect(endCalled).toBe(true)
    const output = res.chunks.join('')
    expect(output).toContain('event: message')
    expect(output).toContain('"delta":"Hello"')
    // message_end is handled by onEnd callback, not forwarded as SSE event
  })

  it('forwards error events from Dify stream', async () => {
    const response = createMockResponse([
      ['message', { event: 'message', answer: 'partial...' }],
      ['error', { event: 'error', message: 'Dify internal error' }],
    ])

    const res = createMockRes()
    let errorReceived = null

    await proxyDifySse({
      response,
      res,
      onDelta() {},
      onError(data) {
        errorReceived = data
      },
    })

    expect(errorReceived).toBeTruthy()
    expect(errorReceived.message).toBe('Dify internal error')
    const output = res.chunks.join('')
    expect(output).toContain('event: error')
  })

  it('handles [DONE] signal', async () => {
    const response = createMockResponse([
      ['message', { event: 'message', answer: 'done' }],
    ])
    // Append [DONE] manually
    const text = 'data: [DONE]\n\n'
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    })
    const doneResponse = new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    })

    const res = createMockRes()
    await proxyDifySse({
      response: doneResponse,
      res,
      onDelta() {},
    })

    // Should not throw on [DONE]
  })

  it('handles empty stream gracefully', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })
    const response = new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    })

    const res = createMockRes()
    await proxyDifySse({
      response,
      res,
      onDelta() {},
    })

    // Should not throw
  })
})

describe('writeSse', () => {
  it('writes SSE formatted event', () => {
    const res = createMockRes()
    const ok = writeSse(res, 'test', { key: 'val' })
    expect(ok).toBe(true)
    const output = res.chunks.join('')
    expect(output).toBe('event: test\ndata: {"key":"val"}\n\n')
  })

  it('returns false when response is destroyed', () => {
    const res = createMockRes()
    res.destroyed = true
    expect(writeSse(res, 'test', {})).toBe(false)
  })

  it('returns false when response has ended', () => {
    const res = createMockRes()
    res.writableEnded = true
    expect(writeSse(res, 'test', {})).toBe(false)
  })
})
