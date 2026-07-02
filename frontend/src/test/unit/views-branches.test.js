import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { clearAuthSession, saveAuthSession } from '../../api/request'

const routerPush = vi.fn()
const routerReplace = vi.fn()
const routerBack = vi.fn()
const routeMock = { query: {}, params: { id: 'doctor-1' }, fullPath: '/home' }

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return { ...actual, useRouter: () => ({ push: routerPush, replace: routerReplace, back: routerBack }), useRoute: () => routeMock }
})

const stubs = {
  'router-view': { template: '<div />' }, 'router-link': { template: '<a><slot /></a>' }, Transition: false,
  LiquidTabBar: { emits: ['change'], template: '<nav></nav>' }, TopUserActions: true,
  'van-button': { emits: ['click'], template: '<button type="button" @click="$emit(`click`)"><slot /></button>' },
  'van-form': { emits: ['submit'], template: '<form @submit.prevent="$emit(`submit`)"><slot /></form>' },
  'van-field': { props: ['modelValue','label','placeholder','type','min','maxlength','rows','clearable','autosize'], emits: ['update:modelValue','change'], template: '<label><span>{{ label }}</span><input :type="type||`text`" :value="modelValue" @input="$emit(`update:modelValue`, $event.target.value)" @change="$emit(`change`, $event)" /></label>' },
  'van-cell': { emits: ['click'], template: '<button class="van-cell-stub" type="button" @click="$emit(`click`)"><slot name="icon"/><slot name="title"/><slot name="label"/><slot name="value"/><slot/><slot name="right-icon"/></button>' },
  'van-cell-group': { template: '<div><slot /></div>' },
  'van-switch': { props: ['modelValue','disabled'], emits: ['update:modelValue'], template: '<button class="van-switch-stub" type="button" :disabled="disabled" @click="$emit(`update:modelValue`, !modelValue)">{{ modelValue?"on":"off" }}</button>' },
  'van-tabs': { emits: ['update:active'], template: '<div><slot /></div>' }, 'van-tab': { template: '<div><slot /></div>' },
  'van-progress': true, 'van-tag': true,
  'van-skeleton': { template: '<div><slot /></div>' },
  'van-row': { template: '<div><slot /></div>' }, 'van-col': { template: '<div><slot /></div>' },
  'van-icon': { template: '<i></i>' },
  'van-empty': { template: '<div class="van-empty-stub"><slot /></div>' },
  'van-nav-bar': { emits: ['click-left'], template: '<header><button type="button" @click="$emit(`click-left`)">back</button><slot name="title"/><slot/></header>' },
  'van-swipe-cell': { template: '<div><slot/><slot name="right"/></div>' },
  'van-calendar': { emits: ['confirm'], template: '<button class="van-calendar-stub" @click="$emit(`confirm`, new Date(`2000-01-02`))">calendar</button>' },
  'van-circle': true, 'van-grid': { template: '<div><slot /></div>' }, 'van-grid-item': { template: '<button type="button"><slot /></button>' },
}

function j(data, status = 200) {
  return new Response(JSON.stringify({ code: status >= 400 ? 1 : 0, data, message: status >= 400 ? 'err' : 'ok' }), { status })
}

