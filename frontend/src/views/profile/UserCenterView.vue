<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CalendarOutlined,
  FileTextOutlined,
  HeartOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  ReadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons-vue'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'
import { apiGet, clearAuthSession, getStoredUser } from '../../api/request'

const router = useRouter()
const user = ref(getStoredUser())
const profile = ref(null)
const toastText = ref('')

const displayName = computed(() => {
  return user.value?.nickname || user.value?.username || '未登录'
})

const completion = computed(() => {
  return profile.value?.completion_rate || profile.value?.profile?.completion_rate || 0
})

const accountRows = [
  {
    title: '健康档案',
    desc: '糖尿病相关指标和管理资料',
    icon: FileTextOutlined,
    tone: 'blue',
    route: 'healthArchive',
  },
  {
    title: '我的收藏',
    desc: '收藏的控糖文章和复查内容',
    icon: StarOutlined,
    tone: 'orange',
    route: 'favorites',
  },
]

const healthRows = [
  {
    title: '生活方案',
    desc: '饮食、运动、睡眠任务',
    icon: CalendarOutlined,
    tone: 'orange',
    route: 'plan',
  },
  {
    title: '医生咨询',
    desc: '先整理问题，再去咨询',
    icon: MedicineBoxOutlined,
    tone: 'red',
    route: 'doctorConsult',
  },
  {
    title: '健康助手',
    desc: '饮食、血糖、风险都能问',
    icon: HeartOutlined,
    tone: 'blue',
    route: 'assistant',
  },
]

function showToast(text) {
  toastText.value = text

  window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

async function loadData() {
  const [meResponse, profileResponse] = await Promise.allSettled([
    apiGet('/api/auth/me'),
    apiGet('/api/profile'),
  ])

  if (meResponse.status === 'fulfilled') {
    user.value = meResponse.value.data?.user || meResponse.value.data || user.value
  }

  if (profileResponse.status === 'fulfilled') {
    profile.value = profileResponse.value.data
  }
}

function go(route, query = undefined) {
  router.push({
    name: route,
    query,
  })
}

function logout() {
  clearAuthSession()
  showToast('已退出登录。')
  router.push({
    name: 'login',
  })
}

function handleTabChange(key) {
  router.push({
    name: key,
  })
}

onMounted(loadData)
</script>

<template>
  <main class="profile-page">
    <section class="profile-phone">
      <div class="profile-scroll">
        <header class="profile-hero">
          <button
            class="profile-user"
            type="button"
            @click="go('personalInfo')"
          >
            <div class="avatar-tile">
              <span>{{ displayName.slice(0, 1) }}</span>
            </div>

            <div class="user-copy">
              <h1>{{ displayName }}</h1>
              <p>健康号：diafit_{{ completion || 0 }}</p>
            </div>

            <RightOutlined class="edit-arrow" />
          </button>
        </header>

        <section class="profile-card stack-card merged-list">
          <button
            v-for="row in accountRows"
            :key="row.title"
            type="button"
            class="profile-row"
            @click="go(row.route, row.query)"
          >
            <span class="row-icon" :class="row.tone">
              <component :is="row.icon" />
            </span>

            <span class="row-copy">
              <strong>{{ row.title }}</strong>
              <small>{{ row.desc }}</small>
            </span>

            <em v-if="row.title === '健康档案'">
              {{ completion }}%
            </em>

            <RightOutlined />
          </button>

          <button
            v-for="row in healthRows"
            :key="row.title"
            type="button"
            class="profile-row"
            @click="go(row.route, row.query)"
          >
            <span class="row-icon" :class="row.tone">
              <component :is="row.icon" />
            </span>

            <span class="row-copy">
              <strong>{{ row.title }}</strong>
              <small>{{ row.desc }}</small>
            </span>

            <RightOutlined />
          </button>

          <button
            type="button"
            class="profile-row"
            @click="go('news')"
          >
            <span class="row-icon red">
              <ReadOutlined />
            </span>

            <span class="row-copy">
              <strong>健康资讯</strong>
              <small>阅读控糖和复查内容</small>
            </span>

            <RightOutlined />
          </button>

          <button
            type="button"
            class="profile-row account-row"
            @click="go('privacySettings')"
          >
            <span class="row-icon blue">
              <SafetyCertificateOutlined />
            </span>

            <span class="row-copy">
              <strong>账号与隐私设置</strong>
              <small>账号安全、消息提醒和健康数据使用偏好</small>
            </span>

            <RightOutlined />
          </button>

          <button
            type="button"
            class="profile-row"
            @click="go('dataAuthorization')"
          >
            <span class="row-icon slate">
              <SettingOutlined />
            </span>

            <span class="row-copy">
              <strong>数据授权管理</strong>
              <small>查看或撤回智能分析与个性化建议授权</small>
            </span>

            <RightOutlined />
          </button>
        </section>

        <button
          class="logout-row"
          type="button"
          @click="logout"
        >
          <LogoutOutlined />
          退出登录
        </button>
      </div>

      <LiquidTabBar
        active-key="profile"
        @change="handleTabChange"
      />

      <transition name="toast">
        <div
          v-if="toastText"
          class="app-toast"
          role="status"
          aria-live="polite"
        >
          {{ toastText }}
        </div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.profile-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f1f2f4;
}

