import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { authMiddleware } from '../auth/auth.js'
import {
  buildPrivacySettingsView,
  normalizeScope,
} from './authorization.js'

const privacySettingsSchema = z.object({
  personalized_advice_enabled: z.boolean().optional(),
  assistant_context_enabled: z.boolean().optional(),
  health_reminder_enabled: z.boolean().optional(),
})

const dataAuthorizationSchema = z.object({
  health_data_analysis_authorized: z.boolean().optional(),
  assistant_context_authorized: z.boolean().optional(),
  plan_suggestion_authorized: z.boolean().optional(),
  news_recommendation_authorized: z.boolean().optional(),
  policy_version: z.string().max(32).optional(),
})

const withdrawAllSchema = z.object({
  reason: z.string().max(64).optional(),
})

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  scope: z.string().optional(),
})

function requestMeta(req, source) {
  return {
    source,
    policy_version: req.body?.policy_version || undefined,
    ip_address: req.ip || req.socket?.remoteAddress || '',
    user_agent: req.header('user-agent') || '',
  }
}

function sendBusinessConflict(res, req, message, data = {}, code = 40901) {
  return res.status(409).json({
    code,
    message,
    data,
    traceId: req.traceId,
  })
}

async function loadPrivacyBundle(store, userId) {
  const [authorizations, privacySettings] = await Promise.all([
    store.getDataAuthorization(userId),
    store.getPrivacySettings(userId),
  ])

  return {
    authorizations,
    privacy_settings: buildPrivacySettingsView(authorizations, privacySettings),
  }
}

export function registerPrivacyRoutes(router, deps) {
  const auth = authMiddleware(deps)
  const { store } = deps

  router.get('/privacy-settings', auth, asyncHandler(async (req, res) => {
    const bundle = await loadPrivacyBundle(store, req.user.id)
    sendOk(res, bundle.privacy_settings)
  }))

  router.put('/privacy-settings', auth, validate(privacySettingsSchema), asyncHandler(async (req, res) => {
    const body = req.body || {}

    if (Object.prototype.hasOwnProperty.call(body, 'assistant_context_enabled')) {
      const authorizations = await store.getDataAuthorization(req.user.id)

      if (
        body.assistant_context_enabled === true &&
        !authorizations?.health_data_analysis_authorized
      ) {
        const bundle = await loadPrivacyBundle(store, req.user.id)
        return sendBusinessConflict(
          res,
          req,
          '请先开启健康数据智能分析授权。',
          bundle,
        )
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'personalized_advice_enabled')) {
      const authorizations = await store.getDataAuthorization(req.user.id)

      if (
        body.personalized_advice_enabled === true &&
        !authorizations?.health_data_analysis_authorized
      ) {
        const bundle = await loadPrivacyBundle(store, req.user.id)
        return sendBusinessConflict(
          res,
          req,
          '请先开启健康数据智能分析授权。',
          bundle,
        )
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'personalized_advice_enabled')) {
      await store.updateDataAuthorization(req.user.id, {
        plan_suggestion_authorized: body.personalized_advice_enabled,
        news_recommendation_authorized: body.personalized_advice_enabled,
      }, requestMeta(req, 'privacy_settings'))
    }

    if (Object.prototype.hasOwnProperty.call(body, 'assistant_context_enabled')) {
      await store.updateDataAuthorization(req.user.id, {
        assistant_context_authorized: body.assistant_context_enabled,
      }, requestMeta(req, 'privacy_settings'))
    }

    if (Object.prototype.hasOwnProperty.call(body, 'health_reminder_enabled')) {
      await store.updatePrivacySettings(req.user.id, {
        health_reminder_enabled: body.health_reminder_enabled,
      }, requestMeta(req, 'privacy_settings'))
    }

    const bundle = await loadPrivacyBundle(store, req.user.id)
    sendOk(res, bundle)
  }))

  router.get('/data-authorizations', auth, asyncHandler(async (req, res) => {
    sendOk(res, await store.getDataAuthorization(req.user.id))
  }))

  router.put('/data-authorizations', auth, validate(dataAuthorizationSchema), asyncHandler(async (req, res) => {
    const patch = { ...req.body }
    const current = await store.getDataAuthorization(req.user.id)

    if (
      current?.health_data_analysis_authorized === false &&
      patch.health_data_analysis_authorized !== true &&
      [
        patch.assistant_context_authorized,
        patch.plan_suggestion_authorized,
        patch.news_recommendation_authorized,
      ].some((value) => value === true)
    ) {
      return sendBusinessConflict(
        res,
        req,
        '请先开启健康数据智能分析授权。',
        {
          authorizations: current,
          privacy_settings: buildPrivacySettingsView(
            current,
            await store.getPrivacySettings(req.user.id),
          ),
        },
      )
    }

    const data = await store.updateDataAuthorization(
      req.user.id,
      patch,
      requestMeta(req, 'data_authorization'),
    )

    sendOk(res, data)
  }))

  router.post('/data-authorizations/withdraw-all', auth, validate(withdrawAllSchema), asyncHandler(async (req, res) => {
    sendOk(
      res,
      await store.withdrawAllDataAuthorization(
        req.user.id,
        {
          reason: req.body.reason || 'user_manual',
        },
        requestMeta(req, 'data_authorization'),
      ),
    )
  }))

  router.get('/data-authorizations/history', auth, validate(historyQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query
    const result = await store.listDataAuthorizationHistory(req.user.id, {
      page: query.page,
      pageSize: query.pageSize,
      scope: normalizeScope(query.scope),
    })
    sendOk(res, result)
  }))
}
