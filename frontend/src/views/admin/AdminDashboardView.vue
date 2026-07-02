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
import { apiGet, apiPost, apiPut, apiDelete, authorizedFetch, getStoredUser, hasAuthSession } from '../../api/request'
import { consumeSseStream } from '../../utils/sse'
import { renderChatHtml } from '../../utils/chatRichText'
import { uploadSingleFile } from '../../api/uploads'

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
const articleCoverInput = ref(null)
const doctorAvatarInput = ref(null)
const articleForm = ref({
  title: '',
  summary: '',
  content: '',
  category_id: null,
  cover_url: '',
  tags: [],
  author: '',
  status: 'draft',
  audit_status: 'approved',
  recommend_weight: 0,
})
const editingArticleId = ref(null)
const articleKeyword = ref('')
const articleStatusFilter = ref('')
const articlePage = ref(1)
const articleTotal = ref(0)
const articlePageSize = 20
const userKeyword = ref('')
const userStatusFilter = ref('')
const userPage = ref(1)
const userTotal = ref(0)
const userPageSize = 20
const consultKeyword = ref('')
const consultDoctorFilter = ref('')
const consultStatusFilter = ref('')
const consultPage = ref(1)
const consultTotal = ref(0)
const consultPageSize = 20
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
      loadArticles(),
      apiGet('/api/admin/doctors?page=1&pageSize=20'),
      loadUsers(),
      loadConsultations(),
      apiGet('/api/admin/dify-run-logs?page=1&pageSize=5'),
    ])
    dashboard.value = dash.data
    articles.value = articleResult?.items || []
    articleTotal.value = articleResult?.total || 0
    doctors.value = doctorResult.data?.items || []
    users.value = userResult?.items || []
    userTotal.value = userResult?.total || 0
    consultations.value = consultationResult || []
    consultTotal.value = consultations.value.length
    logs.value = logResult.data?.items || []
    if (!doctorForm.value.id && doctors.value[0]) editDoctor(doctors.value[0])
  } catch (error) {
    showNotice(error.message || '管理端数据加载失败。')
  } finally {
    loading.value = false
  }
}

function resetArticleForm() {
  editingArticleId.value = null
  articleForm.value = {
    title: '',
    summary: '',
    content: '',
    category_id: null,
    cover_url: '',
    tags: [],
    author: '',
    status: 'draft',
    audit_status: 'approved',
    recommend_weight: 0,
  }
}

async function loadArticles() {
  const params = new URLSearchParams()
  params.set('page', String(articlePage.value))
  params.set('pageSize', String(articlePageSize))
  if (articleKeyword.value.trim()) params.set('keyword', articleKeyword.value.trim())
  if (articleStatusFilter.value) params.set('status', articleStatusFilter.value)
  const result = await apiGet(`/api/admin/articles?${params.toString()}`)
  return result.data
}

async function searchArticles() {
  articlePage.value = 1
  try {
    const data = await loadArticles()
    articles.value = data?.items || []
    articleTotal.value = data?.total || 0
  } catch (error) {
    showNotice(error.message || '查询失败。')
  }
}

async function changeArticlePage(page) {
  articlePage.value = page
  try {
    const data = await loadArticles()
    articles.value = data?.items || []
    articleTotal.value = data?.total || 0
  } catch (error) {
    showNotice(error.message || '加载失败。')
  }
}

async function handleArticleCoverUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const uploaded = await uploadSingleFile(file, 'avatar')
    articleForm.value.cover_url = uploaded.url
  } catch (err) { showNotice(err.message || '上传失败') }
  e.target.value = ''
}

async function handleDoctorAvatarUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const uploaded = await uploadSingleFile(file, 'avatar')
    doctorForm.value.avatar_url = uploaded.url
  } catch (err) { showNotice(err.message || '上传失败') }
  e.target.value = ''
}

async function createArticle() {
  try {
    const result = await apiPost('/api/admin/articles', articleForm.value)
    articles.value = [result.data, ...articles.value]
    articleTotal.value += 1
    resetArticleForm()
    showNotice('文章已创建。')
  } catch (error) {
    showNotice(error.message || '创建失败。')
  }
}

