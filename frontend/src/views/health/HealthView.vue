<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  FileProtectOutlined,
  HeartFilled,
  LeftOutlined,
  LineChartOutlined,
  MedicineBoxOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPost, hasAuthSession, pollWorkflowRun } from '../../api/request'

const router = useRouter()

const toastText = ref('')
const loading = ref(false)
const assessing = ref(false)
const authRefreshKey = ref(0)
const userInfo = ref(readStoredUser())
const profilePayload = ref(createEmptyProfilePayload())
const riskPayload = ref(null)

let toastTimer = null

const isLoggedIn = computed(() => {
  authRefreshKey.value
  return hasAuthSession()
})

const profile = computed(() => {
  return profilePayload.value.profile || profilePayload.value || {}
})

const latestMeasurements = computed(() => {
  const payload = profilePayload.value

  return payload.latest_measurements
    || payload.today_measurements
    || payload.measurements
    || {
      fasting_glucose: profile.value.fasting_glucose,
      postprandial_glucose: profile.value.postprandial_glucose,
      weight_kg: profile.value.weight_kg,
      sbp_mm_hg: profile.value.sbp_mm_hg || profile.value.systolic_bp,
    }
})

const latestRisk = computed(() => {
  return riskPayload.value || profilePayload.value.latest_risk || null
})

const displayName = computed(() => {
  return userInfo.value?.nickname || userInfo.value?.username || '同学'
})

const todayText = computed(() => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
})

const profileRate = computed(() => {
  if (profile.value.completed) {
    return 100
  }

  return clampNumber(
    profile.value.completion_rate || profile.value.completionRate || 0,
    0,
    100,
  )
})

const bodyMetrics = computed(() => {
  const height = numberOrNull(profile.value.height_cm)
  const weight = numberOrNull(
    profile.value.weight_kg || latestMeasurements.value.weight_kg,
  )
  const bmi = numberOrNull(profile.value.bmi) || calcBmi(height, weight)
  const waist = numberOrNull(profile.value.waist_cm)
  const sbp = numberOrNull(
    profile.value.sbp_mm_hg
    || profile.value.systolic_bp
    || latestMeasurements.value.sbp_mm_hg,
  )

  return {
    bmi,
    waist,
    sbp,
  }
})

const scoreCard = computed(() => {
  const risk = latestRisk.value

  if (!risk) {
    return {
      score: '--',
      label: '待评估',
      desc: '先把健康档案补齐，系统会按已填信息给出预测分数。',
      rate: Math.max(12, profileRate.value),
      tone: 'blue',
      action: '填写档案',
    }
  }

  if (risk.score_status === 'diagnosed') {
    return {
      score: '管理',
      label: '已确诊',
      desc: '当前重点是复查、记录、生活方案和医生沟通。',
      rate: 100,
      tone: 'green',
      action: '查看档案',
    }
  }

  if (risk.score_status === 'incomplete') {
    return {
      score: '--',
      label: '资料不足',
      desc: formatMissingFields(risk.missing_fields),
      rate: Math.max(35, profileRate.value),
      tone: 'orange',
      action: '继续填写',
    }
  }

  const score = Number(risk.score)
  const high = risk.risk_level === 'high' || risk.is_high_risk

  return {
    score: Number.isFinite(score) ? String(score) : '--',
    label: high ? '偏高' : '较稳',
    desc: high
      ? '建议优先完善档案、规律记录指标，并生成每日方案。'
      : '继续保持记录节奏，定期复查关键指标。',
    rate: Number.isFinite(score)
      ? clampNumber(Math.round((score / 51) * 100), 8, 100)
      : 60,
    tone: high ? 'orange' : 'green',
    action: high ? '生成方案' : '填写档案',
  }
})

const healthAdvice = computed(() => {
  const risk = latestRisk.value
  if (!risk || !risk.advice || risk.score_status === 'processing') return null
  const a = risk.advice
  if (!a.summary && !a.diet?.length && !a.exercise?.length && !a.review?.length) return null
  return a
})

