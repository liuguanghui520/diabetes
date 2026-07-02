import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createDifyClient } from '../../src/services/dify/client.js'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => Buffer.from('mock file content')),
}))

function fakeConfig(overrides = {}) {
  return {
    dify: {
      baseUrl: 'http://dify.test',
      timeoutMs: 10000,
      apiKeys: {
        report: 'app-report-key',
        assistant: 'app-assistant-key',
        doctor: 'app-doctor-key',
        risk: 'app-risk-key',
        plan: 'app-plan-key',
        checkin: 'app-checkin-key',
        admin: 'app-admin-key',
      },
    },
    ...overrides,
  }
}

describe('createDifyClient extended', () => {
  describe('uploadFile', () => {
    it('fails when fetch returns non-ok', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      })
      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      await expect(
        client.uploadFile({
          appCode: 'report',
          filePath: '/tmp/f.pdf',
          fileName: 'f.pdf',
          mimeType: 'application/pdf',
          user: 'u',
        })
      ).rejects.toThrow()
    })

    it('throws when appCode has no API key', async () => {
      const client = createDifyClient(fakeConfig())
      await expect(
        client.uploadFile({
          appCode: 'unknown',
          filePath: '/tmp/f.pdf',
          fileName: 'f.pdf',
          mimeType: 'application/pdf',
          user: 'u',
        })
      ).rejects.toThrow('Dify API Key')
    })
  })

  describe('runWorkflow', () => {
    it('calls executeWorkflow and returns normalized result', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          workflow_run_id: 'wf-run-1',
          task_id: 'task-1',
          data: {
            outputs: { result: 'ok' },
            total_tokens: 100,
          },
        }),
      })

      const store = {
        createDifyLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
      }

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      const result = await client.runWorkflow('risk', { user_id: '1' }, 'user-1', {
        requestId: 'req-1',
        store,
      })

      expect(result).toHaveProperty('workflow_run_id')
      expect(result).toHaveProperty('outputs')
    })

    it('handles error response from Dify', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ message: 'Bad Gateway' }),
      })

      const store = {
        createDifyLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
      }

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      await expect(
        client.runWorkflow('risk', {}, 'user-1', { requestId: 'req-1', store })
      ).rejects.toThrow()
    })
  })

  describe('normalizeWorkflowAdvice', () => {
    it('normalizes advice structure from outputs', () => {
      const client = createDifyClient(fakeConfig())
      const outputs = {
        advice: {
          summary: '总体健康',
          diet: ['低糖饮食', '多吃蔬菜'],
          exercise: ['每日步行30分钟'],
          review: ['3个月后复查'],
          warning: '注意血压',
          next_steps: ['预约医生', '定期监测血糖'],
        },
      }
      const result = client.normalizeWorkflowAdvice(outputs)
      expect(result.summary).toBe('总体健康')
      expect(result.diet).toEqual(['低糖饮食', '多吃蔬菜'])
      expect(result.exercise).toEqual(['每日步行30分钟'])
      expect(result.review).toEqual(['3个月后复查'])
      expect(result.warning).toBe('注意血压')
      expect(result.next_steps).toEqual(['预约医生', '定期监测血糖'])
    })

    it('uses fallback when outputs are empty', () => {
      const client = createDifyClient(fakeConfig())
      const result = client.normalizeWorkflowAdvice({}, { summary: 'fallback summary', warning: 'fallback warning' })
      expect(result.summary).toBe('fallback summary')
      expect(result.warning).toBe('fallback warning')
    })

    it('handles null outputs', () => {
      const client = createDifyClient(fakeConfig())
      const result = client.normalizeWorkflowAdvice(null, {})
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('diet')
      expect(result).toHaveProperty('exercise')
    })
  })

  describe('chatStream', () => {
    it('sends chat request with proper headers', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/event-stream']]),
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      const response = await client.chatStream({
        appType: 'assistant',
        query: 'Hello',
        inputs: {},
        conversationId: null,
        user: 'user-1',
      })

      expect(fakeFetch).toHaveBeenCalledTimes(1)
      const [url, init] = fakeFetch.mock.calls[0]
      expect(url).toBe('http://dify.test/v1/chat-messages')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe('Bearer app-assistant-key')
      expect(response.ok).toBe(true)
    })

    it('uses doctor API key for doctor appType', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map(),
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      const response = await client.chatStream({
        appType: 'doctor',
        query: 'Help',
        inputs: {},
        user: 'user-1',
      })

      expect(fakeFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer app-doctor-key')
    })

    it('passes inputs.file to request body', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map(),
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      await client.chatStream({
        appType: 'assistant',
        query: '分析报告',
        inputs: { file: { transfer_method: 'local_file', upload_file_id: 'file-1' } },
        user: 'user-1',
      })

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body)
      expect(body.inputs.file).toEqual({ transfer_method: 'local_file', upload_file_id: 'file-1' })
    })

    it('passes conversationId when provided', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map(),
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      await client.chatStream({
        appType: 'assistant',
        query: 'Continue',
        inputs: {},
        conversationId: 'conv-123',
        user: 'user-1',
      })

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body)
      expect(body.conversation_id).toBe('conv-123')
    })
  })

  describe('enqueueWorkflow', () => {
    it('returns processing status immediately', async () => {
      const client = createDifyClient(fakeConfig())
      const store = {
        createDifyLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
        updateDifyLog: vi.fn().mockResolvedValue({}),
      }
      const result = await client.enqueueWorkflow('plan', {}, 'user-1', {
        requestId: 'req-1',
        store,
        onSuccess: vi.fn().mockResolvedValue({}),
        onFailure: vi.fn(),
      })

      expect(result).toHaveProperty('request_id', 'req-1')
      expect(result).toHaveProperty('status')
    })
  })
})
