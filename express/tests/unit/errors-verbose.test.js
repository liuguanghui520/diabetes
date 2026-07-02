import { describe, expect, it, vi } from 'vitest'

// Re-test errors to ensure coverage is captured properly
import { AppError, errors } from '../../src/http/errors.js'

describe('AppError coverage verification', () => {
  it('AppError constructor sets all properties', () => {
    const err = new AppError(50001, 'test', 500, [])
    expect(err.name).toBe('AppError')
    expect(err.code).toBe(50001)
    expect(err.message).toBe('test')
    expect(err.status).toBe(500)
    expect(err.details).toEqual([])
  })

  it('AppError with details', () => {
    const details = [{ path: 'x', message: 'y' }]
    const err = new AppError(40001, 'bad', 400, details)
    expect(err.details).toEqual(details)
  })
})

describe('errors factory exhaustive', () => {
  const testCases = [
    { name: 'badRequest', fn: errors.badRequest, code: 40001, status: 400 },
    { name: 'invalidDslColumn', fn: errors.invalidDslColumn, code: 40002, status: 400 },
    { name: 'invalidDsl', fn: errors.invalidDsl, code: 40003, status: 400 },
    { name: 'unauthorized', fn: errors.unauthorized, code: 40101, status: 401 },
    { name: 'forbidden', fn: errors.forbidden, code: 40301, status: 403 },
    { name: 'forbiddenDslTable', fn: errors.forbiddenDslTable, code: 40302, status: 403 },
    { name: 'notFound', fn: errors.notFound, code: 40401, status: 404 },
    { name: 'conflict', fn: errors.conflict, code: 40901, status: 409 },
    { name: 'queryFailed', fn: errors.queryFailed, code: 50002, status: 500 },
    { name: 'difyUnavailable', fn: errors.difyUnavailable, code: 50201, status: 502 },
  ]

  for (const { name, fn, code, status } of testCases) {
    it(`${name} returns AppError with code=${code} status=${status}`, () => {
      const err = fn('msg')
      expect(err).toBeInstanceOf(AppError)
      expect(err.code).toBe(code)
      expect(err.status).toBe(status)
      expect(err.message).toBe('msg')
    })
  }
})
