<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  DashboardOutlined,
  FileTextOutlined,
  HeartOutlined,
  LineChartOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  ReadOutlined,
  RightOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
} from '@ant-design/icons-vue'
import LiquidTabBar from '../components/navigation/LiquidTabBar.vue'
import TopUserActions from '../components/navigation/TopUserActions.vue'
import { apiGet } from '../api/request'

const router = useRouter()

const activeTab = ref('home')
const toastText = ref('')
const homeSummary = ref(createEmptySummary())
const userInfo = ref(readStoredUser())
const authRefreshKey = ref(0)
const summaryLoading = ref(false)

let toastTimer = null

const isLoggedIn = computed(() => {
  authRefreshKey.value
  return Boolean(localStorage.getItem('diabetesAuthToken'))
})

const nickname = computed(() => {
  return (
    homeSummary.value.user?.nickname ||
    userInfo.value?.nickname ||
    userInfo.value?.username ||
    '同学'
  )
})

const greetingText = computed(() => {
  const hour = new Date().getHours()

  if (hour < 6) {
    return '夜深了'
  }

  if (hour < 11) {
    return '早上好'
  }

  if (hour < 14) {
    return '中午好'
  }

  if (hour < 18) {
    return '下午好'
  }

  return '晚上好'
})

const dateText = computed(() => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
})

const profileCompleted = computed(() => {
  return Boolean(homeSummary.value.profile?.completed)
})

const profileCompletionRate = computed(() => {
  return Number(homeSummary.value.profile?.completion_rate || 0)
})

const measurements = computed(() => {
  return homeSummary.value.today_measurements || {
    fasting_glucose: null,
    postprandial_glucose: null,
    weight_kg: null,
  }
})

const hasAnyMeasurement = computed(() => {
  return [
    measurements.value.fasting_glucose,
    measurements.value.postprandial_glucose,
    measurements.value.weight_kg,
  ].some((item) => {
    return item !== null && item !== undefined && item !== ''
  })
})

const serviceBase = [
  {
    id: 'archive',
    title: '健康档案',
    defaultSubtitle: '完善资料',
    icon: FileTextOutlined,
    color: 'blue',
  },
  {
    id: 'management',
    title: '健康管理',
    defaultSubtitle: '今日概览',
    icon: SafetyCertificateOutlined,
    color: 'green',
  },
  {
    id: 'plan',
    title: '生活方案',
    defaultSubtitle: '饮食运动',
    icon: CalendarOutlined,
    color: 'orange',
  },
  {
    id: 'messages',
    title: '消息中心',
    defaultSubtitle: '提醒通知',
    icon: BellOutlined,
    color: 'pink',
  },
  {
    id: 'news',
    title: '健康资讯',
    defaultSubtitle: '控糖知识',
    icon: ReadOutlined,
    color: 'cyan',
  },
  {
    id: 'favorites',
    title: '我的收藏',
    defaultSubtitle: '收藏内容',
    icon: StarOutlined,
    color: 'purple',
  },
  {
    id: 'doctor',
    title: '医生咨询',
    defaultSubtitle: '专业建议',
    icon: MedicineBoxOutlined,
    color: 'coral',
  },
  {
    id: 'assistant',
    title: '糖尿病助手',
    defaultSubtitle: '随时问问',
    icon: RobotOutlined,
    color: 'indigo',
  },
]

const taskConfig = {
  archive: {
    title: '完善健康档案',
    desc: '填写身高体重、家族史和筛查指标',
    tag: '约 2 分钟',
    action: '去完善',
    icon: FileTextOutlined,
    color: 'blue',
  },
  record: {
    title: '记录健康数据',
    desc: '记录血糖、体重或血压等身体数据',
    tag: '可选',
    action: '去记录',
    icon: LineChartOutlined,
    color: 'green',
  },
}

const fallbackArticles = [
  {
    id: 'food',
    category: '控糖饮食',
    title: '早餐怎么吃，才能让上午血糖更平稳？',
    summary: '主食、蛋白质和蔬菜搭配顺序很重要。',
    read_time: '3 分钟阅读',
  },
  {
    id: 'sport',
    category: '科学运动',
    title: '饭后散步 20 分钟，对血糖有什么帮助？',
    summary: '规律运动，比一次剧烈运动更重要。',
    read_time: '4 分钟阅读',
  },
  {
    id: 'check',
    category: '健康筛查',
    title: '除了血糖，这些指标也值得提前关注',
    summary: '腰围、体重、血压和家族史同样重要。',
    read_time: '5 分钟阅读',
  },
]

const quickServices = computed(() => {
  return serviceBase.map((service) => {
    if (service.id === 'archive') {
      return {
        ...service,
        subtitle: profileCompleted.value
          ? '档案已完成'
          : profileCompletionRate.value > 0
            ? `完成 ${profileCompletionRate.value}%`
            : '完善资料',
      }
    }

    if (service.id === 'record') {
      return {
        ...service,
        subtitle: hasAnyMeasurement.value ? '已有记录' : '血糖体重',
      }
    }

    return {
      ...service,
      subtitle: service.defaultSubtitle,
    }
  })
})

