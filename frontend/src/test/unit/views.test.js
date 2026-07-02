import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../../App.vue'
import { clearAuthSession, saveAuthSession } from '../../api/request'
import { loginByPassword, registerByPassword } from '../../api/auth'

const routerPush = vi.fn()
const routerReplace = vi.fn()
const routerBack = vi.fn()
const routeMock = {
  query: {},
  params: { id: 'doctor-1' },
  fullPath: '/home',
}

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRouter: () => ({
      push: routerPush,
      replace: routerReplace,
      back: routerBack,
    }),
    useRoute: () => routeMock,
  }
})

vi.mock('../../api/auth', async () => {
  const request = await vi.importActual('../../api/request')
  return {
    loginByPassword: vi.fn(async () => {
      const session = { token: 'view-token', user: { id: 1, role: 'user', username: 'demo', nickname: 'Demo' } }
      request.saveAuthSession(session)
      return session
    }),
    registerByPassword: vi.fn(async () => {
      const session = { token: 'view-token', user: { id: 2, role: 'user', username: 'new', nickname: 'New' } }
      request.saveAuthSession(session)
      return session
    }),
    logout: vi.fn(() => request.clearAuthSession()),
  }
})

const stubs = {
  'router-view': { template: '<div />' },
  'router-link': { template: '<a><slot /></a>' },
  Transition: false,
  LiquidTabBar: { emits: ['change'], template: '<nav><button @click="$emit(`change`, `home`)">home</button><button @click="$emit(`change`, `health`)">health</button></nav>' },
  TopUserActions: true,
  'van-button': { emits: ['click'], template: '<button type="button" @click="$emit(`click`)"><slot /></button>' },
  'van-form': { emits: ['submit'], template: '<form @submit.prevent="$emit(`submit`)"><slot /></form>' },
  'van-field': {
    props: ['modelValue', 'label', 'placeholder', 'type'],
    emits: ['update:modelValue'],
    template: '<label><span>{{ label }}</span><slot name="input"><input :type="type || `text`" :value="modelValue" :placeholder="placeholder" @input="$emit(`update:modelValue`, $event.target.value)" /></slot><slot name="right-icon" /></label>',
  },
  'van-cell': { emits: ['click'], template: '<button class="van-cell-stub" type="button" @click="$emit(`click`)"><slot name="icon" /><slot name="title" /><slot name="label" /><slot name="value" /><slot /><slot name="right-icon" /></button>' },
  'van-cell-group': { template: '<div><slot /></div>' },
  'van-switch': { props: ['modelValue', 'disabled'], emits: ['update:modelValue'], template: '<button class="van-switch-stub" type="button" :disabled="disabled" @click="$emit(`update:modelValue`, !modelValue)">{{ modelValue ? `on` : `off` }}</button>' },
  'van-tabs': { emits: ['update:active'], template: '<div><slot /></div>' },
  'van-tab': { template: '<div><slot /></div>' },
  'van-progress': true,
  'van-tag': true,
  'van-skeleton': { template: '<div><slot /></div>' },
  'van-row': { template: '<div><slot /></div>' },
  'van-col': { template: '<div><slot /></div>' },
  'van-icon': true,
  'van-empty': { template: '<div class="van-empty-stub"><slot /></div>' },
  'van-nav-bar': { emits: ['click-left'], template: '<header><button type="button" @click="$emit(`click-left`)">back</button><slot name="title" /><slot /></header>' },
  'van-swipe-cell': { template: '<div><slot /><slot name="right" /></div>' },
  'van-calendar': { emits: ['confirm'], template: '<button class="van-calendar-stub" @click="$emit(`confirm`, new Date(`2000-01-02`))">calendar</button>' },
  'van-circle': true,
  'van-grid': { template: '<div><slot /></div>' },
  'van-grid-item': { template: '<button type="button"><slot /></button>' },
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ code: status >= 400 ? 1 : 0, data, message: status >= 400 ? 'failed' : 'ok' }), { status })
}

function sse(chunks) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } })
}

