<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileTextOutlined,
  FundOutlined,
  MedicineBoxOutlined,
  ReadOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import LiquidTabBar from '../components/navigation/LiquidTabBar.vue'
import TopUserActions from '../components/navigation/TopUserActions.vue'
import { apiGet, hasAuthSession } from '../api/request'

const router = useRouter()

const summary = ref(createEmptySummary())
const doctors = ref([])
const loading = ref(true)
const toastText = ref('')

let toastTimer = null

const latestRisk = computed(() => {
  return summary.value.latest_risk || null
})

const riskInfo = computed(() => {
  const risk = latestRisk.value

  if (!risk) {
    return {
      score: '待评估',
      unit: '',
      tag: '待评估',
      tagType: 'primary',
      note: '填写健康档案后，即可生成风险评分。',
    }
  }

  if (risk.score_status === 'processing') {
    return {
      score: '分析中',
      unit: '',
      tag: '分析中',
      tagType: 'warning',
      note: '系统正在整理本次健康风险结果。',
    }
  }

  if (risk.score_status === 'incomplete') {
    return {
      score: '待补全',
      unit: '',
      tag: '待补全',
      tagType: 'warning',
      note: '补充关键健康信息后，即可完成预测。',
    }
  }

  if (risk.score_status === 'diagnosed') {
    return {
      score: '已确诊',
      unit: '',
      tag: '持续管理',
      tagType: 'warning',
      note: '建议持续记录血糖、饮食、运动和复查情况。',
    }
  }

  if (risk.score_status === 'not_applicable') {
    return {
      score: '暂不适用',
      unit: '',
      tag: '暂不适用',
      tagType: 'primary',
      note: '当前年龄或健康状态暂不适用风险评分。',
    }
  }

  const score = Number(risk.score)
  const level = String(risk.risk_level || '').toLowerCase()

  const riskLevelMap = {
    high: {
      tag: '风险偏高',
      tagType: 'danger',
      note: '建议重点关注饮食、体重、血压和复查管理。',
    },
    medium: {
      tag: '中等风险',
      tagType: 'warning',
      note: '建议保持规律监测并持续改善生活习惯。',
    },
    low: {
      tag: '风险较低',
      tagType: 'success',
      note: '当前状态相对平稳，继续保持健康管理习惯。',
    },
  }

  const levelInfo = riskLevelMap[level] || {
    tag: '已完成评估',
    tagType: 'primary',
    note: '已生成风险结果，可继续完善健康档案。',
  }

  return {
    score: Number.isFinite(score) ? score : '待评估',
    unit: Number.isFinite(score) ? '分' : '',
    tag: levelInfo.tag,
    tagType: levelInfo.tagType,
    note: levelInfo.note,
  }
})

const hasRiskScore = computed(() => {
  return typeof riskInfo.value.score === 'number'
})

const taskList = computed(() => {
  const tasks = Array.isArray(summary.value.today_tasks)
    ? summary.value.today_tasks
    : []

  return tasks.slice(0, 3)
})

const doctorList = computed(() => {
  const recommended = Array.isArray(summary.value.recommended_doctors)
    ? summary.value.recommended_doctors
    : []

  const source = recommended.length ? recommended : doctors.value

  return source.slice(0, 6)
})

const articleList = computed(() => {
  const items = Array.isArray(summary.value.hot_articles)
    ? summary.value.hot_articles
    : []

  return items.slice(0, 3)
})

const diabetesTypes = computed(() => {
  const items = Array.isArray(summary.value.diabetes_types)
    ? summary.value.diabetes_types
    : Array.isArray(summary.value.diabetesTypes)
      ? summary.value.diabetesTypes
      : []

  return items.slice(0, 4)
})

function createEmptySummary() {
  return {
    user: null,
    profile: {
      completion_rate: 0,
      completed: false,
    },
    latest_risk: null,
    today_tasks: [],
    hot_articles: [],
    recommended_doctors: [],
    diabetes_types: [],
  }
}

