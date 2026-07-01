<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BarChartOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  RobotOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPost, apiPut, authorizedFetch, getStoredUser, hasAuthSession } from '../../api/request'
import { consumeSseStream } from '../../utils/sse'

const router = useRouter()
const activeSection = ref('overview')
const loading = ref(false)
const notice = ref('')
const dashboard = ref(null)
const articles = ref([])
const doctors = ref([])
const users = ref([])
const consultations = ref([])
const logs = ref([])
const adminMessage = ref('')
const adminSending = ref(false)
const adminConversationId = ref(null)
const adminHistoryLoaded = ref(false)
const adminMessages = ref([
  { role: 'assistant', content: '可以用自然语言查询后台数据，或草拟医生资料、坐诊时间等维护操作。涉及写库时请先确认。' },
])
const articleForm = ref({
  title: '糖尿病患者的饮食指南',
  summary: '控制碳水化合物摄入，选择低糖水果，保持规律饮食。',
  content: '后台录入的科普正文，可在用户端健康资讯展示。',
  status: 'draft',
  audit_status: 'approved',
})
const doctorForm = ref(emptyDoctorForm())

const navItems = [
  { key: 'overview', label: '概览', icon: BarChartOutlined },
  { key: 'assistant', label: '助手', icon: RobotOutlined },
  { key: 'articles', label: '资讯', icon: FileTextOutlined },
  { key: 'doctors', label: '医生', icon: MedicineBoxOutlined },
  { key: 'users', label: '用户', icon: TeamOutlined },
  { key: 'consultations', label: '工单', icon: MessageOutlined },
]

const currentUser = computed(() => getStoredUser())
const isAdmin = computed(() => ['admin', 'super_admin'].includes(currentUser.value?.role))
const activeTitle = computed(() => navItems.find((item) => item.key === activeSection.value)?.label || '管理')

function emptyDoctorForm() {
  return {
    id: null,
    name: '',
    title: '',
    department: '内分泌科',
    specialty: '',
    intro: '',
    avatar_url: '',
    license_no: '',
    profile_md: '',
    online_status: 'online',
    consult_status: 'online',
    display_status: 'published',
    audit_status: 'approved',
    sort_order: 0,
  }
}

function showNotice(text) {
  notice.value = text
  window.setTimeout(() => {
    notice.value = ''
  }, 2200)
}

async function loadAdminData() {
  if (!hasAuthSession() || !isAdmin.value) {
    showNotice('请使用管理员账号登录。')
    router.push({ name: 'login' })
    return
  }

  loading.value = true
  try {
    const [dash, articleResult, doctorResult, userResult, consultationResult, logResult] = await Promise.all([
      apiGet('/api/admin/dashboard'),
      apiGet('/api/admin/articles?page=1&pageSize=20'),
      apiGet('/api/admin/doctors?page=1&pageSize=20'),
      apiGet('/api/admin/users?page=1&pageSize=20'),
      apiGet('/api/admin/consultations'),
      apiGet('/api/admin/dify-run-logs?page=1&pageSize=5'),
    ])
    dashboard.value = dash.data
    articles.value = articleResult.data?.items || []
    doctors.value = doctorResult.data?.items || []
    users.value = userResult.data?.items || []
    consultations.value = consultationResult.data?.items || []
    logs.value = logResult.data?.items || []
    if (!doctorForm.value.id && doctors.value[0]) editDoctor(doctors.value[0])
  } catch (error) {
    showNotice(error.message || '管理端数据加载失败。')
  } finally {
    loading.value = false
  }
}

async function createArticle() {
  try {
    const result = await apiPost('/api/admin/articles', articleForm.value)
    articles.value = [result.data, ...articles.value]
    showNotice('文章已创建。')
  } catch (error) {
    showNotice(error.message || '创建失败。')
  }
}

async function publishArticle(article) {
  try {
    const result = await apiPost(`/api/admin/articles/${article.id}/publish`)
    articles.value = articles.value.map((item) => item.id === article.id ? result.data : item)
    showNotice('文章已发布。')
  } catch (error) {
    showNotice(error.message || '发布失败。')
  }
}

function editDoctor(doctor) {
  doctorForm.value = {
    ...emptyDoctorForm(),
    ...doctor,
    sort_order: doctor.sort_order || 0,
  }
}

function newDoctor() {
  doctorForm.value = emptyDoctorForm()
}

