<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BarChartOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPost, apiPut, getStoredUser, hasAuthSession } from '../../api/request'

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
const articleForm = ref({
  title: '糖尿病患者的饮食指南',
  summary: '控制碳水化合物摄入，选择低糖水果，保持规律饮食。',
  content: '后台录入的科普正文，可在用户端健康资讯展示。',
  status: 'draft',
  audit_status: 'approved',
})

const navItems = [
  { key: 'overview', label: '数据概览', icon: BarChartOutlined },
  { key: 'articles', label: '资讯管理', icon: FileTextOutlined },
  { key: 'doctors', label: '医生管理', icon: MedicineBoxOutlined },
  { key: 'users', label: '用户管理', icon: TeamOutlined },
  { key: 'consultations', label: '咨询工单', icon: MessageOutlined },
]

const currentUser = computed(() => getStoredUser())
const isAdmin = computed(() => ['admin', 'super_admin'].includes(currentUser.value?.role))

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

onMounted(loadAdminData)
</script>

<template>
  <main class="admin-page">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <span></span>
        <strong>AI智能管理平台</strong>
      </div>
      <button
        v-for="item in navItems"
        :key="item.key"
        type="button"
        :class="{ active: activeSection === item.key }"
        @click="activeSection = item.key"
      >
        <component :is="item.icon" />
        {{ item.label }}
      </button>
      <button class="back-home" type="button" @click="router.push({ name: 'home' })">返回用户端</button>
    </aside>

    <section class="admin-main">
      <header class="admin-top">
        <div>
          <h1>{{ navItems.find((item) => item.key === activeSection)?.label }}</h1>
          <p>{{ currentUser?.username || 'admin' }} · 管理员</p>
        </div>
        <button type="button" @click="loadAdminData">{{ loading ? '同步中' : '刷新数据' }}</button>
      </header>

      <section v-if="activeSection === 'overview'" class="panel-grid">
        <article class="stat-card">
          <span>用户数</span>
          <strong>{{ dashboard?.users || users.length }}</strong>
        </article>
        <article class="stat-card">
          <span>文章数</span>
          <strong>{{ dashboard?.articles || articles.length }}</strong>
        </article>
        <article class="stat-card">
          <span>医生数</span>
          <strong>{{ dashboard?.doctors || doctors.length }}</strong>
        </article>
        <article class="stat-card">
          <span>咨询工单</span>
          <strong>{{ dashboard?.consultations || consultations.length }}</strong>
        </article>
        <section class="wide-card">
          <h2>Dify运行日志</h2>
          <table>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td>{{ log.app_code || log.app_type }}</td>
                <td>{{ log.status }}</td>
                <td>{{ log.created_at }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      <section v-if="activeSection === 'articles'" class="admin-card">
        <h2>新增科普文章</h2>
        <div class="form-grid">
          <input v-model="articleForm.title" aria-label="文章标题" placeholder="文章标题" />
          <input v-model="articleForm.summary" aria-label="文章摘要" placeholder="摘要" />
          <textarea v-model="articleForm.content" aria-label="文章正文" placeholder="正文"></textarea>
          <button type="button" @click="createArticle">创建文章</button>
        </div>
        <table>
          <thead>
            <tr><th>标题</th><th>状态</th><th>阅读</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="article in articles" :key="article.id">
              <td>{{ article.title }}</td>
              <td>{{ article.status }}</td>
              <td>{{ article.view_count || 0 }}</td>
              <td><button type="button" @click="publishArticle(article)">发布</button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="activeSection === 'doctors'" class="admin-card">
        <h2>医生资料</h2>
        <p class="help-text">头像更新方式：在医生资料的 <code>avatar_url</code> 填入图片 URL；为空时用户端显示姓氏占位头像。</p>
        <table>
          <thead>
            <tr><th>医生</th><th>职称</th><th>科室</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="doctor in doctors" :key="doctor.id">
              <td>{{ doctor.name }}</td>
              <td>{{ doctor.title }}</td>
              <td>{{ doctor.department }}</td>
              <td>{{ doctor.display_status }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="activeSection === 'users'" class="admin-card">
        <h2>用户管理</h2>
        <table>
          <thead>
            <tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>操作</th></tr>
          </thead>
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
      </section>

      <section v-if="activeSection === 'consultations'" class="admin-card">
        <h2>医生咨询工单</h2>
        <table>
          <thead>
            <tr><th>ID</th><th>用户</th><th>医生</th><th>问题</th><th>状态</th></tr>
          </thead>
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
      </section>
    </section>

    <transition name="toast">
      <div v-if="notice" class="admin-toast">{{ notice }}</div>
    </transition>
  </main>
</template>

<style scoped>
.admin-page {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 236px minmax(0, 1fr);
  color: #182033;
  background: #f4f6fa;
}

.admin-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid #e4e9f2;
  padding: 22px 16px;
  background: #ffffff;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.admin-brand span {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1d74ff, #20c4ff);
}

.admin-brand strong {
  font-size: 16px;
  font-weight: 900;
}

.admin-sidebar button {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  padding: 11px 12px;
  color: #607086;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  text-align: left;
}

.admin-sidebar button.active {
  color: #116dff;
  background: #edf5ff;
}

.back-home {
  margin-top: auto;
}

.admin-main {
  min-width: 0;
  padding: 24px;
}

.admin-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.admin-top h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
}

.admin-top p {
  margin: 6px 0 0;
  color: #738196;
  font-size: 13px;
}

.admin-top button,
.form-grid button,
td button {
  border-radius: 7px;
  padding: 9px 12px;
  color: #ffffff;
  background: #1677ff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-card,
.wide-card,
.admin-card {
  border-radius: 8px;
  padding: 18px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(28, 55, 95, 0.06);
}

.stat-card span {
  color: #738196;
  font-size: 13px;
  font-weight: 800;
}

.stat-card strong {
  display: block;
  margin-top: 12px;
  font-size: 30px;
  font-weight: 900;
}

.wide-card {
  grid-column: 1 / -1;
}

.wide-card h2,
.admin-card h2 {
  margin: 0 0 14px;
  font-size: 17px;
  font-weight: 900;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) 120px;
  gap: 10px;
  margin-bottom: 16px;
}

.form-grid textarea {
  grid-column: 1 / 3;
  min-height: 78px;
  resize: vertical;
}

.form-grid input,
.form-grid textarea {
  border: 1px solid #dfe6f0;
  border-radius: 7px;
  padding: 10px 11px;
  color: #182033;
  background: #fbfcfe;
  font: inherit;
}

.help-text {
  margin: -4px 0 14px;
  color: #66758c;
  font-size: 13px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  border-bottom: 1px solid #edf1f6;
  padding: 11px 10px;
  text-align: left;
}

th {
  color: #718096;
  font-weight: 900;
}

td {
  color: #233149;
}

td button {
  padding: 6px 9px;
  font-size: 12px;
}

.admin-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  border-radius: 8px;
  padding: 12px 14px;
  color: #ffffff;
  background: rgba(20, 32, 51, 0.94);
}

@media (max-width: 760px) {
  .admin-page {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    flex-direction: row;
    overflow-x: auto;
  }

  .admin-brand {
    min-width: 170px;
    margin: 0;
  }

  .admin-sidebar button {
    min-width: max-content;
  }

  .panel-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-grid textarea {
    grid-column: auto;
  }
}
</style>
