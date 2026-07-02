import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock pg before importing sqlStore
vi.mock('pg', () => {
  const mockPool = vi.fn()
  mockPool.prototype.query = vi.fn()
  mockPool.prototype.connect = vi.fn()
  mockPool.prototype.end = vi.fn()
  return { default: { Pool: mockPool } }
})

import { createSqlStore } from '../../src/db/sqlStore.js'

function mockPool() {
  // Default: every query returns { rows: [{ id: 1 }], rowCount: 1 }
  const query = vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 })
  const clientQuery = vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 })
  const release = vi.fn()
  const connect = vi.fn().mockResolvedValue({
    query: clientQuery,
    release,
  })
  return { query, connect, clientQuery, release }
}

function createStore(pool) {
  return createSqlStore(pool || mockPool())
}

describe('sqlStore', () => {
  let pool, store

  beforeEach(() => {
    pool = mockPool()
    store = createStore(pool)
  })

  // ==================== User methods ====================
  describe('findUserByAccount', () => {
    it('returns user by username', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'test' }] })
      const user = await store.findUserByAccount('test')
      expect(user.id).toBe(1)
    })

    it('returns null when not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] })
      const user = await store.findUserByAccount('nobody')
      expect(user).toBeNull()
    })
  })

  describe('findUserById', () => {
    it('returns user by id', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'u' }] })
      const user = await store.findUserById(1)
      expect(user.id).toBe(1)
    })
  })

  describe('createUser', () => {
    it('creates user and returns it', async () => {
      // duplicate check query
      pool.query.mockResolvedValueOnce({ rows: [] })
      // insert query - returns rows[0]
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'newuser', role: 'user' }] })
      const user = await store.createUser({
        username: 'newuser',
        password_hash: 'hash',
        role: 'user',
        status: 'active',
      })
      expect(user).toBeDefined()
    })
  })

  // ==================== Profile methods ====================
  describe('getProfile', () => {
    it('returns profile', async () => {
      const profile = await store.getProfile(1)
      expect(profile).toBeDefined()
    })

    it('returns null when not found', async () => {
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [] })
      const profile = await store.getProfile(999)
      expect(profile).toBeNull()
    })
  })

  describe('upsertProfile', () => {
    it('inserts new profile', async () => {
      // check existing → not found
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, height_cm: 170, weight_kg: 65 }] })
      const profile = await store.upsertProfile(1, { height_cm: 170, weight_kg: 65 })
      expect(profile).toBeDefined()
    })

    it('updates existing profile', async () => {
      // check existing → found
      pool.query.mockReset()
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, height_cm: 160 }] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, height_cm: 170 }] })
      const profile = await store.upsertProfile(1, { height_cm: 170 })
      expect(profile).toBeDefined()
    })
  })

  // ==================== Privacy methods ====================
  describe('getPrivacySettings', () => {
    it('returns privacy settings', async () => {
      const settings = await store.getPrivacySettings(1)
      expect(settings).toBeDefined()
    })
  })

  describe('getDataAuthorization', () => {
    it('returns data authorization', async () => {
      const auth = await store.getDataAuthorization(1)
      expect(auth).toBeDefined()
    })
  })

  describe('updatePrivacySettings', () => {
    it('updates privacy settings', async () => {
      // ensurePrivacySettingsRow
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      // update
      pool.query.mockResolvedValueOnce({ rows: [{ health_reminder_enabled: false }] })
      const result = await store.updatePrivacySettings(1, { health_reminder_enabled: false })
      expect(result).toBeDefined()
    })
  })

  describe('updateDataAuthorization', () => {
    it('updates data authorization', async () => {
      // ensureDataAuthorizationRow
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      // update
      pool.query.mockResolvedValueOnce({ rows: [{ plan_suggestion_authorized: false }] })
      // insert log
      pool.query.mockResolvedValueOnce({ rows: [] })
      const result = await store.updateDataAuthorization(1, { plan_suggestion_authorized: false })
      expect(result).toBeDefined()
    })
  })

  // ==================== Risk methods ====================
  describe('createRiskAssessment', () => {
    it('creates risk assessment', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, score: 15 }] })
      const risk = await store.createRiskAssessment({
        user_id: 1, inputs: {}, score: 15,
      })
      expect(risk.score).toBe(15)
    })
  })

  describe('getLatestRisk', () => {
    it('returns latest risk', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, score: 20 }] })
      const risk = await store.getLatestRisk(1)
      expect(risk.score).toBe(20)
    })
  })

  // ==================== Conversation methods ====================
  describe('createConversation', () => {
    it('creates conversation', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, app_type: 'assistant', title: 'Chat' }] })
      const conv = await store.createConversation({ user_id: 1, app_type: 'assistant', title: 'Chat' })
      expect(conv.app_type).toBe('assistant')
    })
  })

  describe('listConversations', () => {
    it('lists conversations', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const list = await store.listConversations(1, 'assistant')
      expect(list.length).toBe(1)
    })
  })

  describe('createMessage', () => {
    it('creates message', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Hello' }] })
      const msg = await store.createMessage({
        conversation_id: 1, role: 'user', content: 'Hello',
      })
      expect(msg.content).toBe('Hello')
    })
  })

  // ==================== Plan methods ====================
  describe('getActivePlan', () => {
    it('returns active plan', async () => {
      pool.query.mockReset()
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Plan', status: 'active' }] })  // plan query
        .mockResolvedValueOnce({ rows: [] })  // tasks query
      const plan = await store.getActivePlan(1)
      expect(plan).toBeDefined()
    })
  })

  describe('createPlan', () => {
    it('creates plan', async () => {
      // Transaction uses client.query, not pool.query
      pool.query.mockReset()
      pool.clientQuery.mockReset()
      pool.clientQuery
        .mockResolvedValueOnce({ rows: [] })       // begin
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // insert plan
        .mockResolvedValueOnce({ rows: [] })       // batch insert tasks
        .mockResolvedValueOnce({ rows: [{ id: 1, title: 'New Plan', status: 'active' }] }) // select
        .mockResolvedValueOnce({ rows: [] })        // commit
      pool.query.mockResolvedValueOnce({ rows: [] }) // refreshCheckinCompletion

      const plan = await store.createPlan({
        user_id: 1,
        title: 'New Plan',
        status: 'active',
        start_date: '2024-01-01',
        end_date: '2024-01-07',
        tasks: [],
      })
      expect(plan).toBeDefined()
    })
  })

  // ==================== Checkin methods ====================
  describe('getCheckinSummary', () => {
    it('returns checkin summary', async () => {
      const summary = await store.getCheckinSummary(1, { days: 7 })
      expect(summary).toBeDefined()
    })
  })

  describe('getCheckinRecords', () => {
    it('returns checkin records', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] })
      const records = await store.getCheckinRecords(1, { days: 7 })
      expect(Array.isArray(records)).toBe(true)
    })
  })

  // ==================== Doctor methods ====================
  describe('getDoctorById', () => {
    it('returns doctor', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Dr. X' }] })
      const doc = await store.getDoctorById(1)
      expect(doc.name).toBe('Dr. X')
    })
  })

  describe('listDoctors', () => {
    it('lists doctors', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
      const list = await store.listDoctors({ publishedOnly: true })
      expect(list.length).toBe(1)
    })
  })

  // ==================== Article methods ====================
  describe('getArticleById', () => {
    it('returns article', async () => {
      const article = await store.getArticleById(1)
      expect(article).toBeDefined()
    })
  })

  describe('listAdminArticles', () => {
    it('lists admin articles', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] })
      pool.query.mockResolvedValueOnce({ rows: [{ total: 0 }] })
      const result = await store.listAdminArticles({ page: 1, pageSize: 20 })
      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('total')
    })
  })

  describe('createAdminArticle', () => {
    it('creates article', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'New' }] })
      const article = await store.createAdminArticle({ title: 'New', content: 'C', status: 'draft' })
      expect(article.title).toBe('New')
    })
  })

  // ==================== Dify log methods ====================
  describe('createDifyLog', () => {
    it('creates dify log', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'running' }] })
      const log = await store.createDifyLog({ user_id: 1, app_type: 'risk', request_id: 'r1' })
      expect(log.status).toBe('running')
    })
  })

  // ==================== System messages ====================
  describe('listSystemMessages', () => {
    it('lists system messages', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] })
      const msgs = await store.listSystemMessages(1)
      expect(Array.isArray(msgs)).toBe(true)
    })
  })

  describe('markAllSystemMessagesRead', () => {
    it('marks messages read', async () => {
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 3 })
      const result = await store.markAllSystemMessagesRead(1)
      expect(result.updated).toBe(3)
    })
  })

  // ==================== Admin methods ====================
  describe('listAdminUsers', () => {
    it('lists admin users', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] })
      pool.query.mockResolvedValueOnce({ rows: [{ total: 0 }] })
      const result = await store.listAdminUsers()
      expect(result).toHaveProperty('items')
    })
  })

  describe('updateUserStatus', () => {
    it('updates user status', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] })
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'disabled' }] })
      const result = await store.updateUserStatus(1, 'disabled')
      expect(result.after.status).toBe('disabled')
    })
  })

  describe('listConsultations', () => {
    it('lists consultations', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] })
      const result = await store.listConsultations({})
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // ==================== Upload methods ====================
  describe('createUpload', () => {
    it('creates upload', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, file_id: 'f1' }] })
      const upload = await store.createUpload({
        user_id: 1, file_id: 'f1', original_name: 'test.pdf',
        storage_path: '/tmp/test.pdf', biz_type: 'report',
      })
      expect(upload.file_id).toBe('f1')
    })
  })

  describe('getUploadByFileId', () => {
    it('returns upload', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ file_id: 'f1' }] })
      const upload = await store.getUploadByFileId(1, 'f1')
      expect(upload.file_id).toBe('f1')
    })
  })

  // ==================== Home config ====================
  describe('listHomeConfig', () => {
    it('lists home configs', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] })
      const configs = await store.listHomeConfig()
      expect(Array.isArray(configs)).toBe(true)
    })
  })

  describe('replaceHomeConfig', () => {
    it('replaces home configs', async () => {
      pool.query.mockReset()
      pool.clientQuery.mockReset()
      pool.clientQuery
        .mockResolvedValueOnce({ rows: [] })  // begin
        .mockResolvedValueOnce({ rows: [] })  // delete
        .mockResolvedValueOnce({ rows: [] })  // insert
        .mockResolvedValueOnce({ rows: [] })  // commit
      pool.query.mockResolvedValueOnce({ rows: [] })  // list

      const result = await store.replaceHomeConfig(
        [{ slot_code: 'home_banner', target_type: 'article', target_id: 1 }],
        1
      )
      expect(Array.isArray(result)).toBe(true)
    })
  })
})
