import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { errors } from '../../http/errors.js'
import { makeIdempotencyKey, newRequestId } from '../../utils/ids.js'
import { authMiddleware } from '../auth/auth.js'
import { calculateChinaDiabetesRisk, validateRiskInput } from './scoring.js'

const riskInputSchema = z.object({
  diagnosed_diabetes: z.boolean(),
  diabetes_type: z.enum(['type1', 'type2', 'gestational', 'special', 'unknown']).nullable().optional(),
  age: z.number().int(),
  gender: z.enum(['male', 'female']),
  height_cm: z.number(),
  weight_kg: z.number(),
  waist_cm: z.number().nullable().optional(),
  sbp_mm_hg: z.number().int().nullable().optional(),
  dbp_mm_hg: z.number().int().nullable().optional(),
  family_history_diabetes: z.boolean(),
  past_history: z.array(z.string()).default([]),
  labs: z.object({
    fasting_glucose: z.number().nullable().optional(),
    postprandial_glucose: z.number().nullable().optional(),
    hba1c: z.number().nullable().optional()
  }).default({})
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
})

function fallbackAdvice(scoreResult) {
  if (scoreResult.score_status === 'incomplete') {
    return {
      summary: '当前资料不完整，无法输出正式风险评分。请补充腰围和收缩压后完成正式筛查。',
      diet: [],
      exercise: [],
      review: ['补充腰围', '测量收缩压'],
      warning: '本结果仅用于健康管理参考，不作为医学诊断。'
    }
  }

  if (scoreResult.score_status === 'diagnosed') {
    return {
      summary: '您已标记为糖尿病用户，系统将重点提供血糖管理和生活干预建议。',
      diet: [],
      exercise: [],
      review: ['规律复查血糖相关指标'],
      warning: '本结果仅用于健康管理参考，不作为医学诊断。'
    }
  }

  return {
    summary: scoreResult.risk_level === 'high'
      ? '您属于糖尿病高风险人群，建议完善血糖检查并调整生活方式。'
      : '您当前筛查结果为低风险，建议继续保持健康生活方式并定期复查。',
    diet: [],
    exercise: [],
    review: [],
    warning: '本结果仅用于健康管理参考，不作为医学诊断。'
  }
}

function responseFromRisk(risk) {
  return {
    assessment_id: risk.id,
    score_status: risk.score_status,
    score_rule_version: risk.score_rule_version,
    score: risk.score,
    risk_level: risk.risk_level,
    is_high_risk: risk.is_high_risk,
    score_detail: risk.score_detail,
    missing_fields: risk.missing_fields,
    advice: risk.advice_json,
    status: risk.status
  }
}

function enqueueRiskAdvice({ difyClient, store, created, workflowInput, userId, requestId, scoreResult }) {
  return difyClient.enqueueWorkflow('risk', workflowInput, userId, {
    requestId,
    store,
    async onSuccess(workflowResult) {
      const advice = difyClient.normalizeWorkflowAdvice(workflowResult.outputs, fallbackAdvice(scoreResult))
      const updated = await store.updateRiskAssessment(created.id, {
        advice_summary: advice.summary,
        advice_json: advice,
        status: 'succeeded',
        dify_workflow_run_id: workflowResult.workflow_run_id,
        error_message: null
      })

      return responseFromRisk(updated)
    },
    async onFailure(error) {
      const advice = fallbackAdvice(scoreResult)
      const failed = await store.updateRiskAssessment(created.id, {
        advice_summary: advice.summary,
        advice_json: advice,
        status: 'failed',
        error_message: error?.message || String(error)
      })

      return responseFromRisk(failed)
    }
  })
}

export function registerRiskRoutes(router, deps) {
  const auth = authMiddleware(deps)
  const { store, difyClient } = deps

  router.post('/risk-assessments', auth, validate(riskInputSchema), asyncHandler(async (req, res) => {
    const issues = validateRiskInput(req.body)

    if (issues.length > 0) {
      throw errors.badRequest('参数错误', issues)
    }

    const requestId = newRequestId()
    const idempotencyKey = makeIdempotencyKey(req.user.id, req.body, req.header('Idempotency-Key'))
    const existing = await store.findRiskByIdempotency(req.user.id, idempotencyKey)

    if (existing) {
      return sendOk(res, responseFromRisk(existing))
    }

    const scoreResult = calculateChinaDiabetesRisk(req.body)
    const profileSnapshot = {
      diagnosed_diabetes: req.body.diagnosed_diabetes,
      diabetes_type: req.body.diabetes_type || null,
      age: req.body.age,
      gender: req.body.gender,
      height_cm: req.body.height_cm,
      weight_kg: req.body.weight_kg,
      waist_cm: req.body.waist_cm ?? null,
      sbp_mm_hg: req.body.sbp_mm_hg ?? null,
      family_history_diabetes: req.body.family_history_diabetes,
      past_history: req.body.past_history,
      labs: req.body.labs,
      bmi: scoreResult.bmi
    }

    const created = await store.createRiskAssessment({
      user_id: req.user.id,
      profile_snapshot: profileSnapshot,
      diagnosed_diabetes: req.body.diagnosed_diabetes,
      diabetes_type: req.body.diabetes_type || null,
      score: scoreResult.score,
      score_status: scoreResult.score_status,
      score_rule_version: scoreResult.score_rule_version,
      missing_fields: scoreResult.missing_fields,
      risk_level: scoreResult.risk_level,
      is_high_risk: scoreResult.is_high_risk,
      score_detail: scoreResult.score_detail,
      abnormal_indicators: [],
      advice_summary: null,
      advice_json: {},
      status: 'processing',
      request_id: requestId,
      idempotency_key: idempotencyKey
    })

    const workflowInput = {
      user_id: String(req.user.id),
      assessment_id: created.id,
      ...profileSnapshot,
      ...scoreResult,
      score_detail: scoreResult.score_detail,
      missing_fields: scoreResult.missing_fields
    }

    await enqueueRiskAdvice({
      difyClient,
      store,
      created,
      workflowInput,
      userId: req.user.id,
      requestId,
      scoreResult
    })

    return sendOk(res, {
      ...responseFromRisk(created),
      request_id: requestId,
      workflow: {
        request_id: requestId,
        status: 'processing'
      }
    })
  }))

  router.get('/risk-assessments/latest', auth, asyncHandler(async (req, res) => {
    sendOk(res, await store.getLatestRisk(req.user.id))
  }))

  router.get('/risk-assessments', auth, validate(listQuerySchema, 'query'), asyncHandler(async (req, res) => {
    sendOk(res, await store.listRisks(req.user.id, req.validatedQuery))
  }))
}
