import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { authMiddleware } from '../auth/auth.js'
import { newRequestId } from '../../utils/ids.js'
import { safeJson } from '../../utils/json.js'
import { normalizePlanTask } from '../../utils/planTask.js'
import { errors } from '../../http/errors.js'
import { isScopeAuthorized } from '../privacy/authorization.js'
import { sanitizeAttachmentPayload } from '../uploads/routes.js'

const planSchema = z.object({
  risk_assessment_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
  preferences: z.object({}).catchall(z.any()).default({}),
  goal: z.string().max(500).optional()
})

const planTaskSchema = z.object({
  id: z.union([z.number().int(), z.string()]).optional(),
  category: z.enum(['diet', 'exercise', 'water', 'sleep', 'glucose', 'review']),
  title: z.string().min(1).max(128),
  desc: z.string().max(500).optional(),
  target: z.string().max(64).optional(),
  time: z.string().max(64).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
})

const planTaskCompleteSchema = z.object({
  completed: z.boolean(),
  checkin_date: z.string().optional()
})

const checkinAnalysisSchema = z.object({
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  days: z.coerce.number().int().min(1).max(31).default(7)
})

const reportInterpretSchema = z.object({
  report_file_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
  report_text: z.string().max(20000).optional(),
  metadata: z.object({}).catchall(z.any()).default({})
}).superRefine((value, ctx) => {
  if (!value.report_file_id && !String(value.report_text || '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '请至少提供报告文本或上传报告文件。',
      path: ['report_text'],
    })
  }
})

const workflowRunParamsSchema = z.object({
  requestId: z.string().min(1).max(128)
})

function todayOnly() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function normalizePlanOutput(outputs, preferences) {
  const parsed = safeJson(outputs, outputs) || {}
  const plan = parsed.plan || parsed.data || parsed
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : []

  return {
    title: String(plan.title || preferences.goal || 'AI 生活方案'),
    summary: String(plan.summary || plan.goal_summary || ''),
    sections: Array.isArray(plan.sections) ? plan.sections : [],
    tasks: tasks.map((task, index) => normalizePlanTask(task, index, { emptyTimeFallback: '' })),
    disclaimer: String(plan.disclaimer || ''),
    raw: plan
  }
}

function normalizeAnalysisOutput(outputs, summary) {
  const parsed = safeJson(outputs, outputs) || {}
  const analysis = parsed.analysis || parsed.data || parsed
  const completionRate = Number(
    analysis.completion_rate ?? summary.completion_rate ?? 0
  )
  const improvements = Array.isArray(analysis.improvements)
    ? analysis.improvements
    : []
  const advice = analysis.advice || improvements.join('；') || '继续保持规律记录，优先完成饮食和运动两类核心打卡。'

  return {
    completion_rate: Math.max(0, Math.min(100, Math.round(completionRate))),
    metrics: analysis.metrics || summary.by_type || {},
    evaluation: String(analysis.evaluation || analysis.summary || '已根据近期打卡记录生成生活状态分析。'),
    improvements,
    advice: String(advice),
    raw: analysis
  }
}

function normalizeReportOutput(outputs) {
  const parsed = safeJson(outputs, outputs) || {}
  const report = parsed.report || parsed.interpretation || parsed.data || parsed

  return {
    status: report.status || 'pending_confirm',
    indicators: Array.isArray(report.indicators) ? report.indicators : [],
    summary: String(report.summary || '已完成报告文本初步解读，请结合原始报告和医生意见确认。'),
    advice: Array.isArray(report.advice) ? report.advice : [],
    confirm_required: report.confirm_required !== false,
    raw: report
  }
}

function workflowResponse({ requestId, appCode, log = null }) {
  const outputs = safeJson(log?.outputs, log?.outputs) || {}

  return {
    request_id: requestId,
    app_code: appCode || log?.app_code || '',
    status: log?.status || 'processing',
    workflow_run_id: log?.workflow_run_id || null,
    task_id: log?.task_id || null,
    result: outputs.result || null,
    outputs: outputs.workflow_outputs || outputs,
    error_message: log?.error_message || null,
    elapsed_time: log?.elapsed_time || null
  }
}

