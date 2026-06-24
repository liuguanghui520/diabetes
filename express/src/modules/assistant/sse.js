import { safeJson } from '../../utils/json.js'

export function writeSse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export async function proxyDifySse({ response, res, onDelta, onEnd, onError }) {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('Dify SSE response body is unavailable')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let dataLines = []

  async function emitEvent() {
    if (dataLines.length === 0) {
      eventName = 'message'
      return
    }

    const rawData = dataLines.join('\n')

    if (rawData.trim() === '[DONE]') {
      eventName = 'message'
      dataLines = []
      return
    }

    const parsed = safeJson(rawData, { answer: rawData })
    const eventType = parsed.event || eventName

    if (eventType === 'message') {
      const delta = parsed.answer || parsed.delta || parsed.content || ''

      if (delta) {
        await onDelta?.(delta, parsed)
        writeSse(res, 'message', { delta })
      }
    } else if (eventType === 'message_end') {
      await onEnd?.(parsed)
    } else if (eventType === 'error') {
      await onError?.(parsed)
      writeSse(res, 'error', {
        message: parsed.message || 'AI 服务暂时不可用'
      })
    }

    eventName = 'message'
    dataLines = []
  }

  function processLine(line) {
    if (line === '') {
      return emitEvent()
    }

    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || 'message'
      return Promise.resolve()
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }

    return Promise.resolve()
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const line of lines) {
      await processLine(line)
    }

    if (done) {
      if (buffer) {
        await processLine(buffer.replace(/\r$/, ''))
        buffer = ''
      }

      await emitEvent()
      break
    }
  }
}
