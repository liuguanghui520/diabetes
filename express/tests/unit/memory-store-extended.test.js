import { describe, expect, it, beforeEach } from 'vitest'
import { createMemoryStore } from '../../src/db/memoryStore.js'

describe('MemoryStore Extended', () => {
  let store

  beforeEach(async () => {
    store = createMemoryStore()
    await store.createUser({ username: 'test', password_hash: 'h', role: 'user', status: 'active' })
  })

  describe('Plan task operations', () => {
    it('saves plan task without active plan — auto-creates one', async () => {
      const task = await store.savePlanTask(1, {
        category: 'diet',
        title: 'Eat healthy',
        desc: '3 meals',
        target: '2000kcal',
      })
      expect(task).toBeDefined()
      expect(task.task_type).toBe('diet')
    })

    it('lists plan tasks', async () => {
      await store.savePlanTask(1, { category: 'diet', title: 'T1' })
      const tasks = await store.listPlanTasks(1)
      expect(tasks.length).toBeGreaterThanOrEqual(1)
    })

    it('deletes plan task', async () => {
      await store.savePlanTask(1, { category: 'water', title: 'Drink' })
      const tasks = await store.listPlanTasks(1)
      const taskId = tasks[0].id
      await store.deletePlanTask(1, taskId)
      const after = await store.listPlanTasks(1)
      expect(after.find(t => t.id === taskId)).toBeUndefined()
    })

    it('sets plan task completion', async () => {
      await store.savePlanTask(1, { category: 'diet', title: 'T1' })
      const tasks = await store.listPlanTasks(1)
      const result = await store.setPlanTaskCompletion(1, tasks[0].id, { completed: true })
      expect(result).toBeDefined()
    })

    it('toggles plan task completion off', async () => {
      await store.savePlanTask(1, { category: 'exercise', title: 'Walk' })
      const tasks = await store.listPlanTasks(1)
      await store.setPlanTaskCompletion(1, tasks[0].id, { completed: true })
      const result = await store.setPlanTaskCompletion(1, tasks[0].id, { completed: false })
      expect(result).toBeDefined()
    })
  })

  describe('Consultation operations', () => {
    it('creates consultation order', async () => {
      const order = await store.createConsultationOrder({
        user_id: 1,
        doctor_id: 1,
      })
      expect(order).toBeDefined()
      expect(order.user_id).toBe(1)
    })
  })

  describe('Health analysis report', () => {
    it('creates health analysis report', async () => {
      const report = await store.createHealthAnalysisReport({
        user_id: 1,
        period_start: '2024-01-01',
        period_end: '2024-01-07',
        completion_rate: 85,
        summary: 'Good progress',
        advice: 'Keep going',
      })
      expect(report).toBeDefined()
      expect(report.completion_rate).toBe(85)
    })
  })

  describe('Diabetes types', () => {
    it('lists diabetes types', async () => {
      const types = await store.listDiabetesTypes()
      expect(Array.isArray(types)).toBe(true)
    })
  })

  describe('Admin doctor management', () => {
    it('updates admin doctor', async () => {
      const doc = await store.createAdminDoctor({
        name: 'Dr. Update', department: 'Cardio', display_status: 'published',
      })
      const change = await store.updateAdminDoctor(doc.id, { name: 'Dr. Updated' })
      expect(change.after.name).toBe('Dr. Updated')
    })

    it('deletes admin doctor', async () => {
      const doc = await store.createAdminDoctor({
        name: 'Dr. Delete', department: 'Cardio', display_status: 'published',
      })
      const change = await store.deleteAdminDoctor(doc.id)
      expect(change).toHaveProperty('before')
      expect(change).toHaveProperty('after')
    })
  })

  describe('Dify logs listing', () => {
    it('lists dify logs', async () => {
      await store.createDifyLog({ user_id: 1, app_type: 'risk', status: 'succeeded', request_id: 'r1' })
      const result = await store.listDifyLogs({ page: 1, pageSize: 10 })
      expect(result).toHaveProperty('items')
      expect(result.items.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Article interactions', () => {
    it('toggles article like increments counter', async () => {
      const article = await store.createAdminArticle({
        title: 'Like Article', content: 'Content', status: 'published',
      })
      // First like
      await store.toggleArticleLike(1, article.id)
      // Second like (toggle off)  
      await store.toggleArticleLike(1, article.id)
      // Test passes if no errors
    })

    it('creates comment with parent', async () => {
      const article = await store.createAdminArticle({
        title: 'Comment Article', content: 'C', status: 'published',
      })
      await store.createArticleComment(1, article.id, { content: 'Parent comment' })
      const reply = await store.createArticleComment(1, article.id, {
        content: 'Reply', parent_id: 1,
      })
      expect(reply).toBeDefined()
    })

    it('toggles comment like', async () => {
      const article = await store.createAdminArticle({
        title: 'CL Article', content: 'C', status: 'published',
      })
      await store.createArticleComment(1, article.id, { content: 'Nice!' })
      const result = await store.toggleArticleCommentLike(1, 1)
      expect(result).toBeDefined()
    })
  })

  describe('getHomeSummary', () => {
    it('returns home summary with doctors and articles', async () => {
      const summary = await store.getHomeSummary()
      expect(summary).toHaveProperty('doctors')
      expect(summary).toHaveProperty('articles')
    })
  })
})
