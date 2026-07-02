import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Internal API', () => {
  let app, token, internalToken, store

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    store = ctx.store
    internalToken = ctx.config.internalDifyToken
    token = await registerAndLogin(request, app)
  })

  describe('authentication', () => {
    it('rejects request without X-Internal-Token', async () => {
      const res = await request(app)
        .get('/internal/dify/users/1/context')

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('令牌无效')
    })

    it('rejects request with wrong token', async () => {
      const res = await request(app)
        .get('/internal/dify/users/1/context')
        .set('X-Internal-Token', 'wrong-token')

      expect(res.status).toBe(403)
    })

    it('accepts request with correct token', async () => {
      const res = await request(app)
        .get('/internal/dify/users/1/context')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })
  })

  describe('GET /internal/dify/users/:userId/context', () => {
    it('returns user context', async () => {
      const res = await request(app)
        .get('/internal/dify/users/1/context')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('user_id')
      expect(res.body.data).toHaveProperty('scope')
      expect(res.body.data).toHaveProperty('authorized')
    })

    it('accepts scope query parameter', async () => {
      const res = await request(app)
        .get('/internal/dify/users/1/context?scope=plan')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
      expect(res.body.data.scope).toBe('plan')
    })
  })

  describe('GET /internal/dify/home-summary', () => {
    it('returns home summary', async () => {
      const res = await request(app)
        .get('/internal/dify/home-summary')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
    })
  })

  describe('GET /internal/dify/users/:userId/checkins/summary', () => {
    it('returns checkin summary', async () => {
      const res = await request(app)
        .get('/internal/dify/users/1/checkins/summary')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('completion_rate')
    })
  })

  describe('GET /internal/dify/articles/recommend', () => {
    it('returns article recommendations', async () => {
      const res = await request(app)
        .get('/internal/dify/articles/recommend')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
    })
  })

  describe('GET /internal/dify/doctors/:doctorId', () => {
    it('returns 404 for non-existent doctor', async () => {
      const res = await request(app)
        .get('/internal/dify/doctors/99999')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(404)
    })

    it('returns doctor for existing doctor', async () => {
      // Create a doctor first
      await store.createAdminDoctor({
        name: 'Dr. Internal Test',
        title: '主任医师',
        department: '内科',
        specialty: '糖尿病',
        display_status: 'published',
        online_status: 'online',
      })

      const res = await request(app)
        .get('/internal/dify/doctors/1')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Dr. Internal Test')
    })
  })

  describe('GET /internal/dify/admin/summary', () => {
    it('returns admin summary', async () => {
      const res = await request(app)
        .get('/internal/dify/admin/summary')
        .set('X-Internal-Token', internalToken)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('users')
      expect(res.body.data).toHaveProperty('doctors')
      expect(res.body.data).toHaveProperty('consultations')
      expect(res.body.data).toHaveProperty('latest_dify_logs')
    })
  })

  describe('POST /internal/dify/admin/query', () => {
    it('executes a valid DSL query', async () => {
      const res = await request(app)
        .post('/internal/dify/admin/query')
        .set('X-Internal-Token', internalToken)
        .send({
          table: 'sys_user',
          select: ['id', 'username', 'role'],
        })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('rows')
      expect(res.body.data).toHaveProperty('total')
    })

    it('rejects invalid DSL', async () => {
      const res = await request(app)
        .post('/internal/dify/admin/query')
        .set('X-Internal-Token', internalToken)
        .send({ table: 'nonexistent', select: ['id'] })

      expect(res.status).toBe(403)
    })

    it('rejects disallowed column', async () => {
      const res = await request(app)
        .post('/internal/dify/admin/query')
        .set('X-Internal-Token', internalToken)
        .send({ table: 'sys_user', select: ['password_hash'] })

      expect(res.status).toBe(400)
    })
  })
})
