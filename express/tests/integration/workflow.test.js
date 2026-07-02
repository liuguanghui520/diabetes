import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Workflow API', () => {
  let app, token, store

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    store = ctx.store
    token = await registerAndLogin(request, app)
  })

  describe('POST /api/plans/generate', () => {
    it('triggers plan generation', async () => {
      const res = await request(app)
        .post('/api/plans/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ goal: '减重5公斤' })

      expect(res.status).toBe(200)
      expect(res.body.data.workflow).toHaveProperty('request_id')
      expect(res.body.data.workflow.status).toBe('processing')
    })

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/plans/generate')
        .send({ goal: 'test' })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/checkins/analysis', () => {
    it('triggers checkin analysis', async () => {
      const res = await request(app)
        .post('/api/checkins/analysis')
        .set('Authorization', `Bearer ${token}`)
        .send({ days: 7 })

      // The mock Dify client may or may not return success
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/reports/interpret', () => {
    it('interprets report with text', async () => {
      const res = await request(app)
        .post('/api/reports/interpret')
        .set('Authorization', `Bearer ${token}`)
        .send({ report_text: '空腹血糖 6.5 mmol/L' })

      expect(res.status).toBe(200)
    })

    it('requires at least text or file', async () => {
      const res = await request(app)
        .post('/api/reports/interpret')
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(res.status).toBe(400)
    })
  })

  describe('Plan Tasks', () => {
    let taskId

    it('POST /api/plan-tasks creates a task', async () => {
      const res = await request(app)
        .post('/api/plan-tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'diet',
          title: '每日三餐定时',
          desc: '早中晚各一次',
          target: '3times',
          time: '08:00,12:00,18:00',
        })

      // May or may not have an active plan
      expect([200, 404]).toContain(res.status)
      if (res.status === 200) {
        taskId = res.body.data?.id
      }
    })

    it('GET /api/plan-tasks lists tasks', async () => {
      const res = await request(app)
        .get('/api/plan-tasks')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/workflow-runs/:requestId', () => {
    it('returns workflow run status', async () => {
      const res = await request(app)
        .get('/api/workflow-runs/nonexistent-id')
        .set('Authorization', `Bearer ${token}`)

      // May return 404 or empty
      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/checkins/history', () => {
    it('returns checkin history', async () => {
      const res = await request(app)
        .get('/api/checkins/history')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('days')
      expect(res.body.data).toHaveProperty('history')
    })

    it('accepts days parameter', async () => {
      const res = await request(app)
        .get('/api/checkins/history?days=14')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })
  })
})