function editArticle(article) {
  editingArticleId.value = article.id
  articleForm.value = {
    title: article.title || '',
    summary: article.summary || '',
    content: article.content || '',
    category_id: article.category_id || null,
    cover_url: article.cover_url || '',
    tags: article.tags || [],
    author: article.author || '',
    status: article.status || 'draft',
    audit_status: article.audit_status || 'approved',
    recommend_weight: article.recommend_weight ?? 0,
  }
}

async function updateArticle() {
  if (!editingArticleId.value) return
  try {
    const result = await apiPut(`/api/admin/articles/${editingArticleId.value}`, articleForm.value)
    articles.value = articles.value.map((item) => item.id === editingArticleId.value ? result.data : item)
    resetArticleForm()
    showNotice('文章已更新。')
  } catch (error) {
    showNotice(error.message || '更新失败。')
  }
}

async function deleteArticle(article) {
  if (!window.confirm(`确定要删除文章「${article.title}」吗？此操作不可恢复。`)) return
  try {
    await apiDelete(`/api/admin/articles/${article.id}`)
    articles.value = articles.value.filter((item) => item.id !== article.id)
    articleTotal.value = Math.max(0, articleTotal.value - 1)
    if (editingArticleId.value === article.id) resetArticleForm()
    showNotice('文章已删除。')
  } catch (error) {
    showNotice(error.message || '删除失败。')
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

async function unpublishArticle(article) {
  try {
    const result = await apiPost(`/api/admin/articles/${article.id}/unpublish`)
    articles.value = articles.value.map((item) => item.id === article.id ? result.data : item)
    showNotice('文章已下线。')
  } catch (error) {
    showNotice(error.message || '下线失败。')
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

async function loadUsers() {
  const params = new URLSearchParams()
  params.set('page', String(userPage.value))
  params.set('pageSize', String(userPageSize))
  if (userKeyword.value.trim()) params.set('keyword', userKeyword.value.trim())
  if (userStatusFilter.value) params.set('status', userStatusFilter.value)
  const result = await apiGet(`/api/admin/users?${params.toString()}`)
  return result.data
}

async function searchUsers() {
  userPage.value = 1
  try {
    const data = await loadUsers()
    users.value = data?.items || []
    userTotal.value = data?.total || 0
  } catch (error) {
    showNotice(error.message || '查询失败。')
  }
}

async function changeUserPage(page) {
  userPage.value = page
  try {
    const data = await loadUsers()
    users.value = data?.items || []
    userTotal.value = data?.total || 0
  } catch (error) {
    showNotice(error.message || '加载失败。')
  }
}

async function loadConsultations() {
  const params = new URLSearchParams()
  params.set('page', String(consultPage.value))
  params.set('pageSize', String(consultPageSize))
  if (consultKeyword.value.trim()) params.set('keyword', consultKeyword.value.trim())
  if (consultStatusFilter.value) params.set('status', consultStatusFilter.value)
  if (consultDoctorFilter.value) params.set('doctorId', consultDoctorFilter.value)
  const result = await apiGet(`/api/admin/consultations?${params.toString()}`)
  const items = result.data?.items || result.data || []
  return items
}

async function searchConsultations() {
  consultPage.value = 1
  try {
    consultations.value = await loadConsultations()
    consultTotal.value = consultations.value.length
  } catch (error) {
    showNotice(error.message || '查询失败。')
  }
}

async function changeConsultPage(page) {
  consultPage.value = page
  try {
    consultations.value = await loadConsultations()
    consultTotal.value = consultations.value.length
  } catch (error) {
    showNotice(error.message || '加载失败。')
  }
}

async function readSse(response, target) {
  await consumeSseStream(response, {
    async onMessage(data, rawText) {
      const delta = data.delta || data.content || data.answer || rawText || ''
      target.content += delta
      target.html = renderChatHtml(target.content).html
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
      html: item.role === 'assistant' ? renderChatHtml(item.content || '').html : '',
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
              <template v-if="item.role === 'assistant' && item.html">
                <div v-html="item.html" />
              </template>
              <template v-else>
                {{ item.content || '处理中…' }}
              </template>
            </article>
          </div>
          <form class="admin-chat-form" @submit.prevent="sendAdminMessage">
            <input v-model="adminMessage" aria-label="输入管理员助手指令" placeholder="例如：统计近一个月咨询糖尿病治疗方案的用户数量" />
            <button type="submit" :disabled="adminSending"><SendOutlined /></button>
          </form>
        </section>

        <section v-if="activeSection === 'articles'" class="admin-card">
          <h2>{{ editingArticleId ? '编辑文章' : '新增科普文章' }}</h2>
          <div class="form-grid">
            <input v-model="articleForm.title" aria-label="文章标题" placeholder="文章标题" />
            <input v-model="articleForm.summary" aria-label="文章摘要" placeholder="摘要" />
            <textarea v-model="articleForm.content" aria-label="文章正文" placeholder="正文（支持 Markdown）"></textarea>
            <div class="form-row">
              <div class="cover-upload">
                <input v-model="articleForm.cover_url" aria-label="封面图 URL" placeholder="封面图 URL" />
                <input type="file" accept="image/*" aria-label="上传封面图" style="display:none"
                  :ref="el => articleCoverInput = el" @change="handleArticleCoverUpload" />
                <button type="button" @click="articleCoverInput?.click()" class="upload-btn">📎</button>
                <img v-if="articleForm.cover_url && articleForm.cover_url.startsWith('http')" :src="articleForm.cover_url" class="cover-preview" />
              </div>
              <input v-model="articleForm.author" aria-label="作者" placeholder="作者（可选）" />
            </div>
            <div class="form-row">
              <select v-model="articleForm.status" aria-label="发布状态">
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="offline">已下线</option>
              </select>
              <select v-model="articleForm.audit_status" aria-label="审核状态">
                <option value="pending_review">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已驳回</option>
              </select>
              <input v-model.number="articleForm.recommend_weight" type="number" aria-label="推荐权重" placeholder="推荐权重" />
            </div>
            <div class="form-actions">
              <button v-if="editingArticleId" type="button" @click="updateArticle">保存修改</button>
              <button v-else type="button" @click="createArticle">创建文章</button>
              <button v-if="editingArticleId" type="button" class="btn-secondary" @click="resetArticleForm">取消编辑</button>
            </div>
          </div>

          <div class="search-bar">
            <input v-model="articleKeyword" aria-label="搜索文章" placeholder="搜索标题或摘要..." @keyup.enter="searchArticles" />
            <select v-model="articleStatusFilter" @change="searchArticles" aria-label="状态筛选">
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="offline">已下线</option>
            </select>
            <button type="button" @click="searchArticles">搜索</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>标题</th><th>状态</th><th>审核</th><th>阅读</th><th>更新时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="article in articles" :key="article.id">
                  <td class="article-title-cell">{{ article.title }}</td>
                  <td><span :class="'status-tag status-' + article.status">{{ article.status === 'draft' ? '草稿' : article.status === 'published' ? '已发布' : '已下线' }}</span></td>
                  <td>{{ article.audit_status === 'approved' ? '已通过' : article.audit_status === 'pending_review' ? '待审核' : '已驳回' }}</td>
                  <td>{{ article.view_count || 0 }}</td>
                  <td class="time-cell">{{ article.updated_at?.slice(0, 10) || '-' }}</td>
                  <td class="action-cell">
                    <button type="button" @click="editArticle(article)">编辑</button>
                    <button v-if="article.status !== 'published'" type="button" @click="publishArticle(article)">发布</button>
                    <button v-if="article.status === 'published'" type="button" @click="unpublishArticle(article)">下线</button>
                    <button type="button" class="btn-danger" @click="deleteArticle(article)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="articleTotal > articlePageSize" class="pagination">
              <button type="button" :disabled="articlePage <= 1" @click="changeArticlePage(articlePage - 1)">上一页</button>
              <span>第 {{ articlePage }} 页 / 共 {{ Math.ceil(articleTotal / articlePageSize) }} 页（{{ articleTotal }} 条）</span>
              <button type="button" :disabled="articlePage >= Math.ceil(articleTotal / articlePageSize)" @click="changeArticlePage(articlePage + 1)">下一页</button>
            </div>
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
            <div class="avatar-upload">
              <img v-if="doctorForm.avatar_url && doctorForm.avatar_url.startsWith('http')" :src="doctorForm.avatar_url" class="doctor-avatar-preview" />
              <input v-model="doctorForm.avatar_url" aria-label="头像 URL" placeholder="头像 URL" />
              <input type="file" accept="image/*" aria-label="上传头像" style="display:none"
                :ref="el => doctorAvatarInput = el" @change="handleDoctorAvatarUpload" />
              <button type="button" @click="doctorAvatarInput?.click()" class="upload-btn">📎</button>
            </div>
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
          <div class="search-bar">
            <input v-model="userKeyword" aria-label="搜索用户" placeholder="搜索用户名、手机号、邮箱或昵称..." @keyup.enter="searchUsers" />
            <select v-model="userStatusFilter" @change="searchUsers" aria-label="状态筛选">
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="disabled">已禁用</option>
              <option value="locked">已锁定</option>
            </select>
            <button type="button" @click="searchUsers">搜索</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>用户名</th><th>昵称</th><th>手机号</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td>{{ user.id }}</td>
                  <td>{{ user.username }}</td>
                  <td>{{ user.nickname || '-' }}</td>
                  <td>{{ user.phone || '-' }}</td>
                  <td>{{ user.role }}</td>
                  <td><span :class="'status-tag status-' + user.status">{{ user.status === 'active' ? '正常' : user.status === 'disabled' ? '已禁用' : '已锁定' }}</span></td>
                  <td class="time-cell">{{ user.last_login_at?.slice(0, 16) || '从未登录' }}</td>
                  <td><button type="button" @click="toggleUserStatus(user)">{{ user.status === 'active' ? '禁用' : '启用' }}</button></td>
                </tr>
              </tbody>
            </table>
            <div v-if="userTotal > userPageSize" class="pagination">
              <button type="button" :disabled="userPage <= 1" @click="changeUserPage(userPage - 1)">上一页</button>
              <span>第 {{ userPage }} 页 / 共 {{ Math.ceil(userTotal / userPageSize) }} 页（{{ userTotal }} 条）</span>
              <button type="button" :disabled="userPage >= Math.ceil(userTotal / userPageSize)" @click="changeUserPage(userPage + 1)">下一页</button>
            </div>
          </div>
        </section>

        <section v-if="activeSection === 'consultations'" class="admin-card">
          <h2>医生咨询工单</h2>
          <div class="search-bar">
            <input v-model="consultKeyword" aria-label="搜索工单" placeholder="搜索问题、用户名或医生..." @keyup.enter="searchConsultations" />
            <select v-model="consultStatusFilter" @change="searchConsultations" aria-label="状态筛选">
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="closed">已关闭</option>
            </select>
            <select v-model="consultDoctorFilter" @change="searchConsultations" aria-label="医生筛选">
              <option value="">全部医生</option>
              <option v-for="d in doctors" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
            <button type="button" @click="searchConsultations">搜索</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>用户</th><th>医生</th><th>问题</th><th>状态</th><th>时间</th></tr></thead>
              <tbody>
                <tr v-for="item in consultations" :key="item.id">
                  <td>{{ item.id }}</td>
                  <td>{{ item.username || item.user_id }}</td>
                  <td>{{ item.doctor_name || item.doctor_id || '-' }}</td>
                  <td class="article-title-cell">{{ item.title }}</td>
                  <td><span :class="'status-tag status-' + (item.status === 'active' ? 'published' : 'draft')">{{ item.status === 'active' ? '进行中' : '已关闭' }}</span></td>
                  <td class="time-cell">{{ item.updated_at?.slice(0, 16) || item.created_at?.slice(0, 16) || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="consultTotal > consultPageSize" class="pagination">
              <button type="button" :disabled="consultPage <= 1" @click="changeConsultPage(consultPage - 1)">上一页</button>
              <span>第 {{ consultPage }} 页 / 共 {{ Math.ceil(consultTotal / consultPageSize) }} 页（{{ consultTotal }} 条）</span>
              <button type="button" :disabled="consultPage >= Math.ceil(consultTotal / consultPageSize)" @click="changeConsultPage(consultPage + 1)">下一页</button>
            </div>
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
.admin-chat-log article { border-radius: 8px; padding: 8px 12px; background: #f2f5fa; font-size: 13px; line-height: 1.55; }
.admin-chat-log article.user { justify-self: end; max-width: 82%; color: #fff; background: #1677ff; }
.admin-chat-form { display: grid; grid-template-columns: minmax(0, 1fr) 42px; gap: 8px; }
.admin-chat-form button { display: grid; place-items: center; border-radius: 8px; color: #fff; background: #1677ff; font-size: 16px; }
.admin-chat-form button:disabled { opacity: 0.6; }

.admin-toast { position: fixed; right: 24px; bottom: 24px; border-radius: 8px; padding: 12px 14px; color: #ffffff; background: rgba(20, 32, 51, 0.94); }

.search-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.search-bar input {
  min-width: 0;
  flex: 1 1 140px;
  border: 1px solid #dfe6f0;
  border-radius: 7px;
  padding: 8px 11px;
  color: #182033;
  background: #fbfcfe;
  font: inherit;
  font-size: 13px;
}

.search-bar select {
  min-width: 0;
  flex: 0 0 auto;
  border: 1px solid #dfe6f0;
  border-radius: 7px;
  padding: 8px 10px;
  color: #182033;
  background: #fbfcfe;
  font: inherit;
  font-size: 13px;
}

.search-bar button {
  flex: 0 0 auto;
  border-radius: 7px;
  padding: 8px 14px;
  color: #ffffff;
  background: #1677ff;
  font-size: 12px;
  font-weight: 900;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 9px;
}

.form-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary {
  background: #6b7a90 !important;
}

.btn-danger {
  background: #e5484d !important;
}

.status-tag {
  display: inline-block;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 900;
}

.status-published,
.status-active {
  color: #0c7f3c;
  background: #e6f7ee;
}

.status-draft,
.status-disabled,
.status-locked,
.status-offline {
  color: #8b6914;
  background: #fff7e0;
}

.article-title-cell {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell {
  white-space: nowrap;
  font-size: 11px;
  color: #738196;
}

.action-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 12px;
  color: #607086;
}

.pagination button {
  padding: 6px 12px;
  font-size: 12px;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ---------- Chat Rich Text ---------- */
.admin-chat-log :deep(.chat-rich-content) {
  word-break: break-word;
}

.admin-chat-log :deep(.chat-answer) > :first-child { margin-top: 0; }
.admin-chat-log :deep(.chat-answer) > :last-child { margin-bottom: 0; }

.admin-chat-log :deep(p) { margin: 2px 0; }
.admin-chat-log :deep(ul),
.admin-chat-log :deep(ol) { padding-left: 18px; margin: 2px 0; }
.admin-chat-log :deep(pre) { margin: 4px 0; border-radius: 10px; padding: 8px; background: rgba(0,0,0,.04); font-size: 12px; overflow-x: auto; }

.admin-chat-log :deep(.chat-thinking) {
  border: 1px solid rgba(58,112,183,.18);
  border-radius: 14px;
  margin-bottom: 8px;
  background: linear-gradient(180deg, rgba(255,255,255,.8), rgba(235,242,252,.82));
}

.admin-chat-log :deep(.chat-thinking-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  list-style: none;
  cursor: pointer;
  padding: 10px 13px;
  color: #55708f;
  font-size: 11px;
  font-weight: 700;
}

.admin-chat-log :deep(.chat-thinking-title::-webkit-details-marker) {
  display: none;
}

.admin-chat-log :deep(.chat-thinking-title::after) {
  content: '展开';
  font-size: 10px;
  font-weight: 700;
}

.admin-chat-log :deep(.chat-thinking[open] .chat-thinking-title::after) {
  content: '收起';
}

.admin-chat-log :deep(.chat-thinking-body) {
  padding: 0 13px 10px;
}

.admin-chat-log :deep(.chat-thinking pre) {
  margin: 0 0 6px;
  border-radius: 10px;
  padding: 8px 10px;
  color: #51667f;
  background: rgba(77,114,162,.08);
  font-size: 11px;
  line-height: 1.5;
}
</style>