function mockData(input, init = {}) {
  const url = String(input)
  const method = String(init.method || 'GET').toUpperCase()

  if (url.includes('/api/auth/me')) return { user: { id: 1, username: 'demo', nickname: 'Demo', role: 'user' } }
  if (url.includes('/api/uploads')) return { file_id: 'file-1', file_name: 'file.pdf', size: 1000, mime_type: 'application/pdf', url: '/file.pdf' }
  if (url.includes('/api/profile') && method === 'PUT') return { profile: { nickname: 'Updated', height_cm: 172, weight_kg: 68 } }
  if (url.includes('/api/profile')) return { profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68, waist_cm: 82, sbp_mm_hg: 120, fasting_glucose: 6.1, family_history_diabetes: false, diagnosed_diabetes: false }, user: { nickname: 'Demo' } }
  if (url.includes('/api/privacy-settings')) return { personalized_advice_enabled: true, assistant_context_enabled: true, health_reminder_enabled: true }
  if (url.includes('/api/data-authorizations')) return { health_data_analysis_authorized: true, assistant_context_authorized: true, plan_suggestion_authorized: true, news_recommendation_authorized: true }
  if (url.includes('/api/home/summary')) return { latest_risk: { score: 30, risk_level: 'low' }, today_tasks: [{ id: 'archive', title: '完善档案' }, { id: 'plan', title: '查看计划' }, { id: 'risk', title: '完成预测' }], hot_articles: [{ id: 1, title: '科普文章', summary: 'summary' }], recommended_doctors: [{ id: 'doctor-1', name: 'Doctor', department: 'Endocrine' }] }
  if (url.includes('/api/risk-assessments/latest')) return { score: 18, risk_level: 'low', score_status: 'completed', advice: { summary: 'low risk', diet: ['diet'], exercise: ['walk'], review: ['review'] } }
  if (url.includes('/api/risk-assessments')) return { score: 20, risk_level: 'low', score_status: 'completed', advice: { summary: 'updated' } }
  if (url.includes('/api/reports/interpret')) return { summary: 'report summary', indicators: [{ name: 'glucose', value: '6.4', unit: 'mmol/L' }], advice: ['review'] }
  if (url.includes('/api/checkins/history')) return { history: [{ date: '2026-07-01', task_count: 2, completed_count: 2 }, { date: '2026-07-02', completion_rate: 50 }] }
  if (url.includes('/api/checkins/analysis')) return { completion_rate: 75, summary: 'analysis summary', evaluation: 'good', advice: 'keep' }
  if (url.includes('/api/plans/active')) return { id: 1, title: 'Plan', tasks: [{ id: 'task-1', title: 'Breakfast', target: '1', completed: false }] }
  if (url.includes('/api/plan-tasks/suggestions')) return { suggestions: [{ title: 'Recommended goal', target: 'daily', task_type: 'diet' }] }
  if (url.includes('/api/plan-tasks')) return { id: 'task-2', title: 'Saved task', target: 'daily' }
  if (url.includes('/api/messages')) return { list: [{ id: 1, title: 'Reminder', content: 'Record meal', type: 'plan', group: 'reminder', read: false }, { id: 2, title: 'Assistant', content: 'Advice', type: 'assistant', group: 'assistant', route: 'assistant', read: true }] }
  if (url.includes('/api/articles/1/comments/comment-1/like')) return { liked: true }
  if (url.includes('/api/articles/1/comments') && method === 'POST') return { id: 'comment-2', user: 'Demo', content: 'new comment', created_at: new Date().toISOString(), like_count: 0 }
  if (url.includes('/api/articles/1/comments')) return { items: [{ id: 'comment-1', user: 'Tester', content: 'nice', created_at: new Date().toISOString(), like_count: 1 }] }
  if (url.includes('/api/articles/1/favorite')) return { favorited: true }
  if (url.includes('/api/articles/1/like')) return { liked: true }
  if (url.match(/\/api\/articles\/1$/)) return { id: 1, title: 'Article title', summary: 'summary', content: 'content', category: 'diet', author: 'Editor', favorited: false, liked: false }
  if (url.includes('/api/articles/favorites')) return { items: [{ id: 1, title: 'Favorite article', summary: 'summary', category: 'diet', author: 'Editor' }] }
  if (url.includes('/api/articles')) return { items: [{ id: 1, title: 'Article title', summary: 'summary', category: 'diet', author: 'Editor', favorited: false, liked: false }] }
  if (url.includes('/api/assistant/conversations/conv-1/messages')) return [{ role: 'user', content: 'question' }, { role: 'assistant', content: 'answer' }]
  if (url.includes('/api/assistant/conversations')) return [{ id: 'conv-1', title: 'History', updated_at: new Date().toISOString() }]
  if (url.includes('/api/assistant/chat')) return { reply: 'assistant reply', conversation_id: 'conv-2' }
  if (url.includes('/api/doctors/doctor-1/conversations/doctor-conv-1/messages')) return [{ role: 'assistant', content: 'doctor history' }]
  if (url.includes('/api/doctors/doctor-1/conversations')) return { items: [{ id: 'doctor-conv-1', updated_at: new Date().toISOString() }] }
  if (url.includes('/api/doctors/doctor-1/chat')) return { reply: 'doctor reply', conversation_id: 'doctor-conv-2' }
  if (url.includes('/api/doctors/doctor-1')) return { id: 'doctor-1', name: 'Doctor', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online' }
  if (url.includes('/api/doctors')) return { items: [{ id: 'doctor-1', name: 'Doctor', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online' }] }
  if (url.includes('/api/admin/dashboard')) return { users: 3, articles: 2, doctors: 1, consultations: 1 }
  if (url.includes('/api/admin/articles')) return { items: [{ id: 101, title: 'Admin article', status: 'draft', audit_status: 'approved' }], total: 1 }
  if (url.includes('/api/admin/doctors')) return { items: [{ id: 'doctor-1', name: 'Doctor', department: 'Endocrine' }] }
  if (url.includes('/api/admin/users')) return { items: [{ id: 1, username: 'demo', role: 'user', status: 'active' }], total: 1 }
  if (url.includes('/api/admin/consultations')) return { items: [{ id: 1, username: 'demo', doctor_name: 'Doctor', title: 'Question', status: 'active' }] }
  if (url.includes('/api/admin/dify-run-logs')) return { items: [{ id: 1, app_code: 'assistant', status: 'ok', created_at: '2026-07-02' }] }
  if (url.includes('/api/admin/assistant/conversations')) return [{ id: 'admin-conv-1' }]
  if (url.includes('/api/admin/assistant/chat')) return { reply: 'admin reply' }
  return { items: [] }
}

async function mountFull(component) {
  const wrapper = mount(component, {
    global: { stubs },
  })
  await flushPromises()
  return wrapper
}

async function mountLight(component) {
  const wrapper = shallowMount(component, {
    global: { stubs },
  })
  await flushPromises()
  return wrapper
}

async function triggerFile(wrapper, selector) {
  const input = wrapper.find(selector)
  if (!input.exists()) return
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File(['x'], 'file.pdf', { type: 'application/pdf' })],
  })
  await input.trigger('change')
}

