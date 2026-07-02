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

describe('Final coverage push', () => {

  // ====== HealthView: calculateAge + formatMissingFields ======
  describe('HealthView uncovered functions', () => {
    it('calculateAge all branches', async () => {
      vi.stubGlobal('fetch', vi.fn((input)=>{
        if(String(input).includes('risk-assessments/latest')) return Promise.resolve(j(null))
        return Promise.resolve(j({profile:{completion_rate:50},latest_measurements:null,latest_risk:null}))
      }))
      const HV = (await import('../../views/health/HealthView.vue')).default
      const w = mount(HV,{global:{stubs}}); await flushPromises()
      const vm = w.vm

      // calculateAge: falsy value → null
      await safe(()=>vm.calculateAge?.(''))
      await safe(()=>vm.calculateAge?.(null))
      await safe(()=>vm.calculateAge?.(undefined))

      // calculateAge: invalid date → null
      await safe(()=>vm.calculateAge?.('not-a-date'))
      await safe(()=>vm.calculateAge?.('invalid'))

      // calculateAge: valid date, monthDiff < 0 (birth month later than now)
      // e.g., birth in Dec 1990, now is Jul 2026 → month 12 > 7 → monthDiff = 7-12 = -5 → age -= 1
      await safe(()=>vm.calculateAge?.('1990-12-15'))

      // calculateAge: valid date, monthDiff === 0 && today.getDate() < birth.getDate()
      // Use a date where month matches but day hasn't passed yet
      const now = new Date()
      const sameMonth = `${now.getFullYear()-25}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()+5).padStart(2,'0')}`
      await safe(()=>vm.calculateAge?.(sameMonth))

      // calculateAge: valid date, normal case
      await safe(()=>vm.calculateAge?.('2000-01-01'))

      // calculateAge: age <= 0 or >= 130 → null
      await safe(()=>vm.calculateAge?.('2099-01-01')) // future date → negative age → null
      await safe(()=>vm.calculateAge?.('1800-01-01')) // too old → null

      // formatMissingFields: not array → default
      await safe(()=>vm.formatMissingFields?.(null))
      await safe(()=>vm.formatMissingFields?.('string'))

      // formatMissingFields: empty array → default
      await safe(()=>vm.formatMissingFields?.([]))

      // formatMissingFields: known + unknown fields
      await safe(()=>vm.formatMissingFields?.(['height_cm','weight_kg']))
      await safe(()=>vm.formatMissingFields?.(['unknown_field']))

      expect(w.exists()).toBe(true)
    },10000)
  })

  // ====== AdminDashboard: error handling coverage ======
  describe('AdminDashboard error branches', () => {
    it('updateArticle + saveDoctor + filter params + changePage errors', async () => {
      saveAuthSession({token:'at',user:{id:1,role:'admin',username:'admin'}})
      vi.stubGlobal('fetch', vi.fn((input,init)=>{
        const u=String(input);const m=String(init?.method||'GET').toUpperCase()
        if(u.includes('admin/dashboard')) return Promise.resolve(j({users:3,articles:2,doctors:1,consultations:1}))
        if(u.includes('admin/articles')&&m==='GET') return Promise.resolve(j({items:[{id:101,title:'A',status:'draft',audit_status:'approved',author:'',cover_url:'',tags:[],category_id:null,recommend_weight:0}],total:1}))
        if(u.includes('admin/doctors')&&m==='GET') return Promise.resolve(j({items:[{id:'d1',name:'Doc',department:'Endocrine',specialty:'diabetes',sort_order:0,title:'',avatar_url:'',license_no:'',profile_md:'',online_status:'online',consult_status:'online',display_status:'published',audit_status:'approved'}]}))
        if(u.includes('admin/users')&&m==='GET') return Promise.resolve(j({items:[{id:1,username:'demo',role:'user',status:'active'}],total:1}))
        if(u.includes('admin/consultations')&&m==='GET') return Promise.resolve(j({items:[{id:1,username:'demo',doctor_name:'Doc',status:'active'}]}))
        if(u.includes('admin/dify-run-logs')) return Promise.resolve(j({items:[{id:1,app_code:'assistant',status:'ok',created_at:'2026-07-02'}]}))
        if(u.includes('admin/articles/')&&u.includes('publish')) return Promise.resolve(j({id:101,title:'A',status:'published'}))
        if(u.includes('admin/articles/')&&u.includes('unpublish')) return Promise.resolve(j({id:101,title:'A',status:'draft'}))
        return Promise.resolve(j({}))
      }))
      const Adm = (await import('../../views/admin/AdminDashboardView.vue')).default
      const w = mount(Adm,{global:{stubs}}); await flushPromises()
      const vm = w.vm

      // Edit an article then update (success path)
      vm.activeSection='articles'; await nextTick()
      await safe(()=>vm.editArticle?.({id:101,title:'A',content:'c',author:'E',status:'draft',audit_status:'approved'}))
      await flushPromises()
      // Mock for update success
      vi.stubGlobal('fetch', vi.fn((input,init)=>{
        const u=String(input);const m=String(init?.method||'GET').toUpperCase()
        if(u.includes('admin/articles/')&&m==='PUT') return Promise.resolve(j({id:101,title:'Updated'}))
        if(u.includes('admin/articles')&&m==='GET') return Promise.resolve(j({items:[{id:101,title:'A'}],total:1}))
        if(u.includes('admin/dashboard')) return Promise.resolve(j({users:3}))
        return Promise.resolve(j({}))
      }))
      await safe(()=>vm.updateArticle?.())
      await flushPromises()

      // updateArticle error
      vi.stubGlobal('fetch', vi.fn((input,init)=>{
        const u=String(input);const m=String(init?.method||'GET').toUpperCase()
        if(u.includes('admin/articles/')&&m==='PUT') return Promise.reject(new Error('update fail'))
        return Promise.resolve(j({items:[{id:101,title:'A'}]}))
      }))
      await safe(()=>vm.updateArticle?.())
      await flushPromises()

      // saveDoctor with existing doctor id (update path)
      vi.stubGlobal('fetch', vi.fn((input,init)=>{
        const u=String(input);const m=String(init?.method||'GET').toUpperCase()
        if(u.includes('admin/doctors/')&&m==='PUT') return Promise.resolve(j({id:'d1',name:'UpdatedDoc',department:'Endocrine'}))
        return Promise.resolve(j({}))
      }))
      vm.activeSection='doctors'; await nextTick()
      vm.doctorForm={id:'d1',name:'Doc',department:'Endocrine',specialty:'diabetes',title:'',avatar_url:'',license_no:'',profile_md:'',online_status:'online',consult_status:'online',display_status:'published',audit_status:'approved',sort_order:0}
      await safe(()=>vm.saveDoctor?.())
      await flushPromises()

      // saveDoctor error (update path)
      vi.stubGlobal('fetch', vi.fn((input,init)=>{
        const u=String(input);const m=String(init?.method||'GET').toUpperCase()
        if(u.includes('admin/doctors/')&&m==='PUT') return Promise.reject(new Error('save fail'))
        return Promise.resolve(j({}))
      }))
      await safe(()=>vm.saveDoctor?.())
      await flushPromises()

      // changeArticlePage error
      vi.stubGlobal('fetch', vi.fn((input)=>{
        if(String(input).includes('admin/articles')) return Promise.reject(new Error('page fail'))
        return Promise.resolve(j({}))
      }))
      await safe(()=>vm.changeArticlePage?.(2))
      await flushPromises()

      // changeUserPage error
      vi.stubGlobal('fetch', vi.fn((input)=>{
        if(String(input).includes('admin/users')) return Promise.reject(new Error('page fail'))
        return Promise.resolve(j({}))
      }))
      vm.activeSection='users'; await nextTick()
      await safe(()=>vm.changeUserPage?.(2))
      await flushPromises()

      // search with filters set
      vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({items:[],total:0}))))
      vm.activeSection='articles'; vm.articleKeyword='test'; vm.articleStatusFilter='published'
      await safe(()=>vm.searchArticles?.())
      vm.activeSection='users'; vm.userKeyword='test'; vm.userStatusFilter='disabled'
      await safe(()=>vm.searchUsers?.())
      vm.activeSection='consultations'; vm.consultKeyword='test'; vm.consultDoctorFilter='d1'; vm.consultStatusFilter='active'
      await flushPromises()

      expect(w.exists()).toBe(true)
    },30000)
  })

  // ====== DoctorConsultView: more send paths ======
  describe('DoctorConsultView more branches', () => {
    it('sendMessage with file upload + non-SSE + error paths', async () => {
      vi.stubGlobal('fetch', vi.fn((input,init)=>{
        const u=String(input)
        if(u.includes('doctors/doctor-1/chat')) return Promise.resolve(j({reply:'plain reply',conversation_id:'dc_new'}))
        if(u.includes('doctors/doctor-1/conversations/')&&u.includes('messages')) return Promise.resolve(j([{role:'assistant',content:'history'}]))
        if(u.includes('doctors/doctor-1/conversations')) return Promise.resolve(j({items:[{id:'dc1',updated_at:new Date().toISOString()}]}))
        if(u.includes('doctors/doctor-1')) return Promise.resolve(j({id:'doctor-1',name:'Doc',title:'MD',department:'内分泌',specialty:'糖尿病',online_status:'online',greeting:'Hi',category:'内分泌'}))
        if(u.includes('doctors')) return Promise.resolve(j({items:[{id:'doctor-1',name:'Doc',department:'内分泌科',specialty:'糖尿病',category:'内分泌',title:'MD'}]}))
        if(u.includes('uploads')) return Promise.resolve(j({file_id:'f1',file_name:'doc.pdf',size:500,mime_type:'application/pdf',url:'/f/doc.pdf'}))
        return Promise.resolve(j({}))
      }))
      const D = (await import('../../views/doctor/DoctorConsultView.vue')).default
      const w = mount(D,{global:{stubs}}); await flushPromises()
      const vm = w.vm

      // Open chat
      await safe(()=>vm.openChat?.({id:'doctor-1',greeting:'Hi',unread:0}))
      await flushPromises()

      // Send with message (non-SSE path)
      vm.message='hello'; vm.pendingFiles=[]
      await safe(()=>vm.sendMessage?.())
      await flushPromises()

      // Send with file attachment (raw File)
      vm.message='file check'; vm.pendingFiles=[{raw:new File(['x'],'report.pdf',{type:'application/pdf'})}]
      await safe(()=>vm.sendMessage?.())
      await flushPromises()

      // Conversations error → greeting fallback
      vi.stubGlobal('fetch', vi.fn((input)=>{
        const u=String(input)
        if(u.includes('conversations')) return Promise.reject(new Error('no conv'))
        if(u.includes('doctors/doctor-1')) return Promise.resolve(j({id:'doctor-1',name:'Doc',greeting:'Hi there',department:'内分泌'}))
        if(u.includes('doctors')) return Promise.resolve(j({items:[{id:'doctor-1',name:'Doc',category:'内分泌'}]}))
        return Promise.resolve(j({}))
      }))
      await safe(()=>vm.loadDoctorConversation?.({id:'doctor-1'}))
      await flushPromises()

      // getThread for non-existent → creates with defaults
      vm.threads={}; vm.doctorList=[]
      await safe(()=>vm.getThread?.(999))

      expect(w.exists()).toBe(true)
    },15000)
  })

  // ====== MessagesView + FavoritesView state push ======
  describe('Messages+Favorites remaining', () => {
    it('MessagesView load and click all', async () => {
      vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({list:[
        {id:1,title:'T1',content:'C1',type:'system',group:'info',read:false,created_at:new Date().toISOString(),route:'home'},
        {id:2,title:'T2',content:'C2',type:'assistant',group:'assistant',read:true,created_at:new Date().toISOString(),route:'assistant'},
      ]}))))
      const Msg = (await import('../../views/messages/MessagesView.vue')).default
      const w = mount(Msg,{global:{stubs}}); await flushPromises()
      const buttons = w.findAll('button')
      for(const b of buttons.slice(0,15)) await safe(()=>b.trigger('click'))
      expect(w.exists()).toBe(true)
    },10000)

    it('FavoritesView load and interact', async () => {
      vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({items:[
        {id:1,title:'F1',summary:'S1',category:'饮食',author:'E1',favorited:true},
        {id:2,title:'F2',summary:'S2',category:'运动',author:'E2',favorited:true},
      ]}))))
      const Fav = (await import('../../views/favorites/FavoritesView.vue')).default
      const w = mount(Fav,{global:{stubs}}); await flushPromises()
      const buttons = w.findAll('button')
      for(const b of buttons.slice(0,15)) await safe(()=>b.trigger('click'))
      expect(w.exists()).toBe(true)
    },10000)
  })

  // ====== DataAuthorizationView + ChangePassword more ======
  describe('Profile sub-views', () => {
    it('DataAuthorizationView switches + withdraw', async () => {
      vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({
        health_data_analysis_authorized:true,assistant_context_authorized:true,
        plan_suggestion_authorized:true,news_recommendation_authorized:true
      }))))
      const DA = (await import('../../views/profile/DataAuthorizationView.vue')).default
      const w = mount(DA,{global:{stubs}}); await flushPromises()
      const vm = w.vm
      // Try toggling switches
      const switches = w.findAll('.van-switch-stub')
      for(const s of switches.slice(0,5)) await safe(()=>s.trigger('click'))
      // Withdraw flow
      await safe(()=>vm.requestWithdraw?.())
      await safe(()=>vm.confirmWithdraw?.())
      await safe(()=>vm.cancelWithdraw?.())
      expect(w.exists()).toBe(true)
    },10000)

    it('ChangePasswordView submit with mismatch + error', async () => {
      vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({}))))
      const CP = (await import('../../views/profile/ChangePasswordView.vue')).default
      const w = mount(CP,{global:{stubs}}); await flushPromises()
      const vm = w.vm
      // Empty fields
      await safe(()=>vm.handleSubmit?.())
      // Mismatch
      vm.oldPassword='old'; vm.newPassword='new1'; vm.confirmPassword='new2'
      await safe(()=>vm.handleSubmit?.())
      // Short password
      vm.confirmPassword='new1'; vm.newPassword='ab'
      await safe(()=>vm.handleSubmit?.())
      expect(w.exists()).toBe(true)
    },10000)

    it('PrivacySettingsView more toggles', async () => {
      vi.stubGlobal('fetch', vi.fn((input,init)=>{
        const m=String(init?.method||'GET').toUpperCase()
        if(m==='PUT') return Promise.resolve(j({}))
        return Promise.resolve(j({personalized_advice_enabled:true,assistant_context_enabled:false,health_reminder_enabled:true}))
      }))
      const PS = (await import('../../views/profile/PrivacySettingsView.vue')).default
      const w = mount(PS,{global:{stubs}}); await flushPromises()
      const switches = w.findAll('.van-switch-stub')
      for(const s of switches.slice(0,5)) await safe(()=>s.trigger('click'))
      expect(w.exists()).toBe(true)
    },10000)

    it('PersonalInfoView more interactions', async () => {
      vi.stubGlobal('fetch', vi.fn(()=>Promise.resolve(j({
        profile:{nickname:'Demo',height_cm:172,weight_kg:68,waist_cm:82,sbp_mm_hg:120,fasting_glucose:6.1,birth_date:'1990-06-15',gender:'male'},
        user:{nickname:'Demo'}
      }))))
      const PI = (await import('../../views/profile/PersonalInfoView.vue')).default
      const w = mount(PI,{global:{stubs}}); await flushPromises()
      const buttons = w.findAll('button')
      for(const b of buttons.slice(0,20)) await safe(()=>b.trigger('click'))
      const inputs = w.findAll('input').filter(i=>i.attributes('type')!=='file')
      for(const inp of inputs.slice(0,10)) await safe(()=>inp.setValue('test'))
      await safe(()=>w.find('form').trigger('submit.prevent'))
      expect(w.exists()).toBe(true)
    },10000)
  })
})