const todayTasks = computed(() => {
  const apiTasks = Array.isArray(homeSummary.value.today_tasks)
    ? homeSummary.value.today_tasks
    : []

  if (apiTasks.length > 0) {
    return apiTasks.map((task, index) => {
      const config = taskConfig[task.id] || taskConfig.archive

      return {
        id: task.id || `task-${index}`,
        title: task.title || config.title,
        desc: task.desc || config.desc,
        tag: task.tag || config.tag,
        action: task.action_label || config.action,
        icon: config.icon,
        color: config.color,
        completed: Boolean(task.completed),
      }
    })
  }

  return [
    {
      id: 'archive',
      ...taskConfig.archive,
      completed: profileCompleted.value,
    },
    {
      id: 'record',
      ...taskConfig.record,
      completed: hasAnyMeasurement.value,
    },
  ]
})

const taskProgress = computed(() => {
  const total = todayTasks.value.length
  const completed = todayTasks.value.filter((task) => task.completed).length

  return {
    total,
    completed,
  }
})

const progressPercent = computed(() => {
  if (!taskProgress.value.total) {
    return 0
  }

  return Math.round(
    (taskProgress.value.completed / taskProgress.value.total) * 100,
  )
})

const currentTask = computed(() => {
  const nextTask = todayTasks.value.find((task) => !task.completed)

  if (nextTask) {
    return nextTask
  }

  return {
    id: 'record',
    title: '今天的任务已完成',
    desc: '继续记录，让身体变化变得更清晰。',
    tag: '已完成',
    action: '去记录',
    icon: CheckCircleFilled,
    color: 'green',
    completed: true,
  }
})

const heroHint = computed(() => {
  if (!isLoggedIn.value) {
    return '登录后可以保存健康档案、评估结果和日常记录。'
  }

  if (!profileCompleted.value) {
    return '先告诉我一点基础情况，后面的建议才会真正贴合你。'
  }

  if (latestRisk.value?.score_status === 'incomplete') {
    return '还差几个关键指标，就能完成正式风险筛查。'
  }

  if (hasAnyMeasurement.value) {
    return '每一条真实记录，都能帮助你更了解身体。'
  }

  return '今天从一件小事开始，也是在认真照顾自己。'
})

const recordTitle = computed(() => {
  return hasAnyMeasurement.value
    ? '今天已经留下健康记录'
    : '今天的数据还在等你'
})

const recordHint = computed(() => {
  return hasAnyMeasurement.value
    ? '持续记录，趋势会慢慢变得清晰。'
    : '先完成健康档案，再从一项数据开始。'
})

const hotNews = computed(() => {
  const articles =
    Array.isArray(homeSummary.value.hot_articles) &&
    homeSummary.value.hot_articles.length > 0
      ? homeSummary.value.hot_articles
      : fallbackArticles

  return articles.map((article, index) => {
    const visual = getArticleVisual(article.category || article.tag, index)

    return {
      id: article.id || `article-${index}`,
      title: article.title || '健康资讯',
      desc: article.summary || article.desc || '健康知识内容可用于日常控糖参考。',
      tag: article.category || article.tag || '健康资讯',
      time: article.read_time || article.time || '3 分钟阅读',
      ...visual,
    }
  })
})

function createEmptySummary() {
  return {
    user: null,
    profile: {
      completed: false,
      completion_rate: 0,
    },
    latest_risk: null,
    today_measurements: {
      fasting_glucose: null,
      postprandial_glucose: null,
      weight_kg: null,
    },
    today_tasks: [],
    hot_articles: [],
  }
}

function normalizeSummary(data = {}) {
  const fallback = createEmptySummary()

  return {
    ...fallback,
    ...data,
    user: data.user || null,
    profile: {
      ...fallback.profile,
      ...(data.profile || {}),
    },
    today_measurements: {
      ...fallback.today_measurements,
      ...(data.today_measurements || {}),
    },
    today_tasks: Array.isArray(data.today_tasks)
      ? data.today_tasks
      : [],
    hot_articles: Array.isArray(data.hot_articles)
      ? data.hot_articles
      : [],
  }
}

function getArticleVisual(category, index) {
  if (String(category).includes('饮食')) {
    return {
      icon: HeartOutlined,
      color: 'orange',
    }
  }

  if (String(category).includes('运动')) {
    return {
      icon: LineChartOutlined,
      color: 'green',
    }
  }

  if (String(category).includes('筛查')) {
    return {
      icon: SafetyCertificateOutlined,
      color: 'purple',
    }
  }

  const options = [
    {
      icon: HeartOutlined,
      color: 'orange',
    },
    {
      icon: LineChartOutlined,
      color: 'green',
    },
    {
      icon: SafetyCertificateOutlined,
      color: 'purple',
    },
  ]

  return options[index % options.length]
}

function formatMetric(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const number = Number(value)

  return Number.isFinite(number) ? String(number) : String(value)
}

