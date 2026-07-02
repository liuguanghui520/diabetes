import { describe, expect, it } from 'vitest'
import { extractThinkingBlocks, renderChatHtml } from '../../utils/chatRichText'
import { consumeSseStream } from '../../utils/sse'

// ============================================================
// chatRichText — extractThinkingBlocks
// ============================================================
describe('extractThinkingBlocks', () => {
  it('handles empty / undefined / null input', () => {
    const empty = extractThinkingBlocks()
    expect(empty.cleanText).toBe('')
    expect(empty.thinking).toEqual([])
    expect(empty.hasOpenThinking).toBe(false)

    const nil = extractThinkingBlocks(null)
    expect(nil.cleanText).toBe('')
    expect(nil.thinking).toEqual([])

    const undef = extractThinkingBlocks(undefined)
    expect(undef.cleanText).toBe('')
    expect(undef.thinking).toEqual([])
  })

  it('returns text unchanged when no tags present', () => {
    const result = extractThinkingBlocks('Plain text without any tags.')
    expect(result.cleanText).toBe('Plain text without any tags.')
    expect(result.thinking).toEqual([])
    expect(result.hasOpenThinking).toBe(false)
  })

  it('extracts a single <think> block', () => {
    const result = extractThinkingBlocks('<think>reasoning here</think>answer text')
    expect(result.thinking).toEqual(['reasoning here'])
    expect(result.cleanText).toBe('answer text')
    expect(result.hasOpenThinking).toBe(false)
  })

  it('extracts <thinking> tag variant', () => {
    const result = extractThinkingBlocks('<thinking>analysis</thinking>result')
    expect(result.thinking).toEqual(['analysis'])
    expect(result.cleanText).toBe('result')
  })

  it('extracts multiple think blocks in order', () => {
    const result = extractThinkingBlocks(
      '<think>first</think>text1<think>second</think>text2',
    )
    expect(result.thinking).toEqual(['first', 'second'])
    expect(result.cleanText).toBe('text1text2')
  })

  it('detects open thinking tag without close', () => {
    const result = extractThinkingBlocks('<think>incomplete reasoning')
    expect(result.thinking).toEqual(['incomplete reasoning'])
    expect(result.hasOpenThinking).toBe(true)
  })

  it('detects open <thinking> tag without close', () => {
    const result = extractThinkingBlocks('<thinking>working on it')
    expect(result.thinking).toEqual(['working on it'])
    expect(result.hasOpenThinking).toBe(true)
  })

  it('handles nested-like tags (picks nearest open)', () => {
    const result = extractThinkingBlocks(
      '<think>outer <think>inner</think> outer</think>',
    )
    // The first <think> opens, then <think> inside is treated as text,
    // then </think> closes the outer, then </think> is stripped
    expect(result.thinking.length).toBeGreaterThanOrEqual(1)
  })

  it('strips orphan close tags from clean text', () => {
    const result = extractThinkingBlocks('</think>text</thinking>more')
    expect(result.cleanText).toBe('textmore')
  })

  it('collapses 3+ consecutive newlines into double', () => {
    const result = extractThinkingBlocks('line1\n\n\n\nline2')
    expect(result.cleanText).toBe('line1\n\nline2')
  })

  it('handles case-insensitive tags', () => {
    const result = extractThinkingBlocks('<THINK>upper</THINK>text')
    expect(result.thinking).toEqual(['upper'])
    expect(result.cleanText).toBe('text')
  })

  it('handles mixed <think> and <thinking> tags', () => {
    const result = extractThinkingBlocks(
      '<think>step1</think>mid<thinking>step2</thinking>end',
    )
    expect(result.thinking).toEqual(['step1', 'step2'])
    expect(result.cleanText).toBe('midend')
  })

  it('handles text before first tag', () => {
    const result = extractThinkingBlocks('prefix<think>inner</think>suffix')
    expect(result.thinking).toEqual(['inner'])
    expect(result.cleanText).toBe('prefixsuffix')
  })

  it('handles empty thinking blocks (whitespace only)', () => {
    const result = extractThinkingBlocks('<think>  </think>text')
    expect(result.thinking).toEqual([])
    expect(result.cleanText).toBe('text')
  })

  it('handles tag with no content at all', () => {
    const result = extractThinkingBlocks('<think></think>text')
    expect(result.thinking).toEqual([])
    expect(result.cleanText).toBe('text')
  })
})

