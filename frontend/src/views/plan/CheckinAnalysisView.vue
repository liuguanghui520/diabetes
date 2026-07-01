<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleFilled,
  LeftOutlined,
  TrophyOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPost, pollWorkflowRun } from '../../api/request'

const router = useRouter()

const analysis = ref(null)
const trend = ref([])
const loading = ref(false)

const completionRate = computed(() => {
  const value = analysis.value?.completion_rate

  if (value !== undefined && value !== null) {
    return normalizeRate(value)
  }

  if (!trend.value.length) {
    return 0
  }

  const total = trend.value.reduce((sum, item) => {
    return sum + item.rate
  }, 0)

  return Math.round(total / trend.value.length)
})

const completedDays = computed(() => {
  return trend.value.filter((item) => item.rate >= 100).length
})

const trendAverage = computed(() => {
  if (!trend.value.length) {
    return 0
  }

  const total = trend.value.reduce((sum, item) => {
    return sum + item.rate
  }, 0)

  return Math.round(total / trend.value.length)
})

function normalizeRate(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 0
  }

  if (number > 0 && number <= 1) {
    return Math.round(number * 100)
  }

  return Math.max(0, Math.min(100, Math.round(number)))
}

function normalizeTrendItem(item, index) {
  const totalCount = Number(
    item.task_count
      ?? item.total_count
      ?? item.total
      ?? 0,
  )

  const completedCount = Number(
    item.completed_count
      ?? item.completed
      ?? item.done_count
      ?? 0,
  )

  const directRate = item.completion_rate
    ?? item.rate
    ?? item.completionRate

  const rate = directRate !== undefined && directRate !== null
    ? normalizeRate(directRate)
    : totalCount > 0
      ? normalizeRate((completedCount / totalCount) * 100)
      : 0

  return {
    id: item.id || item.date || `trend-${index}`,
    date: String(item.date || item.checkin_date || '').slice(0, 10),
    rate,
  }
}

function formatShortDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value.slice(5)
  }

  return `${date.getMonth() + 1}/${date.getDate()}`
}

function barHeight(rate) {
  return Math.max(5, Math.round((rate / 100) * 112))
}

function barColor(rate) {
  if (rate >= 80) {
    return '#00a870'
  }

  if (rate >= 50) {
    return '#1677ff'
  }

  if (rate > 0) {
    return '#ff9d22'
  }

  return '#dfe7f1'
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({
    name: 'checkinRecords',
  })
}

async function loadTrend() {
  try {
    const result = await apiGet('/api/checkins/history?days=7')

    const source = result.data?.history
      || result.data?.items
      || result.data
      || []

    trend.value = Array.isArray(source)
      ? source
        .map(normalizeTrendItem)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      : []
  } catch {
    trend.value = []
  }
}

async function loadAnalysis() {
  loading.value = true

  try {
    const result = await apiPost(
      '/api/checkins/analysis',
      {
        days: 7,
      },
      {
        idempotent: true,
      },
    )

    const requestId = result.data?.request_id
      || result.data?.workflow?.request_id

    if (requestId) {
      const workflow = await pollWorkflowRun(requestId)

      if (workflow.status === 'failed') {
        throw new Error(
          workflow.error_message || '打卡分析失败。',
        )
      }

      analysis.value = workflow.result?.data
        || workflow.result
        || null
    } else {
      analysis.value = result.data || null
    }
  } catch {
    analysis.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTrend()
  loadAnalysis()
})
</script>

