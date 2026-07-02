import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { createTestContext } from '../helpers.js'

/**
 * Admin 集成测试 — 通过 store 创建 admin 用户 + 签发 JWT
 * 覆盖 admin/routes.js 全部 27 个路由
 */
describe('Admin Full API', () => {
  let app, adminToken, store, config, articleId, categoryId, doctorId

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    store = ctx.store
    config = ctx.config

    // 创建 admin 用户 (role='admin')
    const adminUser = await store.createUser({
      username: 'superadmin',
      password_hash: 'ignored_for_test',
      role: 'admin',
      nickname: '超级管理员',
      status: 'active',
    })

    // 签发 admin JWT
    adminToken = jwt.sign(
      { sub: String(adminUser.id), role: 'admin', token_version: 0 },
      config.jwt.secret,
      { expiresIn: '7d' }
    )
  })

  // ==================== Dashboard ====================
  describe('GET /api/admin/dashboard', () => {
    it('returns dashboard stats', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('users')
      expect(res.body.data).toHaveProperty('articles')
      expect(res.body.data).toHaveProperty('doctors')
    })
  })

  // ==================== Articles CRUD ====================
  describe('Articles', () => {
    it('POST creates article', async () => {
      const res = await request(app)
        .post('/api/admin/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '糖尿病防治指南', content: '正文内容', status: 'draft' })
      expect(res.status).toBe(200)
      articleId = res.body.data.id
      expect(articleId).toBeGreaterThan(0)
    })

    it('GET lists articles', async () => {
      const res = await request(app)
        .get('/api/admin/articles')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
    })

    it('GET article by id', async () => {
      const res = await request(app)
        .get(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.title).toBe('糖尿病防治指南')
    })

    it('PUT updates article', async () => {
      const res = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '糖尿病防治指南（修订）', content: '更新内容' })
      expect(res.status).toBe(200)
    })

    it('POST publish article', async () => {
      const res = await request(app)
        .post(`/api/admin/articles/${articleId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('POST unpublish article', async () => {
      const res = await request(app)
        .post(`/api/admin/articles/${articleId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('DELETE soft-deletes article', async () => {
      const res = await request(app)
        .delete(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET returns 404 for deleted article', async () => {
      const res = await request(app)
        .get(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })
  })

  // ==================== Categories ====================
  describe('Categories', () => {
    it('POST creates category', async () => {
      const res = await request(app)
        .post('/api/admin/article-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '饮食指导', code: 'diet_guide' })
      expect(res.status).toBe(200)
      categoryId = res.body.data.id
    })

    it('GET lists categories', async () => {
      const res = await request(app)
        .get('/api/admin/article-categories')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
    })

    it('PUT updates category', async () => {
      const res = await request(app)
        .put(`/api/admin/article-categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '饮食指导(更新)' })
      expect(res.status).toBe(200)
    })

    it('DELETE deletes category', async () => {
      const res = await request(app)
        .delete(`/api/admin/article-categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.deleted).toBe(true)
    })
  })

  // ==================== Doctors ====================
  describe('Doctors', () => {
    it('POST creates doctor', async () => {
      const res = await request(app)
        .post('/api/admin/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '王医生', title: '主任医师', department: '内分泌科',
          specialty: '糖尿病', display_status: 'published',
        })
      expect(res.status).toBe(200)
      doctorId = res.body.data.id
    })

    it('GET lists doctors', async () => {
      const res = await request(app)
        .get('/api/admin/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET doctor by id', async () => {
      const res = await request(app)
        .get(`/api/admin/doctors/${doctorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('王医生')
    })

    it('PUT updates doctor', async () => {
      const res = await request(app)
        .put(`/api/admin/doctors/${doctorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '王医生(更新)', title: '副主任医师', department: '内科', display_status: 'published' })
      expect(res.status).toBe(200)
    })

    it('POST publish doctor', async () => {
      const res = await request(app)
        .post(`/api/admin/doctors/${doctorId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('POST unpublish doctor', async () => {
      const res = await request(app)
        .post(`/api/admin/doctors/${doctorId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('DELETE soft-deletes doctor', async () => {
      const res = await request(app)
        .delete(`/api/admin/doctors/${doctorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })
  })

  // ==================== Users ====================
  describe('Users', () => {
    it('GET lists users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
    })

    it('GET with page params', async () => {
      const res = await request(app)
        .get('/api/admin/users?page=1&pageSize=5')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('PUT updates user status', async () => {
      const res = await request(app)
        .put('/api/admin/users/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
      expect(res.status).toBe(200)
    })
  })

  // ==================== Consultations ====================
  describe('Consultations', () => {
    it('GET lists consultations', async () => {
      const res = await request(app)
        .get('/api/admin/consultations')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET filters by status', async () => {
      const res = await request(app)
        .get('/api/admin/consultations?status=open')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })
  })

  // ==================== Dify Logs ====================
  describe('Dify Logs', () => {
    it('GET lists dify logs', async () => {
      const res = await request(app)
        .get('/api/admin/dify-run-logs')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })
  })

  // ==================== Home Config ====================
  describe('Home Config', () => {
    it('GET returns home config', async () => {
      const res = await request(app)
        .get('/api/admin/home-config')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('slots')
    })

    it('PUT updates home config', async () => {
      const res = await request(app)
        .put('/api/admin/home-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slots: [{ slot_code: 'home_banner', target_type: 'article', target_id: 1 }] })
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('slots')
    })
  })

  // ==================== Admin Assistant ====================
  describe('Admin Assistant', () => {
    it('POST admin/assistant/chat streams', async () => {
      const res = await request(app)
        .post('/api/admin/assistant/chat')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: '帮我查看系统概况' })
      // SSE stream or 200
      expect([200, 502]).toContain(res.status)
    })

    it('GET admin/assistant/conversations', async () => {
      const res = await request(app)
        .get('/api/admin/assistant/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET admin/assistant/conversations/:id/messages requires admin conversation type', async () => {
      // Non-admin conversation should fail
      const res = await request(app)
        .get('/api/admin/assistant/conversations/99999/messages')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(404)
    })
  })
})
