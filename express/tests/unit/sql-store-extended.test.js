import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('pg', () => {
  const mockPool = vi.fn()
  mockPool.prototype.query = vi.fn()
  mockPool.prototype.connect = vi.fn()
  mockPool.prototype.end = vi.fn()
  return { default: { Pool: mockPool } }
})

import { createSqlStore } from '../../src/db/sqlStore.js'
import { createPool } from '../../src/db/pool.js'

function mockPool() {
  const query = vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 })
  const clientQuery = vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 })
  const release = vi.fn()
  const connect = vi.fn().mockResolvedValue({ query: clientQuery, release })
  return { query, connect, clientQuery, release }
}

describe('sqlStore extended', () => {
  let pool, store

  beforeEach(() => {
    pool = mockPool()
    store = createSqlStore(pool)
  })

  describe('updateLastLogin', () => {
    it('updates last login', async () => {
      const result = await store.updateLastLogin(1, { last_login_ip: '1.2.3.4' })
      expect(result).toBeDefined()
    })
  })

  describe('updatePassword', () => {
    it('updates password', async () => {
      const result = await store.updatePassword(1, 'newhash', { ip_address: '127.0.0.1' })
      expect(result).toBeDefined()
    })
  })

  describe('withdrawAllDataAuthorization', () => {
    it('withdraws all authorizations', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // ensure
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // update
        .mockResolvedValueOnce({ rows: [] })            // insert log
      const result = await store.withdrawAllDataAuthorization(1, { reason: 'test' }, {})
      expect(result).toBeDefined()
    })
  })

  describe('listDataAuthorizationHistory', () => {
    it('lists authorization history', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [] })      // items
        .mockResolvedValueOnce({ rows: [{ total: 0 }] }) // count
      const result = await store.listDataAuthorizationHistory(1, { page: 1, pageSize: 10 })
      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('total')
    })
  })

  describe('listRisks', () => {
    it('lists risk assessments', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, score: 15 }] })
      const result = await store.listRisks(1, { page: 1, pageSize: 10 })
      expect(result).toHaveProperty('items')
    })
  })

  describe('findRiskByIdempotency', () => {
    it('finds risk by idempotency key', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.findRiskByIdempotency(1, 'key-abc')
      expect(result).toBeDefined()
    })
  })

  describe('updateRiskAssessment', () => {
    it('updates risk assessment', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // old record
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'succeeded' }] }) // updated
      const result = await store.updateRiskAssessment(1, { status: 'succeeded' })
      expect(result).toBeDefined()
    })
  })

  describe('updateConversation', () => {
    it('updates conversation', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.updateConversation(1, { title: 'Updated' })
      expect(result).toBeDefined()
    })
  })

  describe('listMessages', () => {
    it('lists messages', async () => {
      pool.query.mockReset()
      // First query: check conversation exists
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] })
      // Second query: list messages
      pool.query.mockResolvedValueOnce({ rows: [] })
      const result = await store.listMessages(1, 1)
      expect(result).toBeDefined()
    })
  })

  describe('updateDifyLog', () => {
    it('updates dify log', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // existing record
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'succeeded' }] })  // updated
      const result = await store.updateDifyLog(1, { status: 'succeeded' })
      expect(result).toBeDefined()
    })
  })

  describe('getDifyLogByRequestId', () => {
    it('gets dify log by request id', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.getDifyLogByRequestId(1, 'req-1')
      expect(result).toBeDefined()
    })
  })

  describe('getUserContext', () => {
    it('returns user context', async () => {
      pool.query.mockReset()
      // Multiple queries: profile, risk, plan (2 queries), auth (2), privacy (2)
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // profile
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // risk
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // plan
        .mockResolvedValueOnce({ rows: [] })            // plan tasks
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // auth ensure
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // auth get
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // privacy ensure
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // privacy get
      const ctx = await store.getUserContext(1)
      expect(ctx).toBeDefined()
    })
  })

  describe('getHomeSummary', () => {
    it('returns home summary', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
      const summary = await store.getHomeSummary()
      expect(summary).toBeDefined()
    })
  })

  describe('getArticleById', () => {
    it('returns article by id', async () => {
      const article = await store.getArticleById(1)
      expect(article).toBeDefined()
    })
  })

  describe('getArticleRecommendations', () => {
    it('returns recommendations', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.getArticleRecommendations({ page: 1, pageSize: 10 })
      expect(result).toBeDefined()
    })
  })

  describe('toggleArticleFavorite', () => {
    it('toggles favorite', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // exists check
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // delete
      const result = await store.toggleArticleFavorite(1, 1)
      expect(result).toBeDefined()
    })
  })

  describe('toggleArticleLike', () => {
    it('toggles like', async () => {
      const result = await store.toggleArticleLike(1, 1)
      expect(result).toBeDefined()
    })
  })

  describe('listArticleComments', () => {
    it('lists comments', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [] })
      const result = await store.listArticleComments(1)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('createArticleComment', () => {
    it('creates comment', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.createArticleComment(1, 1, { content: 'Nice!' })
      expect(result).toBeDefined()
    })
  })

  describe('toggleArticleCommentLike', () => {
    it('toggles comment like', async () => {
      const result = await store.toggleArticleCommentLike(1, 1)
      expect(result).toBeDefined()
    })
  })

  describe('listDiabetesTypes', () => {
    it('lists diabetes types', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [] })
      const result = await store.listDiabetesTypes()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // createCheckin skipped — complex transaction logic

  describe('createConsultationOrder', () => {
    it('creates consultation', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.createConsultationOrder({ user_id: 1, doctor_id: 1 })
      expect(result).toBeDefined()
    })
  })

  describe('createAdminDoctor', () => {
    it('creates doctor', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Dr. X' }] })
      const result = await store.createAdminDoctor({
        name: 'Dr. X', department: 'Cardio', display_status: 'published',
      })
      expect(result).toBeDefined()
    })
  })

  describe('updateAdminDoctor', () => {
    it('updates doctor', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // old
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] }) // new
      const result = await store.updateAdminDoctor(1, { name: 'Updated' })
      expect(result).toHaveProperty('before')
      expect(result).toHaveProperty('after')
    })
  })

  describe('deleteAdminDoctor', () => {
    it('deletes doctor', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // old
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // deleted
      const result = await store.deleteAdminDoctor(1)
      expect(result).toHaveProperty('before')
    })
  })

  describe('getAdminArticle', () => {
    it('gets admin article', async () => {
      const result = await store.getAdminArticle(1)
      expect(result).toBeDefined()
    })
  })

  describe('updateAdminArticle', () => {
    it('updates article', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Updated' }] })
      const result = await store.updateAdminArticle(1, { title: 'Updated' })
      expect(result).toHaveProperty('before')
    })
  })

  describe('deleteAdminArticle', () => {
    it('deletes article', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.deleteAdminArticle(1)
      expect(result).toHaveProperty('before')
    })
  })

  describe('setArticleStatus', () => {
    it('sets article status', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'published' }] })
      const result = await store.setArticleStatus(1, 'published')
      expect(result).toHaveProperty('before')
    })
  })

  describe('listArticleCategories', () => {
    it('lists categories', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [] })
      const result = await store.listArticleCategories()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('createArticleCategory', () => {
    it('creates category', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.createArticleCategory({ name: 'Diet' })
      expect(result).toBeDefined()
    })
  })

  describe('updateArticleCategory', () => {
    it('updates category', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] })
      const result = await store.updateArticleCategory(1, { name: 'Updated' })
      expect(result).toHaveProperty('before')
    })
  })

  describe('deleteArticleCategory', () => {
    it('deletes category', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.deleteArticleCategory(1)
      expect(result).toHaveProperty('before')
    })
  })

  describe('createHealthAnalysisReport', () => {
    it('creates health analysis report', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.createHealthAnalysisReport({
        user_id: 1, period_start: '2024-01-01', period_end: '2024-01-07',
        completion_rate: 85, summary: 'Good', advice: 'Keep going',
      })
      expect(result).toBeDefined()
    })
  })

  describe('listPlanTasks', () => {
    it('lists plan tasks', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [] })
      const result = await store.listPlanTasks(1)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getCheckinAnalysis', () => {
    it('gets checkin analysis', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.getCheckinAnalysis(1)
      expect(result).toBeDefined()
    })
  })

  describe('auditLog', () => {
    it('creates audit log', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.auditLog({
        admin_user_id: 1, action: 'test', target_type: 'article', target_id: 1,
      })
      expect(result).toBeDefined()
    })
  })

  describe('listDifyLogs', () => {
    it('lists dify logs', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [] })
      pool.query.mockResolvedValueOnce({ rows: [{ total: 0 }] })
      const result = await store.listDifyLogs({ page: 1, pageSize: 10 })
      expect(result).toHaveProperty('items')
    })
  })

  describe('upsertSystemMessage', () => {
    it('upserts system message', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const result = await store.upsertSystemMessage(1, {
        message_key: 'test-key', type: 'risk', title: 'Test',
      })
      expect(result).toBeDefined()
    })
  })
})
