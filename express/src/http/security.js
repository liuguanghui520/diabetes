import cors from 'cors'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function createCorsMiddleware(config) {
  const allowedOrigins = config.security?.corsOrigins || []

  return cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(null, false)
    },
    credentials: true
  })
}

export function createHelmetMiddleware(config) {
  const isProduction = config.env === 'production'

  return helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction
  })
}

export function createGeneralRateLimit(config) {
  return rateLimit({
    windowMs: config.security?.rateLimitWindowMs || 15 * 60 * 1000,
    limit: config.security?.rateLimitMax || 2000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      code: 42901,
      message: '请求过于频繁，请稍后再试。',
      details: []
    }
  })
}

export function createSensitiveRateLimit(config) {
  return rateLimit({
    windowMs: config.security?.sensitiveRateLimitWindowMs || 10 * 60 * 1000,
    limit: config.security?.sensitiveRateLimitMax || 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    message: {
      code: 42902,
      message: '操作过于频繁，请稍后再试。',
      details: []
    }
  })
}

export function createPasswordAttemptLimiter(config) {
  return rateLimit({
    windowMs: Number(config.security?.passwordAttemptWindowMs || 15 * 60 * 1000),
    limit: Number(config.security?.passwordAttemptLimit || 5),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator(req) {
      return req.user?.id
        ? `password:user:${req.user.id}`
        : `password:ip:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'anonymous')}`
    },
    message: {
      code: 42901,
      message: '操作过于频繁，请稍后再试。',
      details: [],
    },
  })
}

export function buildSecurityConfig(env, processEnv) {
  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
  ]

  return {
    corsOrigins: parseOrigins(processEnv.CORS_ORIGINS).length
      ? parseOrigins(processEnv.CORS_ORIGINS)
      : env === 'production'
        ? []
        : defaultDevOrigins,
    rateLimitWindowMs: Number(processEnv.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    rateLimitMax: Number(processEnv.RATE_LIMIT_MAX || 600),
    sensitiveRateLimitWindowMs: Number(processEnv.SENSITIVE_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
    sensitiveRateLimitMax: Number(processEnv.SENSITIVE_RATE_LIMIT_MAX || 30),
    passwordAttemptWindowMs: Number(processEnv.PASSWORD_ATTEMPT_WINDOW_MS || 15 * 60 * 1000),
    passwordAttemptLimit: Number(processEnv.PASSWORD_ATTEMPT_LIMIT || 5),
  }
}