const metricTiles = computed(() => {
  const fasting = numberOrNull(latestMeasurements.value.fasting_glucose)
  const post = numberOrNull(latestMeasurements.value.postprandial_glucose)
  const { bmi, waist, sbp } = bodyMetrics.value

  return [
    {
      key: 'bmi',
      label: 'BMI',
      value: formatValue(bmi, 1),
      unit: '',
      desc: getBmiStatus(bmi),
      tone: 'blue',
      icon: HeartFilled,
    },
    {
      key: 'waist',
      label: '腰围',
      value: formatValue(waist, 0),
      unit: 'cm',
      desc: waist ? '筛查关键项' : '待填写',
      tone: 'green',
      icon: SafetyCertificateOutlined,
    },
    {
      key: 'fasting',
      label: '空腹血糖',
      value: formatValue(fasting, 1),
      unit: 'mmol/L',
      desc: fasting ? glucoseStatus(fasting, 'fasting') : '未记录',
      tone: 'orange',
      icon: LineChartOutlined,
    },
    {
      key: 'post',
      label: '餐后血糖',
      value: formatValue(post, 1),
      unit: 'mmol/L',
      desc: post ? glucoseStatus(post, 'post') : '未记录',
      tone: 'cyan',
      icon: LineChartOutlined,
    },
    {
      key: 'sbp',
      label: '收缩压',
      value: formatValue(sbp, 0),
      unit: 'mmHg',
      desc: sbp ? '筛查关键项' : '待填写',
      tone: 'purple',
      icon: MedicineBoxOutlined,
    },
    {
      key: 'profile',
      label: '档案完整度',
      value: `${profileRate.value}`,
      unit: '%',
      desc: profileRate.value >= 100 ? '已完整' : '继续补齐',
      tone: 'red',
      icon: FileProtectOutlined,
    },
  ]
})

function createEmptyProfilePayload() {
  return {
    user: null,
    profile: {
      completed: false,
      completion_rate: 0,
    },
    latest_measurements: {},
    latest_risk: null,
  }
}

function readStoredUser() {
  try {
    const rawUser = localStorage.getItem('diabetesAuthUser')

    return rawUser ? JSON.parse(rawUser) : null
  } catch {
    return null
  }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

function clampNumber(value, min, max) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return min
  }

  return Math.min(max, Math.max(min, Math.round(number)))
}

function calcBmi(height, weight) {
  if (!height || !weight) {
    return null
  }

  return weight / (height / 100) ** 2
}

function formatValue(value, precision = 0) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '--'
  }

  return precision > 0
    ? number.toFixed(precision)
    : String(Math.round(number))
}

function getBmiStatus(value) {
  if (!value) {
    return '待记录身高体重'
  }

  if (value >= 30) {
    return '偏高，建议管理'
  }

  if (value >= 24) {
    return '略高，关注体重'
  }

  return '处于较稳范围'
}

function glucoseStatus(value, type) {
  if (type === 'fasting') {
    return value >= 7
      ? '偏高'
      : value >= 6.1
        ? '临界'
        : '平稳'
  }

  return value >= 11.1
    ? '偏高'
    : value >= 7.8
      ? '临界'
      : '平稳'
}

function calculateAge(value) {
  if (!value) {
    return null
  }

  const birth = new Date(value)

  if (Number.isNaN(birth.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (
    monthDiff < 0
    || (
      monthDiff === 0
      && today.getDate() < birth.getDate()
    )
  ) {
    age -= 1
  }

  return age > 0 && age < 130 ? age : null
}

function formatMissingFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return '补充腰围、血压、家族史后会更准确。'
  }

  const labels = {
    birth_date: '出生日期',
    gender: '性别',
    height_cm: '身高',
    weight_kg: '体重',
    waist_cm: '腰围',
    sbp_mm_hg: '收缩压',
    family_history_diabetes: '家族史',
  }

  return `还缺 ${fields.map((field) => labels[field] || field).join('、')}`
}

