import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Health API', () => {
  let app, token

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    token = await registerAndLogin(request, app)
  })

  it('GET /health returns ok status', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.status).toBe('ok')
    expect(res.body.data).toHaveProperty('env')
    expect(res.body.data).toHaveProperty('time')
  })

  it('GET /api/health/db returns skipped for memory store', async () => {
    const res = await request(app).get('/api/health/db')
    expect(res.status).toBe(200)
    expect(res.body.data.skipped).toBe(true)
    expect(res.body.data.reason).toContain('in-memory')
  })
})