// ============================================================
// chatRichText — renderChatHtml
// ============================================================
describe('renderChatHtml', () => {
  it('handles empty input', () => {
    const result = renderChatHtml('')
    expect(result.html).toContain('chat-rich-content')
    expect(result.html).toContain('生成中…')
    expect(result.thinking).toEqual([])
    expect(result.hasOpenThinking).toBe(false)
    expect(result.plainText).toBe('')
  })

  it('handles undefined input', () => {
    const result = renderChatHtml()
    expect(result.html).toContain('chat-rich-content')
    expect(result.plainText).toBe('')
  })

  it('renders markdown to HTML', () => {
    const result = renderChatHtml('**bold** and *italic*')
    expect(result.html).toContain('<strong>bold</strong>')
    expect(result.html).toContain('<em>italic</em>')
  })

  it('renders links with rel=noopener noreferrer', () => {
    const result = renderChatHtml('[link](https://example.com)')
    // DOMPurify may strip target but preserves rel
    expect(result.html).toContain('rel="noopener noreferrer"')
    expect(result.html).toContain('https://example.com')
  })

  it('sanitizes script tags', () => {
    const result = renderChatHtml('<script>alert("xss")</script>text')
    // Script tags are HTML-escaped, not removed
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).toContain('text')
  })

  it('wraps thinking blocks in details element', () => {
    const result = renderChatHtml('<think>hidden</think>answer')
    expect(result.html).toContain('chat-thinking')
    expect(result.html).toContain('思考过程')
    expect(result.thinking).toEqual(['hidden'])
  })

  it('shows "正在思考" for open thinking block', () => {
    const result = renderChatHtml('<think>still going')
    expect(result.html).toContain('正在思考')
    expect(result.hasOpenThinking).toBe(true)
  })

  it('renders code blocks in markdown', () => {
    const result = renderChatHtml('```js\nconst x = 1;\n```')
    expect(result.html).toContain('<code')
    expect(result.html).toContain('const x = 1')
  })

  it('handles complex markdown with tables', () => {
    const result = renderChatHtml('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(result.html).toContain('<table')
    expect(result.html).toContain('<td>1</td>')
  })

  it('no thinking block → no details element', () => {
    const result = renderChatHtml('plain text without thinking')
    expect(result.html).not.toContain('chat-thinking')
    expect(result.thinking).toEqual([])
  })

  it('multiple thinking blocks rendered', () => {
    const result = renderChatHtml(
      '<think>step1</think>mid<think>step2</think>end',
    )
    expect(result.thinking).toEqual(['step1', 'step2'])
    // Each thinking block gets its own <pre>
    const preCount = (result.html.match(/<pre>/g) || []).length
    expect(preCount).toBe(2)
  })

  it('escapes HTML in thinking blocks', () => {
    const result = renderChatHtml('<think><script>x</script></think>text')
    // The thinking block should have escaped HTML
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('renders plain text for non-markdown content', () => {
    const result = renderChatHtml('just some text')
    expect(result.plainText).toBe('just some text')
    expect(result.html).toContain('chat-rich-content')
  })
})

// ============================================================
// SSE — consumeSseStream detailed
// ============================================================
describe('consumeSseStream detailed', () => {
  function sseResponse(chunks) {
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  it('handles stream with only event type changes', async () => {
    const events = []
    await consumeSseStream(
      sseResponse([
        'event: custom_event\n',
        'data: {"key":"value"}\n\n',
        'event: message\n',
        'data: {"delta":"hello"}\n\n',
      ]),
      {
        onEvent: (event) => events.push(event),
        onMessage: () => {},
      },
    )
    expect(events).toContain('custom_event')
    expect(events).toContain('message')
  })

  it('handles payload.event override', async () => {
    const events = []
    await consumeSseStream(
      sseResponse([
        'event: message\n',
        'data: {"event":"override_event","value":1}\n\n',
      ]),
      {
        onEvent: (event) => events.push(event),
        onMessage: () => {},
      },
    )
    expect(events).toContain('override_event')
  })

  it('handles [DONE] marker with event reset', async () => {
    const messages = []
    await consumeSseStream(
      sseResponse([
        'data: {"delta":"last"}\n\n',
        'data: [DONE]\n\n',
        'data: {"delta":"should not appear"}\n\n',
      ]),
      {
        onMessage: (data) => messages.push(data.delta),
      },
    )
    expect(messages).toContain('last')
    expect(messages).toContain('should not appear')
  })

  it('handles empty line between events', async () => {
    const messages = []
    await consumeSseStream(
      sseResponse([
        'data: {"delta":"a"}\n\n',
        '\n',
        'data: {"delta":"b"}\n\n',
      ]),
      {
        onMessage: (data) => messages.push(data.delta),
      },
    )
    expect(messages).toEqual(['a', 'b'])
  })

  it('handles data without event prefix', async () => {
    const messages = []
    await consumeSseStream(
      sseResponse(['data: plain text without json\n\n']),
      {
        onEvent: () => {},
        onMessage: (data) => messages.push(data.answer),
      },
    )
    expect(messages).toEqual(['plain text without json'])
  })

  it('handles multiline data (multiple data: lines)', async () => {
    const messages = []
    await consumeSseStream(
      sseResponse([
        'data: {"delta":"line1"}\n',
        'data: {"delta":"line2"}\n\n',
      ]),
      {
        onMessage: (data) => messages.push(data),
      },
    )
    // Two data lines joined by newline, parsed as JSON
    // The JSON parse of "{\"delta\":\"line1\"}\n{\"delta\":\"line2\"}" will fail,
    // so the fallback { answer: rawData } is used
    expect(messages.length).toBe(1)
  })

  it('handles chunk split mid-line', async () => {
    const encoder = new TextEncoder()
    const messages = []

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"del'))
          controller.enqueue(encoder.encode('ta":"splitted"}\n\n'))
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )

    await consumeSseStream(response, {
      onMessage: (data) => messages.push(data.delta),
    })
    expect(messages).toEqual(['splitted'])
  })

  it('handles lines with \\r\\n endings', async () => {
    const encoder = new TextEncoder()
    const messages = []

    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"delta":"crlf"}\r\n\r\n'),
          )
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )

    await consumeSseStream(response, {
      onMessage: (data) => messages.push(data.delta),
    })
    expect(messages).toEqual(['crlf'])
  })

  it('handles error event type', async () => {
    const errors = []
    await consumeSseStream(
      sseResponse([
        'event: error\n',
        'data: {"message":"something went wrong"}\n\n',
      ]),
      {
        onError: (data) => errors.push(data.message),
        onMessage: () => {},
      },
    )
    expect(errors).toEqual(['something went wrong'])
  })

  it('handles message_end event', async () => {
    const endData = []
    await consumeSseStream(
      sseResponse([
        'event: message_end\n',
        'data: {"conversation_id":"conv-99"}\n\n',
      ]),
      {
        onMessageEnd: (data) => endData.push(data.conversation_id),
        onMessage: () => {},
      },
    )
    expect(endData).toEqual(['conv-99'])
  })

  it('throws for response without body', async () => {
    // A 204 No Content response has null body
    await expect(
      consumeSseStream(new Response(null, { status: 204 })),
    ).rejects.toThrow('不支持流式读取')
  })

  it('handles stream with only empty lines', async () => {
    await expect(
      consumeSseStream(sseResponse(['\n', '\n'])),
    ).resolves.toBeUndefined()
  })

  it('calls onEvent for each event with correct arguments', async () => {
    const calls = []
    await consumeSseStream(
      sseResponse(['data: {"delta":"x"}\n\n']),
      {
        onEvent: (type, payload, raw) =>
          calls.push({ type, hasPayload: !!payload, hasRaw: !!raw }),
        onMessage: () => {},
      },
    )
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0].type).toBe('message')
  })

  it('handles graceful stream close with trailing buffer', async () => {
    const encoder = new TextEncoder()
    const messages = []
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"delta":"trailing"}'))
          // Stream ends without \n\n — trailing buffer should be processed
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
    await consumeSseStream(response, {
      onMessage: (data) => messages.push(data.delta),
    })
    expect(messages).toContain('trailing')
  })

  it('handles event: with empty name (falls back to message)', async () => {
    const events = []
    await consumeSseStream(
      sseResponse([
        'event:\n',
        'data: {"delta":"test"}\n\n',
      ]),
      {
        onEvent: (event) => events.push(event),
        onMessage: () => {},
      },
    )
    expect(events).toContain('message')
  })
})
