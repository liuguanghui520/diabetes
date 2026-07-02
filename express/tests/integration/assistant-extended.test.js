import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Assistant extended API', () => {
  let app, token, store

  beforeAll(async () => {
    const ctx = await createTestContext()
    app = ctx.app
    store = ctx.store
    token = await registerAndLogin(request, app)
  })

  describe('GET /api/assistant/conversations', () => {
    it('lists assistant conversations', async () => {
      const res = await request(app)
        .get('/api/assistant/conversations')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/assistant/conversations/:conversationId/messages', () => {
    it('lists messages in a conversation', async () => {
      // First create a conversation
      const conv = await store.createConversation({
        user_id: 1,
        app_type: 'assistant',
        title: 'Test Conversation',
      })
      await store.createMessage({
        conversation_id: conv.id,
        role: 'user',
        content: 'Hello',
      })

      const res = await request(app)
        .get(`/api/assistant/conversations/${conv.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })
})
