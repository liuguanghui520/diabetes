import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Privacy API', () => {
  let app, token

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    token = await registerAndLogin(request, app)
  })

  describe('GET /api/privacy-settings', () => {
    it('returns default privacy settings', async () => {
      const res = await request(app)
        .get('/api/privacy-settings')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('personalized_advice_enabled')
      expect(res.body.data).toHaveProperty('assistant_context_enabled')
      expect(res.body.data).toHaveProperty('health_reminder_enabled')
    })

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/privacy-settings')
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/privacy-settings', () => {
    it('updates health_reminder_enabled', async () => {
      const res = await request(app)
        .put('/api/privacy-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ health_reminder_enabled: false })

      expect(res.status).toBe(200)
      expect(res.body.data.privacy_settings.health_reminder_enabled).toBe(false)
    })

    it('re-enables health reminder', async () => {
      const res = await request(app)
        .put('/api/privacy-settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ health_reminder_enabled: true })

      expect(res.status).toBe(200)
      expect(res.body.data.privacy_settings.health_reminder_enabled).toBe(true)
    })
  })

  describe('GET /api/data-authorizations', () => {
    it('returns data authorizations', async () => {
      const res = await request(app)
        .get('/api/data-authorizations')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })
  })

  describe('PUT /api/data-authorizations', () => {
    it('updates authorization fields', async () => {
      const res = await request(app)
        .put('/api/data-authorizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan_suggestion_authorized: false })

      expect(res.status).toBe(200)
      expect(res.body.data.plan_suggestion_authorized).toBe(false)
    })

    it('blocks sub-authorizations when master is off', async () => {
      // First turn off master
      await request(app)
        .put('/api/data-authorizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ health_data_analysis_authorized: false })

      // Then try to turn on a sub-auth
      const res = await request(app)
        .put('/api/data-authorizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ assistant_context_authorized: true })

      expect(res.status).toBe(409)
    })

    it('allows re-enabling master authorization', async () => {
      const res = await request(app)
        .put('/api/data-authorizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ health_data_analysis_authorized: true })

      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/data-authorizations/withdraw-all', () => {
    it('withdraws all authorizations', async () => {
      const res = await request(app)
        .post('/api/data-authorizations/withdraw-all')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'test_withdrawal' })

      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })
  })

  describe('GET /api/data-authorizations/history', () => {
    it('returns authorization change history', async () => {
      const res = await request(app)
        .get('/api/data-authorizations/history')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('total')
    })

    it('filters by scope', async () => {
      const res = await request(app)
        .get('/api/data-authorizations/history?scope=plan')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })
  })
})