<template>
  <main class="analysis-page">
    <section class="analysis-phone">
      <header class="analysis-nav">
        <button
          type="button"
          aria-label="返回打卡记录"
          @click="goBack"
        >
          <LeftOutlined />
        </button>

        <strong>打卡分析</strong>

        <span></span>
      </header>

      <div class="analysis-scroll">
        <section class="analysis-overview">
          <span>近 7 天任务完成率</span>

          <strong>{{ completionRate }}%</strong>

          <van-progress
            :percentage="completionRate"
            :show-pivot="false"
            stroke-width="8"
            color="#1677ff"
            track-color="#dce8f7"
          />

          <p>
            {{
              analysis?.summary
                || '坚持完成饮食、运动和复查任务，系统会逐步形成更贴合你的健康执行分析。'
            }}
          </p>
        </section>

        <section class="stats-row">
          <article>
            <strong>{{ completedDays }}</strong>
            <span>完成天数</span>
          </article>

          <article>
            <strong>{{ trendAverage }}%</strong>
            <span>平均完成率</span>
          </article>

          <article>
            <strong>{{ trend.length }}</strong>
            <span>已记录天数</span>
          </article>
        </section>

        <section class="analysis-card">
          <header>
            <TrophyOutlined />
            <h2>近 7 天趋势</h2>
          </header>

          <div
            v-if="trend.length"
            class="trend-chart"
          >
            <div class="chart-bars">
              <div
                v-for="item in trend"
                :key="item.id"
                class="chart-bar-wrap"
                :title="`${formatShortDate(item.date)}：${item.rate}%`"
              >
                <div
                  class="chart-bar"
                  :style="{
                    height: `${barHeight(item.rate)}px`,
                    background: barColor(item.rate),
                  }"
                ></div>

                <small>{{ formatShortDate(item.date) }}</small>
              </div>
            </div>

            <div class="chart-legend">
              <span><i class="green"></i>80% 以上</span>
              <span><i class="blue"></i>50% 以上</span>
              <span><i class="orange"></i>50% 以下</span>
            </div>
          </div>

          <p
            v-else
            class="trend-empty"
          >
            完成每日打卡后，这里会显示近 7 天的完成趋势。
          </p>
        </section>

        <section class="analysis-card">
          <header>
            <CheckCircleFilled />
            <h2>生活评价</h2>
          </header>

          <p>
            {{
              analysis?.evaluation
                || '当前连续打卡记录还不够完整，建议先从每天完成一项最容易执行的任务开始。'
            }}
          </p>
        </section>

        <section class="analysis-card">
          <header>
            <TrophyOutlined />
            <h2>改进建议</h2>
          </header>

          <p>
            {{
              analysis?.advice
                || '优先保证饮食记录、饭后轻运动和规律作息，再逐步提高每天的任务完成率。'
            }}
          </p>
        </section>

        <div
          v-if="loading"
          class="analysis-loading"
        >
          正在生成 AI 打卡分析…
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.analysis-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.analysis-phone {
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

.analysis-nav {
  display: grid;
  height: 54px;
  flex: 0 0 auto;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  align-items: center;
  background: transparent;
}

.analysis-nav button {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  justify-self: center;
  border: 0;
  border-radius: 50%;
  color: #17243a;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
}

.analysis-nav button:active {
  background: #eaf3ff;
}

.analysis-nav strong {
  color: #17243a;
  font-size: 17px;
  font-weight: 900;
  text-align: center;
}

.analysis-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px 30px;
  scrollbar-width: none;
}

.analysis-scroll::-webkit-scrollbar {
  display: none;
}

.analysis-overview {
  border-radius: 21px;
  padding: 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(22, 119, 255, 0.14), transparent 42%),
    linear-gradient(135deg, #ffffff, #edf6ff);
  box-shadow: 0 10px 22px rgba(45, 89, 142, 0.07);
}

.analysis-overview span {
  color: #7187a4;
  font-size: 11px;
  font-weight: 800;
}

.analysis-overview strong {
  display: block;
  margin: 9px 0 13px;
  color: #1677ff;
  font-size: 44px;
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1;
}

.analysis-overview p {
  margin: 14px 0 0;
  color: #71849c;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.7;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
  margin-top: 14px;
}

.stats-row article {
  border-radius: 16px;
  padding: 13px 8px;
  background: #ffffff;
  box-shadow: 0 7px 17px rgba(45, 89, 142, 0.05);
  text-align: center;
}

.stats-row strong,
.stats-row span {
  display: block;
}

.stats-row strong {
  color: #25364d;
  font-size: 19px;
  font-weight: 900;
}

.stats-row span {
  margin-top: 5px;
  color: #8596aa;
  font-size: 9px;
  font-weight: 800;
}

.analysis-card {
  margin-top: 15px;
  border-radius: 18px;
  padding: 17px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(45, 89, 142, 0.06);
}

.analysis-card header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.analysis-card header svg {
  color: #1677ff;
  font-size: 18px;
}

.analysis-card h2 {
  margin: 0;
  color: #25364d;
  font-size: 16px;
  font-weight: 900;
}

.analysis-card p {
  margin: 14px 0 0;
  color: #71849c;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.7;
}

.trend-chart {
  margin-top: 15px;
}

.chart-bars {
  display: flex;
  height: 135px;
  align-items: flex-end;
  gap: 7px;
  padding: 0 3px 20px;
}

.chart-bar-wrap {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  height: 100%;
  align-items: center;
  flex-direction: column;
  justify-content: flex-end;
}

.chart-bar {
  width: 100%;
  max-width: 18px;
  min-height: 4px;
  border-radius: 5px 5px 0 0;
  transition: height 0.25s ease;
}

.chart-bar-wrap small {
  position: absolute;
  bottom: -19px;
  color: #8c9aae;
  font-size: 9px;
  font-weight: 750;
  white-space: nowrap;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  color: #8998ab;
  font-size: 9px;
  font-weight: 750;
}

.chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chart-legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 3px;
}

.chart-legend .green {
  background: #00a870;
}

.chart-legend .blue {
  background: #1677ff;
}

.chart-legend .orange {
  background: #ff9d22;
}

.trend-empty {
  padding: 20px 0 5px;
  color: #98a6b7;
  text-align: center;
}

.analysis-loading {
  margin-top: 14px;
  color: #8294aa;
  font-size: 11px;
  font-weight: 800;
  text-align: center;
}
</style>