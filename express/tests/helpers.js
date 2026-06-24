import { createApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'
import { createMemoryStore } from '../src/db/memoryStore.js'
import { createMockDifyClient } from '../src/services/dify/mockClient.js'

export function createTestContext() {
  const config = loadEnv()
  config.env = 'test'
  config.db.useMemory = true
  config.internalDifyToken = 'test-internal-token'
  config.jwt.secret = 'test-secret'
  const store = createMemoryStore()
  const difyClient = createMockDifyClient()
  const app = createApp(config, {
    db: {
      pool: null,
      store,
      async close() {}
    },
    store,
    difyClient
  })

  return {
    app,
    config,
    store,
    difyClient
  }
}

export async function registerAndLogin(request, app) {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'kang',
      password: '12345678',
      phone: '13800000000',
      nickname: '康同学'
    })

  return response.body.data.token
}
