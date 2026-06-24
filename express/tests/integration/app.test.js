import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Express API', () => {
  it('returns health status', async () => {
    const { app } = createTestContext()
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.code).toBe(0)
    expect(response.body.data.status).toBe('ok')
  })

  it('supports register, login and me', async () => {
    const { app } = createTestContext()
    const token = await registerAndLogin(request, app)

    const login = await request(app)
      .post('/api/auth/login')
      .send({
        account: 'kang',
        password: '12345678'
      })

    expect(login.status).toBe(200)
    expect(login.body.data.token).toBeTruthy()

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(me.status).toBe(200)
    expect(me.body.data.user.username).toBe('kang')
  })

  it('upserts profile and calculates BMI', async () => {
    const { app } = createTestContext()
    const token = await registerAndLogin(request, app)

    const response = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        diagnosed_diabetes: false,
        age: 65,
        gender: 'male',
        height_cm: 170,
        weight_kg: 85,
        waist_cm: 85,
        sbp_mm_hg: 110,
        family_history_diabetes: true,
        past_history: ['心血管疾病']
      })

    expect(response.status).toBe(200)
    expect(response.body.data.bmi).toBe(29.41)
  })

  it('runs risk assessment with mock Dify and stores the result', async () => {
    const { app, difyClient } = createTestContext()
    const token = await registerAndLogin(request, app)

    const response = await request(app)
      .post('/api/risk-assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'risk-once')
      .send({
        diagnosed_diabetes: false,
        diabetes_type: null,
        age: 65,
        gender: 'male',
        height_cm: 170,
        weight_kg: 85,
        waist_cm: 85,
        sbp_mm_hg: 110,
        family_history_diabetes: true,
        past_history: ['心血管疾病'],
        labs: {}
      })

    expect(response.status).toBe(200)
    expect(response.body.data.score).toBe(37)
    expect(response.body.data.risk_level).toBe('high')
    expect(response.body.data.advice.summary).toBeTruthy()
    expect(difyClient.calls.workflows[0].inputs.score_detail).toMatchObject({
      age: 18,
      bmi: 3,
      waist: 7,
      sbp: 1
    })

    const repeated = await request(app)
      .post('/api/risk-assessments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'risk-once')
      .send({
        diagnosed_diabetes: false,
        diabetes_type: null,
        age: 65,
        gender: 'male',
        height_cm: 170,
        weight_kg: 85,
        waist_cm: 85,
        sbp_mm_hg: 110,
        family_history_diabetes: true,
        past_history: ['心血管疾病'],
        labs: {}
      })

    expect(repeated.body.data.assessment_id).toBe(response.body.data.assessment_id)
  })

  it('proxies assistant SSE and normalizes Dify events', async () => {
    const { app } = createTestContext()
    const token = await registerAndLogin(request, app)

    const response = await request(app)
      .post('/api/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversation_id: null,
        message: '空腹血糖偏高怎么办？'
      })

    expect(response.status).toBe(200)
    expect(response.text).toContain('event: message')
    expect(response.text).toContain('"delta":"建议先记录近期血糖变化，"')
    expect(response.text).toContain('event: message_end')
    expect(response.text).toContain('"dify_conversation_id":"dify_mock_conversation"')
  })

  it('protects internal Dify APIs with X-Internal-Token', async () => {
    const { app } = createTestContext()

    const denied = await request(app).get('/internal/dify/home-summary')
    expect(denied.status).toBe(403)
    expect(denied.body.code).toBe(40301)

    const allowed = await request(app)
      .get('/internal/dify/home-summary')
      .set('X-Internal-Token', 'test-internal-token')

    expect(allowed.status).toBe(200)
    expect(allowed.body.code).toBe(0)
  })
})
