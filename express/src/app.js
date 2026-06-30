import express from 'express'
import compression from 'compression'
import { createDb } from './db/index.js'
import { createDifyClient } from './services/dify/client.js'
import { errorHandler, notFoundHandler, traceMiddleware } from './http/response.js'
import {
  createCorsMiddleware,
  createGeneralRateLimit,
  createHelmetMiddleware,
  createSensitiveRateLimit
} from './http/security.js'
import { registerAuthRoutes } from './modules/auth/auth.js'
import { registerHealthRoutes } from './modules/health/routes.js'
import { registerProfileRoutes } from './modules/profile/routes.js'
import { registerPrivacyRoutes } from './modules/privacy/routes.js'
import { registerUploadRoutes } from './modules/uploads/routes.js'
import { registerRiskRoutes } from './modules/risk/routes.js'
import { registerAssistantRoutes } from './modules/assistant/routes.js'
import { registerWorkflowRoutes } from './modules/workflow/routes.js'
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
  app.use(compression({ level: 6, threshold: 1024 }))
  app.use(createHelmetMiddleware(config))
  app.use(createCorsMiddleware(config))
  app.use(traceMiddleware)
  app.use(createGeneralRateLimit(config))
  app.use(express.json({ limit: '1mb' }))

  registerHealthRoutes(app, deps)

  const api = express.Router()
  const sensitiveLimiter = createSensitiveRateLimit(config)
  registerAuthRoutes(api, deps, { sensitiveLimiter })
  registerPrivacyRoutes(api, deps)
  registerUploadRoutes(api, deps)
  registerProfileRoutes(api, deps)
  registerRiskRoutes(api, deps)
  registerAssistantRoutes(api, deps, { sensitiveLimiter })
  registerWorkflowRoutes(api, deps, { sensitiveLimiter })
  registerContentRoutes(api, deps)
  registerAdminRoutes(api, deps)
  app.use('/api', api)

  registerInternalRoutes(app, deps)

  // Static files served by Nginx — removed from Express to avoid
  // redundant middleware across PM2 cluster instances.

  app.use(notFoundHandler)
  app.use(errorHandler)

  app.locals.db = db
  app.locals.deps = deps

  return app
}