function showToast(text) {
  toastText.value = text

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

function initials(name) {
  return String(name || '医').slice(0, 1)
}

function requireLogin(text) {
  if (hasAuthSession()) {
    return false
  }

  showToast(text)

  return true
}

async function loadData() {
  loading.value = true

  const [homeResult, doctorResult] = await Promise.allSettled([
    apiGet('/api/home/summary'),
    apiGet('/api/doctors'),
  ])

  if (homeResult.status === 'fulfilled') {
    summary.value = {
      ...createEmptySummary(),
      ...(homeResult.value.data || {}),
    }
  } else {
    summary.value = createEmptySummary()
  }

  if (doctorResult.status === 'fulfilled') {
    const responseData = doctorResult.value.data

    doctors.value = Array.isArray(responseData)
      ? responseData
      : responseData?.items || []
  } else {
    doctors.value = []
  }

  loading.value = false
}

function go(route, query = undefined) {
  router.push({
    name: route,
    query,
  })
}

function goArchive() {
  go('healthArchive')
}

function goRiskPredict() {
  go('health')
}

function openTask(task) {
  if (task.id === 'archive') {
    go('healthArchive')
    return
  }

  if (task.id === 'plan') {
    go('plan')
    return
  }

  if (task.id === 'risk') {
    go('health')
    return
  }

  go('plan')
}

function openDoctor(doctor) {
  if (requireLogin('请先登录后再咨询医生。')) {
    return
  }

  go('doctorConsult', {
    doctor: doctor.id,
  })
}

function openArticle(article) {
  go('news', {
    article: article.id,
  })
}

function taskIcon(task) {
  if (task.id === 'archive') {
    return FileTextOutlined
  }

  if (task.id === 'plan') {
    return CalendarOutlined
  }

  if (task.id === 'risk') {
    return FundOutlined
  }

  return ClockCircleOutlined
}

function taskTone(task) {
  if (task.id === 'archive') {
    return 'blue'
  }

  if (task.id === 'plan') {
    return 'orange'
  }

  if (task.id === 'risk') {
    return 'purple'
  }

  return 'green'
}

function typeTone(index) {
  const tones = ['blue', 'green', 'orange', 'purple']

  return tones[index % tones.length]
}

function handleTabChange(key) {
  if (key === 'home') {
    return
  }

  go(key)
}

onMounted(loadData)

onBeforeUnmount(() => {
  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
})
</script>

<template>
  <main class="home-shell">
    <section class="home-phone">
      <div class="home-scroll">
        <header class="home-header">
          <h1>健康</h1>

          <TopUserActions />
        </header>

        <van-skeleton
          :loading="loading"
          title
          :row="10"
          class="home-skeleton"
        >
          <section class="risk-summary">
            <header class="risk-summary-head">
              <div>
                <p>糖尿病健康</p>
                <h2>风险预测</h2>
              </div>

              <van-tag
                round
                :type="riskInfo.tagType"
                class="risk-tag"
              >
                {{ riskInfo.tag }}
              </van-tag>
            </header>

            <div class="risk-score">
              <strong :class="{ placeholder: !hasRiskScore }">
                {{ riskInfo.score }}
              </strong>

              <span v-if="riskInfo.unit">
                {{ riskInfo.unit }}
              </span>
            </div>

            <p class="risk-note">
              {{ riskInfo.note }}
            </p>

            <div class="risk-actions">
              <van-button
                type="primary"
                class="risk-primary"
                @click="goArchive"
              >
                <FileTextOutlined />
                填写档案
              </van-button>

              <van-button
                plain
                type="primary"
                class="risk-secondary"
                @click="goRiskPredict"
              >
                <FundOutlined />
                开始预测
              </van-button>
            </div>
          </section>

          <section class="home-section doctor-section">
            <header class="section-heading">
              <div>
                <p>在线咨询</p>
                <h2>专业医师团队</h2>
              </div>

              <button
                type="button"
                class="section-link"
                @click="go('doctorConsult')"
              >
                查看全部
                <RightOutlined />
              </button>
            </header>

            <div
              v-if="doctorList.length"
              class="doctor-scroll"
            >
              <button
                v-for="doctor in doctorList"
                :key="doctor.id"
                type="button"
                class="doctor-card"
                @click="openDoctor(doctor)"
              >
                <span
                  class="doctor-avatar"
                  :style="doctor.avatar_url ? { backgroundImage: `url(${doctor.avatar_url})` } : {}"
                >
                  <b v-if="!doctor.avatar_url">
                    {{ initials(doctor.name) }}
                  </b>
                </span>

                <span class="doctor-copy">
                  <strong>{{ doctor.name }}</strong>
                  <small>{{ doctor.title || '专业医生' }}</small>
                  <em>{{ doctor.department || '内分泌科' }}</em>
                </span>

                <span class="doctor-consult">
                  去咨询
                  <RightOutlined />
                </span>
              </button>
            </div>

            <div
              v-else
              class="data-empty"
            >
              <MedicineBoxOutlined />
              <span>暂未配置可咨询医生</span>
            </div>
          </section>

          <section class="home-section">
            <header class="section-heading">
              <div>
                <p>今日管理</p>
                <h2>接下来可以做什么</h2>
              </div>

              <button
                type="button"
                class="section-link"
                @click="go('plan')"
              >
                查看计划
                <RightOutlined />
              </button>
            </header>

            <van-cell-group
              inset
              class="task-group"
              :border="false"
            >
              <template v-if="taskList.length">
                <van-cell
                  v-for="task in taskList"
                  :key="task.id"
                  clickable
                  center
                  @click="openTask(task)"
                >
                  <template #icon>
                    <span
                      class="task-icon"
                      :class="taskTone(task)"
                    >
                      <component :is="taskIcon(task)" />
                    </span>
                  </template>

                  <template #title>
                    <span class="task-title">{{ task.title }}</span>
                  </template>

                  <template #label>
                    <span class="task-desc">{{ task.desc }}</span>
                  </template>

                  <template #value>
                    <span class="task-tag">
                      {{ task.tag || task.action_label || '去完成' }}
                    </span>
                  </template>

                  <template #right-icon>
                    <RightOutlined class="cell-arrow" />
                  </template>
                </van-cell>
              </template>

              <div
                v-else
                class="task-empty"
              >
                <CheckCircleFilled />
                <span>暂无待处理健康任务</span>
              </div>
            </van-cell-group>
          </section>

          <section class="home-section">
            <header class="section-heading">
              <div>
                <p>健康内容</p>
                <h2>健康科普</h2>
              </div>

              <button
                type="button"
                class="section-link"
                @click="go('news')"
              >
                更多
                <RightOutlined />
              </button>
            </header>

            <van-cell-group
              v-if="articleList.length"
              inset
              class="article-group"
              :border="false"
            >
              <van-cell
                v-for="article in articleList"
                :key="article.id"
                clickable
                center
                @click="openArticle(article)"
              >
                <template #icon>
                  <span class="article-icon">
                    <ReadOutlined />
                  </span>
                </template>

                <template #title>
                  <span class="article-title">
                    {{ article.title }}
                  </span>
                </template>

                <template #label>
                  <span class="article-desc">
                    {{ article.summary || '点击查看控糖管理相关内容' }}
                  </span>
                </template>

                <template #right-icon>
                  <RightOutlined class="cell-arrow" />
                </template>
              </van-cell>
            </van-cell-group>

            <div
              v-else
              class="data-empty"
            >
              <ReadOutlined />
              <span>暂无健康科普内容</span>
            </div>
          </section>

          <section class="home-section type-section">
            <header class="section-heading">
              <div>
                <p>基础知识</p>
                <h2>糖尿病类型</h2>
              </div>
            </header>

            <div
              v-if="diabetesTypes.length"
              class="type-scroll"
            >
              <article
                v-for="(item, index) in diabetesTypes"
                :key="item.id || item.name"
                class="type-card"
              >
                <span
                  class="type-icon"
                  :class="typeTone(index)"
                >
                  <TeamOutlined />
                </span>

                <strong>{{ item.name || '糖尿病类型' }}</strong>

                <p>
                  {{
                    item.pathogenesis
                      || item.clinical_features
                      || '了解对应的健康管理重点。'
                  }}
                </p>
              </article>
            </div>

            <div
              v-else
              class="data-empty"
            >
              <TeamOutlined />
              <span>暂无糖尿病类型说明</span>
            </div>
          </section>
        </van-skeleton>
      </div>

      <LiquidTabBar
        active-key="home"
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
.home-shell {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.home-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f6f8fc;
  box-shadow: 0 0 36px rgba(47, 87, 144, 0.1);
}

.home-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px 30px;
  scrollbar-width: none;
}

