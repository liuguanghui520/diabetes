import { asyncHandler, sendOk } from '../../http/response.js'
import { errors } from '../../http/errors.js'

function internalAuth(config) {
  return (req, _res, next) => {
    if (req.header('X-Internal-Token') !== config.internalDifyToken) {
      throw errors.forbidden('内部接口令牌无效')
    }
    next()
  }
}

export function registerInternalRoutes(app, deps) {
  const router = app.route ? null : null
  void router
  const auth = internalAuth(deps.config)

  app.get('/internal/dify/users/:userId/context', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.getUserContext(req.params.userId))
  }))

  app.get('/internal/dify/home-summary', auth, asyncHandler(async (_req, res) => {
    sendOk(res, await deps.store.getHomeSummary())
  }))

  app.get('/internal/dify/users/:userId/checkins/summary', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.getCheckinSummary(req.params.userId, req.query))
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
}
