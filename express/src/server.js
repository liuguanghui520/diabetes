import { parseCliArgs, loadEnv } from './config/env.js'
import { createApp } from './app.js'
import { checkDatabase } from './db/pool.js'

const cliArgs = parseCliArgs()
const config = loadEnv(cliArgs)
const app = await createApp(config)

if (config.db.connectOnStart && app.locals.db.pool) {
  try {
    const result = await checkDatabase(app.locals.db.pool)
    console.log(`[db] connected: ${result.version}`)
  } catch (error) {
    console.error('[db] connection failed:', error.message)
    process.exit(1)
  }
}

const server = app.listen(config.port, config.host, () => {
  console.log(`[express] listening on http://${config.host}:${config.port}`)
})

async function shutdown() {
  server.close(async () => {
    await app.locals.db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