function splitTargetValue(target) {
  const text = String(target || '').trim()

  if (!text) {
    return {
      target_value: null,
      unit: null
    }
  }

  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(text)

  if (!match) {
    return {
      target_value: null,
      unit: text
    }
  }

  return {
    target_value: Number(match[1]),
    unit: match[2]?.trim() || null
  }
}

function normalizeManualPlanTask(task) {
  const { target_value, unit } = splitTargetValue(task.target)

  return {
    id: task.id ? Number(task.id) : undefined,
    category: task.category,
    title: task.title,
    desc: task.desc || '',
    target: task.target || '',
    time: task.time || '',
    startDate: task.startDate || null,
    endDate: task.endDate || null,
    task_type: task.category,
    description: task.desc || '',
    target_value,
    unit,
    target_time: task.time || null,
    metadata: {
      source: 'manual',
      start_date: task.startDate || null,
      end_date: task.endDate || null
    }
  }
}

export function registerWorkflowRoutes(router, deps, options = {}) {
  const auth = authMiddleware(deps)
  const { store, difyClient } = deps
  const sensitiveLimiter = options.sensitiveLimiter || ((_req, _res, next) => next())

  router.post('/plans/generate', sensitiveLimiter, auth, validate(planSchema), asyncHandler(async (req, res) => {
    const authorizations = await store.getDataAuthorization?.(req.user.id)

    if (!isScopeAuthorized(authorizations, 'plan')) {
      throw errors.conflict('当前未开启生活方案定制授权，请先在数据授权页开启后再生成个性化方案。')
    }

    const requestId = newRequestId()
    const latestRisk = req.body.risk_assessment_id
      ? null
      : await store.getLatestRisk(req.user.id)
    const riskAssessmentId = req.body.risk_assessment_id || latestRisk?.id || null
    const inputs = {
      user_id: String(req.user.id),
      risk_assessment_id: riskAssessmentId,
      preferences: {
        ...req.body.preferences,
        goal: req.body.goal || req.body.preferences?.goal || ''
      }
    }

    await difyClient.enqueueWorkflow('plan', inputs, req.user.id, {
      requestId,
      store,
      async onSuccess(workflowResult) {
        const normalized = normalizePlanOutput(workflowResult.outputs, inputs.preferences)
        const saved = await store.createPlan({
          user_id: req.user.id,
          risk_assessment_id: riskAssessmentId,
          title: normalized.title,
          goal_summary: normalized.summary,
          status: 'active',
          start_date: todayOnly(),
          end_date: addDays(todayOnly(), 6),
          preferences: inputs.preferences,
          plan_json: {
            title: normalized.title,
            summary: normalized.summary,
            sections: normalized.sections,
            tasks: normalized.tasks,
            disclaimer: normalized.disclaimer,
            raw: normalized.raw
          },
          tasks: normalized.tasks,
          dify_workflow_run_id: workflowResult?.workflow_run_id || null
        })

        return {
          plan: saved,
          workflow: {
            request_id: requestId,
            workflow_run_id: workflowResult?.workflow_run_id || null,
            status: 'succeeded'
          }
        }
      }
    })

    sendOk(res, {
      workflow: {
        request_id: requestId,
        workflow_run_id: null,
        status: 'processing'
      }
    })
  }))

  router.post('/checkins/analysis', sensitiveLimiter, auth, validate(checkinAnalysisSchema), asyncHandler(async (req, res) => {
    const requestId = newRequestId()
    const periodEnd = req.body.period_end || todayOnly()
    const periodStart = req.body.period_start || addDays(periodEnd, -(req.body.days - 1))
    const summary = await store.getCheckinSummary(req.user.id, {
      days: req.body.days
    })
    const inputs = {
      user_id: String(req.user.id),
      period_start: periodStart,
      period_end: periodEnd,
      checkin_summary: summary
    }
    await difyClient.enqueueWorkflow('checkin', inputs, req.user.id, {
      requestId,
      store,
      async onSuccess(workflowResult) {
        const normalized = normalizeAnalysisOutput(workflowResult.outputs, summary)
        const saved = await store.createHealthAnalysisReport({
          user_id: req.user.id,
          period_start: periodStart,
          period_end: periodEnd,
          completion_rate: normalized.completion_rate,
          summary: normalized.evaluation,
          advice: normalized.advice,
          analysis_json: normalized,
          dify_workflow_run_id: workflowResult?.workflow_run_id || null
        })

        return {
          ...normalized,
          report_id: saved.id,
          period_start: periodStart,
          period_end: periodEnd,
          workflow_run_id: workflowResult?.workflow_run_id || null
        }
      }
    })

    sendOk(res, {
      period_start: periodStart,
      period_end: periodEnd,
      request_id: requestId,
      status: 'processing'
    })
  }))

  router.post('/reports/interpret', sensitiveLimiter, auth, validate(reportInterpretSchema), asyncHandler(async (req, res) => {
    const requestId = newRequestId()
    const uploadMeta = req.body.report_file_id
      ? await sanitizeAttachmentPayload(store, req.user.id, [{ file_id: req.body.report_file_id }])
      : []
    const inputs = {
      user_id: String(req.user.id),
      report_file_id: req.body.report_file_id || null,
      report_text: req.body.report_text || '',
      metadata: {
        ...req.body.metadata,
        uploaded_files: uploadMeta,
      }
    }
    await difyClient.enqueueWorkflow('report', inputs, req.user.id, {
      requestId,
      store,
      async onSuccess(workflowResult) {
        const interpretation = normalizeReportOutput(workflowResult.outputs)

        return {
          ...interpretation,
          workflow_run_id: workflowResult.workflow_run_id,
          request_id: requestId
        }
      }
    })

    sendOk(res, {
      request_id: requestId,
      status: 'processing'
    })
  }))

  router.get('/plan-tasks', auth, asyncHandler(async (req, res) => {
    const tasks = await store.listPlanTasks?.(req.user.id) || []
    sendOk(res, {
      items: tasks.map((task) => ({
        id: task.id,
        category: task.task_type || task.category,
        title: task.title,
        desc: task.description || task.desc || '',
        target: [task.target_value, task.unit].filter(Boolean).join('') || task.unit || '',
        time: task.target_time || task.time || '',
        startDate: task.metadata?.start_date || null,
        endDate: task.metadata?.end_date || null
      }))
    })
  }))

  router.post('/plan-tasks', auth, validate(planTaskSchema), asyncHandler(async (req, res) => {
    const saved = await store.savePlanTask?.(req.user.id, normalizeManualPlanTask(req.body))
    sendOk(res, saved)
  }))

  router.delete('/plan-tasks/:taskId', auth, asyncHandler(async (req, res) => {
    sendOk(res, await store.deletePlanTask?.(req.user.id, req.params.taskId))
  }))

  router.post('/plan-tasks/:taskId/completion', auth, validate(planTaskCompleteSchema), asyncHandler(async (req, res) => {
    sendOk(res, await store.setPlanTaskCompletion?.(
      req.user.id,
      req.params.taskId,
      req.body.completed,
      {
        checkin_date: req.body.checkin_date,
        source: 'plan_task_toggle'
      }
    ))
  }))

  router.get('/workflow-runs/:requestId', auth, validate(workflowRunParamsSchema, 'params'), asyncHandler(async (req, res) => {
    const log = await store.getDifyLogByRequestId?.(req.user.id, req.params.requestId)

    sendOk(res, workflowResponse({
      requestId: req.params.requestId,
      log
    }))
  }))
}
