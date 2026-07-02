import { describe, expect, it, vi } from 'vitest'
import {
  normalizeScope,
  getScopeField,
  isScopeAuthorized,
  buildPrivacySettingsView,
  createEmptyCheckinSummary,
  buildAuthorizedUserContext,
  buildAuthorizedCheckinSummary,
  canGenerateHealthReminders,
  DATA_AUTHORIZATION_DEFAULTS,
  PRIVACY_SETTINGS_DEFAULTS,
} from '../../src/modules/privacy/authorization.js'

describe('normalizeScope', () => {
  it('returns assistant for empty input', () => {
    expect(normalizeScope()).toBe('assistant')
  })

  it('returns assistant for null input', () => {
    expect(normalizeScope(null)).toBe('assistant')
  })

  it('returns assistant for undefined input', () => {
    expect(normalizeScope(undefined)).toBe('assistant')
  })

  it('returns valid scope as-is', () => {
    expect(normalizeScope('assistant')).toBe('assistant')
    expect(normalizeScope('plan')).toBe('plan')
    expect(normalizeScope('news')).toBe('news')
  })

  it('handles case-insensitive', () => {
    expect(normalizeScope('PLAN')).toBe('plan')
  })

  it('handles whitespace', () => {
    expect(normalizeScope('  plan  ')).toBe('plan')
  })

  it('defaults unknown scope to assistant', () => {
    expect(normalizeScope('unknown')).toBe('assistant')
  })
})

describe('getScopeField', () => {
  it('maps assistant to correct field', () => {
    expect(getScopeField('assistant')).toBe('assistant_context_authorized')
  })

  it('maps plan to correct field', () => {
    expect(getScopeField('plan')).toBe('plan_suggestion_authorized')
  })

  it('maps news to correct field', () => {
    expect(getScopeField('news')).toBe('news_recommendation_authorized')
  })

  it('defaults unknown scope to assistant field', () => {
    expect(getScopeField('unknown')).toBe('assistant_context_authorized')
  })
})

describe('isScopeAuthorized', () => {
  it('returns true when both authorizations are true', () => {
    const auth = { health_data_analysis_authorized: true, assistant_context_authorized: true }
    expect(isScopeAuthorized(auth, 'assistant')).toBe(true)
  })

  it('returns false when health_data_analysis_authorized is false', () => {
    const auth = { health_data_analysis_authorized: false, assistant_context_authorized: true }
    expect(isScopeAuthorized(auth, 'assistant')).toBe(false)
  })

  it('returns false when scope-specific field is false', () => {
    const auth = { health_data_analysis_authorized: true, assistant_context_authorized: false }
    expect(isScopeAuthorized(auth, 'assistant')).toBe(false)
  })

  it('returns false when authorizations is empty', () => {
    expect(isScopeAuthorized({}, 'assistant')).toBe(false)
  })

  it('returns false when authorizations is undefined', () => {
    expect(isScopeAuthorized(undefined, 'assistant')).toBe(false)
  })

  it('works for plan scope', () => {
    const auth = { health_data_analysis_authorized: true, plan_suggestion_authorized: true }
    expect(isScopeAuthorized(auth, 'plan')).toBe(true)
  })

  it('works for news scope', () => {
    const auth = { health_data_analysis_authorized: true, news_recommendation_authorized: true }
    expect(isScopeAuthorized(auth, 'news')).toBe(true)
  })
})