function readStoredUser() {
  try {
    const rawUser = localStorage.getItem('diabetesAuthUser')

    return rawUser ? JSON.parse(rawUser) : null
  } catch {
    return null
  }
}

function showToast(text) {
  toastText.value = text

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    toastText.value = ''
  }, 2400)
}

function handleMoreServices() {
  router.push({ name: 'health' })
}

function handleNewsModule() {
  router.push({ name: 'news' })
}

function requireLogin(message) {
  if (isLoggedIn.value) {
    return false
  }

  showToast(message)
  return true
}

async function loadHomeSummary({ silent = false } = {}) {
  if (!isLoggedIn.value) {
    homeSummary.value = createEmptySummary()
    return
  }

  summaryLoading.value = true

  try {
    const response = await apiGet('/api/home/summary')

    homeSummary.value = normalizeSummary(response.data)

    if (response.data?.user) {
      userInfo.value = response.data.user
    }
  } catch {
    homeSummary.value = createEmptySummary()

    if (!silent) {
      showToast('首页数据暂未同步，已展示默认内容。')
    }
  } finally {
    summaryLoading.value = false
  }
}

function handleAuthChanged(event) {
  authRefreshKey.value += 1
  userInfo.value = event.detail?.user || readStoredUser()

  if (isLoggedIn.value) {
    loadHomeSummary({
      silent: true,
    })
    return
  }

  homeSummary.value = createEmptySummary()
}

function handleLogin() {
  router.push('/login')
}

function handleService(serviceId) {
  if (serviceId === 'assistant') {
    if (requireLogin('糖尿病助手需要登录后使用。')) {
      return
    }
    router.push({ name: 'assistant' })
    return
  }

  if (serviceId === 'news') {
    router.push({ name: 'news' })
    return
  }

  if (requireLogin('请先登录后再使用完整健康管理功能。')) {
    return
  }

  const routeMap = {
    archive: 'healthArchive',
    management: 'health',
    plan: 'plan',
    messages: 'messages',
    favorites: 'favorites',
    doctor: 'doctorConsult',
  }

  if (routeMap[serviceId]) {
    router.push({ name: routeMap[serviceId] })
    return
  }

  router.push({ name: 'health' })
}

function handleAssistant() {
  if (requireLogin('糖尿病助手需要登录后使用。')) {
    return
  }

  router.push({ name: 'assistant' })
}

function handleNews(news) {
  router.push({
    name: 'news',
    query: {
      article: news.id,
    },
  })
}

function handleTabChange(key) {
  activeTab.value = key

  if (key === 'home') {
    return
  }

  if (key === 'health') {
    router.push({
      name: 'health',
    })
    return
  }

  if (['plan', 'news', 'profile'].includes(key)) {
    router.push({ name: key })
    return
  }

  if (requireLogin('登录后可以使用完整糖尿病预治功能。')) {
    window.setTimeout(() => {
      activeTab.value = 'home'
    }, 520)

    return
  }

  activeTab.value = 'home'
}

onMounted(() => {
  window.addEventListener('diabetes:auth-changed', handleAuthChanged)
  loadHomeSummary()
})

onBeforeUnmount(() => {
  window.removeEventListener('diabetes:auth-changed', handleAuthChanged)

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
})
</script>

<template>
  <main class="home-page">
    <section class="home-phone">
      <div class="home-scroll">
        <header class="hero-area">
          <div class="hero-art" aria-hidden="true">
            <span class="hero-sun">
              <i></i>
            </span>

            <span class="hero-tide"></span>
            <span class="hero-petal"></span>
            <span class="hero-grid"></span>
            <span class="hero-spark spark-one"></span>
            <span class="hero-spark spark-two"></span>
            <span class="hero-spark spark-three"></span>
          </div>

          <div class="hero-top">
            <div>
              <p>{{ dateText }}</p>
              <h1>{{ greetingText }}，{{ nickname }}</h1>
            </div>

            <TopUserActions light />
          </div>

          <div class="hero-main">
            <div class="hero-copy">
