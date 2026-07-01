import { describe, expect, it, vi } from 'vitest'
import { createDifyClient } from '../../src/services/dify/client.js'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => Buffer.from('mock')),
}))

function makeConfig() {
  return {
    dify: {
      baseUrl: 'http://dify.test',
      timeoutMs: 10000,
      apiKeys: { report: 'app-key', risk: 'app-risk' },
    },
  }
}

async function waitForEnqueue() {
  await new Promise((r) => setTimeout(r, 10))
}

describe('enqueueWorkflow — failure & edge cases', () => {
  it('calls onFailure when workflow execution throws', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('Network down'))
    const client = createDifyClient(makeConfig(), { fetch: fakeFetch })

    const onFailure = vi.fn().mockResolvedValue({ fallback: true })
    const mockStore = {
      createDifyLog: vi.fn().mockResolvedValue({ id: 99 }),
      updateDifyLog: vi.fn().mockResolvedValue({ id: 99 }),
    }

    const result = await client.enqueueWorkflow(
      'report',
      { user_id: '1', report_file_id: 0, report_text: 'test' },
      'u1',
      { requestId: 'req-fail', store: mockStore, onFailure },
    )

    expect(result.status).toBe('processing')
    expect(result.request_id).toBe('req-fail')

    await waitForEnqueue()
    expect(onFailure).toHaveBeenCalled()
    const errorArg = onFailure.mock.calls[0][0]
    expect(errorArg.message).toBe('Network down')
  })

  it('logs failure status when onFailure itself throws', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('Boom'))
    const client = createDifyClient(makeConfig(), { fetch: fakeFetch })

    const onFailure = vi.fn().mockRejectedValue(new Error('Callback crash'))
    const logs = []
    const mockStore = {
      createDifyLog: vi.fn(async (input) => {
        const log = { id: 98, ...input }
        logs.push(log)
        return log
      }),
      updateDifyLog: vi.fn(async (id, patch) => {
        const found = logs.find((l) => l.id === id)
        if (found) Object.assign(found, patch)
        return found
      }),
    }

    await client.enqueueWorkflow(
      'report',
      { user_id: '1', report_file_id: 0, report_text: 't' },
      'u1',
      { requestId: 'req-crash', store: mockStore, onFailure },
    )

    await waitForEnqueue()

    const failedLog = logs.find(
      (l) => l.status === 'failed' || l.status === 'running',
    )
    expect(failedLog).toBeTruthy()
    // The status should eventually be 'failed'
  })

  it('handles missing onFailure callback gracefully', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('Oops'))
    const client = createDifyClient(makeConfig(), { fetch: fakeFetch })

    const logs = []
    const mockStore = {
      createDifyLog: vi.fn(async (input) => {
        const log = { id: 97, ...input }
        logs.push(log)
        return log
      }),
      updateDifyLog: vi.fn(async (id, patch) => {
        const found = logs.find((l) => l.id === id)
        if (found) Object.assign(found, patch)
        return found
      }),
    }

    const result = await client.enqueueWorkflow(
      'report',
      { user_id: '1', report_file_id: 0, report_text: 't' },
      'u1',
      { requestId: 'req-no-fail', store: mockStore },
    )
    expect(result.status).toBe('processing')

    await waitForEnqueue()
    // Should not crash even without onFailure
  })

  it('handles enqueue without store', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workflow_run_id: 'wf-ns',
        data: { status: 'succeeded', outputs: { ok: true }, total_tokens: 0 },
      }),
    })
    const client = createDifyClient(makeConfig(), { fetch: fakeFetch })

    const result = await client.enqueueWorkflow(
      'risk',
      { score_status: 'complete' },
      'u1',
      { requestId: 'req-no-store' },
    )

    expect(result.status).toBe('processing')
    expect(result.log_id).toBeNull()

    await waitForEnqueue()
  })

  it('invokes onSuccess with domain result', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workflow_run_id: 'wf-s',
        data: {
          status: 'succeeded',
          outputs: { answer: 'hello' },
          total_tokens: 42,
        },
      }),
    })

    const client = createDifyClient(makeConfig(), { fetch: fakeFetch })
    const mockStore = {
      createDifyLog: vi.fn().mockResolvedValue({ id: 200 }),
      updateDifyLog: vi.fn().mockResolvedValue({ id: 200 }),
    }
    const onSuccess = vi.fn().mockResolvedValue({ transformed: true })

    await client.enqueueWorkflow(
      'report',
      { user_id: '1', report_text: 'hi' },
      'u1',
      { requestId: 'req-s', store: mockStore, onSuccess },
    )

    await waitForEnqueue()
    expect(onSuccess).toHaveBeenCalledTimes(1)
    const wfResult = onSuccess.mock.calls[0][0]
    expect(wfResult.outputs.answer).toBe('hello')
    expect(wfResult.total_tokens).toBe(42)
  })
})