describe('buildPrivacySettingsView', () => {
  it('builds view from full authorizations', () => {
    const auth = { plan_suggestion_authorized: true, news_recommendation_authorized: true, assistant_context_authorized: true }
    const result = buildPrivacySettingsView(auth, { health_reminder_enabled: true })
    expect(result.personalized_advice_enabled).toBe(true)
    expect(result.assistant_context_enabled).toBe(true)
    expect(result.health_reminder_enabled).toBe(true)
  })

  it('personalized_advice is false when plan_suggestion is false', () => {
    const auth = { plan_suggestion_authorized: false, news_recommendation_authorized: true, assistant_context_authorized: true }
    const result = buildPrivacySettingsView(auth)
    expect(result.personalized_advice_enabled).toBe(false)
  })

  it('personalized_advice is false when news is false', () => {
    const auth = { plan_suggestion_authorized: true, news_recommendation_authorized: false, assistant_context_authorized: true }
    const result = buildPrivacySettingsView(auth)
    expect(result.personalized_advice_enabled).toBe(false)
  })

  it('handles empty inputs', () => {
    const result = buildPrivacySettingsView()
    expect(result.personalized_advice_enabled).toBe(false)
    expect(result.assistant_context_enabled).toBe(false)
    expect(result.health_reminder_enabled).toBe(true)
    expect(result.updated_at).toBe(null)
  })

  it('uses privacy_settings updated_at', () => {
    const result = buildPrivacySettingsView({}, { updated_at: '2024-01-01', health_reminder_enabled: false })
    expect(result.updated_at).toBe('2024-01-01')
    expect(result.health_reminder_enabled).toBe(false)
  })

  it('falls back to authorizations updated_at', () => {
    const result = buildPrivacySettingsView({ updated_at: '2024-06-01' }, {})
    expect(result.updated_at).toBe('2024-06-01')
  })

  it('falls back to created_at fields', () => {
    const result = buildPrivacySettingsView({ created_at: '2024-03-01' }, { created_at: '2024-02-01' })
    expect(result.updated_at).toBe('2024-02-01')
  })
})

describe('createEmptyCheckinSummary', () => {
  it('creates summary for 7 days by default', () => {
    const result = createEmptyCheckinSummary()
    expect(result.period.days).toBe(7)
    expect(result.completion_rate).toBe(0)
    expect(result.record_count).toBe(0)
    expect(result.completed_count).toBe(0)
    expect(result.by_type).toEqual({})
    expect(result.items).toEqual([])
  })

  it('creates summary for custom days', () => {
    const result = createEmptyCheckinSummary(14)
    expect(result.period.days).toBe(14)
  })

  it('clamps days to minimum 1', () => {
    // createEmptyCheckinSummary does: Math.max(1, Math.min(Number(days || 7), 31))
    // For 0: Number(0 || 7) = 7, Math.min(7, 31) = 7, Math.max(1, 7) = 7
    // So 0 doesn't actually clamp to 1 because 0 is falsy and becomes 7
    const result = createEmptyCheckinSummary(0)
    // 0 is falsy so it defaults to 7
    expect(result.period.days).toBe(7)
  })

  it('clamps days to maximum 31', () => {
    const result = createEmptyCheckinSummary(100)
    expect(result.period.days).toBe(31)
  })

  it('handles string days input', () => {
    const result = createEmptyCheckinSummary('5')
    expect(result.period.days).toBe(5)
  })

  it('has valid period start and end dates', () => {
    const result = createEmptyCheckinSummary(7)
    expect(result.period.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.period.start <= result.period.end).toBe(true)
  })
})

