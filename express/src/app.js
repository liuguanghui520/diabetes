import express from 'express'
import compression from 'compression'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
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
  registerProfileRoutes(api, deps)
  registerRiskRoutes(api, deps)
  registerAssistantRoutes(api, deps, { sensitiveLimiter })
  registerWorkflowRoutes(api, deps, { sensitiveLimiter })
  registerContentRoutes(api, deps)
  registerAdminRoutes(api, deps)
  app.use('/api', api)

  registerInternalRoutes(app, deps)

  // Serve frontend static files in production
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const distPath = resolve(__dirname, '../../frontend/dist')
  if (existsSync(distPath)) {
    app.use(express.static(distPath, { maxAge: '7d', etag: true }))
    // SPA fallback: serve index.html for non-API routes
    app.get(/^\/(?!api\/|internal\/|health).*/, (_req, res) => {
      res.sendFile(resolve(distPath, 'index.html'))
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)

  app.locals.db = db
  app.locals.deps = deps

  return app
}