<h2>今天，先把身体<br />照顾好。</h2>

              <p>{{ heroHint }}</p>
            </div>

            <div
              class="hero-meter"
              :style="{
                '--meter-progress': `${Math.max(progressPercent, 8)}%`,
              }"
              aria-label="今日完成进度"
            >
              <span class="meter-sweep"></span>
              <span class="meter-orbit orbit-one"></span>
              <span class="meter-orbit orbit-two"></span>
              <span class="meter-dot dot-one"></span>
              <span class="meter-dot dot-two"></span>

              <div class="meter-content">
                <strong>{{ taskProgress.completed }}</strong>
                <small>/ {{ taskProgress.total }}</small>
                <em>今日完成</em>
              </div>
            </div>
          </div>

          <div class="hero-actions-row">
            <button type="button" @click="handleService('record')">
              <LineChartOutlined />
              <span>记录</span>
            </button>

            <button type="button" @click="handleService('plan')">
              <CalendarOutlined />
              <span>计划</span>
            </button>

            <button type="button" @click="handleAssistant">
              <MessageOutlined />
              <span>助手</span>
            </button>
          </div>
        </header>

        <section class="priority-card">
          <div class="priority-head">
            <span>今日优先事项</span>
            <small>{{ summaryLoading ? '同步中' : currentTask.tag }}</small>
          </div>

          <div class="priority-main">
            <span class="priority-icon" :class="currentTask.color">
              <component :is="currentTask.icon" />
            </span>

            <div class="priority-copy">
              <h2>{{ currentTask.title }}</h2>
              <p>{{ currentTask.desc }}</p>
            </div>

            <button type="button" @click="handleService(currentTask.id)">
              <RightOutlined />
            </button>
          </div>

          <div class="priority-progress">
            <span>今日完成 {{ taskProgress.completed }} / {{ taskProgress.total }}</span>

            <div class="progress-track">
              <i :style="{ width: `${progressPercent}%` }"></i>
            </div>
          </div>
        </section>

        <section class="service-section">
          <div class="section-header">
            <div>
              <span class="section-marker marker-blue"></span>
              <h2>健康服务</h2>
            </div>

            <button type="button" @click="handleMoreServices">
              全部
              <RightOutlined />
            </button>
          </div>

          <div class="service-grid">
            <button
              v-for="service in quickServices"
              :key="service.id"
              class="service-item"
              :class="service.color"
              type="button"
              @click="handleService(service.id)"
            >
              <span class="service-icon">
                <component :is="service.icon" />
              </span>

              <strong>{{ service.title }}</strong>
              <small>{{ service.subtitle }}</small>
            </button>
          </div>
        </section>

        <section class="record-card">
          <span class="record-label">今日记录</span>

          <div class="record-head">
            <div>
              <h2>{{ recordTitle }}</h2>
              <p>{{ recordHint }}</p>
            </div>

            <button type="button" @click="handleService('record')">
              去记录
              <RightOutlined />
            </button>
          </div>

          <div class="metric-grid">
            <div class="metric-item fasting">
              <span><HeartOutlined /></span>
              <small>空腹血糖</small>
              <strong>{{ formatMetric(measurements.fasting_glucose) }}</strong>
              <em>mmol/L</em>
            </div>

            <div class="metric-item post">
              <span><LineChartOutlined /></span>
              <small>餐后血糖</small>
              <strong>{{ formatMetric(measurements.postprandial_glucose) }}</strong>
              <em>mmol/L</em>
            </div>

            <div class="metric-item weight">
              <span><DashboardOutlined /></span>
              <small>体重</small>
              <strong>{{ formatMetric(measurements.weight_kg) }}</strong>
              <em>kg</em>
            </div>
          </div>
        </section>

        <section class="task-card">
          <div class="section-header">
            <div>
              <span class="section-marker marker-green"></span>
              <h2>今天适合做</h2>
            </div>

            <span class="task-total">
              {{ taskProgress.completed }} / {{ taskProgress.total }}
            </span>
          </div>

          <div class="task-list">
            <button
              v-for="task in todayTasks"
              :key="task.id"
              class="task-item"
              :class="{ completed: task.completed }"
              type="button"
              @click="handleService(task.id)"
            >
              <span class="task-icon" :class="task.color">
                <CheckCircleFilled v-if="task.completed" />
                <component v-else :is="task.icon" />
              </span>

              <span class="task-copy">
                <strong>
                  {{ task.completed ? `${task.title} · 已完成` : task.title }}
                </strong>
                <small>{{ task.desc }}</small>
              </span>

              <em>{{ task.completed ? '已完成' : task.tag }}</em>
              <RightOutlined />
            </button>
          </div>
        </section>

        <section class="assistant-card">
          <button type="button" @click="handleAssistant">
            <span class="assistant-orb">
              <RobotOutlined />
            </span>

            <span class="assistant-copy">
              <small>糖尿病助手</small>
              <strong>有点拿不准？问问我</strong>
              <em>饮食、血糖、运动和风险解释都可以聊。</em>
            </span>

            <RightOutlined />
          </button>
        </section>

        <section class="news-section">
          <div class="section-header">
            <div>
              <span class="section-marker marker-orange"></span>
              <h2>热点资讯</h2>
            </div>

            <button type="button" @click="handleNewsModule">
              更多
              <RightOutlined />
            </button>
          </div>

          <div class="news-list">
            <button
              v-for="news in hotNews"
              :key="news.id"
              class="news-item"
              type="button"
              @click="handleNews(news)"
            >
              <span class="news-icon" :class="news.color">
                <component :is="news.icon" />
              </span>

              <span class="news-copy">
                <em>{{ news.tag }}</em>
                <strong>{{ news.title }}</strong>
                <small>{{ news.desc }}</small>
                <span>{{ news.time }}</span>
              </span>

              <RightOutlined />
            </button>
          </div>
        </section>
      </div>

      <LiquidTabBar
        :active-key="activeTab"
        @change="handleTabChange"
      />

      <transition name="toast">
        <div v-if="toastText" class="home-toast">
          <span></span>
          <p>{{ toastText }}</p>
        </div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 13% 6%, rgba(255, 255, 255, 0.84), transparent 25%),
    linear-gradient(135deg, #dceaff 0%, #c7ddfb 100%);
}

