import { asyncHandler, sendOk } from '../../http/response.js'
import { AppError, errors } from '../../http/errors.js'
import {
  buildAuthorizedCheckinSummary,
  buildAuthorizedUserContext,
} from '../privacy/authorization.js'
import { executeQuery, validateDsl } from '../admin/queryDsl.js'

function internalAuth(config) {
  return (req, _res, next) => {
    if (req.header('X-Internal-Token') !== config.internalDifyToken) {
      throw errors.forbidden('内部接口令牌无效')
    }
    next()
  }
}

export function registerInternalRoutes(app, deps) {
  const auth = internalAuth(deps.config)

  app.get('/internal/dify/users/:userId/context', auth, asyncHandler(async (req, res) => {
    sendOk(res, await buildAuthorizedUserContext({
      store: deps.store,
      userId: req.params.userId,
      scope: req.query.scope || 'assistant',
    }))
  }))

  app.get('/internal/dify/home-summary', auth, asyncHandler(async (_req, res) => {
    sendOk(res, await deps.store.getHomeSummary())
  }))

  app.get('/internal/dify/users/:userId/checkins/summary', auth, asyncHandler(async (req, res) => {
    sendOk(res, await buildAuthorizedCheckinSummary({
      store: deps.store,
      userId: req.params.userId,
      scope: req.query.scope || 'plan',
      query: req.query,
    }))
  }))

  app.get('/internal/dify/articles/recommend', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.getArticleRecommendations(req.query))
  }))

  app.get('/internal/dify/doctors/:doctorId', auth, asyncHandler(async (req, res) => {
    const doctor = await deps.store.getDoctorById(req.params.doctorId)

    if (!doctor) {
      throw errors.notFound('医生不存在')
    }

    sendOk(res, doctor)
  }))

  app.get('/internal/dify/admin/summary', auth, asyncHandler(async (req, res) => {
    const [users, doctors, consultations, logs] = await Promise.all([
      deps.store.listAdminUsers?.({
        page: Number(req.query.page || 1),
        pageSize: Math.min(Number(req.query.pageSize || 20), 50),
        keyword: req.query.keyword || ''
      }),
      deps.store.listAdminDoctors?.({
        page: 1,
        pageSize: 50,
        keyword: req.query.keyword || ''
      }),
      deps.store.listConsultations?.({
        status: req.query.status || null
      }),
      deps.store.listDifyLogs?.({
        page: 1,
        pageSize: 10
      })
    ])

    sendOk(res, {
      users,
      doctors,
      consultations,
      latest_dify_logs: logs?.items || [],
      readonly: true,
      note: 'Dify 管理员 Chatflow 只能读取摘要；写操作必须回到 Express 管理接口并经管理员确认。'
    })
  }))

  app.post('/internal/dify/admin/query', auth, asyncHandler(async (req, res) => {
    const result = validateDsl(req.body)

    if (!result.valid) {
      if (result.code === 40302) {
        throw errors.forbiddenDslTable('表不在允许查询范围内', result.errors)
      }

      if (result.code === 40002) {
        throw errors.invalidDslColumn('请求列不在该表白名单内', result.errors)
      }

      throw new AppError(40003, '查询 DSL 不合法', 400, result.errors)
    }

    const data = await executeQuery(deps.pool || deps.store, result.normalizedDsl)
    sendOk(res, data)
  }))
}
