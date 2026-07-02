import { describe, expect, it } from 'vitest'
import {
  createCorsMiddleware,
  createHelmetMiddleware,
  createGeneralRateLimit,
  createSensitiveRateLimit,
  createPasswordAttemptLimiter,
  buildSecurityConfig,
} from '../../src/http/security.js'

describe('buildSecurityConfig', () => {
  it('returns default dev origins for development', () => {
    const result = buildSecurityConfig('development', {})
    expect(result.corsOrigins).toContain('http://localhost:5173')
    expect(result.corsOrigins).toContain('http://localhost:4173')
  })

  it('returns empty origins for production with no CORS_ORIGINS', () => {
    const result = buildSecurityConfig('production', {})
    expect(result.corsOrigins).toEqual([])
  })

  it('returns parsed CORS_ORIGINS when set', () => {
    const result = buildSecurityConfig('production', { CORS_ORIGINS: 'https://example.com,https://app.example.com' })
    expect(result.corsOrigins).toEqual(['https://example.com', 'https://app.example.com'])
  })

  it('parses rate limit values from env', () => {
    const result = buildSecurityConfig('development', {
      RATE_LIMIT_WINDOW_MS: '300000',
      RATE_LIMIT_MAX: '100',
      SENSITIVE_RATE_LIMIT_WINDOW_MS: '60000',
      SENSITIVE_RATE_LIMIT_MAX: '10',
      PASSWORD_ATTEMPT_WINDOW_MS: '600000',
      PASSWORD_ATTEMPT_LIMIT: '3',
    })
    expect(result.rateLimitWindowMs).toBe(300000)
    expect(result.rateLimitMax).toBe(100)
    expect(result.sensitiveRateLimitWindowMs).toBe(60000)
    expect(result.sensitiveRateLimitMax).toBe(10)
    expect(result.passwordAttemptWindowMs).toBe(600000)
    expect(result.passwordAttemptLimit).toBe(3)
  })

  it('uses defaults when env vars are missing', () => {
    const result = buildSecurityConfig('development', {})
    expect(result.rateLimitWindowMs).toBe(900000) // 15 * 60 * 1000
    expect(result.rateLimitMax).toBe(600)
    expect(result.sensitiveRateLimitWindowMs).toBe(600000)
    expect(result.sensitiveRateLimitMax).toBe(30)
    expect(result.passwordAttemptWindowMs).toBe(900000)
    expect(result.passwordAttemptLimit).toBe(5)
  })
})

describe('createCorsMiddleware', () => {
  it('returns a function', () => {
    const config = { security: { corsOrigins: ['http://localhost:3000'] } }
    const middleware = createCorsMiddleware(config)
    expect(typeof middleware).toBe('function')
  })

  it('allows wildcard origin', () => {
    const config = { security: { corsOrigins: ['*'] } }
    const middleware = createCorsMiddleware(config)
    // The middleware itself is a function returned by cors()
    expect(middleware).toBeDefined()
  })
})

describe('createHelmetMiddleware', () => {
  it('returns a function', () => {
    const config = { env: 'development' }
    const middleware = createHelmetMiddleware(config)
    expect(typeof middleware).toBe('function')
  })
})

describe('createGeneralRateLimit', () => {
  it('returns a function', () => {
    const config = { security: { rateLimitWindowMs: 60000, rateLimitMax: 100 } }
    const middleware = createGeneralRateLimit(config)
    expect(typeof middleware).toBe('function')
  })
})

describe('createSensitiveRateLimit', () => {
  it('returns a function', () => {
    const config = { security: {} }
    const middleware = createSensitiveRateLimit(config)
    expect(typeof middleware).toBe('function')
  })
})

describe('createPasswordAttemptLimiter', () => {
  it('returns a function', () => {
    const config = { security: {} }
    const middleware = createPasswordAttemptLimiter(config)
    expect(typeof middleware).toBe('function')
  })
})
