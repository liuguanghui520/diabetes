const SCOPE_FIELD_MAP = {
  assistant: 'assistant_context_authorized',
  plan: 'plan_suggestion_authorized',
  news: 'news_recommendation_authorized',
}

export const DATA_AUTHORIZATION_DEFAULTS = {
  health_data_analysis_authorized: true,
  assistant_context_authorized: true,
  plan_suggestion_authorized: true,
  news_recommendation_authorized: true,
  policy_version: 'v1.0',
}

export const PRIVACY_SETTINGS_DEFAULTS = {
  health_reminder_enabled: true,
}

export function normalizeScope(scope) {
  const value = String(scope || 'assistant').trim().toLowerCase()

  return Object.prototype.hasOwnProperty.call(SCOPE_FIELD_MAP, value)
    ? value
    : 'assistant'
}

export function getScopeField(scope) {
  return SCOPE_FIELD_MAP[normalizeScope(scope)] || SCOPE_FIELD_MAP.assistant
}

export function isScopeAuthorized(authorizations = {}, scope) {
  const normalizedScope = normalizeScope(scope)
  const field = getScopeField(normalizedScope)

  return Boolean(
    authorizations?.health_data_analysis_authorized &&
    authorizations?.[field],
  )
}

export function buildPrivacySettingsView(authorizations = {}, privacySettings = {}) {
  return {
    personalized_advice_enabled: Boolean(
      authorizations?.plan_suggestion_authorized &&
      authorizations?.news_recommendation_authorized,
    ),
    assistant_context_enabled: Boolean(authorizations?.assistant_context_authorized),
    health_reminder_enabled: privacySettings?.health_reminder_enabled !== false,
    updated_at:
      privacySettings?.updated_at ||
      authorizations?.updated_at ||
      privacySettings?.created_at ||
      authorizations?.created_at ||
      null,
  }
}

export function createEmptyCheckinSummary(days = 7) {
  const safeDays = Math.max(1, Math.min(Number(days || 7), 31))
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - (safeDays - 1))

  return {
    period: {
      start: start.toISOString().slice(0, 10),
      end: today.toISOString().slice(0, 10),
      days: safeDays,
    },
    completion_rate: 0,
    record_count: 0,
    completed_count: 0,
    by_type: {},
    items: [],
  }
}

export async function buildAuthorizedUserContext({ store, userId, scope }) {
  const normalizedScope = normalizeScope(scope)
  const [authorizations, privacySettings] = await Promise.all([
    store.getDataAuthorization?.(userId),
    store.getPrivacySettings?.(userId),
  ])
  const authorized = isScopeAuthorized(authorizations, normalizedScope)

  if (!authorized) {
    return {
      user_id: Number(userId),
      scope: normalizedScope,
      authorized: false,
      authorizations,
      privacy_settings: buildPrivacySettingsView(authorizations, privacySettings),
      profile: null,
      latest_risk: null,
      latest_plan: null,
    }
  }

  const [profile, latestRisk, latestPlan] = await Promise.all([
    store.getProfile?.(userId),
    store.getLatestRisk?.(userId),
    store.getActivePlan?.(userId),
  ])

  return {
    user_id: Number(userId),
    scope: normalizedScope,
    authorized: true,
    authorizations,
    privacy_settings: buildPrivacySettingsView(authorizations, privacySettings),
    profile: profile || null,
    latest_risk: latestRisk || null,
    latest_plan: latestPlan || null,
  }
}

export async function buildAuthorizedCheckinSummary({ store, userId, scope, query }) {
  const authorizations = await store.getDataAuthorization?.(userId)

  if (!isScopeAuthorized(authorizations, scope)) {
    return createEmptyCheckinSummary(query?.days)
  }

  return store.getCheckinSummary(userId, query)
}

export function canGenerateHealthReminders(privacySettings = {}) {
  return privacySettings?.health_reminder_enabled !== false
}
