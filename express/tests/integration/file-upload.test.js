import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestContext, registerAndLogin } from '../helpers.js'

describe('Report Interpretation', () => {
  it('interprets report with file upload via local_file', async () => {
    const { app, store, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    // Create an upload record with storage_path
    await store.createUpload({
      file_id: 'file_test_report_001',
      user_id: 1,
      biz_type: 'report',
      file_name: 'health-report.pdf',
      stored_name: 'test-uuid-report.pdf',
      mime_type: 'application/pdf',
      size_bytes: 102400,
      storage_path: '/tmp/test-health-report.pdf',
      url: '/api/uploads/file_test_report_001'
    })

    const response = await request(app)
      .post('/api/reports/interpret')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_file_id: 'file_test_report_001',
        report_text: '',
        metadata: {}
      })

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('processing')
    expect(response.body.data.request_id).toBeTruthy()

    // Verify Dify was called with local_file in inputs
    expect(difyClient.calls.uploads.length).toBeGreaterThanOrEqual(1)
    const uploadCall = difyClient.calls.uploads[0]
    expect(uploadCall.filePath).toBe('/tmp/test-health-report.pdf')
    expect(uploadCall.mimeType).toBe('application/pdf')
    expect(uploadCall.appCode).toBe('report')

    // Verify workflow was called with file in inputs
    const workflowCall = difyClient.calls.workflows.find(c => c.appCode === 'report')
    expect(workflowCall).toBeTruthy()
    expect(workflowCall.inputs.file).toEqual({
      type: 'document',
      transfer_method: 'local_file',
      upload_file_id: expect.any(String)
    })
  })

  it('falls back to text-only when upload has no storage_path', async () => {
    const { app, store, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    // Create upload without storage_path
    await store.createUpload({
      file_id: 'file_no_path',
      user_id: 1,
      biz_type: 'report',
      file_name: 'no-path.pdf',
      stored_name: 'no-path-uuid.pdf',
      mime_type: 'application/pdf',
      size_bytes: 500,
      url: '/api/uploads/file_no_path'
      // No storage_path
    })

    const response = await request(app)
      .post('/api/reports/interpret')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_file_id: 'file_no_path',
        report_text: '空腹血糖：6.4 mmol/L',
        metadata: {}
      })

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('processing')

    // Should not have uploaded to Dify
    expect(difyClient.calls.uploads.length).toBe(0)

    // Workflow should still be called (text-only mode)
    const workflowCall = difyClient.calls.workflows.find(c => c.appCode === 'report')
    expect(workflowCall).toBeTruthy()
    expect(workflowCall.inputs.file).toBeUndefined()
    expect(workflowCall.inputs.report_text).toBe('空腹血糖：6.4 mmol/L')
  })

  it('handles text-only report without file', async () => {
    const { app, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    const response = await request(app)
      .post('/api/reports/interpret')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_text: '糖化血红蛋白：6.1%，总胆固醇：5.8 mmol/L',
        metadata: {}
      })

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('processing')

    expect(difyClient.calls.uploads.length).toBe(0)
    const workflowCall = difyClient.calls.workflows.find(c => c.appCode === 'report')
    expect(workflowCall.inputs.file).toBeUndefined()
    expect(workflowCall.inputs.report_text).toContain('糖化血红蛋白')
  })

  it('retrieves workflow run result by requestId', async () => {
    const { app, store } = await createTestContext()
    const token = await registerAndLogin(request, app)

    // Send a report interpret request
    const response = await request(app)
      .post('/api/reports/interpret')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_text: '测试数据',
        metadata: {}
      })

    const requestId = response.body.data.request_id

    // Query the workflow run result
    const result = await request(app)
      .get(`/api/workflow-runs/${requestId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(result.status).toBe(200)
    expect(result.body.data.request_id).toBe(requestId)
    expect(result.body.data.status).toBe('succeeded')
    expect(result.body.data.outputs).toBeTruthy()
  })
})

describe('Assistant Chat with File', () => {
  it('sends chat with file uploaded to Dify', async () => {
    const { app, store, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    // Create an upload record
    await store.createUpload({
      file_id: 'file_chat_001',
      user_id: 1,
      biz_type: 'assistant',
      file_name: 'lab-result.pdf',
      stored_name: 'chat-test.pdf',
      mime_type: 'application/pdf',
      size_bytes: 80000,
      storage_path: '/tmp/chat-lab-result.pdf',
      url: '/api/uploads/file_chat_001'
    })

    // Don't await the response — SSE streaming won't end naturally
    const req = request(app)
      .post('/api/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: '帮我看看这份化验单',
        attachments: [{ file_id: 'file_chat_001' }]
      })

    // Just check that it starts streaming
    const response = await req
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')

    // Verify Dify upload was called
    expect(difyClient.calls.uploads.length).toBeGreaterThanOrEqual(1)
    const uploadCall = difyClient.calls.uploads[0]
    expect(uploadCall.fileName).toBe('lab-result.pdf')
    expect(uploadCall.appCode).toBe('assistant')

    // Verify chat was called with file in inputs
    const chatCall = difyClient.calls.chats.find(c => c.query === '帮我看看这份化验单')
    expect(chatCall).toBeTruthy()
    expect(chatCall.inputs.file).toEqual({
      type: 'document',
      transfer_method: 'local_file',
      upload_file_id: expect.any(String)
    })
  })

  it('sends chat without file as normal', async () => {
    const { app, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    const req = request(app)
      .post('/api/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: '糖尿病饮食需要注意什么？'
      })

    const response = await req
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')

    expect(difyClient.calls.uploads.length).toBe(0)
    const chatCall = difyClient.calls.chats.find(c => c.query === '糖尿病饮食需要注意什么？')
    expect(chatCall.inputs.file).toBeUndefined()
  })
})

describe('Doctor Chat with File', () => {
  it('sends doctor chat with file upload', async () => {
    const { app, store, difyClient } = await createTestContext()
    const token = await registerAndLogin(request, app)

    // Need a doctor in the store for the route to work
    await store.createAdminDoctor?.({
      name: '李医生',
      title: '主任医师',
      department: '内分泌科',
      display_status: 'published'
    })
    const doctors = await store.listDoctors()
    const doctorId = doctors[0]?.id
    expect(doctorId).toBeTruthy()

    await store.createUpload({
      file_id: 'file_doctor_001',
      user_id: 1,
      biz_type: 'doctor',
      file_name: 'glucose-log.pdf',
      stored_name: 'doctor-test.pdf',
      mime_type: 'application/pdf',
      size_bytes: 60000,
      storage_path: '/tmp/doctor-glucose-log.pdf',
      url: '/api/uploads/file_doctor_001'
    })

    const req = request(app)
      .post(`/api/doctors/${doctorId}/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: '李医生好，这是我的血糖记录',
        attachments: [{ file_id: 'file_doctor_001' }]
      })

    const response = await req
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')

    expect(difyClient.calls.uploads.length).toBeGreaterThanOrEqual(1)
    const chatCall = difyClient.calls.chats.find(c => c.query === '李医生好，这是我的血糖记录')
    expect(chatCall).toBeTruthy()
    expect(chatCall.inputs.file).toEqual({
      type: 'document',
      transfer_method: 'local_file',
      upload_file_id: expect.any(String)
    })
  })
})
