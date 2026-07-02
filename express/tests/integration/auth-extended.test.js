import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Auth API extended', () => {
  let app, token

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    token = await registerAndLogin(request, app)
  })

  describe('PUT /api/auth/password', () => {
    it('rejects wrong old password', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ old_password: 'wrongpassword', new_password: 'newpass123' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(40031)
    })

    it('rejects too short new password', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ old_password: '12345678', new_password: '12345' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(40032)
    })

    it('rejects same password', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ old_password: '12345678', new_password: '12345678' })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe(40033)
    })

    it('changes password successfully', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ old_password: '12345678', new_password: 'newpass123' })

      expect(res.status).toBe(200)
      expect(res.body.data.re_login_required).toBe(true)
    })

    it('rejects request without auth', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .send({ old_password: 'x', new_password: 'y' })

      expect(res.status).toBe(401)
    })
  })
})
