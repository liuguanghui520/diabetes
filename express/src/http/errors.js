export class AppError extends Error {
  constructor(code, message, status = 500, details = []) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const errors = {
  badRequest(message, details = []) {
    return new AppError(40001, message, 400, details)
  },
  invalidDslColumn(message = '查询字段不在白名单内', details = []) {
    return new AppError(40002, message, 400, details)
  },
  invalidDsl(message = '查询 DSL 不合法', details = []) {
    return new AppError(40003, message, 400, details)
  },
  unauthorized(message = '未登录或 Token 失效') {
    return new AppError(40101, message, 401)
  },
  forbidden(message = '无权限') {
    return new AppError(40301, message, 403)
  },
  forbiddenDslTable(message = '表不在允许查询范围内', details = []) {
    return new AppError(40302, message, 403, details)
  },
  notFound(message = '资源不存在') {
    return new AppError(40401, message, 404)
  },
  conflict(message = '数据冲突') {
    return new AppError(40901, message, 409)
  },
  queryFailed(message = '查询超时或数据库错误', details = []) {
    return new AppError(50002, message, 500, details)
  },
  difyUnavailable(message = 'Dify 服务不可用') {
    return new AppError(50201, message, 502)
  }
}