async function saveDoctor() {
  const payload = { ...doctorForm.value }
  delete payload.id
  try {
    const result = doctorForm.value.id
      ? await apiPut(`/api/admin/doctors/${doctorForm.value.id}`, payload)
      : await apiPost('/api/admin/doctors', payload)
    const saved = result.data
    doctors.value = doctorForm.value.id
      ? doctors.value.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...doctors.value]
    editDoctor(saved)
    showNotice('医生资料已保存。')
  } catch (error) {
    showNotice(error.message || '医生资料保存失败。')
  }
}

async function toggleUserStatus(user) {
  const nextStatus = user.status === 'active' ? 'disabled' : 'active'
  try {
    const result = await apiPut(`/api/admin/users/${user.id}/status`, { status: nextStatus })
    users.value = users.value.map((item) => item.id === user.id ? { ...item, ...result.data } : item)
    showNotice('用户状态已更新。')
  } catch (error) {
    showNotice(error.message || '更新失败。')
  }
}

async function readSse(response, target) {
  await consumeSseStream(response, {
    async onMessage(data, rawText) {
      target.content += data.delta || data.content || data.answer || rawText || ''
    },
    async onMessageEnd(data) {
      if (data.conversation_id) {
        adminConversationId.value = data.conversation_id
      }
    },
    async onError(data) {
      throw new Error(data.message || '管理员助手暂时不可用，请稍后重试。')
    },
  })
}

async function loadAdminAssistantHistory() {
  try {
    const result = await apiGet('/api/admin/assistant/conversations')
    const items = result.data || []
    const latest = items[0] || null

    if (!latest) {
      adminConversationId.value = null
      adminHistoryLoaded.value = true
      return
    }

    adminConversationId.value = latest.id

    const messagesResult = await apiGet(
      `/api/admin/assistant/conversations/${latest.id}/messages`,
    )
    const historyMessages = (messagesResult.data || []).map((item) => ({
      role: item.role,
      content: item.content || '',
    }))

    if (historyMessages.length) {
      adminMessages.value = historyMessages
    }
  } catch (error) {
    showNotice(error.message || '管理助手历史读取失败。')
  } finally {
    adminHistoryLoaded.value = true
  }
}

async function sendAdminMessage() {
  const content = adminMessage.value.trim()
  if (!content || adminSending.value) return

  adminMessages.value.push({ role: 'user', content })
  const reply = { role: 'assistant', content: '' }
  adminMessages.value.push(reply)
  adminMessage.value = ''
  adminSending.value = true

  try {
    const response = await authorizedFetch('/api/admin/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: adminConversationId.value,
        message: content,
        context: { activeSection: activeSection.value },
      }),
    })
    await readSse(response, reply)
  } catch (error) {
    reply.content = '管理员助手暂时不可用，请稍后重试。'
    showNotice(error.message || '发送失败。')
  } finally {
    adminSending.value = false
  }
}

async function handleSectionChange(key) {
  activeSection.value = key

  if (key === 'assistant' && !adminHistoryLoaded.value) {
    await loadAdminAssistantHistory()
  }
}

onMounted(async () => {
  await loadAdminData()

  if (activeSection.value === 'assistant' && !adminHistoryLoaded.value) {
    await loadAdminAssistantHistory()
  }
})
</script>