.home-phone {
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fa;
  box-shadow: 0 0 48px rgba(28, 69, 136, 0.16);
}

.home-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: 24px;
  scrollbar-width: none;
}

.home-scroll::-webkit-scrollbar {
  display: none;
}

.hero-area {
  position: relative;
  min-height: 184px;
  overflow: hidden;
  padding: 18px 20px 15px;
  color: #ffffff;
  background:
    radial-gradient(circle at 100% 0%, rgba(110, 245, 210, 0.32), transparent 36%),
    linear-gradient(124deg, #104ab8 0%, #1677f7 53%, #1e9cdd 100%);
  background-size: 130% 130%;
  animation: hero-background-flow 9s ease-in-out infinite;
}

.hero-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.hero-sun {
  position: absolute;
  top: -48px;
  right: -39px;
  width: 130px;
  height: 130px;
  overflow: hidden;
  border-radius: 50%;
  background: #ffd65c;
  box-shadow: 0 0 34px rgba(255, 214, 92, 0.26);
  animation: hero-sun-drift 7s ease-in-out infinite;
}

.hero-sun i {
  position: absolute;
  top: 17px;
  left: 14px;
  width: 36px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.36);
  filter: blur(1px);
  animation: hero-sun-shine 3.4s ease-in-out infinite;
}

.hero-tide {
  position: absolute;
  right: -63px;
  bottom: -70px;
  width: 184px;
  height: 140px;
  border-radius: 58% 42% 0 0;
  background: #41dbc1;
  opacity: 0.93;
  transform: rotate(-18deg);
  animation: hero-tide-drift 8s ease-in-out infinite;
}

.hero-petal {
  position: absolute;
  top: 101px;
  right: 103px;
  width: 27px;
  height: 35px;
  border-radius: 9px 19px 11px 19px;
  background: #ff8cb2;
  box-shadow: 0 8px 18px rgba(255, 104, 160, 0.24);
  transform: rotate(28deg);
  animation: hero-petal-float 4.6s ease-in-out infinite;
}

.hero-grid {
  position: absolute;
  right: 31px;
  bottom: 19px;
  width: 77px;
  height: 48px;
  opacity: 0.46;
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.92) 1px,
    transparent 1px
  );
  background-size: 9px 9px;
  animation: hero-grid-shift 6s ease-in-out infinite;
}

.hero-spark {
  position: absolute;
  display: block;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
}

.spark-one {
  top: 105px;
  right: 47px;
  width: 7px;
  height: 7px;
  animation: hero-spark-pulse 2.4s ease-in-out infinite;
}

.spark-two {
  right: 142px;
  bottom: 41px;
  width: 5px;
  height: 5px;
  animation: hero-spark-pulse 2.4s ease-in-out -0.9s infinite;
}

.spark-three {
  top: 70px;
  right: 82px;
  width: 4px;
  height: 4px;
  animation: hero-spark-pulse 2.4s ease-in-out -1.6s infinite;
}

.hero-top,
.hero-main,
.hero-actions-row {
  position: relative;
  z-index: 2;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.hero-top p {
  margin: 0;
  color: rgba(239, 248, 255, 0.84);
  font-size: 10px;
  font-weight: 700;
}

.hero-top h1 {
  margin: 6px 0 0;
  color: #ffffff;
  font-size: 22px;
  letter-spacing: 0;
}

.hero-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 13px;
}

.hero-copy {
  width: 62%;
}


.hero-copy h2 {
  margin: 0;
  color: #ffffff;
  font-size: 20px;
  line-height: 1.16;
  letter-spacing: 0;
}

.hero-copy p {
  max-width: 232px;
  margin: 7px 0 0;
  color: rgba(238, 248, 255, 0.92);
  font-size: 9px;
  line-height: 1.52;
}

.hero-meter {
  position: relative;
  display: grid;
  width: 68px;
  height: 68px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background:
    conic-gradient(
      from -90deg,
      #8bffe0 0 var(--meter-progress),
      rgba(255, 255, 255, 0.22) var(--meter-progress) 100%
    );
  box-shadow:
    0 0 0 7px rgba(255, 255, 255, 0.06),
    0 9px 20px rgba(6, 54, 137, 0.2);
  animation: hero-meter-breathe 3.2s ease-in-out infinite;
}

.hero-meter::before {
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.22), transparent 25%),
    rgba(10, 96, 195, 0.78);
  content: "";
}

.meter-content {
  position: relative;
  z-index: 3;
  display: flex;
  width: 100%;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.meter-content strong {
  margin-left: 2px;
  color: #ffffff;
  font-size: 23px;
  line-height: 1;
}

.meter-content small {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.87);
  font-size: 9px;
}

