import express from 'express'
import { createDb } from './db/index.js'
import { createDifyClient } from './services/dify/client.js'
import { errorHandler, notFoundHandler, traceMiddleware } from './http/response.js'
import { registerAuthRoutes } from './modules/auth/auth.js'
import { registerHealthRoutes } from './modules/health/routes.js'
import { registerProfileRoutes } from './modules/profile/routes.js'
import { registerRiskRoutes } from './modules/risk/routes.js'
import { registerAssistantRoutes } from './modules/assistant/routes.js'
import { registerInternalRoutes } from './modules/internal/routes.js'
import { registerContentRoutes } from './modules/content/routes.js'
import { registerAdminRoutes } from './modules/admin/routes.js'

export async function createApp(config, overrides = {}) {
  const app = express()
  const db = overrides.db || await createDb(config)
  const deps = {
    config,
    pool: db.pool,
    store: overrides.store || db.store,
    difyClient: overrides.difyClient || createDifyClient(config, overrides)
  }

  app.disable('x-powered-by')
  app.use(traceMiddleware)
  app.use(express.json({ limit: '1mb' }))

  registerHealthRoutes(app, deps)

  const api = express.Router()
  registerAuthRoutes(api, deps)
  registerProfileRoutes(api, deps)
  registerRiskRoutes(api, deps)
  registerAssistantRoutes(api, deps)
  registerContentRoutes(api, deps)
  registerAdminRoutes(api, deps)
  app.use('/api', api)

  registerInternalRoutes(app, deps)

  app.use(notFoundHandler)
  app.use(errorHandler)

  app.locals.db = db
  app.locals.deps = deps

  return app
}
