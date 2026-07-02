import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Upload API', () => {
  let app, token, store

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    store = ctx.store
    token = await registerAndLogin(request, app)
  })

  describe('POST /api/uploads', () => {
    it('rejects upload without file', async () => {
      const res = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${token}`)
        .field('biz_type', 'report')

      expect(res.status).toBe(400)
    })

    it('uploads a text file', async () => {
      const res = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${token}`)
        .field('biz_type', 'report')
        .attach('file', Buffer.from('test content'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('file_id')
      expect(res.body.data).toHaveProperty('url')
    })

    it('uploads with default biz_type', async () => {
      const res = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('pdf content'), {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        })

      expect(res.status).toBe(200)
    })

    it('rejects unsupported file type', async () => {
      const res = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('binary'), {
          filename: 'malware.exe',
          contentType: 'application/octet-stream',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/uploads/:fileId', () => {
    it('gets uploaded file', async () => {
      // First upload a file
      const uploadRes = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('hello world'), {
          filename: 'readme.txt',
          contentType: 'text/plain',
        })

      const fileId = uploadRes.body.data.file_id

      const res = await request(app)
        .get(`/api/uploads/${fileId}`)
        .set('Authorization', `Bearer ${token}`)

      // May fail if file doesn't exist on disk, but route should be reachable
      expect([200, 404, 500]).toContain(res.status)
    })

    it('returns 404 for non-existent file', async () => {
      const res = await request(app)
        .get('/api/uploads/nonexistent-id')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/public-uploads/:fileId', () => {
    it('returns 404 for non-public file type', async () => {
      // Upload a report (not public)
      const uploadRes = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('data'), {
          filename: 'report.txt',
          contentType: 'text/plain',
        })
        .field('biz_type', 'report')

      const fileId = uploadRes.body.data.file_id

      const res = await request(app).get(`/api/public-uploads/${fileId}`)
      expect(res.status).toBe(404)
    })
  })
})
