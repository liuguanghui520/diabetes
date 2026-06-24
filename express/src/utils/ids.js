import { createHash, randomUUID } from 'node:crypto'

export function newRequestId() {
  return `req_${Date.now()}_${randomUUID().slice(0, 12)}`
}

export function makeIdempotencyKey(userId, body, headerValue) {
  if (headerValue) {
    return String(headerValue).slice(0, 128)
  }

  const hash = createHash('sha256')
    .update(String(userId))
    .update(JSON.stringify(body))
    .digest('hex')

  return `auto_${hash.slice(0, 48)}`
}