.home-scroll::-webkit-scrollbar,
.doctor-scroll::-webkit-scrollbar,
.type-scroll::-webkit-scrollbar {
  display: none;
}

.home-header {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
}

.home-header h1 {
  margin: 0;
  color: #17243a;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.8px;
}

.home-skeleton {
  margin-top: 20px;
}

.risk-summary {
  border-bottom: 1px solid #dfe7f1;
  padding: 0 0 24px;
}

.risk-summary-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.risk-summary-head p {
  margin: 0;
  color: #7d90a8;
  font-size: 11px;
  font-weight: 700;
}

.risk-summary-head h2 {
  margin: 5px 0 0;
  color: #1c2d45;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.risk-tag {
  margin-bottom: 3px;
  border: 0;
  font-size: 10px;
  font-weight: 800;
}

.risk-score {
  display: flex;
  align-items: baseline;
  margin-top: 20px;
}

.risk-score strong {
  color: #1677ff;
  font-size: 74px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -4px;
  line-height: 0.9;
}

.risk-score strong.placeholder {
  color: #1c2d45;
  font-size: 34px;
  letter-spacing: -1px;
}

.risk-score span {
  margin-left: 7px;
  color: #607994;
  font-size: 15px;
  font-weight: 800;
}

.risk-note {
  max-width: 280px;
  margin: 11px 0 0;
  color: #7488a0;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.55;
}