function showToast(text) {
  toastText.value = text

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    toastText.value = ''
  }, 2000)
}

function requireLogin() {
  if (isLoggedIn.value) {
    return false
  }

  showToast('请先登录，再使用完整健康管理功能。')

  return true
}

function buildRiskPayload() {
  const source = profile.value
  const measurements = latestMeasurements.value
  const age = Number(
    source.age_snapshot
    || source.age
    || calculateAge(source.birth_date),
  )

  const gender = source.gender === 'female'
    ? 'female'
    : source.gender === 'male'
      ? 'male'
      : ''

  const height = numberOrNull(source.height_cm)

  const weight = numberOrNull(
    source.weight_kg || measurements.weight_kg,
  )

  const waist = numberOrNull(source.waist_cm)

  const sbp = numberOrNull(
    source.sbp_mm_hg
    || source.systolic_bp
    || measurements.sbp_mm_hg,
  )

  const missing = []

  if (!Number.isFinite(age)) {
    missing.push('出生日期')
  }

  if (!gender) {
    missing.push('性别')
  }

  if (!height) {
    missing.push('身高')
  }

  if (!weight) {
    missing.push('体重')
  }

  if (!waist) {
    missing.push('腰围')
  }

  if (!sbp) {
    missing.push('收缩压')
  }

  if (
    source.family_history_diabetes === null
    || source.family_history_diabetes === undefined
  ) {
    missing.push('家族史')
  }

  if (
    source.diagnosed_diabetes === null
    || source.diagnosed_diabetes === undefined
  ) {
    missing.push('是否确诊')
  }

  if (missing.length) {
    return {
      missing,
    }
  }

  return {
    payload: {
      diagnosed_diabetes: Boolean(source.diagnosed_diabetes),
      diabetes_type: source.diagnosed_diabetes
        ? source.diabetes_type || 'unknown'
        : null,
      age,
      gender,
      height_cm: height,
      weight_kg: weight,
      waist_cm: waist,
      sbp_mm_hg: Math.round(sbp),
      dbp_mm_hg: numberOrNull(source.dbp_mm_hg),
      family_history_diabetes: Boolean(source.family_history_diabetes),
      past_history: Array.isArray(source.past_history)
        ? source.past_history
        : [],
      labs: {
        fasting_glucose: numberOrNull(
          measurements.fasting_glucose || source.fasting_glucose,
        ),
        postprandial_glucose: numberOrNull(
          measurements.postprandial_glucose || source.postprandial_glucose,
        ),
        hba1c: numberOrNull(
          measurements.hba1c || source.hba1c,
        ),
      },
    },
  }
}

async function runRiskAssessment() {
  if (requireLogin()) {
    return
  }

  const { payload, missing } = buildRiskPayload()

  if (!payload) {
    showToast(`请先补齐：${missing.slice(0, 4).join('、')}`)
    return
  }

  assessing.value = true

  try {
    const result = await apiPost(
      '/api/risk-assessments',
      payload,
      {
        idempotent: true,
      },
    )

    riskPayload.value = result.data

    showToast(
      result.data?.status === 'processing'
        ? 'AI 健康评估已提交。'
        : 'AI 健康评估已更新。',
    )

    const requestId = result.data?.workflow?.request_id || result.data?.request_id

    if (requestId && result.data?.status === 'processing') {
      const workflow = await pollWorkflowRun(requestId)

      if (workflow.status === 'failed') {
        showToast(workflow.error_message || 'AI 评估失败，请稍后再试。')
      } else {
        showToast('AI 健康评估已完成。')
      }
    }

    await loadHealthData({
      silent: true,
    })
  } catch (error) {
    showToast(error.message || '评估失败，请稍后再试。')
  } finally {
    assessing.value = false
  }
}