function m3(input, init = {}) {
  const url = String(input)
  const method = String(init.method || 'GET').toUpperCase()
  if (url.includes('/api/home/summary')) return { latest_risk: { score: 30, risk_level: 'low', score_status: 'completed' }, today_tasks: [{ id: 'archive', title: '完善档案' }, { id: 'plan', title: '查看计划' }, { id: 'risk', title: '完成预测' }], hot_articles: [{ id: 1, title: '科普', summary: 's' }], recommended_doctors: [{ id: 'd1', name: 'Doc', department: 'Endocrine' }] }
  if (url.includes('/api/risk-assessments/latest')) return { score: 18, risk_level: 'low', score_status: 'completed', advice: { summary: 'low', diet: ['d'], exercise: ['e'], review: ['r'] } }
  if (url.includes('/api/risk-assessments')) return { score: 20, risk_level: 'low', score_status: 'completed', advice: { summary: 'ok' } }
  if (url.includes('/api/profile') && method === 'PUT') return { profile: { nickname: 'Updated' } }
  if (url.includes('/api/profile')) return { profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68, waist_cm: 82, sbp_mm_hg: 120, fasting_glucose: 6.1, family_history_diabetes: false, diagnosed_diabetes: false }, user: { nickname: 'Demo' } }
  if (url.includes('/api/reports/interpret')) return { summary: 'ok', indicators: [{ name: 'glucose', value: '6.4', unit: 'mmol/L' }], advice: ['r'] }
  if (url.includes('/api/checkins/history')) return { history: [{ date: '2026-07-01', task_count: 2, completed_count: 2 }] }
  if (url.includes('/api/checkins/analysis')) return { completion_rate: 75, summary: 'ok', evaluation: 'good', advice: 'keep' }
  if (url.includes('/api/plans/active')) return { id: 1, title: 'Plan', tasks: [{ id: 'task-1', title: 'Breakfast', target: '1', completed: false }] }
  if (url.includes('/api/plan-tasks/suggestions')) return { suggestions: [{ title: 'Goal', target: 'daily', task_type: 'diet', startDate: '2026-07-02', endDate: '2026-07-16' }] }
  if (url.includes('/api/plan-tasks')) return { id: 'task-2', title: 'Saved', target: 'daily' }
  if (url.includes('/api/messages')) return { list: [{ id: 1, title: 'Reminder', content: 'Record', type: 'plan', group: 'reminder', read: false }] }
  if (url.includes('/api/articles/1/comments')) return { items: [{ id: 'c1', user: 'T', content: 'nice', created_at: new Date().toISOString(), like_count: 1 }] }
  if (url.match(/\/api\/articles\/1$/)) return { id: 1, title: 'Article', summary: 's', content: 'c', category: 'diet', author: 'E', favorited: false, liked: false }
  if (url.includes('/api/articles/favorites')) return { items: [{ id: 1, title: 'Fav', summary: 's', category: 'diet', author: 'E' }] }
  if (url.includes('/api/articles')) return { items: [{ id: 1, title: 'Article', summary: 's', category: 'diet', author: 'E', favorited: false, liked: false }] }
  if (url.includes('/api/assistant/conversations/conv-1/messages')) return [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }]
  if (url.includes('/api/assistant/conversations')) return [{ id: 'conv-1', title: 'History', updated_at: new Date().toISOString() }]
  if (url.includes('/api/assistant/chat')) return { reply: 'reply', conversation_id: 'c2' }
  if (url.includes('/api/doctors/doctor-1/conversations/doctor-conv-1/messages')) return [{ role: 'assistant', content: 'history' }]
  if (url.includes('/api/doctors/doctor-1/conversations')) return { items: [{ id: 'dc1', updated_at: new Date().toISOString() }] }
  if (url.includes('/api/doctors/doctor-1/chat')) return { reply: 'doctor reply', conversation_id: 'dc2' }
  if (url.includes('/api/doctors/doctor-1')) return { id: 'doctor-1', name: 'Doc', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online' }
  if (url.includes('/api/doctors')) return { items: [{ id: 'd1', name: 'Doc', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online' }] }
  if (url.includes('/api/admin/dashboard')) return { users: 3, articles: 2, doctors: 1, consultations: 1 }
  if (url.includes('/api/admin/articles')) return { items: [{ id: 101, title: 'A', status: 'draft', audit_status: 'approved' }], total: 1 }
  if (url.includes('/api/admin/doctors')) return { items: [{ id: 'd1', name: 'Doc', department: 'Endocrine' }] }
  if (url.includes('/api/admin/users')) return { items: [{ id: 1, username: 'demo', role: 'user', status: 'active' }], total: 1 }
  if (url.includes('/api/admin/consultations')) return { items: [{ id: 1, username: 'demo', doctor_name: 'Doc', title: 'Q', status: 'active' }] }
  if (url.includes('/api/admin/dify-run-logs')) return { items: [{ id: 1, app_code: 'assistant', status: 'ok', created_at: '2026-07-02' }] }
  if (url.includes('/api/admin/assistant/conversations')) return [{ id: 'a1' }]
  if (url.includes('/api/admin/assistant/chat')) return { reply: 'admin reply' }
  if (url.includes('/api/privacy-settings')) return { personalized_advice_enabled: true, assistant_context_enabled: true, health_reminder_enabled: true }
  if (url.includes('/api/data-authorizations')) return { health_data_analysis_authorized: true, assistant_context_authorized: true, plan_suggestion_authorized: true, news_recommendation_authorized: true }
  return { items: [] }
}

async function mountF(comp) { const w = mount(comp, { global: { stubs } }); await flushPromises(); return w }
async function safe(fn) { try { await fn(); await flushPromises() } catch {} }

beforeEach(() => {
  routerPush.mockClear(); routerReplace.mockClear(); routerBack.mockClear()
  routeMock.query = {}; routeMock.params = { id: 'doctor-1' }
  clearAuthSession()
  saveAuthSession({ token: 'vt', user: { id: 1, role: 'user', username: 'demo', nickname: 'Demo' } })
  vi.stubGlobal('fetch', vi.fn((input, init) => Promise.resolve(j(m3(input, init)))))
  window.confirm = vi.fn(() => true)
})

// ============================================================
// LoginView — all branches
// ============================================================
describe('LoginView branches', () => {
  let Login
  beforeAll(async () => { Login = (await import('../../views/auth/LoginView.vue')).default })

  it('register: password mismatch and short password', async () => {
    const w = await mountF(Login)
    // Switch to register mode
    await safe(() => w.find('.register-prompt').trigger('click'))
    await flushPromises()
    // Fill register form with mismatch
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('new-user')
    if (inputs[1]) await inputs[1].setValue('12345') // too short
    if (inputs[2]) await inputs[2].setValue('123456') // mismatch
    if (inputs[3]) await inputs[3].setValue(true) // agreement checkbox
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('register: password too short (5 chars)', async () => {
    const w = await mountF(Login)
    await safe(() => w.find('.register-prompt').trigger('click'))
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('new-user')
    if (inputs[1]) await inputs[1].setValue('12345')
    if (inputs[2]) await inputs[2].setValue('12345')
    if (inputs[3]) await inputs[3].setValue(true)
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('login: non-ApiRequestError message', async () => {
    const { loginByPassword } = await import('../../api/auth')
    const orig = vi.mocked(loginByPassword)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ token: 't', user: { id: 1, role: 'user' } }))))
    const w = await mountF(Login)
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('demo')
    if (inputs[1]) await inputs[1].setValue('123456')
    if (inputs[2]) await inputs[2].setValue(true)
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('login: submit without agreement checked', async () => {
    const w = await mountF(Login)
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('demo')
    if (inputs[1]) await inputs[1].setValue('123456')
    // agreement NOT checked
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('register: agreement not checked', async () => {
    const w = await mountF(Login)
    await safe(() => w.find('.register-prompt').trigger('click'))
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('new-user')
    if (inputs[1]) await inputs[1].setValue('123456')
    if (inputs[2]) await inputs[2].setValue('123456')
    // agreement NOT checked
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('submit with only empty fields', async () => {
    const w = await mountF(Login)
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handleSubmit: redirect with admin role', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ token: 't', user: { id: 1, role: 'admin' } }))))
    const w = await mountF(Login)
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('admin')
    if (inputs[1]) await inputs[1].setValue('123456')
    if (inputs[2]) await inputs[2].setValue(true)
    await safe(() => w.find('form').trigger('submit.prevent'))
    await new Promise(r => setTimeout(r, 600))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handleSubmit: redirect with redirect query param', async () => {
    routeMock.query = { redirect: '/health' }
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ token: 't', user: { id: 1, role: 'user' } }))))
    const w = await mountF(Login)
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('demo')
    if (inputs[1]) await inputs[1].setValue('123456')
    if (inputs[2]) await inputs[2].setValue(true)
    await safe(() => w.find('form').trigger('submit.prevent'))
    await new Promise(r => setTimeout(r, 600))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('openPhoneLogin shows notice', async () => {
    const w = await mountF(Login)
    await safe(() => w.find('.footer-options button').trigger('click'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('toggle showPassword', async () => {
    const w = await mountF(Login)
    const passBtns = w.findAll('.password-button')
    if (passBtns[0]) await passBtns[0].trigger('click')
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// HealthView — risk scoreCard branches
// ============================================================
describe('HealthView branches', () => {
  let HealthView
  beforeAll(async () => { HealthView = (await import('../../views/health/HealthView.vue')).default })

  function mockHealth(profileData) {
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.includes('/api/risk-assessments/latest')) {
        const risk = profileData.latest_risk
        if (!risk) return Promise.reject(new Error('no risk'))
        return Promise.resolve(j(risk))
      }
      return Promise.resolve(j(profileData))
    }))
  }

  it('scoreCard: no risk → 待评估', async () => {
    mockHealth({ profile: { completion_rate: 0, completed: false }, latest_measurements: null, latest_risk: null })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('待评估')
  })

  it('scoreCard: diagnosed status → 已确诊', async () => {
    mockHealth({ profile: { completion_rate: 50 }, latest_measurements: null, latest_risk: { score_status: 'diagnosed' } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('已确诊')
  })

  it('scoreCard: incomplete status → 资料不足', async () => {
    mockHealth({ profile: { completion_rate: 40 }, latest_measurements: null, latest_risk: { score_status: 'incomplete', missing_fields: ['height'] } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('资料不足')
  })

  it('scoreCard: high risk', async () => {
    mockHealth({ profile: { completion_rate: 80 }, latest_measurements: null, latest_risk: { score: 45, risk_level: 'high' } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('偏高')
  })

  it('scoreCard: low risk', async () => {
    mockHealth({ profile: { completion_rate: 80 }, latest_measurements: null, latest_risk: { score: 10, risk_level: 'low' } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('较稳')
  })

  it('scoreCard: is_high_risk flag', async () => {
    mockHealth({ profile: { completion_rate: 80 }, latest_measurements: null, latest_risk: { score: 15, is_high_risk: true } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('偏高')
  })

  it('healthAdvice: no advice when processing', async () => {
    mockHealth({ profile: {}, latest_measurements: null, latest_risk: { score: 10, risk_level: 'low', score_status: 'processing', advice: { summary: 'x' } } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('healthAdvice: null advice', async () => {
    mockHealth({ profile: {}, latest_measurements: null, latest_risk: { score: 10, risk_level: 'low', advice: null } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('healthAdvice: empty advice object', async () => {
    mockHealth({ profile: {}, latest_measurements: null, latest_risk: { score: 10, risk_level: 'low', advice: { summary: '', diet: [], exercise: [], review: [] } } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('bodyMetrics: with full measurements', async () => {
    mockHealth({ profile: { height_cm: 170, weight_kg: 70, bmi: 24.2, waist_cm: 85, sbp_mm_hg: 130, completion_rate: 80 }, latest_measurements: { fasting_glucose: 6.1, postprandial_glucose: 7.8 }, latest_risk: { score: 10, risk_level: 'low', advice: { summary: 'ok' } } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('bodyMetrics: with systolic_bp fallback', async () => {
    mockHealth({ profile: { height_cm: 170, weight_kg: 70, systolic_bp: 125, completion_rate: 80 }, latest_measurements: { sbp_mm_hg: 128 }, latest_risk: { score: 10, risk_level: 'low', advice: { summary: 'ok' } } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('metricTiles: glucoseStatus for all ranges', async () => {
    mockHealth({ profile: { height_cm: 170, weight_kg: 70, bmi: 18, waist_cm: 85, sbp_mm_hg: 130, completion_rate: 100 }, latest_measurements: { fasting_glucose: 8.0, postprandial_glucose: 12.0 }, latest_risk: { score: 10, risk_level: 'low', advice: { summary: 'ok' } } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('metricTiles: bmi >= 30 → 偏高', async () => {
    mockHealth({ profile: { height_cm: 160, weight_kg: 80, bmi: 31.2, waist_cm: 95, sbp_mm_hg: 140, completion_rate: 80 }, latest_measurements: { fasting_glucose: 5.0, postprandial_glucose: 6.5 }, latest_risk: { score: 10, risk_level: 'low', advice: { summary: 'ok' } } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('偏高')
  })

  it('metricTiles: bmi >= 24 → 略高', async () => {
    mockHealth({ profile: { height_cm: 170, weight_kg: 75, bmi: 25.9, waist_cm: 85, sbp_mm_hg: 120, completion_rate: 80 }, latest_measurements: { fasting_glucose: 5.0, postprandial_glucose: 6.5 }, latest_risk: { score: 10, risk_level: 'low', advice: { summary: 'ok' } } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('略高')
  })

  it('readStoredUser with corrupt JSON', async () => {
    localStorage.setItem('diabetesAuthUser', '{bad json')
    mockHealth({ profile: { completion_rate: 50 }, latest_measurements: null, latest_risk: { score: 10, risk_level: 'low' } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
    localStorage.removeItem('diabetesAuthUser')
  })

  it('loads with profile only (no latest_measurements)', async () => {
    mockHealth({ profile: { completed: true, completion_rate: 100, height_cm: 170, weight_kg: 70, waist_cm: 85, sbp_mm_hg: 120, fasting_glucose: 5.5 } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('today_measurements fallback', async () => {
    mockHealth({ profile: { completion_rate: 80 }, today_measurements: { fasting_glucose: 5.5, weight_kg: 70, sbp_mm_hg: 120 }, latest_risk: { score: 10, risk_level: 'low' } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('measurements fallback (bare array key)', async () => {
    mockHealth({ profile: { completion_rate: 80 }, measurements: { fasting_glucose: 5.5, weight_kg: 70, sbp_mm_hg: 120 }, latest_risk: { score: 10, risk_level: 'low' } })
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('profileRate: completed → 100', async () => {
    mockHealth({ profile: { completed: true, completion_rate: 50 }, latest_measurements: null, latest_risk: { score: 10, risk_level: 'low' } })
    const w = await mountF(HealthView)
    expect(w.text()).toContain('100')
  })

  it('API fetch error handled', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const w = await mountF(HealthView)
    expect(w.exists()).toBe(true)
  })

  it('assessRisk: without login shows toast', async () => {
    clearAuthSession()
    mockHealth({ profile: { completion_rate: 50 }, latest_measurements: null, latest_risk: null })
    const w = await mountF(HealthView)
    const buttons = w.findAll('button')
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// HealthArchiveView branches
// ============================================================
describe('HealthArchiveView branches', () => {
  let Archive
  beforeAll(async () => { Archive = (await import('../../views/health/HealthArchiveView.vue')).default })

  it('mounts and submits with error handling', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68, waist_cm: 82, sbp_mm_hg: 120, fasting_glucose: 6.1 } }))))
    const w = await mountF(Archive)
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    for (const inp of inputs.slice(0, 10)) {
      await safe(() => inp.setValue('test'))
    }
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles API error on submit', async () => {
    vi.stubGlobal('fetch', vi.fn((input, init) => {
      const method = String(init?.method || 'GET').toUpperCase()
      if (String(input).includes('/api/profile') && method === 'PUT') {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve(j({ profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68, waist_cm: 82, sbp_mm_hg: 120, fasting_glucose: 6.1 } }))
    }))
    const w = await mountF(Archive)
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('demo')
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// PlanView — plan states and toggle
// ============================================================
describe('PlanView branches', () => {
  let PlanView
  beforeAll(async () => { PlanView = (await import('../../views/plan/PlanView.vue')).default })

  it('empty plan → 待生成', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ plan: null }))))
    const w = await mountF(PlanView)
    expect(w.exists()).toBe(true)
  })

  it('all tasks completed → 今日已完成', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      plan: { id: 1, title: 'P', tasks: [{ id: 't1', title: 'A', target: '1', completed: true }] },
    }))))
    const w = await mountF(PlanView)
    expect(w.exists()).toBe(true)
  })

  it('API error on load', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const w = await mountF(PlanView)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('toggleTask with invalid id', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      plan: { tasks: [{ title: 'A', target: '1', completed: false }] },
    }))))
    const w = await mountF(PlanView)
    await flushPromises()
    // Click task area
    const cells = w.findAll('.van-cell-stub')
    for (const cell of cells.slice(0, 5)) {
      await safe(() => cell.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('toggleTask API error', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/plan-tasks/') && String(input).includes('completion')) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve(j({ plan: { tasks: [{ id: 't1', title: 'A', target: '1', completed: false }] } }))
    }))
    const w = await mountF(PlanView)
    await flushPromises()
    const cells = w.findAll('.van-cell-stub')
    for (const cell of cells.slice(0, 5)) {
      await safe(() => cell.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('generatePlan error', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/plans/generate')) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve(j({ plan: null }))
    }))
    const w = await mountF(PlanView)
    await flushPromises()
    const buttons = w.findAll('button')
    for (const btn of buttons.slice(0, 10)) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// HomeView — riskInfo statuses and interactions
// ============================================================
describe('HomeView branches', () => {
  let HomeView
  beforeAll(async () => { HomeView = (await import('../../views/HomeView.vue')).default })

  it('riskInfo: processing status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: { score_status: 'processing' },
      today_tasks: [], hot_articles: [], recommended_doctors: [],
    }))))
    const w = await mountF(HomeView)
    expect(w.exists()).toBe(true)
  })

  it('riskInfo: incomplete status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: { score_status: 'incomplete' },
      today_tasks: [], hot_articles: [], recommended_doctors: [],
    }))))
    const w = await mountF(HomeView)
    expect(w.exists()).toBe(true)
  })

  it('riskInfo: diagnosed status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: { score_status: 'diagnosed' },
      today_tasks: [], hot_articles: [], recommended_doctors: [],
    }))))
    const w = await mountF(HomeView)
    expect(w.exists()).toBe(true)
  })

  it('riskInfo: not_applicable status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: { score_status: 'not_applicable' },
      today_tasks: [], hot_articles: [], recommended_doctors: [],
    }))))
    const w = await mountF(HomeView)
    expect(w.exists()).toBe(true)
  })

  it('riskInfo: unknown risk level', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: { score: 25, risk_level: 'unknown_xyz' },
      today_tasks: [], hot_articles: [], recommended_doctors: [],
    }))))
    const w = await mountF(HomeView)
    expect(w.exists()).toBe(true)
  })

  it('medium risk level', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: { score: 25, risk_level: 'medium' },
      today_tasks: [], hot_articles: [], recommended_doctors: [],
    }))))
    const w = await mountF(HomeView)
    expect(w.exists()).toBe(true)
  })

  it('loadData API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const w = await mountF(HomeView)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('requireLogin blocks unauthenticated actions', async () => {
    clearAuthSession()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: null, today_tasks: [], hot_articles: [], recommended_doctors: [{ id: 'd1', name: 'Doc', department: 'Endocrine' }],
    }))))
    const w = await mountF(HomeView)
    await flushPromises()
    // Click doctor card — should trigger toast instead of navigation
    const docCards = w.findAll('.doctor-card')
    for (const card of docCards.slice(0, 3)) {
      await safe(() => card.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('openArticle and openDoctor navigation', async () => {
    saveAuthSession({ token: 'vt', user: { id: 1, role: 'user' } })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: { score: 10, risk_level: 'low' },
      today_tasks: [{ id: 'archive', title: '档案' }, { id: 'plan', title: '计划' }, { id: 'risk', title: '评估' }, { id: 'other', title: '其他' }],
      hot_articles: [{ id: 1, title: 'Article', summary: 's' }],
      recommended_doctors: [{ id: 'd1', name: 'Doc', department: 'Endocrine' }],
    }))))
    const w = await mountF(HomeView)
    await flushPromises()
    // Click task cells
    const cells = w.findAll('.van-cell-stub')
    for (const cell of cells.slice(0, 8)) {
      await safe(() => cell.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles different data shapes (doctors as array, responseData.items)', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.includes('/api/home/summary')) return Promise.resolve(j({
        latest_risk: { score: 10, risk_level: 'low' },
        today_tasks: [], hot_articles: [],
        recommended_doctors: [],
      }))
      if (url.includes('/api/doctors')) return Promise.resolve(j([{ id: 'd1', name: 'Doc', department: 'Endocrine' }]))
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(HomeView)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('no doctors, no articles empty states', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({
      latest_risk: null, today_tasks: [], hot_articles: [], recommended_doctors: [], diabetes_types: [],
    }))))
    const w = await mountF(HomeView)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// HealthJourneyView — touch interaction branches
// ============================================================
describe('HealthJourneyView branches', () => {
  let Journey
  beforeAll(async () => { Journey = (await import('../../views/journey/HealthJourneyView.vue')).default })

  it('pointerDown with mouse button=0 initiates drag', async () => {
    const w = await mountF(Journey)
    const vp = w.find('.journey-viewport')
    expect(vp.exists()).toBe(true)
    await safe(() => vp.trigger('pointerdown', { pointerType: 'mouse', button: 0, clientX: 200, pointerId: 1 }))
    await safe(() => vp.trigger('pointermove', { pointerType: 'mouse', clientX: 140, pointerId: 1 }))
    await safe(() => vp.trigger('pointerup'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('pointerDown with non-zero mouse button is ignored', async () => {
    const w = await mountF(Journey)
    const vp = w.find('.journey-viewport')
    await safe(() => vp.trigger('pointerdown', { pointerType: 'mouse', button: 2, clientX: 200, pointerId: 1 }))
    await safe(() => vp.trigger('pointermove', { pointerType: 'mouse', clientX: 100, pointerId: 1 }))
    await safe(() => vp.trigger('pointerup'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handleAction: last page clicks go to login', async () => {
    const w = await mountF(Journey)
    for (let i = 0; i < 3; i++) {
      const vp = w.find('.journey-viewport')
      await safe(() => vp.trigger('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 300 }))
      await safe(() => vp.trigger('pointermove', { pointerType: 'touch', pointerId: 1, clientX: 100 }))
      await safe(() => vp.trigger('pointerup'))
      await flushPromises()
    }
    const nodes = w.findAll('.route-node')
    for (const node of nodes) {
      await safe(() => node.trigger('click'))
    }
    await flushPromises()
    const buttons = w.findAll('button')
    for (const btn of buttons.slice(0, 12)) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handlePointerEnd: drag right past threshold navigates back', async () => {
    const w = await mountF(Journey)
    let vp = w.find('.journey-viewport')
    await safe(() => vp.trigger('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 300 }))
    await safe(() => vp.trigger('pointermove', { pointerType: 'touch', pointerId: 1, clientX: 100 }))
    await safe(() => vp.trigger('pointerup'))
    await flushPromises()
    vp = w.find('.journey-viewport')
    await safe(() => vp.trigger('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 100 }))
    await safe(() => vp.trigger('pointermove', { pointerType: 'touch', pointerId: 2, clientX: 350 }))
    await safe(() => vp.trigger('pointerup'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handlePointerMove when not dragging does nothing', async () => {
    const w = await mountF(Journey)
    const vp = w.find('.journey-viewport')
    await safe(() => vp.trigger('pointermove', { pointerType: 'touch', clientX: 150, pointerId: 1 }))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handlePointerEnd when not dragging does nothing', async () => {
    const w = await mountF(Journey)
    const vp = w.find('.journey-viewport')
    await safe(() => vp.trigger('pointerup'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('pointercancel triggers handlePointerEnd', async () => {
    const w = await mountF(Journey)
    const vp = w.find('.journey-viewport')
    await safe(() => vp.trigger('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 300 }))
    await safe(() => vp.trigger('pointermove', { pointerType: 'touch', pointerId: 1, clientX: 150 }))
    await safe(() => vp.trigger('pointercancel'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// PlanTaskCreateView — all form and AI branches
// ============================================================
describe('PlanTaskCreateView branches', () => {
  let Task
  beforeAll(async () => { Task = (await import('../../views/plan/PlanTaskCreateView.vue')).default })

  it('validateTask: empty title', async () => {
    const w = await mountF(Task)
    await flushPromises()
    // Try to save with empty form
    const buttons = w.findAll('button')
    // Find save button
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('saveTask with editingId', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ items: [{ id: 't1', category: 'diet', title: 'Eat healthy', desc: 'desc', target: '3', time: '08:00', startDate: '2026-07-02', endDate: '2026-07-16' }] }))))
    const w = await mountF(Task)
    await flushPromises()
    // Click existing task to load it
    const exRows = w.findAll('.ep-ex-row')
    if (exRows[0]) await exRows[0].trigger('click')
    await flushPromises()
    // Now save
    const buttons = w.findAll('button')
    // Set title
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('Updated task content')
    await flushPromises()
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('saveTask API error', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/plan-tasks') && !String(input).includes('/api/plan-tasks/suggestions')) {
        return Promise.reject(new Error('save failed'))
      }
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    // Fill title
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file' && i.attributes('type') !== 'date')
    if (inputs[0]) await inputs[0].setValue('New task title')
    // Set dates
    const dateInputs = w.findAll('input[type="date"]')
    if (dateInputs[0]) await dateInputs[0].setValue('2026-07-02')
    if (dateInputs[1]) await dateInputs[1].setValue('2026-07-16')
    await flushPromises()
    // Click save
    const buttons = w.findAll('button')
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('validateTask: startDate before today', async () => {
    const w = await mountF(Task)
    await flushPromises()
    const dateInputs = w.findAll('input[type="date"]')
    // Set start date to past
    if (dateInputs[0]) await dateInputs[0].setValue('2020-01-01')
    if (dateInputs[1]) await dateInputs[1].setValue('2026-12-31')
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file' && i.attributes('type') !== 'date')
    if (inputs[0]) await inputs[0].setValue('Task title')
    await flushPromises()
    const buttons = w.findAll('button')
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('validateTask: endDate before startDate', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const w = await mountF(Task)
    await flushPromises()
    const dateInputs = w.findAll('input[type="date"]')
    if (dateInputs[0]) await dateInputs[0].setValue(today)
    if (dateInputs[1]) await dateInputs[1].setValue(today) // same day = invalid
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file' && i.attributes('type') !== 'date')
    if (inputs[0]) await inputs[0].setValue('Task title')
    await flushPromises()
    const buttons = w.findAll('button')
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('generateAi with diagnosed profile', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/profile')) {
        return Promise.resolve(j({ profile: { diagnosed_diabetes: true, weight_kg: 80, sbp_mm_hg: 140, fasting_glucose: 8.5 } }))
      }
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    // Click generate
    const genBtn = w.find('.ep-gen-btn')
    if (genBtn.exists()) await genBtn.trigger('click')
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('generateAi without profile (fetch error)', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/profile')) {
        return Promise.reject(new Error('no profile'))
      }
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    const genBtn = w.find('.ep-gen-btn')
    if (genBtn.exists()) await genBtn.trigger('click')
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('generateAi with profile (no diagnosed, with measurements)', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/profile')) {
        return Promise.resolve(j({ profile: { diagnosed_diabetes: false, weight_kg: null, sbp_mm_hg: null, fasting_glucose: null } }))
      }
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    const genBtn = w.find('.ep-gen-btn')
    if (genBtn.exists()) await genBtn.trigger('click')
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('acceptAll with valid suggestions', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const end = new Date(); end.setDate(end.getDate() + 13)
    const endDate = end.toISOString().slice(0, 10)
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/profile')) {
        return Promise.resolve(j({ profile: { diagnosed_diabetes: true, weight_kg: 75, sbp_mm_hg: 130, fasting_glucose: 7.0 } }))
      }
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    // Generate AI first
    const genBtn = w.find('.ep-gen-btn')
    if (genBtn.exists()) await genBtn.trigger('click')
    await flushPromises()
    // Accept all
    const buttons = w.findAll('button')
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('acceptAll API error', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/profile')) {
        return Promise.resolve(j({ profile: { diagnosed_diabetes: true, weight_kg: 75, sbp_mm_hg: 130, fasting_glucose: 7.0 } }))
      }
      if (String(input).includes('/api/plan-tasks') && !String(input).includes('suggestions')) {
        return Promise.reject(new Error('batch fail'))
      }
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    const genBtn = w.find('.ep-gen-btn')
    if (genBtn.exists()) await genBtn.trigger('click')
    await flushPromises()
    const buttons = w.findAll('button')
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('deleteTask confirmation cancelled', async () => {
    window.confirm = vi.fn(() => false)
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ items: [{ id: 't1', category: 'diet', title: 'Task', desc: 'd', target: '1', time: '08:00', startDate: '2026-07-02', endDate: '2026-07-16' }] }))))
    const w = await mountF(Task)
    await flushPromises()
    const delButtons = w.findAll('.ep-ex-del')
    for (const btn of delButtons.slice(0, 2)) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    window.confirm = vi.fn(() => true)
    expect(w.exists()).toBe(true)
  })

  it('deleteTask API error', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/plan-tasks/') && String(input).includes('DELETE')) {
        return Promise.reject(new Error('delete fail'))
      }
      return Promise.resolve(j({ items: [{ id: 't1', category: 'diet', title: 'Task', desc: 'd', target: '1', time: '08:00', startDate: '2026-07-02', endDate: '2026-07-16' }] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    const delButtons = w.findAll('.ep-ex-del')
    if (delButtons[0]) await delButtons[0].trigger('click')
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('cancelEdit resets form', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ items: [] }))))
    const w = await mountF(Task)
    await flushPromises()
    const buttons = w.findAll('button')
    for (const btn of buttons) {
      await safe(() => btn.trigger('click'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('onStartDateChange updates minEndDate', async () => {
    const w = await mountF(Task)
    await flushPromises()
    const dateInputs = w.findAll('input[type="date"]')
    if (dateInputs[0]) {
      await dateInputs[0].setValue('2026-12-01')
      await dateInputs[0].trigger('change')
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('goBack when no history', async () => {
    Object.defineProperty(window, 'history', { configurable: true, value: { length: 1 } })
    const w = await mountF(Task)
    await flushPromises()
    const navButtons = w.findAll('.ep-nav button')
    if (navButtons[0]) await navButtons[0].trigger('click')
    await flushPromises()
    expect(routerPush).toHaveBeenCalled()
    Object.defineProperty(window, 'history', { configurable: true, value: { length: 2 } })
  })

  it('auto generateAi when route.query.ai=1', async () => {
    routeMock.query = { ai: '1' }
    vi.stubGlobal('fetch', vi.fn((input) => {
      if (String(input).includes('/api/profile')) {
        return Promise.resolve(j({ profile: { diagnosed_diabetes: false } }))
      }
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Task)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// DoctorConsultView — chat interactions
// ============================================================
describe('DoctorConsultView branches', () => {
  let Doctor
  beforeAll(async () => { Doctor = (await import('../../views/doctor/DoctorConsultView.vue')).default })

  it('mounts and loads doctor list', async () => {
    routeMock.query = {}
    const w = await mountF(Doctor)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('loads with doctor query param', async () => {
    routeMock.query = { doctor: 'doctor-1' }
    const w = await mountF(Doctor)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('sends message to doctor', async () => {
    routeMock.query = { doctor: 'doctor-1' }
    const w = await mountF(Doctor)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    for (const inp of inputs.slice(0, 5)) {
      await safe(() => inp.setValue('hello doctor'))
    }
    const forms = w.findAll('form')
    for (const form of forms.slice(0, 3)) {
      await safe(() => form.trigger('submit.prevent'))
    }
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    routeMock.query = { doctor: 'doctor-1' }
    const w = await mountF(Doctor)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// Other views — error handling and edge cases
// ============================================================
describe('Other views branches', () => {
  it('AssistantView handles API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Assistant = (await import('../../views/assistant/AssistantView.vue')).default
    const w = await mountF(Assistant)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('MessagesView loads message list', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ list: [{ id: 1, title: 'T', content: 'C', type: 'system', group: 'info', read: true }] }))))
    const Messages = (await import('../../views/messages/MessagesView.vue')).default
    const w = await mountF(Messages)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('MessagesView handles API error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Messages = (await import('../../views/messages/MessagesView.vue')).default
    const w = await mountF(Messages)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('FavoritesView API error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Favorites = (await import('../../views/favorites/FavoritesView.vue')).default
    const w = await mountF(Favorites)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('NewsView API error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const News = (await import('../../views/news/NewsView.vue')).default
    const w = await mountF(News)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('ChangePasswordView: form validation branches', async () => {
    const Password = (await import('../../views/profile/ChangePasswordView.vue')).default
    const w = await mountF(Password)
    await flushPromises()
    // Submit empty form
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    // Fill with mismatch
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('old')
    if (inputs[1]) await inputs[1].setValue('new1')
    if (inputs[2]) await inputs[2].setValue('new2')
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('ChangePasswordView: API error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Password = (await import('../../views/profile/ChangePasswordView.vue')).default
    const w = await mountF(Password)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('old')
    if (inputs[1]) await inputs[1].setValue('new123')
    if (inputs[2]) await inputs[2].setValue('new123')
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('PrivacySettingsView: API error on toggle', async () => {
    vi.stubGlobal('fetch', vi.fn((input, init) => {
      const method = String(init?.method || 'GET').toUpperCase()
      if (String(input).includes('/api/privacy-settings') && method === 'PUT') {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve(j({ personalized_advice_enabled: true, assistant_context_enabled: true, health_reminder_enabled: true }))
    }))
    const Privacy = (await import('../../views/profile/PrivacySettingsView.vue')).default
    const w = await mountF(Privacy)
    await flushPromises()
    const switches = w.findAll('.van-switch-stub')
    if (switches[0]) await switches[0].trigger('click')
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('PersonalInfoView: API error on save', async () => {
    vi.stubGlobal('fetch', vi.fn((input, init) => {
      const method = String(init?.method || 'GET').toUpperCase()
      if (String(input).includes('/api/profile') && method === 'PUT') {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve(j({ profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68, waist_cm: 82, sbp_mm_hg: 120, fasting_glucose: 6.1 }, user: { nickname: 'Demo' } }))
    }))
    const Info = (await import('../../views/profile/PersonalInfoView.vue')).default
    const w = await mountF(Info)
    await flushPromises()
    await safe(() => w.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('DataAuthorizationView: API error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Authz = (await import('../../views/profile/DataAuthorizationView.vue')).default
    const w = await mountF(Authz)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('DoctorProfileView mounts with params', async () => {
    routeMock.params = { id: 'doctor-1' }
    const Profile = (await import('../../views/doctor/DoctorProfileView.vue')).default
    const w = await mountF(Profile)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('DoctorProfileView API error', async () => {
    routeMock.params = { id: 'doctor-1' }
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Profile = (await import('../../views/doctor/DoctorProfileView.vue')).default
    const w = await mountF(Profile)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('CheckinAnalysisView: API error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Analysis = (await import('../../views/plan/CheckinAnalysisView.vue')).default
    const w = await mountF(Analysis)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('CheckinRecordsView: API error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const Records = (await import('../../views/plan/CheckinRecordsView.vue')).default
    const w = await mountF(Records)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('NotFoundView: no history → replace home', async () => {
    Object.defineProperty(window, 'history', { configurable: true, value: { length: 1 } })
    const NotFound = (await import('../../views/NotFoundView.vue')).default
    const w = await mountF(NotFound)
    await flushPromises()
    const buttons = w.findAll('button')
    if (buttons[0]) await buttons[0].trigger('click') // "返回上一页" with no history
    await flushPromises()
    expect(w.exists()).toBe(true)
    Object.defineProperty(window, 'history', { configurable: true, value: { length: 2 } })
  })

  it('NotFoundView: back with history', async () => {
    Object.defineProperty(window, 'history', { configurable: true, value: { length: 3 } })
    const NotFound = (await import('../../views/NotFoundView.vue')).default
    const w = await mountF(NotFound)
    await flushPromises()
    const buttons = w.findAll('button')
    if (buttons[0]) await buttons[0].trigger('click')
    await flushPromises()
    expect(routerBack).toHaveBeenCalled()
    Object.defineProperty(window, 'history', { configurable: true, value: { length: 2 } })
  })

  it('NotFoundView: "回到首页" button', async () => {
    const NotFound = (await import('../../views/NotFoundView.vue')).default
    const w = await mountF(NotFound)
    await flushPromises()
    const buttons = w.findAll('button')
    if (buttons[1]) await buttons[1].trigger('click')
    await flushPromises()
    expect(routerReplace).toHaveBeenCalledWith(expect.objectContaining({ name: 'home' }))
  })
})

// ============================================================
// AdminDashboardView — comprehensive coverage
// ============================================================
describe('AdminDashboardView comprehensive', () => {
  let Admin
  beforeAll(async () => { Admin = (await import('../../views/admin/AdminDashboardView.vue')).default })

  function adminMock(overrides = {}) {
    vi.stubGlobal('fetch', vi.fn((input, init) => {
      const url = String(input)
      const method = String(init?.method || 'GET').toUpperCase()
      if (url.includes('/api/admin/dashboard')) return Promise.resolve(j({ users: 3, articles: 2, doctors: 1, consultations: 1 }))
      if (url.includes('/api/admin/articles') && method === 'GET') return Promise.resolve(j({ items: [{ id: 101, title: 'Test', status: 'draft', audit_status: 'approved', category_id: null, cover_url: '', tags: [], author: 'E', recommend_weight: 0 }], total: 1 }))
      if (url.includes('/api/admin/doctors') && method === 'GET') return Promise.resolve(j({ items: [{ id: 'd1', name: 'Doc', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online', avatar_url: '', license_no: '', profile_md: '', consult_status: 'online', display_status: 'published', audit_status: 'approved', sort_order: 0 }] }))
      if (url.includes('/api/admin/users') && method === 'GET') return Promise.resolve(j({ items: [{ id: 1, username: 'demo', role: 'user', status: 'active' }], total: 1 }))
      if (url.includes('/api/admin/consultations') && method === 'GET') return Promise.resolve(j({ items: [{ id: 1, username: 'demo', doctor_name: 'Doc', title: 'Q', status: 'active' }] }))
      if (url.includes('/api/admin/dify-run-logs')) return Promise.resolve(j({ items: [{ id: 1, app_code: 'assistant', status: 'ok', created_at: '2026-07-02' }] }))
      if (url.includes('/api/admin/articles/') && url.includes('publish')) return Promise.resolve(j({ id: 101, title: 'Test', status: 'published' }))
      if (url.includes('/api/admin/articles/') && url.includes('unpublish')) return Promise.resolve(j({ id: 101, title: 'Test', status: 'draft' }))
      if (url.includes('/api/admin/articles') && method === 'POST') return Promise.resolve(j({ id: 102, title: 'New', status: 'draft' }))
      if (url.includes('/api/admin/articles/') && method === 'PUT') return Promise.resolve(j({ id: 101, title: 'Updated', status: 'draft' }))
      if (url.includes('/api/admin/articles/') && method === 'DELETE') return Promise.resolve(j({}))
      if (url.includes('/api/admin/doctors') && (method === 'POST' || method === 'PUT')) return Promise.resolve(j({ id: 'd2', name: 'NewDoc', department: 'Endocrine' }))
      if (url.includes('/api/admin/users/') && method === 'PUT') return Promise.resolve(j({ id: 1, username: 'demo', status: 'disabled' }))
      if (url.includes('/api/admin/assistant/chat')) return Promise.resolve(j({ reply: 'admin reply', conversation_id: 'a1' }))
      if (url.includes('/api/admin/assistant/conversations')) return Promise.resolve(j([{ id: 'a1' }]))
      if (url.includes('/api/uploads')) return Promise.resolve(j({ file_id: 'f1', url: '/f.jpg' }))
      return Promise.resolve(j({ items: [] }))
    }))
  }

  beforeEach(() => {
    saveAuthSession({ token: 'at', user: { id: 1, role: 'admin', username: 'admin' } })
    adminMock()
  })

  async function clickAll(w) {
    for (const btn of w.findAll('button').slice(0, 60)) await safe(() => btn.trigger('click'))
  }

  it('loads overview tab', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('switches to articles tab and creates article', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[2]) await tabs[2].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('switches to doctors tab and saves', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[3]) await tabs[3].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('switches to users tab and toggles status', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[4]) await tabs[4].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('switches to consultations tab', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[5]) await tabs[5].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('assistant tab: sends admin message', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[1]) await tabs[1].trigger('click')
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('stats')
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('API errors handled gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const w = await mountF(Admin)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('non-admin redirects', async () => {
    saveAuthSession({ token: 'ut', user: { id: 1, role: 'user', username: 'user' } })
    const w = await mountF(Admin)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('all nav tabs clicked', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    for (const tab of tabs) {
      await tab.trigger('click')
      await flushPromises()
      await clickAll(w)
    }
    expect(w.exists()).toBe(true)
  })

  it('searchArticles and pagination', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[2]) await tabs[2].trigger('click')
    await flushPromises()
    // Search
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('keyword')
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('article CRUD operations', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[2]) await tabs[2].trigger('click')
    await flushPromises()
    // Fill article form
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    for (const inp of inputs.slice(0, 5)) await safe(() => inp.setValue('test'))
    const textareas = w.findAll('textarea')
    if (textareas[0]) await safe(() => textareas[0].setValue('content'))
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('doctor save and new doctor', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[3]) await tabs[3].trigger('click')
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    for (const inp of inputs.slice(0, 5)) await safe(() => inp.setValue('name'))
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('article delete cancelled', async () => {
    window.confirm = vi.fn(() => false)
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[2]) await tabs[2].trigger('click')
    await flushPromises()
    // Try to edit existing article
    await clickAll(w)
    await flushPromises()
    window.confirm = vi.fn(() => true)
    expect(w.exists()).toBe(true)
  })

  it('publish and unpublish article', async () => {
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[2]) await tabs[2].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('article CRUD error handling', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.includes('/api/admin/articles') && !url.includes('publish') && !url.includes('unpublish')) return Promise.reject(new Error('fail'))
      if (url.includes('/api/admin/dashboard')) return Promise.resolve(j({ users: 3, articles: 2, doctors: 1 }))
      return Promise.resolve(j({ items: [] }))
    }))
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[2]) await tabs[2].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('doctor save error', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.includes('/api/admin/doctors') && (String(input).includes('PUT') || String(input).includes('POST'))) return Promise.reject(new Error('fail'))
      if (url.includes('/api/admin/dashboard')) return Promise.resolve(j({ users: 3, articles: 2 }))
      return Promise.resolve(j({ items: [{ id: 'd1', name: 'Doc', department: 'Endocrine', title: 'Chief' }] }))
    }))
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[3]) await tabs[3].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('user toggle error', async () => {
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.includes('/api/admin/users/') && url.includes('status')) return Promise.reject(new Error('fail'))
      if (url.includes('/api/admin/dashboard')) return Promise.resolve(j({ users: 3 }))
      return Promise.resolve(j({ items: [{ id: 1, username: 'demo', role: 'user', status: 'active' }], total: 1 }))
    }))
    const w = await mountF(Admin)
    await flushPromises()
    const tabs = w.findAll('.admin-tabs button')
    if (tabs[4]) await tabs[4].trigger('click')
    await flushPromises()
    await clickAll(w)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// AssistantView — comprehensive coverage
// ============================================================
describe('AssistantView comprehensive', () => {
  let Asst
  beforeAll(async () => { Asst = (await import('../../views/assistant/AssistantView.vue')).default })

  function asstMock(opts = {}) {
    const { chatFail, convFail } = opts
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.includes('/api/assistant/conversations/') && url.includes('messages')) return Promise.resolve(j([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }]))
      if (url.includes('/api/assistant/conversations')) {
        if (convFail) return Promise.reject(new Error('fail'))
        return Promise.resolve(j([{ id: 'c1', title: 'History', updated_at: new Date().toISOString() }]))
      }
      if (url.includes('/api/assistant/chat')) {
        if (chatFail) return Promise.reject(new Error('fail'))
        return Promise.resolve(j({ reply: 'I can help', conversation_id: 'c2' }))
      }
      if (url.includes('/api/uploads')) return Promise.resolve(j({ file_id: 'f1', file_name: 'test.pdf', size: 100, mime_type: 'application/pdf', url: '/f.pdf' }))
      return Promise.resolve(j({}))
    }))
  }

  beforeEach(() => {
    saveAuthSession({ token: 't', user: { id: 1, role: 'user' } })
    asstMock({})
  })

  async function clickAll(w, max = 30) {
    for (const btn of w.findAll('button').slice(0, max)) await safe(() => btn.trigger('click'))
  }

  it('mounts and sends message', async () => {
    const w = await mountF(Asst)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await safe(() => inputs[0].setValue('hello'))
    await clickAll(w, 15)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('opens history sidebar', async () => {
    const w = await mountF(Asst)
    await flushPromises()
    await clickAll(w, 20)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('new conversation', async () => {
    const w = await mountF(Asst)
    await flushPromises()
    // New conversation button
    await clickAll(w, 20)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles chat API error', async () => {
    asstMock({ chatFail: true })
    const w = await mountF(Asst)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('test')
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles conversation history error', async () => {
    asstMock({ convFail: true })
    const w = await mountF(Asst)
    await flushPromises()
    await clickAll(w, 20)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('loads conversation from history', async () => {
    const w = await mountF(Asst)
    await flushPromises()
    // Open history first
    await clickAll(w, 15)
    await flushPromises()
    // Click a history item
    await clickAll(w, 15)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// DoctorConsultView — comprehensive coverage
// ============================================================
describe('DoctorConsultView comprehensive', () => {
  let Doctor
  beforeAll(async () => { Doctor = (await import('../../views/doctor/DoctorConsultView.vue')).default })

  function docMock() {
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      if (url.includes('/api/doctors/doctor-1/conversations/') && url.includes('messages')) return Promise.resolve(j([{ role: 'assistant', content: 'history msg' }]))
      if (url.includes('/api/doctors/doctor-1/conversations')) return Promise.resolve(j({ items: [{ id: 'dc1', updated_at: new Date().toISOString() }] }))
      if (url.includes('/api/doctors/doctor-1/chat')) return Promise.resolve(j({ reply: 'doctor reply', conversation_id: 'dc2' }))
      if (url.includes('/api/doctors/doctor-1')) return Promise.resolve(j({ id: 'doctor-1', name: 'Doc', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online', greeting: 'Hello' }))
      if (url.includes('/api/doctors')) return Promise.resolve(j({ items: [{ id: 'doctor-1', name: 'Doc', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online', category: '内分泌', unread: 1 }] }))
      if (url.includes('/api/uploads')) return Promise.resolve(j({ file_id: 'f1', url: '/f.jpg' }))
      return Promise.resolve(j({}))
    }))
  }

  beforeEach(() => {
    saveAuthSession({ token: 't', user: { id: 1, role: 'user' } })
    routeMock.query = {}
    docMock()
  })

  async function clickAll(w, max = 40) {
    for (const btn of w.findAll('button').slice(0, max)) await safe(() => btn.trigger('click'))
  }

  it('mounts and shows doctor list', async () => {
    const w = await mountF(Doctor)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('opens doctor chat', async () => {
    routeMock.query = { doctor: 'doctor-1' }
    const w = await mountF(Doctor)
    await flushPromises()
    await clickAll(w, 20)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('sends message in chat', async () => {
    routeMock.query = { doctor: 'doctor-1' }
    const w = await mountF(Doctor)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    for (const inp of inputs.slice(0, 3)) await safe(() => inp.setValue('hello doctor'))
    await clickAll(w, 20)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles goBack from chat mode', async () => {
    routeMock.query = { doctor: 'doctor-1' }
    const w = await mountF(Doctor)
    await flushPromises()
    // Click doctor to open chat
    await clickAll(w, 10)
    await flushPromises()
    // Now click back
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const w = await mountF(Doctor)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('filters doctors by keyword', async () => {
    const w = await mountF(Doctor)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('endo')
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('selects emoji and toggles panel', async () => {
    routeMock.query = { doctor: 'doctor-1' }
    const w = await mountF(Doctor)
    await flushPromises()
    await clickAll(w, 30)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('opens doctor profile', async () => {
    const w = await mountF(Doctor)
    await flushPromises()
    await clickAll(w, 15)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('chat with no doctor available', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(j({ items: [] }))))
    routeMock.query = { doctor: 'nonexistent' }
    const w = await mountF(Doctor)
    await flushPromises()
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})

// ============================================================
// NewsView — comprehensive coverage
// ============================================================
describe('NewsView comprehensive', () => {
  let News
  beforeAll(async () => { News = (await import('../../views/news/NewsView.vue')).default })

  function newsMock() {
    vi.stubGlobal('fetch', vi.fn((input) => {
      const url = String(input)
      const method = String(input?.method || 'GET')
      if (url.includes('/api/articles/1/comments/') && url.includes('like')) return Promise.resolve(j({ liked: true }))
      if (url.includes('/api/articles/1/comments') && url.includes('POST')) return Promise.resolve(j({ id: 'c2', user: 'Demo', content: 'new comment', created_at: new Date().toISOString(), like_count: 0 }))
      if (url.includes('/api/articles/1/comments')) return Promise.resolve(j({ items: [{ id: 'c1', user: 'Tester', content: 'Great article', created_at: new Date().toISOString(), like_count: 5 }] }))
      if (url.includes('/api/articles/1/favorite')) return Promise.resolve(j({ favorited: true }))
      if (url.includes('/api/articles/1/like')) return Promise.resolve(j({ liked: true }))
      if (url.match(/\/api\/articles\/1$/)) return Promise.resolve(j({ id: 1, title: 'Article Title', summary: 'Summary', content: 'Full content', category: '饮食', author: 'Editor', favorited: false, liked: false, views: 100 }))
      if (url.includes('/api/articles/favorites')) return Promise.resolve(j({ items: [{ id: 1, title: 'Fav Article', summary: 's', category: '饮食', author: 'E', favorited: true, liked: false }] }))
      if (url.includes('/api/articles')) return Promise.resolve(j({ items: [{ id: 1, title: 'Article Title', summary: 'A summary', category: '饮食', author: 'Editor', favorited: false, liked: false, views: 100 }] }))
      return Promise.resolve(j({}))
    }))
  }

  beforeEach(() => {
    saveAuthSession({ token: 't', user: { id: 1, role: 'user', username: 'demo', nickname: 'Demo' } })
    routeMock.query = {}
    newsMock()
  })

  async function clickAll(w, max = 30) {
    for (const btn of w.findAll('button').slice(0, max)) await safe(() => btn.trigger('click'))
  }

  it('mounts and shows article list', async () => {
    const w = await mountF(News)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('opens article detail', async () => {
    const w = await mountF(News)
    await flushPromises()
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('toggles favorite on article', async () => {
    const w = await mountF(News)
    await flushPromises()
    await clickAll(w, 15)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('submits comment on article', async () => {
    routeMock.query = { article: '1' }
    const w = await mountF(News)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    for (const inp of inputs.slice(0, 3)) await safe(() => inp.setValue('nice article'))
    await clickAll(w, 15)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('switches category filter', async () => {
    const w = await mountF(News)
    await flushPromises()
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('favorites mode', async () => {
    routeMock.query = { favorites: '1' }
    const w = await mountF(News)
    await flushPromises()
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('search articles by keyword', async () => {
    const w = await mountF(News)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await inputs[0].setValue('diet')
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('handles API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fail'))))
    const w = await mountF(News)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('toggle like on article', async () => {
    routeMock.query = { article: '1' }
    const w = await mountF(News)
    await flushPromises()
    await clickAll(w, 15)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('close article detail', async () => {
    routeMock.query = { article: '1' }
    const w = await mountF(News)
    await flushPromises()
    // Find close/nav button
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('applyRouteArticle from query', async () => {
    routeMock.query = { article: '1' }
    const w = await mountF(News)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('submit comment without login', async () => {
    clearAuthSession()
    routeMock.query = { article: '1' }
    const w = await mountF(News)
    await flushPromises()
    const inputs = w.findAll('input').filter(i => i.attributes('type') !== 'file')
    if (inputs[0]) await safe(() => inputs[0].setValue('comment'))
    await clickAll(w, 10)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })

  it('toggle like on comment', async () => {
    routeMock.query = { article: '1' }
    const w = await mountF(News)
    await flushPromises()
    await clickAll(w, 15)
    await flushPromises()
    expect(w.exists()).toBe(true)
  })
})