.risk-actions {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 10px;
  margin-top: 20px;
}

.risk-actions :deep(.van-button) {
  height: 42px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
}

.risk-actions :deep(.van-button__content) {
  gap: 6px;
}

.risk-primary {
  box-shadow: 0 8px 16px rgba(22, 119, 255, 0.18);
}

.risk-secondary {
  background: transparent;
}

.home-section {
  margin-top: 27px;
}

.doctor-section {
  margin-top: 25px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.section-heading p {
  margin: 0;
  color: #8394ab;
  font-size: 10px;
  font-weight: 700;
}

.section-heading h2 {
  margin: 5px 0 0;
  color: #1a2d47;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.4px;
  line-height: 1.25;
}

.section-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #1677ff;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
}

.section-link svg {
  font-size: 13px;
}

.doctor-scroll,
.type-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin: 13px -18px 0;
  padding: 0 18px 4px;
  scrollbar-width: none;
}

.doctor-card {
  display: grid;
  width: 158px;
  min-width: 158px;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  border-radius: 14px;
  padding: 12px;
  color: #17243a;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(40, 66, 102, 0.06);
  cursor: pointer;
  text-align: left;
}

.doctor-avatar {
  display: grid;
  width: 42px;
  height: 42px;
  grid-row: span 2;
  place-items: center;
  border-radius: 50%;
  color: #1677ff;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.48), transparent 45%),
    #dcecff;
  background-position: center;
  background-size: cover;
  font-size: 16px;
  font-weight: 800;
}

.doctor-copy {
  min-width: 0;
}

.doctor-copy strong,
.doctor-copy small,
.doctor-copy em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doctor-copy strong {
  color: #25364d;
  font-size: 12px;
  font-weight: 800;
}

.doctor-copy small {
  margin-top: 3px;
  color: #8999aa;
  font-size: 9px;
  font-weight: 700;
}

.doctor-copy em {
  margin-top: 4px;
  color: #1677ff;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
}

.doctor-consult {
  display: inline-flex;
  grid-column: 2;
  align-items: center;
  gap: 1px;
  color: #1677ff;
  font-size: 9px;
  font-weight: 800;
}

.doctor-consult svg {
  font-size: 10px;
}