async function loadHealthData({ silent = false } = {}) {
  if (!isLoggedIn.value) {
    profilePayload.value = createEmptyProfilePayload()
    riskPayload.value = null
    return
  }

  loading.value = true

  try {
    const [profileResult, riskResult] = await Promise.allSettled([
      apiGet('/api/profile'),
      apiGet('/api/risk-assessments/latest'),
    ])

    profilePayload.value = profileResult.status === 'fulfilled'
      ? {
        ...createEmptyProfilePayload(),
        ...(profileResult.value.data || {}),
      }
      : createEmptyProfilePayload()

    if (
      profileResult.status === 'fulfilled'
      && profileResult.value.data?.user
    ) {
      userInfo.value = profileResult.value.data.user
    }

    riskPayload.value = riskResult.status === 'fulfilled'
      ? riskResult.value.data
      : profilePayload.value.latest_risk || null

    if (
      profileResult.status === 'rejected'
      && riskResult.status === 'rejected'
      && !silent
    ) {
      showToast('健康数据暂未同步，当前显示待完善状态。')
    }
  } finally {
    loading.value = false
  }
}

function goFeature(key) {
  if (requireLogin()) {
    return
  }

  const routeMap = {
    archive: 'healthArchive',
    plan: 'plan',
    metric: 'healthArchive',
  }

  router.push({
    name: routeMap[key] || 'healthArchive',
  })
}

function handleScoreAction() {
  if (scoreCard.value.action === '生成方案') {
    goFeature('plan')
    return
  }

  goFeature('archive')
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({
    name: 'profile',
  })
}

function handleAuthChanged(event) {
  authRefreshKey.value += 1
  userInfo.value = event.detail?.user || readStoredUser()

  loadHealthData({
    silent: true,
  })
}

onMounted(() => {
  window.addEventListener(
    'diabetes:auth-changed',
    handleAuthChanged,
  )

  loadHealthData({
    silent: true,
  })
})

onBeforeUnmount(() => {
  window.removeEventListener(
    'diabetes:auth-changed',
    handleAuthChanged,
  )

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
})
</script>

