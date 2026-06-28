import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Express API', () => {
  it('returns health status', async () => {
    const { app } = await createTestContext()
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.code).toBe(0)
    expect(response.body.data.status).toBe('ok')
  })

  it('supports register, login and me', async () => {
    const { app } = await createTestContext()
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
    const { app } = await createTestContext()
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
    const { app, difyClient } = await createTestContext()
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
    const { app } = await createTestContext()
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

  it('serves frontend integration endpoints', async () => {
    const { app } = await createTestContext()
    const token = await registerAndLogin(request, app)

    const summary = await request(app)
      .get('/api/home/summary')
      .set('Authorization', `Bearer ${token}`)
    expect(summary.status).toBe(200)
    expect(summary.body.data.user.username).toBe('kang')
    expect(Array.isArray(summary.body.data.today_tasks)).toBe(true)

    const articles = await request(app).get('/api/articles?page=1&pageSize=2')
    expect(articles.status).toBe(200)
    expect(articles.body.data.items.length).toBeGreaterThan(0)

    const plan = await request(app)
      .get('/api/plans/active')
      .set('Authorization', `Bearer ${token}`)
    expect(plan.status).toBe(200)
    expect(Array.isArray(plan.body.data.tasks)).toBe(true)

    const checkin = await request(app)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'exercise',
        value: 1,
        unit: '次',
        detail_text: '饭后轻走 20 分钟'
      })
    expect(checkin.status).toBe(200)

    const messages = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${token}`)
    expect(messages.status).toBe(200)
    expect(Array.isArray(messages.body.data.list)).toBe(true)
  })

  it('runs plan, checkin analysis and report workflows', async () => {
    const { app, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    const plan = await request(app)
      .post('/api/plans/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        preferences: {
          goal: '控糖和减重'
        }
      })
    expect(plan.status).toBe(200)
    expect(plan.body.data.plan.title).toBeTruthy()
    expect(plan.body.data.plan.tasks.length).toBeGreaterThan(0)

    await request(app)
      .post('/api/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'exercise',
        value: 1,
        unit: '次',
        detail_text: '饭后轻走'
      })

    const analysis = await request(app)
      .post('/api/checkins/analysis')
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 7 })
    expect(analysis.status).toBe(200)
    expect(analysis.body.data.report_id).toBeTruthy()
    expect(analysis.body.data.workflow_run_id).toBe('mock_checkin_workflow_run_id')

    const report = await request(app)
      .post('/api/reports/interpret')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_text: '空腹血糖 6.4 mmol/L，糖化血红蛋白 6.1%。'
      })
    expect(report.status).toBe(200)
    expect(report.body.data.status).toBe('pending_confirm')
    expect(difyClient.calls.workflows.map((item) => item.appCode)).toEqual(
      expect.arrayContaining(['plan', 'checkin', 'report'])
    )
  })

  it('proxies doctor consultation SSE', async () => {
    const { app, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    const response = await request(app)
      .post('/api/doctors/1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversation_id: null,
        message: '帮我整理一份复诊前问题清单'
      })

    expect(response.status).toBe(200)
    expect(response.text).toContain('event: message')
    expect(difyClient.calls.chats.at(-1)).toMatchObject({
      appType: 'doctor',
      query: '帮我整理一份复诊前问题清单'
    })
  })

  it('protects internal Dify APIs with X-Internal-Token', async () => {
    const { app } = await createTestContext()

    const denied = await request(app).get('/internal/dify/home-summary')
    expect(denied.status).toBe(403)
    expect(denied.body.code).toBe(40301)

    const allowed = await request(app)
      .get('/internal/dify/home-summary')
      .set('X-Internal-Token', 'test-internal-token')

    expect(allowed.status).toBe(200)
    expect(allowed.body.code).toBe(0)
  })

  it('protects admin APIs and supports article publishing', async () => {
    const { app, store } = await createTestContext()
    const userToken = await registerAndLogin(request, app)

    const denied = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${userToken}`)
    expect(denied.status).toBe(403)

    const admin = await store.createUser({
      username: 'admin',
      password_hash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      role: 'admin',
      nickname: '管理员'
    })
    const adminToken = (await import('../../src/modules/auth/auth.js')).signToken(admin, {
      jwt: {
        secret: 'test-secret',
        expiresIn: '7d'
      }
    })

    const created = await request(app)
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '糖尿病日常管理指南',
        summary: '科学饮食、规律运动和复查提醒。',
        content: '正文内容',
        status: 'draft',
        audit_status: 'approved'
      })
    expect(created.status).toBe(200)

    const published = await request(app)
      .post(`/api/admin/articles/${created.body.data.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(published.status).toBe(200)
    expect(published.body.data.status).toBe('published')

    const savedHome = await request(app)
      .put('/api/admin/home-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slots: [{
          slot_code: 'hot_articles',
          target_type: 'article',
          target_id: created.body.data.id,
          title: '首页推荐',
          sort_order: 1,
          status: 'active'
        }]
      })
    expect(savedHome.status).toBe(200)
    expect(savedHome.body.data.slots[0]).toMatchObject({
      slot_code: 'hot_articles',
      target_type: 'article',
      title: '首页推荐'
    })

    const homeConfig = await request(app)
      .get('/api/admin/home-config')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(homeConfig.body.data.slots).toHaveLength(1)
  })
})
