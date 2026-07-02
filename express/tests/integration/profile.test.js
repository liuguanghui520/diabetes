import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Profile API', () => {
  let app, token

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    token = await registerAndLogin(request, app)
  })

  describe('GET /api/profile', () => {
    it('returns profile with default values', async () => {
      const res = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('profile')
      expect(res.body.data).toHaveProperty('user')
      expect(res.body.data).toHaveProperty('latest_risk')
    })

    it('includes completion_rate', async () => {
      const res = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)

      expect(res.body.data.profile).toHaveProperty('completion_rate')
      expect(typeof res.body.data.profile.completion_rate).toBe('number')
    })

    it('requires authentication', async () => {
      const res = await request(app).get('/api/profile')
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/profile', () => {
    it('updates profile with health data', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          height_cm: 170,
          weight_kg: 65,
          waist_cm: 80,
          gender: 'male',
          age: 30,
          sbp_mm_hg: 120,
          dbp_mm_hg: 80,
          family_history_diabetes: false,
        })

      expect(res.status).toBe(200)
      expect(res.body.data.profile).toBeDefined()
      expect(res.body.data.bmi).toBeCloseTo(22.49, 1)
    })

    it('calculates BMI correctly', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ height_cm: 180, weight_kg: 80 })

      expect(res.status).toBe(200)
      expect(res.body.data.bmi).toBeCloseTo(24.69, 1)
    })

    it('accepts birth_date to calculate age_snapshot', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ birth_date: '1990-06-15' })

      expect(res.status).toBe(200)
      expect(res.body.data.profile.age_snapshot).toBeGreaterThanOrEqual(0)
    })

    it('rejects invalid height', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ height_cm: 50 })

      expect(res.status).toBe(400)
    })

    it('rejects invalid weight', async () => {
      const res = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight_kg: 500 })

      expect(res.status).toBe(400)
    })
  })
})
