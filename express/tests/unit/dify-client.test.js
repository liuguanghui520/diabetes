import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createDifyClient } from '../../src/services/dify/client.js'

// Mock node:fs to avoid real file reads
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => Buffer.from('mock file content'))
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
        risk: 'app-risk-key'
      }
    },
    ...overrides
  }
}

describe('createDifyClient', () => {
  describe('uploadFile', () => {
    it('uploads a file and returns the file id', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'dify-file-uuid-001' })
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      const fileId = await client.uploadFile({
        appCode: 'report',
        filePath: '/tmp/test-report.pdf',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        user: 'user-123'
      })

      expect(fileId).toBe('dify-file-uuid-001')
      expect(fakeFetch).toHaveBeenCalledTimes(1)
      const [url, init] = fakeFetch.mock.calls[0]
      expect(url).toBe('http://dify.test/v1/files/upload')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe('Bearer app-report-key')
      expect(init.body).toBeInstanceOf(FormData)
    })

    it('throws when API key is missing', async () => {
      const client = createDifyClient(fakeConfig())
      await expect(client.uploadFile({
        appCode: 'nonexistent',
        filePath: '/tmp/f.pdf',
        fileName: 'f.pdf',
        mimeType: 'application/pdf',
        user: 'u'
      })).rejects.toThrow('Dify API Key')
    })

    it('throws when Dify responds with error status', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      await expect(client.uploadFile({
        appCode: 'report',
        filePath: '/tmp/test.pdf',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        user: 'u'
      })).rejects.toThrow('HTTP 400')
    })
  })

  describe('executeWorkflow', () => {
    it('sends workflow request with correct body', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          workflow_run_id: 'wf-001',
          task_id: 'task-001',
          data: {
            id: 'wf-001',
            status: 'succeeded',
            outputs: { result: 'ok' },
            total_tokens: 100
          }
        })
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      const { enqueueWorkflow } = client

      // Call enqueueWorkflow which calls executeWorkflow internally
      // We need to mock scheduleBackground by waiting
      const result = await new Promise((resolve) => {
        const mockStore = {
          createDifyLog: vi.fn().mockResolvedValue({ id: 1 }),
          updateDifyLog: vi.fn().mockResolvedValue({ id: 1 })
        }
        enqueueWorkflow('report', {
          user_id: '1',
          report_file_id: 0,
          report_text: 'test',
          file: {
            type: 'document',
            transfer_method: 'local_file',
            upload_file_id: 'dify-file-uuid-001'
          }
        }, 'user-1', {
          requestId: 'req-001',
          store: mockStore,
          onSuccess: (wfResult) => {
            resolve(wfResult)
            return { ok: true }
          }
        })
      })

      expect(fakeFetch).toHaveBeenCalledTimes(1)
      const [, init] = fakeFetch.mock.calls[0]
      const body = JSON.parse(init.body)
      expect(body.inputs.file).toEqual({
        type: 'document',
        transfer_method: 'local_file',
        upload_file_id: 'dify-file-uuid-001'
      })
      expect(body.response_mode).toBe('blocking')
      expect(body.user).toBe('user-1')
    })

    it('passes files array to top-level when provided', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          workflow_run_id: 'wf-002',
          data: { status: 'succeeded', outputs: {} }
        })
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      const { enqueueWorkflow } = client

      await new Promise((resolve) => {
        const mockStore = {
          createDifyLog: vi.fn().mockResolvedValue({ id: 2 }),
          updateDifyLog: vi.fn().mockResolvedValue({ id: 2 })
        }
        enqueueWorkflow('report', { user_id: '1', report_file_id: 0, report_text: '' }, 'user-1', {
          requestId: 'req-002',
          store: mockStore,
          files: [{ variable: 'file', transfer_method: 'local_file', upload_file_id: 'fid', type: 'document' }],
          onSuccess: () => resolve(true)
        })
      })

      const [, init] = fakeFetch.mock.calls[0]
      const body = JSON.parse(init.body)
      expect(body.files).toHaveLength(1)
      expect(body.files[0].variable).toBe('file')
    })
  })

  describe('chatStream', () => {
    it('sends chat request with inputs including file', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(c) { c.enqueue(new TextEncoder().encode('data: {}\n\n')); c.close() }
        })
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      await client.chatStream({
        appType: 'assistant',
        query: '帮我看看这份报告',
        inputs: {
          user_id: 'user-1',
          file: {
            type: 'document',
            transfer_method: 'local_file',
            upload_file_id: 'dify-file-uuid'
          }
        },
        conversationId: '',
        user: 'user-1'
      })

      const [url, init] = fakeFetch.mock.calls[0]
      expect(url).toBe('http://dify.test/v1/chat-messages')
      const body = JSON.parse(init.body)
      expect(body.inputs.file).toEqual({
        type: 'document',
        transfer_method: 'local_file',
        upload_file_id: 'dify-file-uuid'
      })
      expect(body.response_mode).toBe('streaming')
    })
  })

  describe('runWorkflow', () => {
    it('returns normalized workflow result', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          workflow_run_id: 'wf-direct',
          task_id: 'task-direct',
          data: {
            id: 'wf-direct',
            status: 'succeeded',
            outputs: { status: 'pending_confirm', indicators: [] },
            total_tokens: 50
          }
        })
      })

      const client = createDifyClient(fakeConfig(), { fetch: fakeFetch })
      const result = await client.runWorkflow('report', {
        user_id: '1',
        report_file_id: 0,
        report_text: '空腹血糖：6.4'
      }, 'user-1')

      expect(result.workflow_run_id).toBe('wf-direct')
      expect(result.task_id).toBe('task-direct')
      expect(result.outputs.status).toBe('pending_confirm')
      expect(result.total_tokens).toBe(50)
    })
  })
})