.meter-content em {
  width: 100%;
  margin-top: -5px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 8px;
  font-style: normal;
  text-align: center;
}

.meter-sweep {
  position: absolute;
  z-index: 4;
  inset: -8px;
  border-top: 1px solid rgba(255, 255, 255, 0.72);
  border-right: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  animation: meter-sweep-rotate 5s linear infinite;
}

.meter-orbit {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 50%;
}

.orbit-one {
  inset: -9px;
  animation: meter-orbit-breathe 3s ease-in-out infinite;
}

.orbit-two {
  inset: -18px;
  opacity: 0.45;
  animation: meter-orbit-breathe 3s ease-in-out -1.4s infinite;
}

.meter-dot {
  position: absolute;
  z-index: 5;
  display: block;
  border-radius: 50%;
  background: #b6ffe9;
  box-shadow: 0 0 0 4px rgba(182, 255, 233, 0.18);
}

.meter-dot.dot-one {
  top: -6px;
  right: 8px;
  width: 7px;
  height: 7px;
  animation: meter-dot-float 2.8s ease-in-out infinite;
}

.meter-dot.dot-two {
  bottom: 3px;
  left: -7px;
  width: 5px;
  height: 5px;
  animation: meter-dot-float 2.8s ease-in-out -1.2s infinite;
}

.hero-actions-row {
  display: flex;
  gap: 18px;
  margin-top: 12px;
}

.hero-actions-row button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  padding: 0;
  color: rgba(255, 255, 255, 0.98);
  background: transparent;
  cursor: pointer;
  font-size: 9px;
}

.hero-actions-row button :deep(svg) {
  font-size: 16px;
}

.hero-actions-row button:nth-child(1) :deep(svg) {
  color: #ffffff;
}

.hero-actions-row button:nth-child(2) :deep(svg) {
  color: #a9ffe6;
}

.hero-actions-row button:nth-child(3) :deep(svg) {
  color: #f5c8ff;
}

.priority-card {
  position: relative;
  z-index: 4;
  margin: -13px 16px 0;
  padding: 13px 15px 11px;
  border-radius: 15px;
  background: #ffffff;
  box-shadow: 0 9px 20px rgba(25, 78, 157, 0.14);
}

.priority-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.priority-head > span {
  color: #2278ed;
  font-size: 10px;
  font-weight: 800;
}

.priority-head small {
  color: #94a2b1;
  font-size: 9px;
}

.priority-main {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 10px;
}

.priority-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px 12px 12px 5px;
  font-size: 20px;
}

.priority-icon.blue {
  color: #1677ff;
  background: #eaf3ff;
}

.priority-icon.purple {
  color: #8959e8;
  background: #f0e9ff;
}

.priority-icon.green {
  color: #10ab83;
  background: #e3f8ef;
}

.priority-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.priority-copy h2 {
  overflow: hidden;
  margin: 0;
  color: #2b405a;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-copy p {
  overflow: hidden;
  margin: 4px 0 0;
  color: #95a3b2;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-main > button {
  display: grid;
  width: 35px;
  height: 35px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #50a3ff);
  box-shadow: 0 7px 13px rgba(22, 119, 255, 0.24);
  cursor: pointer;
  font-size: 13px;
}

.priority-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 11px;
}

.priority-progress > span {
  color: #7f91a8;
  font-size: 9px;
  white-space: nowrap;
}

.progress-track {
  position: relative;
  height: 4px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: #eaf0f7;
}

.progress-track i {
  position: relative;
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1677ff, #54d4b8);
  transition: width 0.25s ease;
}

.progress-track i::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -28px;
  width: 18px;
  background: rgba(255, 255, 255, 0.75);
  content: "";
  filter: blur(2px);
  transform: skewX(-22deg);
  animation: progress-shimmer 2.6s ease-in-out infinite;
}

.service-section,
.task-card,
.news-section {
  margin: 24px 20px 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h2 {
  margin: 0;
  color: #2b3d54;
  font-size: 17px;
  letter-spacing: 0;
}

.section-marker {
  display: block;
  width: 4px;
  height: 18px;
  border-radius: 4px;
}

.marker-blue {
  background: #1677ff;
}

.marker-green {
  background: #14b888;
}

.marker-orange {
  background: #f59a23;
}

.section-header button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  padding: 0;
  color: #7c8ea4;
  background: transparent;
  cursor: pointer;
  font-size: 10px;
}

.section-header button :deep(svg) {
  font-size: 10px;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: 21px;
  margin-top: 17px;
}