<template>
  <main class="health-page">
    <section class="health-phone">
      <div class="health-scroll">
        <header class="health-header">
          <div class="health-topbar">
            <button
              class="header-back"
              type="button"
              aria-label="返回上一页"
              @click="goBack"
            >
              <LeftOutlined />
            </button>

            <div class="health-title">
              <p>{{ todayText }}</p>
              <h1>健康</h1>
            </div>
          </div>

          <section class="score-panel" :class="scoreCard.tone">
            <div class="score-copy">
              <van-tag round type="primary">
                预测分数
              </van-tag>

              <h2>{{ displayName }}，今天先看这一项</h2>

              <p>{{ scoreCard.desc }}</p>

              <div class="score-actions">
                <van-button
                  round
                  type="primary"
                  size="small"
                  :loading="assessing"
                  loading-text="评估中"
                  @click="runRiskAssessment"
                >
                  {{ latestRisk ? '重新评估' : 'AI评估' }}
                </van-button>

                <van-button
                  round
                  plain
                  type="primary"
                  size="small"
                  @click="handleScoreAction"
                >
                  {{ scoreCard.action }}
                </van-button>
              </div>
            </div>

            <button
              class="score-ring"
              type="button"
              @click="handleScoreAction"
            >
              <van-circle
                :current-rate="scoreCard.rate"
                :rate="scoreCard.rate"
                :speed="60"
                :stroke-width="64"
                layer-color="rgba(255,255,255,.56)"
                :color="scoreCard.tone === 'orange' ? '#ff7a00' : '#00c48c'"
                size="108px"
              />

              <span class="score-center">
                <strong>{{ scoreCard.score }}</strong>
                <small>{{ scoreCard.label }}</small>
              </span>
            </button>
          </section>
        </header>

        <section class="health-section">
          <div class="section-head">
            <div>
              <span>健康档案</span>
              <h2>关键指标</h2>
            </div>
          </div>

          <van-grid
            class="metric-grid"
            :border="false"
            :column-num="2"
            :gutter="10"
          >
            <van-grid-item
              v-for="item in metricTiles"
              :key="item.key"
              @click="goFeature('metric')"
            >
              <div class="metric-tile" :class="item.tone">
                <div class="metric-top">
                  <span>
                    <component :is="item.icon" />
                  </span>

                  <em>{{ item.desc }}</em>
                </div>

                <strong>
                  {{ item.value }}
                  <small v-if="item.unit">
                    {{ item.unit }}
                  </small>
                </strong>

                <p>{{ item.label }}</p>
              </div>
            </van-grid-item>
          </van-grid>

          <section v-if="healthAdvice" class="advice-section">
            <div class="section-head">
              <h2>AI 健康建议</h2>
            </div>

            <div class="advice-card">
              <p class="advice-summary">{{ healthAdvice.summary }}</p>

              <div v-if="healthAdvice.diet?.length" class="advice-block">
                <h4>🥗 饮食建议</h4>
                <ul>
                  <li v-for="(tip, i) in healthAdvice.diet" :key="'d'+i">{{ tip }}</li>
                </ul>
              </div>

              <div v-if="healthAdvice.exercise?.length" class="advice-block">
                <h4>🏃 运动建议</h4>
                <ul>
                  <li v-for="(tip, i) in healthAdvice.exercise" :key="'e'+i">{{ tip }}</li>
                </ul>
              </div>

              <div v-if="healthAdvice.review?.length" class="advice-block">
                <h4>📋 复查建议</h4>
                <ul>
                  <li v-for="(tip, i) in healthAdvice.review" :key="'r'+i">{{ tip }}</li>
                </ul>
              </div>

              <p v-if="healthAdvice.warning" class="advice-warning">{{ healthAdvice.warning }}</p>
            </div>
          </section>
        </section>
      </div>

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
.health-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.health-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% -4%, rgba(22, 119, 255, 0.18), transparent 30%),
    radial-gradient(circle at 90% 2%, rgba(0, 196, 140, 0.16), transparent 30%),
    linear-gradient(180deg, #f8fbff 0%, #f5f8fc 46%, #eef4fb 100%);
}

.health-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px calc(30px + env(safe-area-inset-bottom));
  scrollbar-width: none;
}

.health-scroll::-webkit-scrollbar {
  display: none;
}

.health-topbar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.health-title {
  min-width: 0;
  padding-top: 1px;
}

.health-topbar p,
.section-head span {
  margin: 0;
  color: #5f7ea4;
  font-size: 11px;
  font-weight: 900;
}

.health-topbar h1 {
  margin: 5px 0 0;
  color: #101936;
  font-size: 25px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.2;
}

.header-back {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 50%;
  padding: 0;
  color: #17243a;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  -webkit-tap-highlight-color: transparent;
}

.header-back:active {
  background: rgba(255, 255, 255, 0.46);
  transform: scale(0.92);
}

.score-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 12px;
  margin-top: 16px;
  border: 1px solid rgba(157, 184, 218, 0.18);
  border-radius: 28px;
  padding: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(232, 243, 255, 0.92)),
    #ffffff;
  box-shadow: 0 18px 36px rgba(33, 62, 102, 0.08);
}

.score-panel.green {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(230, 248, 240, 0.95)),
    #ffffff;
}

.score-panel.orange {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(255, 242, 223, 0.95)),
    #ffffff;
}

.score-copy {
  min-width: 0;
}

.score-copy h2 {
  margin: 11px 0 7px;
  color: #101936;
  font-size: 19px;
  font-weight: 900;
  line-height: 1.28;
}

.score-copy p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0 0 13px;
  color: #607b9d;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.score-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.score-actions :deep(.van-button) {
  min-width: 76px;
}

.score-ring {
  position: relative;
  display: grid;
  width: 112px;
  min-width: 112px;
  height: 112px;
  place-items: center;
  align-self: center;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  -webkit-tap-highlight-color: transparent;
}

