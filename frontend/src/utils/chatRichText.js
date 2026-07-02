import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const defaultLinkOpen =
  markdown.renderer.rules.link_open
  || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/* istanbul ignore next — default param never triggered internally */
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function findOpenTag(source, lowerSource, startIndex) {
  const tags = [
    { open: '<think>', close: '</think>' },
    { open: '<thinking>', close: '</thinking>' },
  ]

  let matched = null

  for (const tag of tags) {
    const index = lowerSource.indexOf(tag.open, startIndex)

    if (index === -1) {
      continue
    }

    if (!matched || index < matched.index) {
      matched = {
        index,
        open: source.slice(index, index + tag.open.length),
        close: tag.close,
      }
    }
  }

  return matched
}

export function extractThinkingBlocks(raw = '') {
  const source = String(raw || '')
  const lowerSource = source.toLowerCase()
  const thinking = []
  const answerParts = []

  let cursor = 0
  let currentThinking = ''
  let activeCloseTag = null

  while (cursor < source.length) {
    if (!activeCloseTag) {
      const tag = findOpenTag(source, lowerSource, cursor)

      if (!tag) {
        answerParts.push(source.slice(cursor))
        break
      }

      answerParts.push(source.slice(cursor, tag.index))
      activeCloseTag = tag.close
      currentThinking = ''
      cursor = tag.index + tag.open.length
      continue
    }

    const closeIndex = lowerSource.indexOf(activeCloseTag, cursor)

    if (closeIndex === -1) {
      currentThinking += source.slice(cursor)
      cursor = source.length
      break
    }

    currentThinking += source.slice(cursor, closeIndex)

    const text = currentThinking.trim()
    if (text) {
      thinking.push(text)
    }

    cursor = closeIndex + activeCloseTag.length
    currentThinking = ''
    activeCloseTag = null
  }

  if (currentThinking.trim()) {
    thinking.push(currentThinking.trim())
  }

  const cleanText = answerParts
    .join('')
    .replace(/<\/think>/gi, '')
    .replace(/<\/thinking>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    cleanText,
    thinking,
    hasOpenThinking: Boolean(activeCloseTag),
  }
}

export function renderChatHtml(raw = '') {
  const { cleanText, thinking, hasOpenThinking } = extractThinkingBlocks(raw)
  const safeThinking = thinking.map((item) => escapeHtml(item))
  const answerHtml = markdown.render(cleanText || '生成中…')
  const thinkingHtml = safeThinking.length
    ? `
      <details class="chat-thinking"${hasOpenThinking ? ' open' : ''}>
        <summary class="chat-thinking-title">${hasOpenThinking ? '正在思考' : '思考过程'}</summary>
        <div class="chat-thinking-body">
          ${safeThinking.map((item) => `<pre>${item}</pre>`).join('')}
        </div>
      </details>
    `
    : ''

  return {
    html: DOMPurify.sanitize(`
      <div class="chat-rich-content">
        ${thinkingHtml}
        <div class="chat-answer">${answerHtml}</div>
      </div>
    `),
    plainText: cleanText || '',
    thinking,
    hasOpenThinking,
  }
}
