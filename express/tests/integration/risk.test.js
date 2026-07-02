import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Risk API', () => {
  let app, token

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    token = await registerAndLogin(request, app)
  })

  describe('POST /api/risk-assessments', () => {
    it('creates a risk assessment', async () => {
      const res = await request(app)
        .post('/api/risk-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          diagnosed_diabetes: false,
          age: 45,
          gender: 'male',
          height_cm: 170,
          weight_kg: 75,
          waist_cm: 90,
          sbp_mm_hg: 130,
          dbp_mm_hg: 85,
          family_history_diabetes: true,
        })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('assessment_id')
      expect(res.body.data).toHaveProperty('score')
      expect(res.body.data).toHaveProperty('risk_level')
    })

    it('returns existing result for same idempotency key', async () => {
      const body = {
        diagnosed_diabetes: false,
        age: 30,
        gender: 'female',
        height_cm: 160,
        weight_kg: 55,
        family_history_diabetes: false,
      }

      const res1 = await request(app)
        .post('/api/risk-assessments')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'test-key-risk')
        .send(body)

      const res2 = await request(app)
        .post('/api/risk-assessments')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'test-key-risk')
        .send(body)

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(res2.body.data.assessment_id).toBe(res1.body.data.assessment_id)
    })

    it('handles diagnosed diabetes users', async () => {
      const res = await request(app)
        .post('/api/risk-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          diagnosed_diabetes: true,
          diabetes_type: 'type2',
          age: 55,
          gender: 'male',
          height_cm: 175,
          weight_kg: 80,
          family_history_diabetes: true,
        })

      expect(res.status).toBe(200)
      expect(res.body.data.score_status).toBe('diagnosed')
    })

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/risk-assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ diagnosed_diabetes: false })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/risk-assessments/latest', () => {
    it('returns latest risk', async () => {
      const res = await request(app)
        .get('/api/risk-assessments/latest')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      // May be null if no risk, or have data
      if (res.body.data) {
        expect(res.body.data).toHaveProperty('risk_level')
      }
    })
  })

  describe('GET /api/risk-assessments', () => {
    it('returns paginated risks', async () => {
      const res = await request(app)
        .get('/api/risk-assessments')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('total')
    })
  })
})