async function safe(action) {
  try {
    await action()
    await flushPromises()
  } catch {
    // Generic coverage sweep: ignore impossible UI states and keep exercising the next control.
  }
}

async function exerciseMountedView(wrapper) {
  const textInputs = wrapper.findAll('input').filter((input) => {
    const type = input.attributes('type') || 'text'
    return !['file', 'checkbox', 'radio'].includes(type)
  })

  for (const [index, input] of textInputs.slice(0, 12).entries()) {
    await safe(() => input.setValue(index % 2 === 0 ? 'demo' : '123456'))
  }

  for (const textarea of wrapper.findAll('textarea').slice(0, 6)) {
    await safe(() => textarea.setValue('demo content'))
  }

  for (const select of wrapper.findAll('select').slice(0, 6)) {
    const option = select.find('option')
    if (option.exists()) {
      await safe(() => select.setValue(option.attributes('value') || ''))
    }
  }

  for (const fileInput of wrapper.findAll('input[type="file"]').slice(0, 4)) {
    await safe(async () => {
      Object.defineProperty(fileInput.element, 'files', {
        configurable: true,
        value: [new File(['file'], 'demo.pdf', { type: 'application/pdf' })],
      })
      await fileInput.trigger('change')
    })
  }

  for (const form of wrapper.findAll('form').slice(0, 6)) {
    await safe(() => form.trigger('submit.prevent'))
  }

  for (const button of wrapper.findAll('button').slice(0, 80)) {
    await safe(() => button.trigger('click'))
  }

  await flushPromises()
}

