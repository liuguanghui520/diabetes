<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
  TrophyOutlined,
} from '@ant-design/icons-vue'
import { apiGet } from '../../api/request'

const router = useRouter()

const loading = ref(false)
const records = ref([])

const totalDays = computed(() => {
  return records.value.length
})

const completedDays = computed(() => {
  return records.value.filter((item) => item.rate >= 100).length
})

const averageRate = computed(() => {
  if (!records.value.length) {
    return 0
  }

  const total = records.value.reduce((sum, item) => {
    return sum + item.rate
  }, 0)

  return Math.round(total / records.value.length)
})

const latestRecord = computed(() => {
  return records.value[0] || null
})

function clampRate(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 0
  }

  if (number > 0 && number <= 1) {
    return Math.round(number * 100)
  }

  return Math.max(0, Math.min(100, Math.round(number)))
}

function normalizeRecord(item, index) {
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
    ? clampRate(directRate)
    : totalCount > 0
      ? clampRate((completedCount / totalCount) * 100)
      : 0

  return {
    id: item.id || item.date || `record-${index}`,
    date: String(item.date || item.checkin_date || '').slice(0, 10),
    rate,
    totalCount,
    completedCount,
  }
}

function formatDate(value) {
  if (!value) {
    return '未知日期'
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

function getStatusText(item) {
  if (item.totalCount <= 0) {
    return '暂无任务'
  }

  if (item.rate >= 100) {
    return '已完成'
  }

  if (item.rate > 0) {
    return '部分完成'
  }

  return '未完成'
}

function getStatusClass(item) {
  if (item.rate >= 100) {
    return 'complete'
  }

  if (item.rate > 0) {
    return 'partial'
  }

  return 'pending'
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({
    name: 'plan',
  })
}

function openAnalysis() {
  router.push({
    name: 'checkinAnalysis',
  })
}

async function loadRecords() {
  loading.value = true

  try {
    const result = await apiGet('/api/checkins/history?days=30')

    const source = result.data?.history
      || result.data?.items
      || result.data
      || []

    records.value = Array.isArray(source)
      ? source
        .map(normalizeRecord)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : []
  } catch {
    records.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadRecords)
</script>

<template>
  <main class="records-page">
    <section class="records-phone">
      <header class="records-nav">
        <button
          type="button"
          aria-label="返回"
          @click="goBack"
        >
          <LeftOutlined />
        </button>

        <strong>打卡记录</strong>

        <button type="button" class="analysis-nav-btn" @click="openAnalysis">
          <TrophyOutlined />
          分析
        </button>
      </header>

      <div class="records-scroll">
        <section class="record-summary">
          <div class="summary-copy">
            <span>近 30 天打卡情况</span>
            <strong>{{ averageRate }}%</strong>
            <small>平均任务完成率</small>
          </div>

          <div class="summary-side">
            <span>
              {{ completedDays }}
              <small>天完成</small>
            </span>

            <span>
              {{ totalDays }}
              <small>条记录</small>
            </span>
          </div>
        </section>

        <section class="latest-card">
          <span class="latest-icon">
            <CheckCircleFilled />
          </span>

          <div>
            <strong>
              {{ latestRecord ? formatDate(latestRecord.date) : '暂未生成打卡记录' }}
            </strong>

            <small>
              {{
                latestRecord
                  ? `完成率 ${latestRecord.rate}% · ${getStatusText(latestRecord)}`
                  : '完成每日任务后，系统会自动生成记录。'
              }}
            </small>
          </div>
        </section>

        <section class="records-section">
          <header class="section-heading">
            <div>
              <span>每日记录</span>
              <h2>最近 30 天</h2>
            </div>

            <small>{{ totalDays }} 条</small>
          </header>

          <div
            v-if="loading"
            class="record-empty"
          >
            正在加载打卡记录…
          </div>

          <div
            v-else-if="records.length === 0"
            class="record-empty"
          >
            <ClockCircleOutlined />

            <strong>还没有打卡记录</strong>

            <small>完成生活方案中的任务后，这里会自动保留每日记录。</small>
          </div>

          <article
            v-for="item in records"
            :key="item.id"
            class="record-row"
          >
            <div class="record-date">
              <strong>{{ formatDate(item.date) }}</strong>

              <small>
                {{
                  item.totalCount > 0
                    ? `${item.completedCount}/${item.totalCount} 项任务完成`
                    : '暂无任务安排'
                }}
              </small>
            </div>

            <div class="record-progress">
              <span
                class="record-status"
                :class="getStatusClass(item)"
              >
                {{ getStatusText(item) }}
              </span>

              <strong>{{ item.rate }}%</strong>
            </div>
          </article>
        </section>


      </div>
    </section>
  </main>
</template>

<style scoped>
.records-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.records-phone {
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

.records-nav {
  display: grid;
  height: 54px;
  flex: 0 0 auto;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  align-items: center;
  background: transparent;
}

.records-nav button {
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

.records-nav button:active {
  background: #eaf3ff;
}

.records-nav strong {
  color: #17243a;
  font-size: 17px;
  font-weight: 900;
  text-align: center;
}

.analysis-nav-btn {
  display: flex !important;
  width: auto !important;
  height: auto !important;
  gap: 3px;
  padding: 4px 10px;
  border-radius: 14px !important;
  font-size: 12px !important;
  font-weight: 600;
  color: #1677ff !important;
  background: #eaf3ff !important;
}

.records-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px 30px;
  scrollbar-width: none;
}

.records-scroll::-webkit-scrollbar {
  display: none;
}

.record-summary {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 14px;
  border-radius: 21px;
  padding: 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(22, 119, 255, 0.14), transparent 40%),
    linear-gradient(135deg, #ffffff, #edf6ff);
  box-shadow: 0 10px 22px rgba(45, 89, 142, 0.07);
}

.summary-copy span,
.summary-copy small {
  display: block;
  color: #7187a4;
  font-size: 11px;
  font-weight: 800;
}

.summary-copy strong {
  display: block;
  margin: 8px 0 4px;
  color: #1677ff;
  font-size: 39px;
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1;
}

.summary-side {
  display: grid;
  min-width: 102px;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  align-content: center;
}

.summary-side span {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  border-radius: 13px;
  color: #25364d;
  background: rgba(255, 255, 255, 0.76);
  font-size: 16px;
  font-weight: 900;
}

.summary-side small {
  margin-top: 4px;
  color: #7c90a8;
  font-size: 9px;
  font-weight: 750;
}

.latest-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-top: 14px;
  border-radius: 16px;
  padding: 13px;
  background: #ffffff;
  box-shadow: 0 7px 17px rgba(45, 89, 142, 0.05);
}

.latest-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 12px;
  color: #00a870;
  background: #e6f8f0;
  font-size: 18px;
}

.latest-card strong,
.latest-card small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.latest-card strong {
  color: #25364d;
  font-size: 13px;
  font-weight: 900;
}

.latest-card small {
  margin-top: 4px;
  color: #8799af;
  font-size: 10px;
  font-weight: 750;
}

.records-section {
  margin-top: 25px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
}

.section-heading span {
  display: block;
  color: #7187a4;
  font-size: 11px;
  font-weight: 800;
}

.section-heading h2 {
  margin: 5px 0 0;
  color: #17243a;
  font-size: 19px;
  font-weight: 900;
}

.section-heading small {
  color: #8598b0;
  font-size: 11px;
  font-weight: 800;
}

.record-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 10px;
  border-radius: 16px;
  padding: 14px;
  background: #ffffff;
  box-shadow: 0 7px 17px rgba(45, 89, 142, 0.05);
}

.record-date {
  min-width: 0;
}

.record-date strong,
.record-date small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-date strong {
  color: #25364d;
  font-size: 13px;
  font-weight: 900;
}

.record-date small {
  margin-top: 5px;
  color: #8999ad;
  font-size: 10px;
  font-weight: 750;
}

.record-progress {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  flex-direction: column;
  gap: 6px;
}

.record-progress strong {
  color: #1677ff;
  font-size: 17px;
  font-weight: 900;
}

.record-status {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 9px;
  font-weight: 900;
}

.record-status.complete {
  color: #00a870;
  background: #e6f8f0;
}

.record-status.partial {
  color: #e68800;
  background: #fff3df;
}

.record-status.pending {
  color: #7d8ea4;
  background: #eef2f6;
}

.record-empty {
  display: grid;
  min-height: 170px;
  place-items: center;
  align-content: center;
  gap: 8px;
  border-radius: 16px;
  color: #8a9aae;
  background: #ffffff;
  box-shadow: 0 7px 17px rgba(45, 89, 142, 0.05);
  text-align: center;
}

.record-empty svg {
  color: #b6cde8;
  font-size: 29px;
}

.record-empty strong {
  color: #60758f;
  font-size: 13px;
  font-weight: 900;
}

.record-empty small {
  max-width: 240px;
  color: #9aa8b8;
  font-size: 10px;
  font-weight: 750;
  line-height: 1.55;
}

.analysis-entry {
  display: grid;
  width: 100%;
  grid-template-columns: 42px minmax(0, 1fr) 18px;
  gap: 11px;
  align-items: center;
  margin-top: 23px;
  border: 0;
  border-radius: 17px;
  padding: 14px;
  color: #9cafc6;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(45, 89, 142, 0.06);
  cursor: pointer;
  text-align: left;
}

.analysis-entry:active {
  background: #f7fbff;
}

.analysis-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 13px;
  color: #7c3aed;
  background: #f0e9ff;
  font-size: 19px;
}

.analysis-copy {
  min-width: 0;
}

.analysis-copy strong,
.analysis-copy small {
  display: block;
}

.analysis-copy strong {
  color: #25364d;
  font-size: 14px;
  font-weight: 900;
}

.analysis-copy small {
  overflow: hidden;
  margin-top: 4px;
  color: #8999ad;
  font-size: 10px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>