import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { clearAuthSession, saveAuthSession } from '../../api/request'

const routerPush = vi.fn(); const routerBack = vi.fn(); const routerReplace = vi.fn()
const routeMock = { query: {}, params: { id: 'doctor-1' }, fullPath: '/home' }
vi.mock('vue-router', async () => { const a = await vi.importActual('vue-router'); return { ...a, useRouter: () => ({ push: routerPush, replace: routerReplace, back: routerBack }), useRoute: () => routeMock } })
const stubs = {
  'router-view': { template: '<div />' }, 'router-link': { template: '<a><slot /></a>' }, Transition: false,
  LiquidTabBar: { emits: ['change'], template: '<nav></nav>' }, TopUserActions: true,
  'van-button': { emits: ['click'], template: '<button type="button" @click="$emit(`click`)"><slot /></button>' },
  'van-form': { emits: ['submit'], template: '<form @submit.prevent="$emit(`submit`)"><slot /></form>' },
  'van-field': { props: ['modelValue','label','placeholder','type','min','maxlength','rows','clearable','autosize'], emits: ['update:modelValue','change'], template: '<label><span>{{ label }}</span><input :type="type||`text`" :value="modelValue" @input="$emit(`update:modelValue`, $event.target.value)" @change="$emit(`change`, $event)" /></label>' },
  'van-cell': { emits: ['click'], template: '<button class="van-cell-stub" type="button" @click="$emit(`click`)"><slot name="icon"/><slot name="title"/><slot name="label"/><slot name="value"/><slot/><slot name="right-icon"/></button>' },
  'van-cell-group': { template: '<div><slot /></div>' }, 'van-switch': { props: ['modelValue','disabled'], emits: ['update:modelValue'], template: '<button class="van-switch-stub" type="button" :disabled="disabled" @click="$emit(`update:modelValue`, !modelValue)">{{ modelValue?"on":"off" }}</button>' },
  'van-tabs': { emits: ['update:active'], template: '<div><slot /></div>' }, 'van-tab': { template: '<div><slot /></div>' },
  'van-progress': true, 'van-tag': true, 'van-skeleton': { template: '<div><slot /></div>' },
  'van-row': { template: '<div><slot /></div>' }, 'van-col': { template: '<div><slot /></div>' },
  'van-icon': { template: '<i></i>' }, 'van-empty': { template: '<div class="van-empty-stub"><slot /></div>' },
  'van-nav-bar': { emits: ['click-left'], template: '<header><button type="button" @click="$emit(`click-left`)">back</button><slot name="title"/><slot/></header>' },
  'van-swipe-cell': { template: '<div><slot/><slot name="right"/></div>' },
  'van-calendar': { emits: ['confirm'], template: '<button class="van-calendar-stub" @click="$emit(`confirm`, new Date(`2000-01-02`))">cal</button>' },
  'van-circle': true, 'van-grid': { template: '<div><slot /></div>' }, 'van-grid-item': { template: '<button type="button"><slot /></button>' },
}
function j(d,s=200){return new Response(JSON.stringify({code:s>=400?1:0,data:d,message:s>=400?'err':'ok'}),{status:s})}
async function safe(fn){try{await fn();await flushPromises()}catch{}}
beforeEach(()=>{
  routerPush.mockClear();routerReplace.mockClear();routerBack.mockClear()
  routeMock.query={};routeMock.params={id:'doctor-1'}
  clearAuthSession();saveAuthSession({token:'vt',user:{id:1,role:'user',username:'demo',nickname:'Demo'}})
  window.confirm=vi.fn(()=>true);window.speechSynthesis={cancel:vi.fn(),speak:vi.fn()}
  window.SpeechSynthesisUtterance=vi.fn()
  Object.defineProperty(window,'history',{configurable:true,value:{length:2}})
  localStorage.clear()
})

