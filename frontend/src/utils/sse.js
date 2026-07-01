function safeJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function consumeSseStream(response, handlers = {}) {
  const reader = response.body?.getReader?.()

  if (!reader) {
    throw new Error('当前响应不支持流式读取。')
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
    dataLines = []

    if (rawData.trim() === '[DONE]') {
      eventName = 'message'
      return
    }

    const payload = safeJson(rawData) || {
      answer: rawData,
    }
    const eventType = payload.event || eventName

    await handlers.onEvent?.(eventType, payload, rawData)

    if (eventType === 'message') {
      await handlers.onMessage?.(payload, rawData)
    } else if (eventType === 'message_end') {
      await handlers.onMessageEnd?.(payload, rawData)
    } else if (eventType === 'error') {
      await handlers.onError?.(payload, rawData)
    }

    eventName = 'message'
  }

  async function processLine(line) {
    if (line === '') {
      await emitEvent()
      return
    }

    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || 'message'
      return
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  while (true) {
    const { done, value } = await reader.read()

    buffer += decoder.decode(value || new Uint8Array(), {
      stream: !done,
    })

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