<template>
  <main class="admin-shell">
    <section class="admin-phone">
      <header class="admin-topbar">
        <div>
          <strong>AI智能管理平台</strong>
          <small>{{ currentUser?.username || 'admin' }} · 管理员</small>
        </div>
        <button type="button" @click="loadAdminData">{{ loading ? '同步中' : '刷新' }}</button>
      </header>

      <section class="admin-content">
        <header class="section-title">
          <h1>{{ activeTitle }}</h1>
          <button type="button" @click="router.push({ name: 'home' })">用户端</button>
        </header>

        <section v-if="activeSection === 'overview'" class="panel-grid">
          <article class="stat-card"><span>用户数</span><strong>{{ dashboard?.users || users.length }}</strong></article>
          <article class="stat-card"><span>文章数</span><strong>{{ dashboard?.articles || articles.length }}</strong></article>
          <article class="stat-card"><span>医生数</span><strong>{{ dashboard?.doctors || doctors.length }}</strong></article>
          <article class="stat-card"><span>咨询工单</span><strong>{{ dashboard?.consultations || consultations.length }}</strong></article>
          <section class="admin-card">
            <h2>Dify运行日志</h2>
            <div class="table-wrap">
              <table>
                <tbody>
                  <tr v-for="log in logs" :key="log.id">
                    <td>{{ log.app_code || log.app_type }}</td>
                    <td>{{ log.status }}</td>
                    <td>{{ log.created_at }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section v-if="activeSection === 'assistant'" class="admin-card assistant-admin-card">
          <h2>管理员 AI 助手</h2>
          <div class="admin-chat-log">
            <article v-for="(item, index) in adminMessages" :key="index" :class="item.role">
              {{ item.content || '处理中…' }}
            </article>
          </div>
          <form class="admin-chat-form" @submit.prevent="sendAdminMessage">
            <input v-model="adminMessage" aria-label="输入管理员助手指令" placeholder="例如：统计近一个月咨询糖尿病治疗方案的用户数量" />
            <button type="submit" :disabled="adminSending"><SendOutlined /></button>
          </form>
        </section>

        <section v-if="activeSection === 'articles'" class="admin-card">
          <h2>新增科普文章</h2>
          <div class="form-grid">
            <input v-model="articleForm.title" aria-label="文章标题" placeholder="文章标题" />
            <input v-model="articleForm.summary" aria-label="文章摘要" placeholder="摘要" />
            <textarea v-model="articleForm.content" aria-label="文章正文" placeholder="正文"></textarea>
            <button type="button" @click="createArticle">创建文章</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>标题</th><th>状态</th><th>阅读</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="article in articles" :key="article.id">
                  <td>{{ article.title }}</td>
                  <td>{{ article.status }}</td>
                  <td>{{ article.view_count || 0 }}</td>
                  <td><button type="button" @click="publishArticle(article)">发布</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeSection === 'doctors'" class="admin-card">
          <header class="card-head">
            <h2>医生资料</h2>
            <button type="button" @click="newDoctor">新建</button>
          </header>
          <div class="doctor-editor">
            <input v-model="doctorForm.name" aria-label="医生姓名" placeholder="医生姓名" />
            <input v-model="doctorForm.title" aria-label="职称" placeholder="职称" />
            <input v-model="doctorForm.department" aria-label="科室" placeholder="科室" />
            <input v-model="doctorForm.specialty" aria-label="擅长方向" placeholder="擅长方向" />
            <input v-model="doctorForm.avatar_url" aria-label="头像 URL" placeholder="头像 URL" />
            <input v-model="doctorForm.license_no" aria-label="执业编号" placeholder="执业编号" />
            <textarea v-model="doctorForm.intro" aria-label="医生简介" placeholder="医生简介"></textarea>
            <button type="button" @click="saveDoctor">保存医生资料</button>
          </div>
          <div class="doctor-list-mini">
            <button v-for="doctor in doctors" :key="doctor.id" type="button" @click="editDoctor(doctor)">
              <span>{{ doctor.name?.slice(0, 1) || '医' }}</span>
              <strong>{{ doctor.name }}</strong>
              <small>{{ doctor.department }} · {{ doctor.display_status }}</small>
            </button>
          </div>
        </section>

        <section v-if="activeSection === 'users'" class="admin-card">
          <h2>用户管理</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td>{{ user.id }}</td>
                  <td>{{ user.username }}</td>
                  <td>{{ user.role }}</td>
                  <td>{{ user.status }}</td>
                  <td><button type="button" @click="toggleUserStatus(user)">{{ user.status === 'active' ? '禁用' : '启用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeSection === 'consultations'" class="admin-card">
          <h2>医生咨询工单</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>用户</th><th>医生</th><th>问题</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="item in consultations" :key="item.id">
                  <td>{{ item.id }}</td>
                  <td>{{ item.username || item.user_id }}</td>
                  <td>{{ item.doctor_name || item.doctor_id }}</td>
                  <td>{{ item.title }}</td>
                  <td>{{ item.status }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <transition name="toast">
        <div v-if="notice" class="admin-toast">{{ notice }}</div>
      </transition>

      <nav class="admin-tabs" aria-label="管理导航">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          :class="{ active: activeSection === item.key }"
          @click="handleSectionChange(item.key)"
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  color: #182033;
  background: #dbe8f7;
}

.admin-phone {
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f4f6fa;
}

.admin-topbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  background: #ffffff;
}

.admin-topbar strong,
.admin-topbar small {
  display: block;
}

.admin-topbar strong { font-size: 17px; font-weight: 900; }
.admin-topbar small { margin-top: 4px; color: #738196; font-size: 12px; font-weight: 800; }

.admin-topbar button,
.section-title button,
.form-grid button,
td button,
.card-head button,
.doctor-editor button {
  border-radius: 7px;
  padding: 8px 11px;
  color: #ffffff;
  background: #1677ff;
  font-size: 12px;
  font-weight: 900;
}

.admin-tabs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  flex: 0 0 auto;
  border-top: 1px solid #edf1f5;
  padding: 6px 5px calc(6px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -8px 20px rgba(31, 65, 110, 0.06);
}

@media (max-width: 380px) {
  .admin-tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.admin-tabs button {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  border-radius: 8px;
  padding: 7px 2px 6px;
  color: #607086;
  background: transparent;
  font-size: 11px;
  font-weight: 900;
}

.admin-tabs button svg {
  font-size: 20px;
}

@media (max-width: 380px) {
  .admin-tabs button svg {
    font-size: 16px;
  }
  .admin-tabs button span {
    font-size: 10px;
  }
}

.admin-tabs button span {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.admin-tabs button.active {
  color: #116dff;
  background: #edf5ff;
}

.admin-content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 18px;
  scrollbar-width: none;
}
.admin-content::-webkit-scrollbar { display: none; }

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title h1 { margin: 0; font-size: 22px; font-weight: 900; }

.panel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

.stat-card,
.admin-card {
  border-radius: 8px;
  padding: 15px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(28, 55, 95, 0.06);
}

.stat-card span { color: #738196; font-size: 12px; font-weight: 800; }
.stat-card strong { display: block; margin-top: 10px; font-size: 28px; font-weight: 900; }
.admin-card { margin-bottom: 14px; }
.panel-grid .admin-card { grid-column: 1 / -1; margin-bottom: 0; }

.admin-card h2 { margin: 0 0 12px; font-size: 16px; font-weight: 900; }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.card-head h2 { margin: 0; }

.form-grid,
.doctor-editor {
  display: grid;
  gap: 9px;
  margin-bottom: 14px;
}

.form-grid input,
.form-grid textarea,
.doctor-editor input,
.doctor-editor textarea,
.admin-chat-form input {
  min-width: 0;
  border: 1px solid #dfe6f0;
  border-radius: 7px;
  padding: 10px 11px;
  color: #182033;
  background: #fbfcfe;
  font: inherit;
  font-size: 13px;
}

.form-grid textarea,
.doctor-editor textarea { min-height: 76px; resize: vertical; }

.table-wrap { overflow-x: auto; margin: 0 -4px; padding: 0 4px; }
table { min-width: 520px; width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { border-bottom: 1px solid #edf1f6; padding: 10px 8px; text-align: left; }
th { color: #718096; font-weight: 900; }
td { color: #233149; }
td button { padding: 6px 8px; font-size: 12px; }

.doctor-list-mini { display: grid; gap: 8px; }
.doctor-list-mini button {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  column-gap: 10px;
  align-items: center;
  border-radius: 8px;
  padding: 10px;
  background: #f7faff;
  text-align: left;
}
.doctor-list-mini span { display: grid; width: 38px; height: 38px; place-items: center; grid-row: span 2; border-radius: 50%; color: #fff; background: #1677ff; font-weight: 900; }
.doctor-list-mini strong { overflow: hidden; font-size: 14px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.doctor-list-mini small { overflow: hidden; color: #738196; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }

.admin-chat-log { display: grid; gap: 10px; max-height: 42vh; overflow-y: auto; margin-bottom: 12px; }
.admin-chat-log article { border-radius: 8px; padding: 10px 12px; background: #f2f5fa; font-size: 13px; font-weight: 800; line-height: 1.55; white-space: pre-wrap; }
.admin-chat-log article.user { justify-self: end; max-width: 82%; color: #fff; background: #1677ff; }
.admin-chat-form { display: grid; grid-template-columns: minmax(0, 1fr) 42px; gap: 8px; }
.admin-chat-form button { display: grid; place-items: center; border-radius: 8px; color: #fff; background: #1677ff; font-size: 16px; }
.admin-chat-form button:disabled { opacity: 0.6; }

.admin-toast { position: fixed; right: 24px; bottom: 24px; border-radius: 8px; padding: 12px 14px; color: #ffffff; background: rgba(20, 32, 51, 0.94); }
</style>