.service-item {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.service-icon {
  display: grid;
  width: 40px;
  height: 39px;
  place-items: center;
  font-size: 33px;
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.service-item:active .service-icon {
  transform: translateY(-3px) scale(1.07);
}

.service-item.blue .service-icon {
  color: #1677ff;
}

.service-item.purple .service-icon {
  color: #925be8;
}

.service-item.green .service-icon {
  color: #12b886;
}

.service-item.orange .service-icon {
  color: #f6921f;
}

.service-item.pink .service-icon {
  color: #f35aab;
}

.service-item.cyan .service-icon {
  color: #12bfc4;
}

.service-item.coral .service-icon {
  color: #ff704e;
}

.service-item.indigo .service-icon {
  color: #5b68dc;
}

.service-item strong {
  width: 100%;
  overflow: hidden;
  margin-top: 7px;
  color: #344960;
  font-size: 10px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-item small {
  width: 100%;
  overflow: hidden;
  margin-top: 4px;
  color: #98a5b5;
  font-size: 8px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-card,
.task-card {
  position: relative;
  margin-right: 20px;
  margin-left: 20px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(45, 76, 119, 0.05);
}

.record-card {
  margin-top: 27px;
  padding: 40px 15px 15px;
  border-radius: 15px;
}

.record-label {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 15px 0 12px 0;
  padding: 7px 15px;
  color: #ffffff;
  background: linear-gradient(135deg, #1f8bff, #1677ff);
  font-size: 10px;
  font-weight: 800;
}

.record-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
}

.record-head h2 {
  margin: 0;
  color: #2a405b;
  font-size: 17px;
}

.record-head p {
  margin: 7px 0 0;
  color: #95a3b2;
  font-size: 9px;
}

.record-head button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  padding: 0;
  color: #1677ff;
  background: transparent;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

.record-head button :deep(svg) {
  font-size: 10px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 16px;
  border-top: 1px solid #edf0f4;
  border-bottom: 1px solid #edf0f4;
}

.metric-item {
  min-width: 0;
  padding: 12px 9px;
}

.metric-item + .metric-item {
  border-left: 1px solid #edf0f4;
}

.metric-item > span {
  display: block;
  font-size: 19px;
}

.metric-item.fasting > span {
  color: #1677ff;
}

.metric-item.post > span {
  color: #15b789;
}

.metric-item.weight > span {
  color: #f3921f;
}

.metric-item small {
  display: block;
  margin-top: 8px;
  color: #8798ae;
  font-size: 8px;
}

.metric-item strong {
  display: block;
  margin-top: 7px;
  color: #30465f;
  font-size: 20px;
  line-height: 1;
}

.metric-item em {
  display: block;
  margin-top: 5px;
  color: #a0adbb;
  font-size: 8px;
  font-style: normal;
}

.task-card {
  margin-top: 23px;
  border-radius: 15px;
  padding: 16px 15px 4px;
}

.task-total {
  color: #7f94a7;
  font-size: 10px;
  font-weight: 700;
}

.task-list {
  margin-top: 13px;
  border-top: 1px solid #edf0f4;
}

.task-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  border: 0;
  border-bottom: 1px solid #edf0f4;
  padding: 12px 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.task-item:last-child {
  border-bottom: 0;
}

.task-icon {
  display: grid;
  width: 31px;
  height: 31px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  font-size: 16px;
}

.task-icon.blue {
  background: #1677ff;
}

.task-icon.purple {
  background: #905be8;
}

.task-icon.green {
  background: #14b888;
}

.task-item.completed .task-icon {
  color: #14aa7e;
  background: #e4f8ef;
}

.task-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.task-copy strong {
  overflow: hidden;
  color: #354960;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-copy small {
  overflow: hidden;
  margin-top: 4px;
  color: #95a2b2;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item em {
  color: #8b9caf;
  font-size: 8px;
  font-style: normal;
  white-space: nowrap;
}

.task-item > :deep(svg) {
  color: #92a1b4;
  font-size: 10px;
}

.assistant-card {
  margin: 19px 20px 0;
}

.assistant-card button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 11px;
  overflow: hidden;
  border: 0;
  border-left: 4px solid #ffbd28;
  border-radius: 13px;
  padding: 13px 14px;
  color: #ffffff;
  background:
    radial-gradient(circle at 90% 17%, rgba(255, 126, 174, 0.62), transparent 18%),
    radial-gradient(circle at 84% 93%, rgba(84, 235, 205, 0.5), transparent 20%),
    linear-gradient(125deg, #4d50bc 0%, #6966dc 55%, #277ee8 100%);
  box-shadow: 0 9px 19px rgba(68, 83, 192, 0.18);
  cursor: pointer;
  text-align: left;
}

.assistant-orb {
  display: grid;
  width: 39px;
  height: 39px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50% 50% 12px 50%;
  background: rgba(255, 255, 255, 0.2);
  font-size: 21px;
}

.assistant-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.assistant-copy small {
  color: rgba(237, 241, 255, 0.84);
  font-size: 8px;
  font-weight: 700;
}

.assistant-copy strong {
  margin-top: 4px;
  color: #ffffff;
  font-size: 12px;
}

.assistant-copy em {
  overflow: hidden;
  margin-top: 4px;
  color: rgba(237, 241, 255, 0.87);
  font-size: 8px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-card button > :deep(svg) {
  font-size: 12px;
}

.news-list {
  margin-top: 13px;
  overflow: hidden;
  border-radius: 15px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(45, 76, 119, 0.05);
}

.news-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 11px;
  border: 0;
  border-bottom: 1px solid #edf0f4;
  padding: 13px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.news-item:last-child {
  border-bottom: 0;
}

.news-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 11px 11px 11px 4px;
  font-size: 20px;
}

.news-icon.orange {
  color: #f28b16;
  background: #fff1dc;
}

.news-icon.green {
  color: #10a879;
  background: #e3f8ee;
}

.news-icon.purple {
  color: #8a58e6;
  background: #f0e8ff;
}

.news-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.news-copy em {
  color: #66809f;
  font-size: 8px;
  font-style: normal;
}

.news-copy strong {
  overflow: hidden;
  margin-top: 4px;
  color: #354960;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-copy small {
  overflow: hidden;
  margin-top: 4px;
  color: #96a3b2;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-copy span {
  margin-top: 5px;
  color: #a2afbc;
  font-size: 8px;
}

.news-item > :deep(svg) {
  color: #91a1b4;
  font-size: 10px;
}

.home-toast {
  position: absolute;
  z-index: 50;
  right: 20px;
  bottom: 76px;
  left: 20px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border-radius: 12px;
  padding: 11px 13px;
  color: #ffffff;
  background: rgba(29, 46, 75, 0.95);
  box-shadow: 0 12px 22px rgba(30, 47, 75, 0.2);
}

.home-toast > span {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  margin-top: 5px;
  border-radius: 50%;
  background: #57dcc0;
}

.home-toast p {
  margin: 0;
  font-size: 10px;
  line-height: 1.5;
}

.hero-actions-row button:active,
.priority-main > button:active,
.service-item:active,
.record-head button:active,
.task-item:active,
.assistant-card button:active,
.news-item:active,
.section-header button:active {
  transform: scale(0.95);
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
  transform: translateY(10px);
}

@keyframes hero-background-flow {
  0%,
  100% {
    background-position: 0% 45%;
  }

  50% {
    background-position: 100% 55%;
  }
}

@keyframes hero-sun-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(-5px, 5px, 0) scale(1.04);
  }
}

@keyframes hero-sun-shine {
  0%,
  100% {
    opacity: 0.46;
    transform: translateX(0);
  }

  50% {
    opacity: 0.9;
    transform: translateX(10px);
  }
}

@keyframes hero-tide-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(-18deg);
  }

  50% {
    transform: translate3d(-8px, -6px, 0) rotate(-13deg);
  }
}

