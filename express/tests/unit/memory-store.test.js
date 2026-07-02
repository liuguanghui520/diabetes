import { describe, expect, it, beforeEach } from 'vitest'
import { createMemoryStore } from '../../src/db/memoryStore.js'

describe('MemoryStore', () => {
  let store

  beforeEach(() => {
    store = createMemoryStore()
  })

  describe('User operations', () => {
    it('creates a user', async () => {
      const user = await store.createUser({
        username: 'test',
        password_hash: 'hash',
        role: 'user',
        status: 'active',
        phone: '13800000001',
      })
      expect(user.id).toBe(1)
      expect(user.username).toBe('test')
      expect(user.role).toBe('user')
    })

    it('finds user by account (username)', async () => {
      await store.createUser({ username: 'findme', password_hash: 'h', role: 'user', status: 'active' })
      const user = await store.findUserByAccount('findme')
      expect(user).not.toBeNull()
      expect(user.username).toBe('findme')
    })

    it('finds user by account (phone)', async () => {
      await store.createUser({ username: 'phoneuser', password_hash: 'h', role: 'user', status: 'active', phone: '13811112222' })
      const user = await store.findUserByAccount('13811112222')
      expect(user).not.toBeNull()
    })

    it('finds user by id', async () => {
      await store.createUser({ username: 'iduser', password_hash: 'h', role: 'user', status: 'active' })
      const user = await store.findUserById(1)
      expect(user).not.toBeNull()
      expect(user.username).toBe('iduser')
    })

    it('returns undefined for non-existent user', async () => {
      const user = await store.findUserById(99999)
      expect(user).toBeUndefined()
    })

    it('throws conflict for duplicate username', async () => {
      await store.createUser({ username: 'dup', password_hash: 'h', role: 'user', status: 'active' })
      await expect(
        store.createUser({ username: 'dup', password_hash: 'h', role: 'user', status: 'active' })
      ).rejects.toThrow()
    })

    it('throws conflict for duplicate phone', async () => {
      await store.createUser({ username: 'u1', password_hash: 'h', role: 'user', status: 'active', phone: '13800000001' })
      await expect(
        store.createUser({ username: 'u2', password_hash: 'h', role: 'user', status: 'active', phone: '13800000001' })
      ).rejects.toThrow()
    })

    it('updates last login', async () => {
      await store.createUser({ username: 'loginuser', password_hash: 'h', role: 'user', status: 'active' })
      await store.updateLastLogin(1, { last_login_ip: '127.0.0.1' })
      const user = await store.findUserById(1)
      expect(user.last_login_ip).toBe('127.0.0.1')
    })

    it('updates password', async () => {
      await store.createUser({ username: 'pwuser', password_hash: 'oldhash', role: 'user', status: 'active' })
      await store.updatePassword(1, 'newhash', { ip_address: '127.0.0.1' })
      const user = await store.findUserById(1)
      expect(user.password_hash).toBe('newhash')
      expect(user.token_version).toBe(1)
    })
  })

  describe('Conversation operations', () => {
    it('creates conversation', async () => {
      const conv = await store.createConversation({
        user_id: 1,
        app_type: 'assistant',
        title: 'Test Chat',
      })
      expect(conv.id).toBe(1)
      expect(conv.app_type).toBe('assistant')
      expect(conv.dify_conversation_id).toBeUndefined()
    })

    it('creates message and updates conversation', async () => {
      const conv = await store.createConversation({ user_id: 1, app_type: 'assistant', title: 'Chat' })
      const msg = await store.createMessage({
        conversation_id: conv.id,
        role: 'user',
        content: 'Hello',
      })
      expect(msg.id).toBe(1)
      expect(msg.role).toBe('user')
    })

    it('lists conversations for user', async () => {
      await store.createConversation({ user_id: 1, app_type: 'assistant', title: 'Chat 1' })
      await store.createConversation({ user_id: 1, app_type: 'doctor', title: 'Doctor Chat' })
      const list = await store.listConversations(1, 'assistant')
      expect(list.length).toBe(1)
      expect(list[0].app_type).toBe('assistant')
    })

    it('lists messages for conversation', async () => {
      const conv = await store.createConversation({ user_id: 1, app_type: 'assistant', title: 'Chat' })
      await store.createMessage({ conversation_id: conv.id, role: 'user', content: 'msg1' })
      await store.createMessage({ conversation_id: conv.id, role: 'assistant', content: 'reply1' })
      const msgs = await store.listMessages(1, conv.id)
      expect(msgs.length).toBe(2)
    })

    it('throws notFound when listing messages for non-existent conversation', async () => {
      await expect(store.listMessages(1, 999)).rejects.toThrow()
    })

    it('updates conversation', async () => {
      const conv = await store.createConversation({ user_id: 1, app_type: 'assistant', title: 'Old' })
      await store.updateConversation(conv.id, { title: 'New Title' })
      const updated = await store.findConversation(1, conv.id)
      expect(updated.title).toBe('New Title')
    })

    it('throws notFound when updating non-existent conversation', async () => {
      await expect(store.updateConversation(999, { title: 'X' })).rejects.toThrow()
    })
  })

  describe('Dify log operations', () => {
    it('creates dify log', async () => {
      const log = await store.createDifyLog({
        user_id: 1,
        app_type: 'risk_assessment',
        status: 'running',
        request_id: 'req-1',
      })
      expect(log.id).toBe(1)
      expect(log.status).toBe('running')
    })

    it('updates dify log', async () => {
      await store.createDifyLog({ user_id: 1, app_type: 'risk', status: 'running', request_id: 'req-1' })
      await store.updateDifyLog(1, { status: 'succeeded', outputs: '{}' })
      const log = await store.getDifyLogByRequestId(1, 'req-1')
      expect(log.status).toBe('succeeded')
    })

    it('throws notFound when updating non-existent dify log', async () => {
      await expect(store.updateDifyLog(999, { status: 'failed' })).rejects.toThrow()
    })

    it('returns null for non-existent request id', async () => {
      const log = await store.getDifyLogByRequestId(1, 'nonexistent')
      expect(log).toBeNull()
    })
  })

  describe('Plan operations', () => {
    it('creates plan with tasks', async () => {
      const plan = await store.createPlan({
        user_id: 1,
        title: 'Test Plan',
        status: 'active',
        start_date: '2024-01-01',
        end_date: '2024-01-07',
        tasks: [
          { task_type: 'diet', title: 'Eat healthy', sort_order: 0 },
          { task_type: 'exercise', title: 'Walk', sort_order: 1 },
        ],
      })
      expect(plan.id).toBe(1)
      expect(plan.status).toBe('active')
    })

    it('gets active plan', async () => {
      await store.createPlan({
        user_id: 1,
        title: 'Active Plan',
        status: 'active',
        start_date: '2024-01-01',
        end_date: '2024-01-07',
        tasks: [],
      })
      const plan = await store.getActivePlan(1)
      expect(plan).not.toBeNull()
      expect(plan.title).toBe('Active Plan')
    })

    it('returns null for no active plan', async () => {
      const plan = await store.getActivePlan(999)
      expect(plan).toBeNull()
    })
  })

  describe('Checkin operations', () => {
    it('creates checkin record with items', async () => {
      const record = await store.createCheckin(1, {
        checkin_date: '2024-01-01',
        items: [
          { task_type: 'diet', task_title: 'Breakfast', completed: true },
        ],
      })
      expect(record).not.toBeNull()
    })

    it('gets checkin summary', async () => {
      const summary = await store.getCheckinSummary(1, { days: 7 })
      expect(summary).toHaveProperty('completion_rate')
      expect(summary).toHaveProperty('by_type')
      expect(summary).toHaveProperty('items')
    })

    it('gets checkin records', async () => {
      const records = await store.getCheckinRecords(1, { days: 30 })
      expect(Array.isArray(records)).toBe(true)
    })
  })

  describe('Risk assessment operations', () => {
    it('creates risk assessment', async () => {
      const risk = await store.createRiskAssessment({
        user_id: 1,
        inputs: { age: 30, bmi: 22 },
        score: 15,
      })
      expect(risk.id).toBe(1)
    })

    it('gets latest risk', async () => {
      await store.createRiskAssessment({ user_id: 1, inputs: {}, score: 10 })
      const risk = await store.getLatestRisk(1)
      expect(risk).not.toBeNull()
      expect(risk.score).toBe(10)
    })

    it('returns null for no risk', async () => {
      const risk = await store.getLatestRisk(999)
      expect(risk).toBeNull()
    })

    it('finds risk by idempotency key', async () => {
      await store.createRiskAssessment({ user_id: 1, idempotency_key: 'key-abc', inputs: {}, score: 5 })
      const risk = await store.findRiskByIdempotency(1, 'key-abc')
      expect(risk).not.toBeNull()
    })
  })

  describe('Doctor operations', () => {
    it('creates admin doctor', async () => {
      const doc = await store.createAdminDoctor({
        name: 'Dr. Smith',
        title: 'Chief',
        department: 'Endocrinology',
        display_status: 'published',
      })
      expect(doc.id).toBe(1)
      expect(doc.name).toBe('Dr. Smith')
    })

    it('lists doctors', async () => {
      await store.createAdminDoctor({ name: 'Dr. A', department: 'A', display_status: 'published' })
      const list = await store.listDoctors({ publishedOnly: true })
      expect(list.length).toBe(1)
    })

    it('gets doctor by id', async () => {
      await store.createAdminDoctor({ name: 'Dr. B', department: 'B', display_status: 'published' })
      const doc = await store.getDoctorById(1)
      expect(doc.name).toBe('Dr. B')
    })
  })

  describe('Article operations', () => {
    it('creates admin article', async () => {
      const article = await store.createAdminArticle({
        title: 'Test Article',
        content: 'Content',
        status: 'draft',
        author: 'Admin',
      })
      expect(article.id).toBe(1)
      expect(article.title).toBe('Test Article')
    })

    it('lists admin articles', async () => {
      const result = await store.listAdminArticles({ page: 1, pageSize: 10 })
      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('total')
    })

    it('gets admin article by id', async () => {
      await store.createAdminArticle({ title: 'A', content: 'C', status: 'published' })
      const article = await store.getAdminArticle(1)
      expect(article.title).toBe('A')
    })

    it('updates admin article', async () => {
      await store.createAdminArticle({ title: 'Old', content: 'C', status: 'draft' })
      const change = await store.updateAdminArticle(1, { title: 'New' })
      expect(change.after.title).toBe('New')
    })

    it('deletes admin article', async () => {
      await store.createAdminArticle({ title: 'To Delete', content: 'C', status: 'draft' })
      const change = await store.deleteAdminArticle(1)
      expect(change).toHaveProperty('before')
      expect(change).toHaveProperty('after')
    })

    it('sets article status', async () => {
      await store.createAdminArticle({ title: 'Publishable', content: 'C', status: 'draft' })
      const change = await store.setArticleStatus(1, 'published')
      expect(change.after.status).toBe('published')
    })
  })

  describe('Category operations', () => {
    it('creates article category', async () => {
      const cat = await store.createArticleCategory({ name: 'Diet', code: 'diet' })
      expect(cat.id).toBe(1)
      expect(cat.name).toBe('Diet')
    })

    it('lists categories', async () => {
      await store.createArticleCategory({ name: 'Diet', code: 'diet' })
      const cats = await store.listArticleCategories()
      expect(cats.length).toBe(1)
    })

    it('updates category', async () => {
      await store.createArticleCategory({ name: 'Diet', code: 'diet' })
      const change = await store.updateArticleCategory(1, { name: 'Nutrition' })
      expect(change.after.name).toBe('Nutrition')
    })

    it('deletes category', async () => {
      await store.createArticleCategory({ name: 'Diet', code: 'diet' })
      const change = await store.deleteArticleCategory(1)
      expect(change).toHaveProperty('before')
    })
  })

  describe('Privacy operations', () => {
    it('gets default data authorization', async () => {
      const auth = await store.getDataAuthorization(1)
      expect(auth).toHaveProperty('health_data_analysis_authorized', true)
      expect(auth).toHaveProperty('policy_version', 'v1.0')
    })

    it('updates data authorization', async () => {
      await store.updateDataAuthorization(1, { plan_suggestion_authorized: false }, { source: 'test' })
      const auth = await store.getDataAuthorization(1)
      expect(auth.plan_suggestion_authorized).toBe(false)
    })

    it('gets default privacy settings', async () => {
      const settings = await store.getPrivacySettings(1)
      expect(settings).toHaveProperty('health_reminder_enabled', true)
    })

    it('updates privacy settings', async () => {
      await store.updatePrivacySettings(1, { health_reminder_enabled: false }, { source: 'test' })
      const settings = await store.getPrivacySettings(1)
      expect(settings.health_reminder_enabled).toBe(false)
    })

    it('withdraws all data authorizations', async () => {
      const result = await store.withdrawAllDataAuthorization(1, { reason: 'test' }, { source: 'test' })
      expect(result).toHaveProperty('withdrawn_at')
    })

    it('lists authorization history', async () => {
      await store.updateDataAuthorization(1, { plan_suggestion_authorized: false }, { source: 'test' })
      const history = await store.listDataAuthorizationHistory(1, { page: 1, pageSize: 10 })
      expect(history.total).toBeGreaterThanOrEqual(1)
      expect(history.items.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Profile operations', () => {
    it('upserts profile', async () => {
      const profile = await store.upsertProfile(1, {
        height_cm: 170,
        weight_kg: 65,
        gender: 'male',
        age_snapshot: 30,
      })
      expect(profile.id).toBe(1)
      expect(profile.height_cm).toBe(170)
    })

    it('gets profile', async () => {
      await store.upsertProfile(1, { height_cm: 170, weight_kg: 65 })
      const profile = await store.getProfile(1)
      expect(profile).not.toBeNull()
      expect(profile.height_cm).toBe(170)
      expect(profile.weight_kg).toBe(65)
    })

    it('returns null for non-existent profile', async () => {
      const profile = await store.getProfile(999)
      expect(profile).toBeNull()
    })
  })

  describe('Upload operations', () => {
    it('creates upload record', async () => {
      const upload = await store.createUpload({
        user_id: 1,
        file_id: 'file-uuid-1',
        original_name: 'test.pdf',
        storage_path: '/uploads/test.pdf',
        biz_type: 'report',
        mime_type: 'application/pdf',
        file_size: 1024,
      })
      expect(upload.id).toBe(1)
      expect(upload.file_id).toBe('file-uuid-1')
    })

    it('gets upload by file id', async () => {
      await store.createUpload({
        user_id: 1, file_id: 'file-1', original_name: 'f.pdf',
        storage_path: '/f.pdf', biz_type: 'report', mime_type: 'application/pdf', file_size: 100,
      })
      const upload = await store.getUploadByFileId(1, 'file-1')
      expect(upload).not.toBeNull()
    })

    it('returns null for non-existent file', async () => {
      const upload = await store.getUploadByFileId(1, 'nonexistent')
      expect(upload).toBeNull()
    })
  })

  describe('Home config operations', () => {
    it('lists home config', async () => {
      const configs = await store.listHomeConfig()
      expect(Array.isArray(configs)).toBe(true)
    })

    it('replaces home config', async () => {
      const slots = [{ slot_code: 'home_banner', target_type: 'article', target_id: 1 }]
      const result = await store.replaceHomeConfig(slots, 1)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Admin user operations', () => {
    it('lists admin users', async () => {
      await store.createUser({ username: 'admin1', password_hash: 'h', role: 'user', status: 'active' })
      const result = await store.listAdminUsers()
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('items')
    })

    it('updates user status', async () => {
      await store.createUser({ username: 'statususer', password_hash: 'h', role: 'user', status: 'active' })
      const result = await store.updateUserStatus(1, 'disabled')
      expect(result).toHaveProperty('before')
      expect(result).toHaveProperty('after')
    })
  })

  describe('System messages', () => {
    it('upserts a system message', async () => {
      const msg = await store.upsertSystemMessage(1, {
        message_key: 'test-key',
        type: 'risk',
        title: 'Test Message',
        content: 'Content',
      })
      expect(msg.id).toBeGreaterThan(0)
      expect(msg.message_key).toBe('test-key')
    })

    it('replaces existing message with same key', async () => {
      await store.upsertSystemMessage(1, { message_key: 'dup-key', type: 'risk', title: 'First' })
      const updated = await store.upsertSystemMessage(1, { message_key: 'dup-key', type: 'plan', title: 'Updated' })
      expect(updated.title).toBe('Updated')
      expect(updated.type).toBe('plan')
    })

    it('lists system messages', async () => {
      await store.upsertSystemMessage(1, { message_key: 'list-1', type: 'risk', title: 'Msg1' })
      await store.upsertSystemMessage(1, { message_key: 'list-2', type: 'plan', title: 'Msg2' })
      const msgs = await store.listSystemMessages(1)
      expect(msgs.length).toBeGreaterThanOrEqual(2)
    })

    it('marks all system messages read', async () => {
      await store.upsertSystemMessage(1, { message_key: 'read-1', type: 'risk', title: 'Unread' })
      const result = await store.markAllSystemMessagesRead(1)
      expect(result).toHaveProperty('updated')
      expect(result.updated).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Checkin analysis', () => {
    it('gets checkin analysis', async () => {
      const analysis = await store.getCheckinAnalysis(1)
      // May return empty object or analysis data
      expect(analysis).toBeDefined()
    })
  })

  describe('Consultations', () => {
    it('lists consultations for a user', async () => {
      const result = await store.listConsultations({ userId: 1 })
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Home summary', () => {
    it('gets home summary', async () => {
      const summary = await store.getHomeSummary()
      expect(summary).toBeDefined()
    })
  })

  describe('Audit operations', () => {
    it('creates audit log', async () => {
      const log = await store.auditLog({
        admin_user_id: 1,
        action: 'test.action',
        target_type: 'article',
        target_id: 1,
      })
      expect(log).toBeDefined()
    })
  })

  describe('getUserContext', () => {
    it('returns user context', async () => {
      await store.createUser({ username: 'ctxuser', password_hash: 'h', role: 'user', status: 'active' })
      const ctx = await store.getUserContext(1)
      expect(ctx).toBeDefined()
      expect(ctx).toHaveProperty('profile')
      expect(ctx).toHaveProperty('latest_risk')
      expect(ctx).toHaveProperty('latest_plan')
      expect(ctx).toHaveProperty('authorizations')
    })
  })
})
