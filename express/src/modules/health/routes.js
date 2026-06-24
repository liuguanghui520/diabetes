import { checkDatabase } from '../../db/pool.js'
import { asyncHandler, sendOk } from '../../http/response.js'

export function registerHealthRoutes(app, deps) {
  const { config, pool } = deps

  app.get('/health', (req, res) => {
    sendOk(res, {
      status: 'ok',
      env: config.env,
      time: new Date().toISOString()
    })
  })

  app.get('/api/health/db', asyncHandler(async (_req, res) => {
    if (!pool) {
      return sendOk(res, {
        ok: true,
        skipped: true,
        reason: 'in-memory store is active'
      })
    }

    sendOk(res, await checkDatabase(pool))
  }))
}
