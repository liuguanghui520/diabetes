import { describe, expect, it } from 'vitest'
import { AppError, errors } from '../../src/http/errors.js'

describe('AppError', () => {
  it('creates an error instance with code, message, status', () => {
    const err = new AppError(40001, '参数错误', 400)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
    expect(err.name).toBe('AppError')
    expect(err.code).toBe(40001)
    expect(err.message).toBe('参数错误')
    expect(err.status).toBe(400)
    expect(err.details).toEqual([])
  })

  it('creates an error with details array', () => {
    const err = new AppError(40001, '参数错误', 400, [{ path: 'name', message: '必填' }])
    expect(err.details).toEqual([{ path: 'name', message: '必填' }])
  })

  it('defaults status to 500 and details to []', () => {
    const err = new AppError(50001, '系统错误')
    expect(err.status).toBe(500)
    expect(err.details).toEqual([])
  })
})

describe('error factories', () => {
  describe('badRequest', () => {
    it('returns AppError with 400 status', () => {
      const err = errors.badRequest('参数错误')
      expect(err).toBeInstanceOf(AppError)
      expect(err.code).toBe(40001)
      expect(err.status).toBe(400)
      expect(err.message).toBe('参数错误')
    })

    it('accepts details', () => {
      const err = errors.badRequest('参数错误', [{ path: 'age' }])
      expect(err.details).toEqual([{ path: 'age' }])
    })
  })

  describe('invalidDslColumn', () => {
    it('returns AppError with default message', () => {
      const err = errors.invalidDslColumn()
      expect(err.code).toBe(40002)
      expect(err.status).toBe(400)
      expect(err.message).toBe('查询字段不在白名单内')
    })

    it('accepts custom message', () => {
      const err = errors.invalidDslColumn('自定义消息')
      expect(err.message).toBe('自定义消息')
    })
  })

  describe('invalidDsl', () => {
    it('returns AppError with default message', () => {
      const err = errors.invalidDsl()
      expect(err.code).toBe(40003)
      expect(err.status).toBe(400)
      expect(err.message).toBe('查询 DSL 不合法')
    })
  })

  describe('unauthorized', () => {
    it('returns AppError with 401 status', () => {
      const err = errors.unauthorized()
      expect(err.code).toBe(40101)
      expect(err.status).toBe(401)
      expect(err.message).toBe('未登录或 Token 失效')
    })

    it('accepts custom message', () => {
      const err = errors.unauthorized('Token 已过期')
      expect(err.message).toBe('Token 已过期')
    })
  })

  describe('forbidden', () => {
    it('returns AppError with 403 status', () => {
      const err = errors.forbidden()
      expect(err.code).toBe(40301)
      expect(err.status).toBe(403)
      expect(err.message).toBe('无权限')
    })
  })

  describe('forbiddenDslTable', () => {
    it('returns AppError with default message', () => {
      const err = errors.forbiddenDslTable()
      expect(err.code).toBe(40302)
      expect(err.status).toBe(403)
      expect(err.message).toBe('表不在允许查询范围内')
    })
  })

  describe('notFound', () => {
    it('returns AppError with 404 status', () => {
      const err = errors.notFound()
      expect(err.code).toBe(40401)
      expect(err.status).toBe(404)
      expect(err.message).toBe('资源不存在')
    })

    it('accepts custom message', () => {
      const err = errors.notFound('用户不存在')
      expect(err.message).toBe('用户不存在')
    })
  })

  describe('conflict', () => {
    it('returns AppError with 409 status', () => {
      const err = errors.conflict()
      expect(err.code).toBe(40901)
      expect(err.status).toBe(409)
      expect(err.message).toBe('数据冲突')
    })

    it('accepts custom message', () => {
      const err = errors.conflict('用户名已存在')
      expect(err.message).toBe('用户名已存在')
    })
  })

  describe('queryFailed', () => {
    it('returns AppError with 500 status', () => {
      const err = errors.queryFailed()
      expect(err.code).toBe(50002)
      expect(err.status).toBe(500)
      expect(err.message).toBe('查询超时或数据库错误')
    })

    it('accepts custom message and details', () => {
      const err = errors.queryFailed('连接超时', [{ detail: 'timeout after 5s' }])
      expect(err.message).toBe('连接超时')
      expect(err.details).toEqual([{ detail: 'timeout after 5s' }])
    })
  })

  describe('difyUnavailable', () => {
    it('returns AppError with 502 status', () => {
      const err = errors.difyUnavailable()
      expect(err.code).toBe(50201)
      expect(err.status).toBe(502)
      expect(err.message).toBe('Dify 服务不可用')
    })

    it('accepts custom message', () => {
      const err = errors.difyUnavailable('Dify 超时')
      expect(err.message).toBe('Dify 超时')
    })
  })
})
