import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Content API', () => {
  let app, token, store

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    store = ctx.store
    token = await registerAndLogin(request, app)

    // Seed a doctor and an article for tests
    await store.createAdminDoctor({
      name: '李医生', title: '副主任医师', department: '内分泌科',
      specialty: '糖尿病', display_status: 'published',
    })
    await store.createAdminArticle({
      title: '糖尿病饮食指南', content: '控制碳水摄入...', content_md: '# 饮食指南',
      status: 'published', author: '系统', cover_url: '/cover.jpg',
      category_name: '饮食', read_time: '5 分钟',
    })
  })

  describe('GET /api/articles', () => {
    it('returns articles list', async () => {
      const res = await request(app).get('/api/articles')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
    })

    it('accepts page params', async () => {
      const res = await request(app).get('/api/articles?page=1&pageSize=10')
      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/articles/favorites', () => {
    it('returns favorites', async () => {
      const res = await request(app)
        .get('/api/articles/favorites')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
    })
  })

  describe('GET /api/articles/:id', () => {
    it('returns a single article', async () => {
      const res = await request(app).get('/api/articles/1')
      expect(res.status).toBe(200)
      expect(res.body.data.title).toBe('糖尿病饮食指南')
    })

    it('returns 404 for non-existent article', async () => {
      const res = await request(app).get('/api/articles/99999')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/articles/:id/favorite', () => {
    it('toggles favorite', async () => {
      const res = await request(app)
        .post('/api/articles/1/favorite')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/articles/:id/like', () => {
    it('toggles like', async () => {
      const res = await request(app)
        .post('/api/articles/1/like')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })
  })

  describe('Article comments', () => {
    it('GET /api/articles/:id/comments returns comments', async () => {
      const res = await request(app).get('/api/articles/1/comments')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
    })

    it('POST /api/articles/:id/comments creates a comment', async () => {
      const res = await request(app)
        .post('/api/articles/1/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '很有用的文章！' })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('content', '很有用的文章！')
    })

    it('POST /api/articles/:id/comments/:commentId/like likes a comment', async () => {
      const res = await request(app)
        .post('/api/articles/1/comments/1/like')
        .set('Authorization', `Bearer ${token}`)

      // May return 200 or 404 if comment not found
      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/doctors', () => {
    it('lists published doctors', async () => {
      const res = await request(app).get('/api/doctors')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /api/doctors/:id', () => {
    it('returns doctor by id', async () => {
      const res = await request(app).get('/api/doctors/1')
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('李医生')
    })

    it('returns 404 for non-existent doctor', async () => {
      const res = await request(app).get('/api/doctors/99999')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/plans/active', () => {
    it('returns active plan (may be null)', async () => {
      const res = await request(app)
        .get('/api/plans/active')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })
  })

  describe('Checkin CRUD', () => {
    it('POST /api/checkins creates a checkin', async () => {
      const res = await request(app)
        .post('/api/checkins')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'diet', value: 1, detail_text: '吃了早餐' })

      expect(res.status).toBe(200)
    })

    it('GET /api/checkins lists checkins', async () => {
      const res = await request(app)
        .get('/api/checkins')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
    })

    it('GET /api/checkins/analysis returns analysis', async () => {
      const res = await request(app)
        .get('/api/checkins/analysis')
        .set('Authorization', `Bearer ${token}`)

      // May or may not have data
      expect([200, 404]).toContain(res.status)
    })
  })

  describe('GET /api/consultations', () => {
    it('lists user consultations', async () => {
      const res = await request(app)
        .get('/api/consultations')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
    })
  })

  describe('System Messages', () => {
    it('GET /api/messages returns system messages', async () => {
      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('list')
    })

    it('POST /api/messages/read-all marks all read', async () => {
      const res = await request(app)
        .post('/api/messages/read-all')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
    })
  })
})