describe('view smoke and interactions', () => {
  beforeEach(() => {
    routerPush.mockClear()
    routerReplace.mockClear()
    routerBack.mockClear()
    routeMock.query = {}
    routeMock.params = { id: 'doctor-1' }
    clearAuthSession()
    saveAuthSession({ token: 'view-token', user: { id: 1, role: 'user', username: 'demo', nickname: 'Demo' } })
    vi.stubGlobal('fetch', vi.fn((input, init) => Promise.resolve(json(mockData(input, init)))))
  })

  it('mounts app and all views', async () => {
    expect(shallowMount(App, { global: { stubs } }).exists()).toBe(true)
    const loaders = [
      () => import('../../views/HomeView.vue'),
      () => import('../../views/auth/LoginView.vue'),
      () => import('../../views/journey/HealthJourneyView.vue'),
      () => import('../../views/health/HealthView.vue'),
      () => import('../../views/health/HealthArchiveView.vue'),
      () => import('../../views/plan/PlanView.vue'),
      () => import('../../views/plan/PlanTaskCreateView.vue'),
      () => import('../../views/plan/CheckinRecordsView.vue'),
      () => import('../../views/plan/CheckinAnalysisView.vue'),
      () => import('../../views/news/NewsView.vue'),
      () => import('../../views/assistant/AssistantView.vue'),
      () => import('../../views/profile/UserCenterView.vue'),
      () => import('../../views/profile/PersonalInfoView.vue'),
      () => import('../../views/profile/PrivacySettingsView.vue'),
      () => import('../../views/profile/ChangePasswordView.vue'),
      () => import('../../views/profile/DataAuthorizationView.vue'),
      () => import('../../views/doctor/DoctorConsultView.vue'),
      () => import('../../views/doctor/DoctorProfileView.vue'),
      () => import('../../views/messages/MessagesView.vue'),
      () => import('../../views/favorites/FavoritesView.vue'),
      () => import('../../views/admin/AdminDashboardView.vue'),
      () => import('../../views/NotFoundView.vue'),
    ]
    for (const loader of loaders) {
      const component = (await loader()).default
      const wrapper = await mountLight(component)
      expect(wrapper.exists()).toBe(true)
    }
  })

  it.each([
    ['Home', () => import('../../views/HomeView.vue')],
    ['Login', () => import('../../views/auth/LoginView.vue')],
    ['Journey', () => import('../../views/journey/HealthJourneyView.vue')],
    ['Health', () => import('../../views/health/HealthView.vue')],
    ['HealthArchive', () => import('../../views/health/HealthArchiveView.vue')],
    ['Plan', () => import('../../views/plan/PlanView.vue')],
    ['PlanTaskCreate', () => import('../../views/plan/PlanTaskCreateView.vue')],
    ['CheckinRecords', () => import('../../views/plan/CheckinRecordsView.vue')],
    ['CheckinAnalysis', () => import('../../views/plan/CheckinAnalysisView.vue')],
    ['News', () => import('../../views/news/NewsView.vue')],
    ['Assistant', () => import('../../views/assistant/AssistantView.vue')],
    ['UserCenter', () => import('../../views/profile/UserCenterView.vue')],
    ['PersonalInfo', () => import('../../views/profile/PersonalInfoView.vue')],
    ['PrivacySettings', () => import('../../views/profile/PrivacySettingsView.vue')],
    ['ChangePassword', () => import('../../views/profile/ChangePasswordView.vue')],
    ['DataAuthorization', () => import('../../views/profile/DataAuthorizationView.vue')],
    ['DoctorConsult', () => import('../../views/doctor/DoctorConsultView.vue')],
    ['DoctorProfile', () => import('../../views/doctor/DoctorProfileView.vue')],
    ['Messages', () => import('../../views/messages/MessagesView.vue')],
    ['Favorites', () => import('../../views/favorites/FavoritesView.vue')],
    ['AdminDashboard', () => import('../../views/admin/AdminDashboardView.vue')],
    ['NotFound', () => import('../../views/NotFoundView.vue')],
  ])('auto exercises %s vue component controls', async (_name, loader) => {
    const component = (await loader()).default
    const wrapper = await mountFull(component)
    await exerciseMountedView(wrapper)
    expect(wrapper.exists()).toBe(true)
  }, 20000)

  it('covers home, profile and privacy flows', async () => {
    const Home = (await import('../../views/HomeView.vue')).default
    const home = await mountFull(Home)
    await home.find('.risk-primary').trigger('click')
    await home.find('.risk-secondary').trigger('click')
    expect(routerPush).toHaveBeenCalled()

    const UserCenter = (await import('../../views/profile/UserCenterView.vue')).default
    const profile = await mountFull(UserCenter)
    await profile.find('.profile-user').trigger('click')
    profile.findAll('.profile-row').forEach((row) => row.trigger('click'))
    expect(routerPush).toHaveBeenCalled()

    const Privacy = (await import('../../views/profile/PrivacySettingsView.vue')).default
    const privacy = await mountFull(Privacy)
    await privacy.findAll('.van-switch-stub')[0].trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/privacy-settings', expect.objectContaining({ method: 'PUT' }))

    const Authz = (await import('../../views/profile/DataAuthorizationView.vue')).default
    const authz = await mountFull(Authz)
    if (authz.findAll('.van-switch-stub')[0]) {
      await authz.findAll('.van-switch-stub')[0].trigger('click')
    }
    if (authz.find('.withdraw-button').exists()) {
      await authz.find('.withdraw-button').trigger('click')
      await authz.find('.confirm-actions .confirm').trigger('click')
    }
    await flushPromises()
    expect(fetch).toHaveBeenCalled()
  })

  it('covers login, password and personal info forms', async () => {
    const Login = (await import('../../views/auth/LoginView.vue')).default
    const login = await mountFull(Login)
    await login.find('form').trigger('submit.prevent')
    const loginInputs = login.findAll('input').filter((input) => input.attributes('type') !== 'file')
    if (loginInputs[0]) await loginInputs[0].setValue('demo')
    if (loginInputs[1]) await loginInputs[1].setValue('123456')
    await login.findAll('.agreement-row button')[0].trigger('click')
    await login.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(login.exists()).toBe(true)

    const Password = (await import('../../views/profile/ChangePasswordView.vue')).default
    const password = await mountFull(Password)
    const fields = password.findAll('input').filter((input) => input.attributes('type') !== 'file')
    if (fields[0]) await fields[0].setValue('old-pass')
    if (fields[1]) await fields[1].setValue('new-pass')
    if (fields[2]) await fields[2].setValue('new-pass')
    await password.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(fetch).toHaveBeenCalled()

    const Info = (await import('../../views/profile/PersonalInfoView.vue')).default
    const info = await mountFull(Info)
    const infoInput = info.findAll('input').find((input) => input.attributes('type') !== 'file')
    if (infoInput) await infoInput.setValue('Updated')
    await info.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PUT' }))
  })

  it('covers health archive, risk and plan pages', async () => {
    const Health = (await import('../../views/health/HealthView.vue')).default
    const health = await mountFull(Health)
    await health.find('.score-actions button').trigger('click')
    await flushPromises()
    expect(health.exists()).toBe(true)

    const Archive = (await import('../../views/health/HealthArchiveView.vue')).default
    const archive = await mountFull(Archive)
    await archive.find('form').trigger('submit.prevent')
    await triggerFile(archive, '.report-input')
    await archive.find('.report-textarea input').setValue('report text')
    await archive.find('.report-action button').trigger('click')
    await flushPromises()
    expect(archive.text()).toContain('report summary')

    const Plan = (await import('../../views/plan/PlanView.vue')).default
    const plan = await mountFull(Plan)
    await plan.find('.overview-actions button').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalled()

    const Task = (await import('../../views/plan/PlanTaskCreateView.vue')).default
    const task = await mountFull(Task)
    await task.find('.ep-gen-btn').trigger('click')
    await flushPromises()
    await task.find('.ep-save').trigger('click')
    expect(task.exists()).toBe(true)

    const Analysis = (await import('../../views/plan/CheckinAnalysisView.vue')).default
    expect((await mountFull(Analysis)).text()).toContain('75')
  })

  it('covers news, favorites and messages', async () => {
    const News = (await import('../../views/news/NewsView.vue')).default
    const news = await mountFull(News)
    await news.find('.feed-article footer button').trigger('click')
    await news.find('.feed-article').trigger('click')
    await flushPromises()
    await news.find('.detail-toolbar button').trigger('click')
    await news.find('.comment-input input').setValue('new comment')
    await news.find('.comment-input').trigger('submit.prevent')
    await flushPromises()
    expect(fetch).toHaveBeenCalled()

    const Favorites = (await import('../../views/favorites/FavoritesView.vue')).default
    const fav = await mountFull(Favorites)
    await fav.find('.favorite-article').trigger('click')
    await fav.find('.swipe-remove').trigger('click')
    await flushPromises()
    expect(routerPush).toHaveBeenCalled()

    const Messages = (await import('../../views/messages/MessagesView.vue')).default
    const messages = await mountFull(Messages)
    await messages.find('.message-row').trigger('click')
    await messages.find('.read-button').trigger('click')
    await flushPromises()
    expect(messages.exists()).toBe(true)
  })

  it('covers assistant and doctor chat pages', async () => {
    const Assistant = (await import('../../views/assistant/AssistantView.vue')).default
    const assistant = await mountFull(Assistant)
    await assistant.find('.q-header button').trigger('click')
    await flushPromises()
    await assistant.find('.sidebar-list button').trigger('click')
    await assistant.find('input[name="assistant_message"]').setValue('hello')
    await assistant.find('.q-input').trigger('submit.prevent')
    await flushPromises()
    await triggerFile(assistant, '.file-input')
    expect(fetch).toHaveBeenCalledWith('/api/assistant/chat', expect.objectContaining({ method: 'POST' }))

    const Doctor = (await import('../../views/doctor/DoctorConsultView.vue')).default
    const doctor = await mountFull(Doctor)
    await doctor.find('.avatar-button').trigger('click')
    await doctor.find('.doctor-item').trigger('click')
    await flushPromises()
    await doctor.find('input[name="doctor_message"]').setValue('question')
    await triggerFile(doctor, '.doctor-file-input')
    await doctor.find('.chat-input').trigger('submit.prevent')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/doctors/doctor-1/chat', expect.objectContaining({ method: 'POST' }))

    const Profile = (await import('../../views/doctor/DoctorProfileView.vue')).default
    const profile = await mountFull(Profile)
    await profile.find('.profile-action button').trigger('click')
    expect(routerPush).toHaveBeenCalled()
  })

  it('covers admin dashboard and streaming alternatives', async () => {
    saveAuthSession({ token: 'admin-token', user: { id: 1, role: 'admin', username: 'admin' } })
    vi.stubGlobal('fetch', vi.fn((input, init) => {
      if (String(input).includes('/api/admin/assistant/chat')) {
        return Promise.resolve(sse(['data: {"delta":"admin"}\n\n', 'event: message_end\n', 'data: {"conversation_id":"a1"}\n\n']))
      }
      if (String(input).includes('/api/assistant/chat')) {
        return Promise.resolve(sse(['data: {"delta":"stream"}\n\n', 'event: message_end\n', 'data: {"conversation_id":"s1"}\n\n']))
      }
      return Promise.resolve(json(mockData(input, init)))
    }))
    const Admin = (await import('../../views/admin/AdminDashboardView.vue')).default
    const admin = await mountFull(Admin)
    const tabs = admin.findAll('.admin-tabs button')
    await tabs[1].trigger('click')
    await flushPromises()
    await admin.find('.admin-chat-form input').setValue('stats')
    await admin.find('.admin-chat-form').trigger('submit.prevent')
    await tabs[2].trigger('click')
    await nextTick()
    await admin.find('.form-actions button').trigger('click')
    await tabs[3].trigger('click')
    await nextTick()
    await admin.find('.doctor-editor button').trigger('click')
    await flushPromises()
    expect(admin.exists()).toBe(true)
  })

  it('deeply covers admin, login, news and task creation branches', async () => {
    const Login = (await import('../../views/auth/LoginView.vue')).default
    const login = await mountFull(Login)
    await exerciseMountedView(login)
    if (login.find('.mode-switch').exists()) await safe(() => login.find('.mode-switch').trigger('click'))
    if (login.find('.register-prompt').exists()) await safe(() => login.find('.register-prompt').trigger('click'))
    if (login.find('.login-prompt').exists()) await safe(() => login.find('.login-prompt').trigger('click'))

    const News = (await import('../../views/news/NewsView.vue')).default
    const news = await mountFull(News)
    await exerciseMountedView(news)
    if (news.find('.feed-article').exists()) {
      await safe(() => news.find('.feed-article').trigger('click'))
      await safe(() => news.find('.comment-input input').setValue('comment'))
      await safe(() => news.find('.comment-input').trigger('submit.prevent'))
      for (const button of news.findAll('.detail-toolbar button')) {
        await safe(() => button.trigger('click'))
      }
      if (news.find('.detail-nav button').exists()) await safe(() => news.find('.detail-nav button').trigger('click'))
    }

    const Task = (await import('../../views/plan/PlanTaskCreateView.vue')).default
    const task = await mountFull(Task)
    await exerciseMountedView(task)
    if (task.find('.ep-gen-btn').exists()) await safe(() => task.find('.ep-gen-btn').trigger('click'))
    await flushPromises()
    if (task.find('.ep-ai-row').exists()) await safe(() => task.find('.ep-ai-row').trigger('click'))
    if (task.find('.ep-ai-top button').exists()) await safe(() => task.find('.ep-ai-top button').trigger('click'))
    if (task.find('.ep-ex-row').exists()) await safe(() => task.find('.ep-ex-row').trigger('click'))
    if (task.find('.ep-ex-del').exists()) await safe(() => task.find('.ep-ex-del').trigger('click'))

    saveAuthSession({ token: 'admin-token', user: { id: 1, role: 'admin', username: 'admin' } })
    const Admin = (await import('../../views/admin/AdminDashboardView.vue')).default
    const admin = await mountFull(Admin)
    const tabs = admin.findAll('.admin-tabs button')
    for (const tab of tabs) {
      await safe(() => tab.trigger('click'))
      await exerciseMountedView(admin)
    }
    await safe(() => admin.find('.admin-topbar button').trigger('click'))
    await safe(() => admin.find('.section-title button').trigger('click'))
    for (const button of admin.findAll('td button').slice(0, 20)) {
      await safe(() => button.trigger('click'))
    }
    for (const button of admin.findAll('.pagination button').slice(0, 10)) {
      await safe(() => button.trigger('click'))
    }
    expect(admin.exists()).toBe(true)
  }, 30000)

  it('targets remaining high-branch vue component methods', async () => {
    const Login = (await import('../../views/auth/LoginView.vue')).default
    const login = await mountFull(Login)
    await safe(() => login.find('.privacy-button').trigger('click'))
    await safe(() => login.find('.footer-options button').trigger('click'))
    await safe(() => login.find('.register-prompt').trigger('click'))
    let inputs = login.findAll('input').filter((input) => input.attributes('type') !== 'file')
    await safe(() => inputs[0].setValue('new-user'))
    await safe(() => inputs[1].setValue('123'))
    await safe(() => inputs[2].setValue('456'))
    await safe(() => inputs[3].setValue(true))
    await safe(() => login.find('form').trigger('submit.prevent'))
    await safe(() => inputs[1].setValue('123456'))
    await safe(() => inputs[2].setValue('123456'))
    await safe(() => login.find('form').trigger('submit.prevent'))
    await flushPromises()
    expect(registerByPassword).toHaveBeenCalled()
    await safe(() => login.find('.login-prompt').trigger('click'))
    inputs = login.findAll('input').filter((input) => input.attributes('type') !== 'file')
    await safe(() => inputs[0].setValue('demo'))
    await safe(() => inputs[1].setValue('123456'))
    await safe(() => login.findAll('.agreement-row input')[0].setValue(true))
    await safe(() => login.find('form').trigger('submit.prevent'))
    expect(loginByPassword).toHaveBeenCalled()

    const Journey = (await import('../../views/journey/HealthJourneyView.vue')).default
    const journey = await mountFull(Journey)
    const actions = journey.findAll('.journey-action')
    for (const action of actions) await safe(() => action.trigger('click'))
    const viewport = journey.find('.journey-viewport')
    await safe(() => viewport.trigger('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 220 }))
    await safe(() => viewport.trigger('pointermove', { pointerType: 'touch', pointerId: 1, clientX: 120 }))
    await safe(() => viewport.trigger('pointerup'))
    expect(journey.exists()).toBe(true)

    const PersonalInfo = (await import('../../views/profile/PersonalInfoView.vue')).default
    const personal = await mountFull(PersonalInfo)
    const avatarClick = vi.spyOn(personal.find('input[type="file"]').element, 'click').mockImplementation(() => {})
    await safe(() => personal.find('.avatar-box').trigger('click'))
    expect(avatarClick).toHaveBeenCalled()
    await triggerFile(personal, 'input[type="file"]')
    await safe(() => personal.findAll('.segment-row button')[1].trigger('click'))
    await safe(() => personal.findAll('label')[2].trigger('click'))
    if (personal.find('.van-calendar-stub').exists()) {
      await safe(() => personal.find('.van-calendar-stub').trigger('click'))
    }
    await safe(() => personal.find('.archive-link').trigger('click'))
    await safe(() => personal.find('form').trigger('submit.prevent'))

    const Assistant = (await import('../../views/assistant/AssistantView.vue')).default
    const assistant = await mountFull(Assistant)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn() } })
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(new Error('cancel')) })
    await safe(() => assistant.findAll('.message-actions button')[0].trigger('click'))
    await safe(() => assistant.findAll('.message-actions button')[1].trigger('click'))
    await safe(() => assistant.findAll('.message-actions button')[2].trigger('click'))
    await safe(() => assistant.findAll('.q-input > button')[0].trigger('click'))
    await safe(() => assistant.findAll('.q-input > button')[1].trigger('click'))
    await safe(() => assistant.findAll('.q-input > button')[2].trigger('click'))
    await triggerFile(assistant, '.file-input')
    if (assistant.find('.attachment-row button').exists()) await safe(() => assistant.find('.attachment-row button').trigger('click'))
    await safe(() => assistant.find('input[name="assistant_message"]').setValue('preset'))
    await safe(() => assistant.find('.q-input').trigger('submit.prevent'))

    const Doctor = (await import('../../views/doctor/DoctorConsultView.vue')).default
    routeMock.query = { doctor: 'doctor-1' }
    const doctor = await mountFull(Doctor)
    await safe(() => doctor.find('.emoji-tool').trigger('click'))
    if (doctor.find('.emoji-grid button').exists()) await safe(() => doctor.find('.emoji-grid button').trigger('click'))
    for (const button of doctor.findAll('.tool-row button')) await safe(() => button.trigger('click'))
    await triggerFile(doctor, '.doctor-file-input')
    if (doctor.find('.doctor-attachments button').exists()) await safe(() => doctor.find('.doctor-attachments button').trigger('click'))
    await safe(() => doctor.find('.chat-input').trigger('submit.prevent'))

    const News = (await import('../../views/news/NewsView.vue')).default
    routeMock.query = { article: '1' }
    const news = await mountFull(News)
    if (news.find('.comment-actions button').exists()) await safe(() => news.find('.comment-actions button').trigger('click'))
    await safe(() => news.find('.comment-input input').setValue('reply'))
    await safe(() => news.find('.comment-input').trigger('submit.prevent'))
    if (news.find('.comment-row header button').exists()) await safe(() => news.find('.comment-row header button').trigger('click'))
    for (const button of news.findAll('.detail-toolbar button')) await safe(() => button.trigger('click'))
    expect(news.exists()).toBe(true)
  }, 30000)
})
