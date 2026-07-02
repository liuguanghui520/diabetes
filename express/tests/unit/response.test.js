import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  traceMiddleware,
  sendOk,
  asyncHandler,
  validate,
  notFoundHandler,
  errorHandler,
} from '../../src/http/response.js'
import { AppError, errors } from '../../src/http/errors.js'
import { z, ZodError } from 'zod'

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    req: { method: 'POST', traceId: 'trace-123' },
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
  }
  return res
}

describe('traceMiddleware', () => {
  it('sets traceId from X-Request-Id header', () => {
    const req = { header: vi.fn().mockReturnValue('custom-trace-id') }
    const res = { setHeader: vi.fn() }
    const next = vi.fn()

    traceMiddleware(req, res, next)

    expect(req.traceId).toBe('custom-trace-id')
    expect(res.setHeader).toHaveBeenCalledWith('X-Trace-Id', 'custom-trace-id')
    expect(next).toHaveBeenCalled()
  })

  it('generates traceId when no X-Request-Id header', () => {
    const req = { header: vi.fn().mockReturnValue(undefined) }
    const res = { setHeader: vi.fn() }
    const next = vi.fn()

    traceMiddleware(req, res, next)

    expect(req.traceId).toMatch(/^req_\d+_[a-f0-9]{8}$/)
    expect(res.setHeader).toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})

describe('sendOk', () => {
  it('sends JSON response with code 0', () => {
    const res = mockRes()
    sendOk(res, { name: 'test' }, 'success')

    expect(res.body.code).toBe(0)
    expect(res.body.message).toBe('success')
    expect(res.body.data).toEqual({ name: 'test' })
    expect(res.body.traceId).toBe('trace-123')
  })

  it('uses default message "ok"', () => {
    const res = mockRes()
    sendOk(res, { x: 1 })

    expect(res.body.message).toBe('ok')
  })

  it('uses default empty data object', () => {
    const res = mockRes()
    sendOk(res)

    expect(res.body.data).toEqual({})
  })

  it('adds Cache-Control and ETag for GET requests', () => {
    const res = mockRes()
    res.req.method = 'GET'
    sendOk(res, { items: [] })

    expect(res.headers['Cache-Control']).toBe('private, max-age=30')
    expect(res.headers['ETag']).toMatch(/^W\/"/)
  })

  it('does not add Cache-Control for POST requests', () => {
    const res = mockRes()
    res.req.method = 'POST'
    sendOk(res, { items: [] })

    expect(res.headers['Cache-Control']).toBeUndefined()
    expect(res.headers['ETag']).toBeUndefined()
  })
})

describe('asyncHandler', () => {
  it('wraps async handler and catches errors', async () => {
    const error = new Error('test error')
    const handler = async () => {
      throw error
    }
    const wrapped = asyncHandler(handler)
    const req = {}
    const res = {}
    const next = vi.fn()

    await wrapped(req, res, next)

    expect(next).toHaveBeenCalledWith(error)
  })

  it('passes through successful handler result', async () => {
    const handler = async (_req, res) => {
      res.body = 'ok'
    }
    const wrapped = asyncHandler(handler)
    const req = {}
    const res = {}
    const next = vi.fn()

    await wrapped(req, res, next)

    expect(res.body).toBe('ok')
    expect(next).not.toHaveBeenCalled()
  })
})

describe('validate', () => {
  it('validates body and calls next on success', () => {
    const schema = z.object({ name: z.string() })
    const middleware = validate(schema)
    const req = { body: { name: 'test' } }
    const next = vi.fn()

    middleware(req, {}, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('validates query and stores in validatedQuery', () => {
    const schema = z.object({ page: z.coerce.number() })
    const middleware = validate(schema, 'query')
    const req = { query: { page: '1' } }
    const next = vi.fn()

    middleware(req, {}, next)

    expect(req.validatedQuery).toEqual({ page: 1 })
    expect(next).toHaveBeenCalledWith()
  })

  it('calls next with error on validation failure', () => {
    const schema = z.object({ name: z.string() })
    const middleware = validate(schema)
    const req = { body: { name: 123 } }
    const next = vi.fn()

    middleware(req, {}, next)

    expect(next).toHaveBeenCalled()
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError)
  })
})

describe('notFoundHandler', () => {
  it('calls next with notFound error', () => {
    const req = { method: 'GET', path: '/api/nonexistent' }
    const next = vi.fn()

    notFoundHandler(req, {}, next)

    expect(next).toHaveBeenCalled()
    const err = next.mock.calls[0][0]
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe(40401)
    expect(err.message).toContain('GET')
    expect(err.message).toContain('/api/nonexistent')
  })
})

describe('errorHandler', () => {
  it('handles ZodError with 400 response', () => {
    const zodError = new ZodError([{ code: 'invalid_type', path: ['name'], message: 'Required' }])
    const req = { traceId: 'trace-1' }
    const res = mockRes()

    errorHandler(zodError, req, res, vi.fn())

    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe(40001)
    expect(res.body.message).toBe('参数错误')
    expect(res.body.details).toHaveLength(1)
    expect(res.body.details[0].path).toBe('name')
  })

  it('handles AppError with correct status', () => {
    const err = errors.notFound('用户不存在')
    const req = { traceId: 'trace-1' }
    const res = mockRes()

    errorHandler(err, req, res, vi.fn())

    expect(res.statusCode).toBe(404)
    expect(res.body.code).toBe(40401)
    expect(res.body.message).toBe('用户不存在')
  })

  it('handles unknown errors with 500', () => {
    const err = new Error('Something broke')
    const req = { traceId: 'trace-1' }
    const res = mockRes()

    errorHandler(err, req, res, vi.fn())

    expect(res.statusCode).toBe(500)
    expect(res.body.code).toBe(50001)
    expect(res.body.message).toBe('系统错误')
  })

  it('includes empty details array for AppError without details', () => {
    const err = errors.unauthorized()
    const req = { traceId: 'trace-1' }
    const res = mockRes()

    errorHandler(err, req, res, vi.fn())

    expect(res.body.details).toEqual([])
  })

  it('handles AppError with details', () => {
    const err = errors.badRequest('invalid', [{ path: 'field', message: 'bad' }])
    const req = { traceId: 'trace-1' }
    const res = mockRes()

    errorHandler(err, req, res, vi.fn())

    expect(res.body.details).toEqual([{ path: 'field', message: 'bad' }])
  })
})