.score-ring:active {
  transform: scale(0.97);
}

.score-center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  pointer-events: none;
}

.score-center strong {
  max-width: 72px;
  overflow: hidden;
  color: #101936;
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-center small {
  margin-top: 5px;
  color: #6f86a8;
  font-size: 10px;
  font-weight: 900;
}

.health-section {
  margin-top: 20px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-head h2 {
  margin: 4px 0 0;
  color: #101936;
  font-size: 18px;
  font-weight: 900;
}

.metric-grid {
  margin: 0 -4px;
}

.metric-grid :deep(.van-grid-item__content) {
  border-radius: 22px;
  padding: 0;
  background: transparent;
}

.metric-tile {
  display: grid;
  width: 100%;
  min-height: 124px;
  align-content: space-between;
  border: 1px solid rgba(157, 184, 218, 0.12);
  border-radius: 22px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 24px rgba(33, 62, 102, 0.06);
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.metric-top span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 14px;
  color: var(--tone);
  background: var(--tone-bg);
  font-size: 17px;
}

.metric-top em {
  min-width: 0;
  overflow: hidden;
  color: #7f91a8;
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-tile strong {
  margin-top: 12px;
  color: #101936;
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
}

.metric-tile strong small {
  margin-left: 4px;
  color: #6f86a8;
  font-size: 10px;
  font-weight: 900;
}

.metric-tile p {
  margin: 9px 0 0;
  color: #536984;
  font-size: 12px;
  font-weight: 900;
}

.metric-tile.blue {
  --tone: #1677ff;
  --tone-bg: #e8f3ff;
}

.metric-tile.green {
  --tone: #00a870;
  --tone-bg: #e6f8f0;
}

.metric-tile.orange {
  --tone: #ff7a00;
  --tone-bg: #fff2df;
}

.metric-tile.cyan {
  --tone: #00a6a6;
  --tone-bg: #ddf8f6;
}

.metric-tile.purple {
  --tone: #7c3aed;
  --tone-bg: #f0e9ff;
}

.metric-tile.red {
  --tone: #ff4d4f;
  --tone-bg: #ffecec;
}

.app-toast {
  position: absolute;
  z-index: 50;
  right: 50%;
  bottom: calc(26px + env(safe-area-inset-bottom));
  max-width: calc(100% - 48px);
  border-radius: 999px;
  padding: 10px 15px;
  color: #ffffff;
  background: rgba(20, 32, 51, 0.94);
  box-shadow: 0 14px 24px rgba(20, 32, 51, 0.2);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.45;
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

button:active,
.metric-grid :deep(.van-grid-item__content:active) {
  transform: scale(0.99);
}

@media (max-width: 360px) {
  .health-scroll {
    padding-right: 14px;
    padding-left: 14px;
  }

  .score-panel {
    grid-template-columns: minmax(0, 1fr) 98px;
    padding: 14px;
  }

  .score-ring {
    width: 98px;
    min-width: 98px;
    height: 98px;
  }

  .score-copy h2 {
    font-size: 17px;
  }
}

/* ---------- AI 健康建议 ---------- */
.advice-section {
  margin-top: 16px;
}

.advice-card {
  background: linear-gradient(135deg, #f0f7ff, #f6fbfe);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(22, 119, 255, 0.1);
}

.advice-summary {
  font-size: 14px;
  color: #333;
  margin: 0 0 12px;
  line-height: 1.6;
}

.advice-block {
  margin-bottom: 10px;
}

.advice-block h4 {
  font-size: 13px;
  font-weight: 600;
  color: #1677ff;
  margin: 0 0 6px;
}

.advice-block ul {
  margin: 0;
  padding-left: 18px;
}

.advice-block li {
  font-size: 13px;
  color: #555;
  line-height: 1.7;
}

.advice-warning {
  font-size: 12px;
  color: #999;
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px dashed rgba(0,0,0,.08);
}
</style>