.task-group,
.article-group {
  overflow: hidden;
  margin: 13px 0 0;
  border-radius: 15px;
  box-shadow: 0 6px 16px rgba(40, 66, 102, 0.06);
}

.task-group :deep(.van-cell),
.article-group :deep(.van-cell) {
  min-height: 67px;
  align-items: center;
  padding: 12px 13px;
}

.task-group :deep(.van-cell::after),
.article-group :deep(.van-cell::after) {
  right: 13px;
  left: 13px;
  border-color: #edf1f5;
}

.task-icon,
.article-icon {
  display: grid;
  width: 32px;
  height: 32px;
  margin-right: 10px;
  place-items: center;
  border-radius: 10px;
  font-size: 17px;
}

.task-icon.blue,
.article-icon {
  color: #1677ff;
  background: #eaf3ff;
}

.task-icon.orange {
  color: #f06b00;
  background: #fff2df;
}

.task-icon.purple {
  color: #6f42ff;
  background: #f0ecff;
}

.task-icon.green {
  color: #00a870;
  background: #e6f8f0;
}

.task-title,
.article-title {
  display: block;
  overflow: hidden;
  color: #25364d;
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-desc,
.article-desc {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: #8b9aab;
  font-size: 9px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-tag {
  display: inline-block;
  max-width: 60px;
  overflow: hidden;
  color: #1677ff;
  font-size: 9px;
  font-weight: 800;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-arrow {
  margin-left: 4px;
  color: #b9c3d0;
  font-size: 13px;
}

.task-empty,
.data-empty {
  display: flex;
  min-height: 78px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 13px;
  border-radius: 15px;
  color: #91a1b4;
  background: rgba(255, 255, 255, 0.78);
  font-size: 11px;
  font-weight: 700;
}

.task-empty {
  min-height: 70px;
  margin-top: 0;
  border-radius: 0;
  background: #ffffff;
}

.task-empty svg {
  color: #00a870;
  font-size: 16px;
}

.data-empty svg {
  color: #a3b5ca;
  font-size: 18px;
}

.type-card {
  display: flex;
  width: 138px;
  min-width: 138px;
  flex-direction: column;
  border-radius: 14px;
  padding: 13px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(40, 66, 102, 0.06);
}

.type-icon {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border-radius: 10px;
  font-size: 16px;
}

.type-icon.blue {
  color: #1677ff;
  background: #eaf3ff;
}

.type-icon.green {
  color: #00a870;
  background: #e6f8f0;
}

.type-icon.orange {
  color: #f06b00;
  background: #fff2df;
}

.type-icon.purple {
  color: #6f42ff;
  background: #f0ecff;
}

.type-card strong {
  display: block;
  overflow: hidden;
  margin-top: 11px;
  color: #25364d;
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-card p {
  display: -webkit-box;
  overflow: hidden;
  margin: 6px 0 0;
  color: #8b9aab;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.app-toast {
  position: absolute;
  z-index: 80;
  right: 50%;
  bottom: calc(76px + env(safe-area-inset-bottom));
  max-width: calc(100% - 48px);
  border-radius: 999px;
  padding: 10px 15px;
  color: #ffffff;
  background: rgba(20, 32, 51, 0.94);
  box-shadow: 0 14px 24px rgba(20, 32, 51, 0.2);
  font-size: 10px;
  font-weight: 800;
  line-height: 1.5;
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

@media (max-width: 430px) {
  .home-phone {
    max-width: none;
    box-shadow: none;
  }
}

@media (max-width: 360px) {
  .home-scroll {
    padding-right: 14px;
    padding-left: 14px;
  }

  .doctor-scroll,
  .type-scroll {
    margin-right: -14px;
    margin-left: -14px;
    padding-right: 14px;
    padding-left: 14px;
  }

  .home-header h1 {
    font-size: 22px;
  }

  .risk-summary-head h2 {
    font-size: 20px;
  }

  .risk-score strong {
    font-size: 62px;
  }

  .risk-score strong.placeholder {
    font-size: 30px;
  }

  .risk-actions {
    gap: 8px;
  }

  .risk-actions :deep(.van-button) {
    font-size: 11px;
  }
}
</style>