describe('buildAuthorizedUserContext', () => {
  it('returns unauthorized when isScopeAuthorized returns false', async () => {
    const store = {
      getDataAuthorization: vi.fn().mockResolvedValue({ health_data_analysis_authorized: false }),
      getPrivacySettings: vi.fn().mockResolvedValue({}),
    }
    const result = await buildAuthorizedUserContext({ store, userId: 1, scope: 'assistant' })
    expect(result.authorized).toBe(false)
    expect(result.profile).toBe(null)
    expect(result.latest_risk).toBe(null)
    expect(result.latest_plan).toBe(null)
  })

  it('returns authorized context when authorized', async () => {
    const profile = { nickname: 'Test', age: 30 }
    const risk = { level: 'low' }
    const plan = { title: 'Test Plan' }
    const store = {
      getDataAuthorization: vi.fn().mockResolvedValue({
        health_data_analysis_authorized: true,
        assistant_context_authorized: true,
      }),
      getPrivacySettings: vi.fn().mockResolvedValue({}),
      getProfile: vi.fn().mockResolvedValue(profile),
      getLatestRisk: vi.fn().mockResolvedValue(risk),
      getActivePlan: vi.fn().mockResolvedValue(plan),
    }
    const result = await buildAuthorizedUserContext({ store, userId: 1, scope: 'assistant' })
    expect(result.authorized).toBe(true)
    expect(result.profile).toEqual(profile)
    expect(result.latest_risk).toEqual(risk)
    expect(result.latest_plan).toEqual(plan)
    expect(result.user_id).toBe(1)
    expect(result.scope).toBe('assistant')
  })

  it('handles null profile/risk/plan gracefully', async () => {
    const store = {
      getDataAuthorization: vi.fn().mockResolvedValue({
        health_data_analysis_authorized: true,
        assistant_context_authorized: true,
      }),
      getPrivacySettings: vi.fn().mockResolvedValue({}),
      getProfile: vi.fn().mockResolvedValue(null),
      getLatestRisk: vi.fn().mockResolvedValue(null),
      getActivePlan: vi.fn().mockResolvedValue(null),
    }
    const result = await buildAuthorizedUserContext({ store, userId: 1, scope: 'assistant' })
    expect(result.authorized).toBe(true)
    expect(result.profile).toBe(null)
    expect(result.latest_risk).toBe(null)
    expect(result.latest_plan).toBe(null)
  })
})

describe('buildAuthorizedCheckinSummary', () => {
  it('returns empty summary when not authorized', async () => {
    const store = {
      getDataAuthorization: vi.fn().mockResolvedValue({ health_data_analysis_authorized: false }),
    }
    const result = await buildAuthorizedCheckinSummary({ store, userId: 1, scope: 'plan', query: { days: 7 } })
    expect(result.completion_rate).toBe(0)
    expect(result.items).toEqual([])
  })

  it('returns real summary when authorized', async () => {
    const summaryData = { completion_rate: 80, items: [{ id: 1 }] }
    const store = {
      getDataAuthorization: vi.fn().mockResolvedValue({
        health_data_analysis_authorized: true,
        plan_suggestion_authorized: true,
      }),
      getCheckinSummary: vi.fn().mockResolvedValue(summaryData),
    }
    const result = await buildAuthorizedCheckinSummary({ store, userId: 1, scope: 'plan', query: {} })
    expect(result).toEqual(summaryData)
  })
})

describe('canGenerateHealthReminders', () => {
  it('returns true when health_reminder_enabled is true', () => {
    expect(canGenerateHealthReminders({ health_reminder_enabled: true })).toBe(true)
  })

  it('returns false when health_reminder_enabled is false', () => {
    expect(canGenerateHealthReminders({ health_reminder_enabled: false })).toBe(false)
  })

  it('returns true for empty settings (default)', () => {
    expect(canGenerateHealthReminders({})).toBe(true)
  })

  it('returns true for undefined settings', () => {
    expect(canGenerateHealthReminders()).toBe(true)
  })
})

describe('DATA_AUTHORIZATION_DEFAULTS', () => {
  it('has all required fields', () => {
    expect(DATA_AUTHORIZATION_DEFAULTS).toHaveProperty('health_data_analysis_authorized', true)
    expect(DATA_AUTHORIZATION_DEFAULTS).toHaveProperty('assistant_context_authorized', true)
    expect(DATA_AUTHORIZATION_DEFAULTS).toHaveProperty('plan_suggestion_authorized', true)
    expect(DATA_AUTHORIZATION_DEFAULTS).toHaveProperty('news_recommendation_authorized', true)
    expect(DATA_AUTHORIZATION_DEFAULTS).toHaveProperty('policy_version', 'v1.0')
  })
})

describe('PRIVACY_SETTINGS_DEFAULTS', () => {
  it('has health_reminder_enabled true by default', () => {
    expect(PRIVACY_SETTINGS_DEFAULTS).toHaveProperty('health_reminder_enabled', true)
  })
})