.profile-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 0 28px;
  scrollbar-width: none;
}

.profile-scroll::-webkit-scrollbar {
  display: none;
}

.profile-hero {
  padding: 62px 20px 34px;
  background: #ffffff;
}

.profile-user {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 16px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.avatar-tile {
  display: grid;
  width: 74px;
  height: 74px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.18), rgba(0, 184, 148, 0.18)),
    #eef6ff;
}

.avatar-tile span {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  color: #1677ff;
  background: #ffffff;
  font-size: 23px;
  font-weight: 900;
}

.user-copy {
  min-width: 0;
  flex: 1;
}

.user-copy h1 {
  margin: 0;
  color: #1f2329;
  font-size: 20px;
  font-weight: 900;
}

.user-copy p {
  overflow: hidden;
  margin: 7px 0 0;
  color: #7f7f86;
  font-size: 14px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-user > svg {
  color: #b7bcc4;
  font-size: 18px;
}

.profile-card {
  margin-top: 10px;
  border-radius: 0;
  background: #ffffff;
  box-shadow: none;
}

.stack-card {
  overflow: hidden;
}

.profile-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 13px;
  border-bottom: 1px solid #edf1f5;
  padding: 12px 20px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.profile-row:last-child {
  border-bottom: 0;
}

.account-row {
  margin-top: 0;
  border-top: 10px solid #f1f2f4;
}

.row-icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 0;
  color: #1677ff;
  background: transparent;
  font-size: 21px;
}

.blue {
  color: #1677ff;
  background: #eef5ff;
}

.orange {
  color: #f06b00;
  background: #fff3e2;
}

.red {
  color: #f04438;
  background: #fff0ef;
}

.slate {
  color: #475467;
  background: #f2f4f7;
}

.row-copy {
  min-width: 0;
  flex: 1;
}

.row-copy strong {
  display: block;
  color: #2d333c;
  font-size: 14px;
  font-weight: 900;
}

.row-copy small {
  display: block;
  overflow: hidden;
  margin-top: 4px;
  color: #99a1ab;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-row em {
  color: #9aa1aa;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.profile-row > svg {
  color: #c3c9d1;
}

.logout-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  border-top: 1px solid #edf1f5;
  border-radius: 0;
  padding: 13px 20px;
  color: #ff4d4f;
  background: #ffffff;
  font-size: 13px;
  font-weight: 900;
}

.app-toast {
  position: absolute;
  z-index: 80;
  right: 50%;
  bottom: calc(78px + env(safe-area-inset-bottom));
  max-width: calc(100% - 48px);
  border-radius: 999px;
  padding: 10px 15px;
  color: #ffffff;
  background: rgba(19, 37, 66, 0.92);
  box-shadow: 0 10px 24px rgba(20, 36, 65, 0.16);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.35;
  transform: translateX(50%);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(50%, 10px);
}
</style>