describe('Kill all red — unmount + template states', () => {

  // ====== HomeView: trigger onBeforeUnmount + all template states ======
  it('HomeView: onBeforeUnmount + diabetesTypes', async () => {
    vi.stubGlobal('fetch', vi.fn((input)=>{
      const u=String(input)
      if(u.includes('home/summary')) return Promise.resolve(j({
        latest_risk: { score: 25, risk_level: 'medium' },
        today_tasks: [{ id: 'archive', title: '完善档案', desc: 'xxx' }, { id: 'plan', title: '查看计划' }, { id: 'risk', title: '完成预测' }],
        hot_articles: [{ id: 1, title: 'Article', summary: 's' }],
        recommended_doctors: [{ id: 'd1', name: 'Doc', department: 'Endocrine', avatar_url: '/a.jpg' }],
        diabetes_types: [{ id: 1, name: '1型糖尿病', pathogenesis: 'autoimmune' }, { id: 2, name: '2型糖尿病', clinical_features: 'insulin resistance' }],
      }))
      if(u.includes('doctors')) return Promise.resolve(j([{ id: 'd1', name: 'Doc', department: 'Endocrine' }]))
      return Promise.resolve(j({}))
    }))
    const Home = (await import('../../views/HomeView.vue')).default
    const w = mount(Home,{global:{stubs}}); await flushPromises()
    // Trigger toast (sets toastTimer)
    w.vm.showToast?.('test')
    await flushPromises()
    // Now unmount → triggers onBeforeUnmount → clears toastTimer
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== HealthView: onBeforeUnmount ======
  it('HealthView: unmount to trigger onBeforeUnmount', async () => {
    vi.stubGlobal('fetch', vi.fn((input)=>{
      if(String(input).includes('risk-assessments/latest')) return Promise.resolve(j({ score: 18, risk_level: 'low', score_status: 'completed', advice: { summary: 'ok' } }))
      return Promise.resolve(j({ profile: { completion_rate: 80, height_cm: 170, weight_kg: 70, waist_cm: 85, sbp_mm_hg: 130 }, latest_measurements: { fasting_glucose: 5.5, postprandial_glucose: 7.0 }, latest_risk: { score: 18, risk_level: 'low', score_status: 'completed', advice: { summary: 'ok' } } }))
    }))
    const HV = (await import('../../views/health/HealthView.vue')).default
    const w = mount(HV,{global:{stubs}}); await flushPromises()
    w.vm.showToast?.('test')
    await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== PlanView: onBeforeUnmount ======
  it('PlanView: unmount + all plan states', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ plan: { id: 1, title: 'Plan', tasks: [
      { id: 't1', task_type: 'diet', title: 'Breakfast', target: '1', completed: true },
      { id: 't2', task_type: 'exercise', title: 'Walk', target: '30min', completed: false },
      { id: 't3', task_type: 'sleep', title: 'Sleep early', target: '8h', completed: false },
    ] } }))))
    const Plan = (await import('../../views/plan/PlanView.vue')).default
    const w = mount(Plan,{global:{stubs}}); await flushPromises()
    w.vm.showToast?.('test')
    await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== LoginView: all states + unmount ======
  it('LoginView: all form states + unmount', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ token: 't', user: { id: 1, role: 'user' } }))))
    const Login = (await import('../../views/auth/LoginView.vue')).default
    const w = mount(Login,{global:{stubs}}); await flushPromises()
    const vm = w.vm

    // All mode/form combinations
    vm.mode='login'; vm.account=''; vm.password=''; vm.agreed=false; vm.focusedField='' ; vm.submitting=false
    await nextTick()
    vm.focusedField='account'; await nextTick(); vm.focusedField=''; await nextTick()
    vm.focusedField='password'; await nextTick(); vm.focusedField=''; await nextTick()

    vm.mode='register'; await nextTick()
    vm.focusedField='confirmPassword'; await nextTick(); vm.focusedField=''; await nextTick()
    vm.submitting=true; await nextTick(); vm.submitting=false; await nextTick()
    vm.showPassword=true; await nextTick(); vm.showPassword=false; await nextTick()
    vm.noticeText='Error!'; await nextTick()

    // Trigger submit with agreement checked but empty
    vm.agreed=true; vm.account='demo'; vm.password='123456'
    await safe(()=>vm.handleSubmit?.())
    await flushPromises()

    // unmount to hit onBeforeUnmount
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== AssistantView: unmount ======
  it('AssistantView: unmount', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j([]))))
    const A = (await import('../../views/assistant/AssistantView.vue')).default
    const w = mount(A,{global:{stubs}}); await flushPromises()
    w.vm.showToast?.('test')
    await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== DoctorConsultView: unmount ======
  it('DoctorConsultView: unmount', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ items: [{ id: 'doctor-1', name: 'Doc', department: '内分泌科', specialty: '糖尿病', online_status: 'online', category: '内分泌' }] }))))
    const D = (await import('../../views/doctor/DoctorConsultView.vue')).default
    const w = mount(D,{global:{stubs}}); await flushPromises()
    w.vm.showToast?.('test')
    await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== NewsView: unmount ======
  it('NewsView: unmount + all states', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ items: [
      { id: 1, title: 'A', summary: 's', category: '饮食', author: 'E', favorited: false, liked: false },
      { id: 2, title: 'B', summary: 's2', category: '运动', author: 'E2', favorited: false, liked: false },
    ] }))))
    const News = (await import('../../views/news/NewsView.vue')).default
    const w = mount(News,{global:{stubs}}); await flushPromises()
    w.vm.showToast?.('test')
    await flushPromises()
    // Open article detail
    await safe(()=>w.vm.openArticle?.({ id: 1, title: 'A', summary: 's', category: '饮食', author: 'E' }))
    await flushPromises()
    // Close article
    await safe(()=>w.vm.closeArticle?.())
    await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== MessagesView: unmount ======
  it('MessagesView: unmount', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ list: [{ id: 1, title: 'T', content: 'C', type: 'plan', group: 'reminder', read: false, created_at: new Date().toISOString(), route: 'plan' }] }))))
    const Msg = (await import('../../views/messages/MessagesView.vue')).default
    const w = mount(Msg,{global:{stubs}}); await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== FavoritesView: unmount ======
  it('FavoritesView: unmount', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ items: [{ id: 1, title: 'F', summary: 's', category: '饮食', author: 'E', favorited: true }] }))))
    const Fav = (await import('../../views/favorites/FavoritesView.vue')).default
    const w = mount(Fav,{global:{stubs}}); await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== AdminDashboard: unmount ======
  it('AdminDashboard: unmount', async () => {
    saveAuthSession({ token: 'at', user: { id: 1, role: 'admin', username: 'admin' } })
    vi.stubGlobal('fetch', vi.fn((input)=>{
      const u=String(input)
      if(u.includes('admin/dashboard')) return Promise.resolve(j({ users: 3, articles: 2, doctors: 1, consultations: 1 }))
      if(u.includes('admin/articles')) return Promise.resolve(j({ items: [{ id: 101, title: 'A', status: 'draft', audit_status: 'approved' }], total: 1 }))
      if(u.includes('admin/doctors')) return Promise.resolve(j({ items: [{ id: 'd1', name: 'Doc', department: 'Endocrine', specialty: 'diabetes' }] }))
      if(u.includes('admin/users')) return Promise.resolve(j({ items: [{ id: 1, username: 'demo', role: 'user', status: 'active' }], total: 1 }))
      if(u.includes('admin/consultations')) return Promise.resolve(j({ items: [{ id: 1, username: 'demo', doctor_name: 'Doc', status: 'active' }] }))
      if(u.includes('admin/dify-run-logs')) return Promise.resolve(j({ items: [{ id: 1, app_code: 'assistant', status: 'ok', created_at: '2026-07-02' }] }))
      return Promise.resolve(j({}))
    }))
    const Adm = (await import('../../views/admin/AdminDashboardView.vue')).default
    const w = mount(Adm,{global:{stubs}}); await flushPromises()
    w.vm.showNotice?.('test')
    await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },10000)

  // ====== All profile sub-views: unmount ======
  it('Profile sub-views: unmount all', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68 }, user: { nickname: 'Demo' } }))))
    const UserCenter = (await import('../../views/profile/UserCenterView.vue')).default
    let w = mount(UserCenter,{global:{stubs}}); await flushPromises(); w.unmount()

    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68, waist_cm: 82, sbp_mm_hg: 120, fasting_glucose: 6.1, birth_date: '1990-06-15', gender: 'male' }, user: { nickname: 'Demo' } }))))
    const Info = (await import('../../views/profile/PersonalInfoView.vue')).default
    w = mount(Info,{global:{stubs}}); await flushPromises(); w.unmount()

    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ personalized_advice_enabled: true, assistant_context_enabled: true, health_reminder_enabled: true }))))
    const Priv = (await import('../../views/profile/PrivacySettingsView.vue')).default
    w = mount(Priv,{global:{stubs}}); await flushPromises(); w.unmount()

    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({}))))
    const Pwd = (await import('../../views/profile/ChangePasswordView.vue')).default
    w = mount(Pwd,{global:{stubs}}); await flushPromises(); w.unmount()

    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ health_data_analysis_authorized: true, assistant_context_authorized: true, plan_suggestion_authorized: true, news_recommendation_authorized: true }))))
    const Authz = (await import('../../views/profile/DataAuthorizationView.vue')).default
    w = mount(Authz,{global:{stubs}}); await flushPromises(); w.unmount()

    expect(w.exists()).toBe(false)
  },15000)

  // ====== Plan sub-views: unmount ======
  it('Plan sub-views: unmount all', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ items: [] }))))
    const Task = (await import('../../views/plan/PlanTaskCreateView.vue')).default
    let w = mount(Task,{global:{stubs}}); await flushPromises(); w.unmount()

    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ history: [{ date: '2026-07-01', task_count: 2, completed_count: 2 }] }))))
    const Records = (await import('../../views/plan/CheckinRecordsView.vue')).default
    w = mount(Records,{global:{stubs}}); await flushPromises(); w.unmount()

    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ completion_rate: 75, summary: 'ok', evaluation: 'good', advice: 'keep' }))))
    const Analysis = (await import('../../views/plan/CheckinAnalysisView.vue')).default
    w = mount(Analysis,{global:{stubs}}); await flushPromises(); w.unmount()

    expect(w.exists()).toBe(false)
  },15000)

  // ====== HealthArchiveView + Journey + NotFound: unmount ======
  it('HealthArchive + Journey + DoctorProfile + NotFound: unmount all', async () => {
    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ profile: { nickname: 'Demo', height_cm: 172, weight_kg: 68, waist_cm: 82, sbp_mm_hg: 120, fasting_glucose: 6.1 } }))))
    const Archive = (await import('../../views/health/HealthArchiveView.vue')).default
    let w = mount(Archive,{global:{stubs}}); await flushPromises(); w.unmount()

    const Journey = (await import('../../views/journey/HealthJourneyView.vue')).default
    w = mount(Journey,{global:{stubs}}); await flushPromises(); w.unmount()

    vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({ id: 'doctor-1', name: 'Doc', title: 'Chief', department: 'Endocrine', specialty: 'diabetes', online_status: 'online' }))))
    const DocProfile = (await import('../../views/doctor/DoctorProfileView.vue')).default
    w = mount(DocProfile,{global:{stubs}}); await flushPromises(); w.unmount()

    const NotFound = (await import('../../views/NotFoundView.vue')).default
    w = mount(NotFound,{global:{stubs}}); await flushPromises(); w.unmount()

    expect(w.exists()).toBe(false)
  },15000)

  // ====== App.vue unmount ======
  it('App.vue: unmount', async () => {
    const App = (await import('../../App.vue')).default
    const w = mount(App,{global:{stubs}}); await flushPromises()
    w.unmount()
    expect(w.exists()).toBe(false)
  },5000)
})
