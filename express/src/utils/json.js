export function safeJson(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }

  return value
}

export function maskSensitive(value) {
  const text = JSON.stringify(value ?? {})
  return JSON.parse(text
    .replace(/1[3-9]\d{9}/g, (phone) => `${phone.slice(0, 3)}****${phone.slice(7)}`)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[masked-email]'))
}