@keyframes hero-petal-float {
  0%,
  100% {
    transform: translateY(0) rotate(28deg);
  }

  50% {
    transform: translateY(-7px) rotate(39deg);
  }
}

@keyframes hero-grid-shift {
  0%,
  100% {
    opacity: 0.28;
    transform: translateX(0);
  }

  50% {
    opacity: 0.62;
    transform: translateX(-6px);
  }
}

@keyframes hero-spark-pulse {
  0%,
  100% {
    opacity: 0.36;
    transform: scale(0.75);
  }

  50% {
    opacity: 1;
    transform: scale(1.22);
  }
}

@keyframes notification-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 121, 109, 0.34);
  }

  50% {
    box-shadow: 0 0 0 4px rgba(255, 121, 109, 0);
  }
}


@keyframes hero-meter-breathe {
  0%,
  100% {
    transform: scale(0.97);
  }

  50% {
    transform: scale(1.03);
  }
}

@keyframes meter-sweep-rotate {
  to {
    transform: rotate(360deg);
  }
}

@keyframes meter-orbit-breathe {
  0%,
  100% {
    opacity: 0.22;
    transform: scale(0.93);
  }

  50% {
    opacity: 0.72;
    transform: scale(1.07);
  }
}

@keyframes meter-dot-float {
  0%,
  100% {
    opacity: 0.42;
    transform: translateY(0);
  }

  50% {
    opacity: 1;
    transform: translateY(-5px);
  }
}

@keyframes progress-shimmer {
  0% {
    left: -28px;
  }

  100% {
    left: calc(100% + 12px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-area,
  .hero-sun,
  .hero-sun i,
  .hero-tide,
  .hero-petal,
  .hero-grid,
  .hero-spark,
  .hero-meter,
  .meter-sweep,
  .meter-orbit,
  .meter-dot,
  .progress-track i::after {
    animation: none;
  }
}

@media (max-width: 430px) {
  .home-phone {
    box-shadow: none;
  }
}

@media (max-width: 360px) {
  .hero-area {
    padding-right: 16px;
    padding-left: 16px;
  }

  .priority-card {
    margin-right: 13px;
    margin-left: 13px;
  }

  .service-section,
  .record-card,
  .task-card,
  .assistant-card,
  .news-section {
    margin-right: 16px;
    margin-left: 16px;
  }

  .hero-top h1 {
    font-size: 20px;
  }

  .hero-copy h2 {
    font-size: 18px;
  }

  .hero-meter {
    width: 62px;
    height: 62px;
  }

  .service-grid {
    row-gap: 19px;
  }

  .metric-item {
    padding-right: 7px;
    padding-left: 7px;
  }
}
</style>
