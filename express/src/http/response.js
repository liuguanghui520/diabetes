import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'
import { AppError, errors } from './errors.js'

export function traceMiddleware(req, res, next) {
  req.traceId = req.header('X-Request-Id') || `req_${Date.now()}_${randomUUID().slice(0, 8)}`
  res.setHeader('X-Trace-Id', req.traceId)
  next()
}

export function sendOk(res, data = {}, message = 'ok') {
  // 为 GET 请求添加协商缓存
  if (res.req.method === 'GET') {
    res.setHeader('Cache-Control', 'private, max-age=30')
    res.setHeader('ETag', `W/"${Buffer.from(JSON.stringify(data)).length}-${Date.now().toString(36)}"`)
  }

  return res.json({
    code: 0,
    message,
    data,
    traceId: res.req.traceId
  })
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source])

      if (source === 'query') {
        req.validatedQuery = parsed
      } else {
        req[source] = parsed
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export function notFoundHandler(req, _res, next) {
  next(errors.notFound(`接口不存在：${req.method} ${req.path}`))
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }))

    return res.status(400).json({
      code: 40001,
      message: '参数错误',
      details,
      traceId: req.traceId
    })
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
      details: error.details || [],
      traceId: req.traceId
    })
  }

  console.error(`[${req.traceId}] ${error?.name || 'Error'}: ${error?.message || 'Unhandled error'}`)

  return res.status(500).json({
    code: 50001,
    message: '系统错误',
    details: [],
    traceId: req.traceId
  })
}
