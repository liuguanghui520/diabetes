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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function extractThinkingBlocks(raw = '') {
  const source = String(raw || '')
  const blocks = []
  const patterns = [
    /<think>([\s\S]*?)<\/think>/gi,
    /<thinking>([\s\S]*?)<\/thinking>/gi,
  ]

  let clean = source

  for (const pattern of patterns) {
    clean = clean.replace(pattern, (_, content) => {
      const text = String(content || '').trim()
      if (text) {
        blocks.push(text)
      }
      return '\n'
    })
  }

  return {
    cleanText: clean.replace(/\n{3,}/g, '\n\n').trim(),
    thinking: blocks,
  }
}

export function renderChatHtml(raw = '') {
  const { cleanText, thinking } = extractThinkingBlocks(raw)
  const safeThinking = thinking.map((item) => escapeHtml(item))
  const contentHtml = markdown.render(cleanText || '生成中…')
  const thinkingHtml = safeThinking.length
    ? `<details class="chat-thinking"><summary>思考过程</summary>${safeThinking.map((item) => `<pre>${item}</pre>`).join('')}</details>`
    : ''

  return {
    html: DOMPurify.sanitize(`${contentHtml}${thinkingHtml}`),
    plainText: cleanText || '',
    thinking,
  }
}
