import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { authMiddleware } from '../auth/auth.js'
import { newRequestId } from '../../utils/ids.js'
import { safeJson } from '../../utils/json.js'
import { normalizePlanTask } from '../../utils/planTask.js'

const planSchema = z.object({
  risk_assessment_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
  preferences: z.object({}).catchall(z.any()).default({}),
  goal: z.string().max(500).optional()
})

const checkinAnalysisSchema = z.object({
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  days: z.coerce.number().int().min(1).max(31).default(7)
})

const reportInterpretSchema = z.object({
  report_file_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
  report_text: z.string().min(1).max(20000),
  metadata: z.object({}).catchall(z.any()).default({})
})

function todayOnly() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function fallbackPlan(preferences = {}) {
  return {
    title: preferences.goal || '基础健康预治计划',
    summary: '围绕饮食、运动、记录和复查建立可执行的生活管理节奏。',
    sections: [],
    tasks: [
      {
        task_type: 'diet',
        title: '记录三餐结构',
        description: '记录主食、蛋白质和蔬菜搭配，优先观察真实饮食习惯。',
        target_value: 3,
        unit: '次',
        target_time: '三餐后'
      },
      {
        task_type: 'exercise',
        title: '饭后轻走',
        description: '选择一餐后轻走 15-20 分钟，避免空腹或不适时运动。',
        target_value: 20,
        unit: '分钟',
        target_time: '餐后'
      },
      {
        task_type: 'review',
        title: '整理复查指标',
        description: '记录空腹血糖、餐后血糖和 HbA1c 等关键指标。',
        target_value: 1,
        unit: '次',
        target_time: '本周'
      }
    ],
    disclaimer: '方案仅供健康管理参考，如有不适或基础疾病请咨询医生。'
  }
}

function normalizePlanOutput(outputs, preferences) {
  const parsed = safeJson(outputs, outputs) || {}
  const plan = parsed.plan || parsed.data || parsed
  const fallback = fallbackPlan(preferences)
  const tasks = Array.isArray(plan.tasks) && plan.tasks.length > 0
    ? plan.tasks
    : fallback.tasks

  return {
    title: String(plan.title || fallback.title),
    summary: String(plan.summary || plan.goal_summary || fallback.summary),
    sections: Array.isArray(plan.sections) ? plan.sections : [],
    tasks: tasks.map((task, index) => normalizePlanTask(task, index, { emptyTimeFallback: '' })),
    disclaimer: String(plan.disclaimer || fallback.disclaimer),
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

export function registerWorkflowRoutes(router, deps, options = {}) {
  const auth = authMiddleware(deps)
  const { store, difyClient } = deps
  const sensitiveLimiter = options.sensitiveLimiter || ((_req, _res, next) => next())

  router.post('/plans/generate', sensitiveLimiter, auth, validate(planSchema), asyncHandler(async (req, res) => {
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

    let workflowResult
    let normalized

    try {
      workflowResult = await difyClient.runWorkflow('plan', inputs, req.user.id, {
        requestId,
        store
      })
      normalized = normalizePlanOutput(workflowResult.outputs, inputs.preferences)
    } catch (error) {
      normalized = normalizePlanOutput({}, inputs.preferences)
      normalized.error_message = error.message
    }

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
        raw: normalized.raw,
        error_message: normalized.error_message || null
      },
      tasks: normalized.tasks,
      dify_workflow_run_id: workflowResult?.workflow_run_id || null
    })

    sendOk(res, {
      plan: saved,
      workflow: {
        request_id: requestId,
        workflow_run_id: workflowResult?.workflow_run_id || null,
        fallback: Boolean(normalized.error_message)
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
    let workflowResult
    let normalized

    try {
      workflowResult = await difyClient.runWorkflow('checkin', inputs, req.user.id, {
        requestId,
        store
      })
      normalized = normalizeAnalysisOutput(workflowResult.outputs, summary)
    } catch (error) {
      normalized = normalizeAnalysisOutput({}, summary)
      normalized.error_message = error.message
    }

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

    sendOk(res, {
      ...normalized,
      report_id: saved.id,
      period_start: periodStart,
      period_end: periodEnd,
      workflow_run_id: workflowResult?.workflow_run_id || null
    })
  }))

  router.post('/reports/interpret', sensitiveLimiter, auth, validate(reportInterpretSchema), asyncHandler(async (req, res) => {
    const requestId = newRequestId()
    const inputs = {
      user_id: String(req.user.id),
      report_file_id: req.body.report_file_id || null,
      report_text: req.body.report_text,
      metadata: req.body.metadata
    }
    const workflowResult = await difyClient.runWorkflow('report', inputs, req.user.id, {
      requestId,
      store
    })
    const interpretation = normalizeReportOutput(workflowResult.outputs)

    sendOk(res, {
      ...interpretation,
      workflow_run_id: workflowResult.workflow_run_id,
      request_id: requestId
    })
  }))
}
