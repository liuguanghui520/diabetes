<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  FundOutlined,
  LeftOutlined,
} from '@ant-design/icons-vue'
import { apiGet } from '../../api/request'

const router = useRouter()

const loading = ref(false)
const records = ref([])
const selectedDate = ref('')

const orderedRecords = computed(() => {
  return [...records.value].sort((a, b) => {
    return String(b.date).localeCompare(String(a.date))
  })
})

const latestRecord = computed(() => {
  return orderedRecords.value[0] || null
})

const recordMap = computed(() => {
  const map = new Map()

  orderedRecords.value.forEach((item) => {
    if (!map.has(item.date)) {
      map.set(item.date, item)
    }
  })

  return map
})

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

const calendarAnchorDate = computed(() => {
  return parseLocalDate(latestRecord.value?.date) || getToday()
})

const calendarStartDate = computed(() => {
  return addDays(calendarAnchorDate.value, -29)
})

const rangeText = computed(() => {
  return `${formatMonthDay(calendarStartDate.value)} - ${formatMonthDay(calendarAnchorDate.value)}`
})

const calendarGrid = computed(() => {
  const startDate = calendarStartDate.value
  const leadingEmptyCount = getMondayIndex(startDate)
  const cells = []

  for (let index = 0; index < leadingEmptyCount; index += 1) {
    cells.push({
      key: `empty-start-${index}`,
      placeholder: true,
    })
  }

  for (let index = 0; index < 30; index += 1) {
    const date = addDays(startDate, index)
    const dateKey = formatDateKey(date)
    const record = recordMap.value.get(dateKey) || null

    cells.push({
      key: dateKey,
      placeholder: false,
      date: dateKey,
      day: date.getDate(),
      record,
    })
  }

  const trailingEmptyCount = (7 - (cells.length % 7)) % 7

  for (let index = 0; index < trailingEmptyCount; index += 1) {
    cells.push({
      key: `empty-end-${index}`,
      placeholder: true,
    })
  }

  return cells
})

const selectedInfo = computed(() => {
  const record = recordMap.value.get(selectedDate.value) || null
  const selected = parseLocalDate(selectedDate.value)
    || calendarAnchorDate.value

  return {
    date: selectedDate.value || formatDateKey(calendarAnchorDate.value),
    dateText: formatDate(selected),
    record,
    rate: record?.rate || 0,
    completedCount: record?.completedCount || 0,
    totalCount: record?.totalCount || 0,
    status: getStatusText(record),
    statusClass: getStatusClass(record),
  }
})

function toSafeNumber(value) {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

function clampRate(value) {
  const number = toSafeNumber(value)

  if (number > 0 && number <= 1) {
    return Math.round(number * 100)
  }

  return Math.max(0, Math.min(100, Math.round(number)))
}

function parseLocalDate(value) {
  const text = String(value || '').slice(0, 10)
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() + 1 !== month
    || date.getDate() !== day
  ) {
    return null
  }

  return date
}

function getToday() {
  const now = new Date()

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )
}

function addDays(date, days) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )

  result.setDate(result.getDate() + days)

  return result
}

function getMondayIndex(date) {
  return (date.getDay() + 6) % 7
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatDate(value) {
  const date = value instanceof Date
    ? value
    : parseLocalDate(value)

  if (!date) {
    return '暂无日期'
  }

  const weekList = [
    '周日',
    '周一',
    '周二',
    '周三',
    '周四',
    '周五',
    '周六',
  ]

  return `${date.getMonth() + 1}月${date.getDate()}日${weekList[date.getDay()]}`
}

function normalizeRecord(item, index) {
  const totalCount = Math.max(
    0,
    toSafeNumber(
      item.task_count
      ?? item.total_count
      ?? item.total
      ?? item.taskCount,
    ),
  )

  const completedRaw = Math.max(
    0,
    toSafeNumber(
      item.completed_count
      ?? item.completed
      ?? item.done_count
      ?? item.completedCount,
    ),
  )

  const completedCount = totalCount > 0
    ? Math.min(completedRaw, totalCount)
    : completedRaw

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

function getStatusText(record) {
  if (!record || record.totalCount <= 0) {
    return '暂无任务'
  }

  if (record.rate >= 100) {
    return '已完成'
  }

  if (record.rate > 0) {
    return '部分完成'
  }

  return '未完成'
}

function getStatusClass(record) {
  if (!record || record.totalCount <= 0 || record.rate <= 0) {
    return 'pending'
  }

  if (record.rate >= 100) {
    return 'complete'
  }

  return 'partial'
}

function getDayRateText(record) {
  if (!record || record.totalCount <= 0) {
    return '—'
  }

  return `${record.rate}%`
}

function selectDate(date) {
  selectedDate.value = date
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

    const normalized = Array.isArray(source)
      ? source
        .map(normalizeRecord)
        .filter((item) => item.date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : []

    records.value = normalized

    selectedDate.value = normalized[0]?.date
      || formatDateKey(getToday())
  } catch {
    records.value = []
    selectedDate.value = formatDateKey(getToday())
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
          class="nav-back"
          aria-label="返回生活方案"
          @click="goBack"
        >
          <LeftOutlined />
        </button>

        <strong>打卡记录</strong>

        <button
          type="button"
          class="analysis-nav-button"
          aria-label="查看打卡分析"
          title="打卡分析"
          @click="openAnalysis"
        >
          <FundOutlined />
        </button>
      </header>

      <div class="records-scroll">
        <section class="record-summary">
          <div class="summary-copy">
            <span>近 30 天任务完成率</span>

            <strong>{{ averageRate }}%</strong>

            <small>平均任务完成率</small>
          </div>

          <div class="summary-side">
            <div>
              <strong>{{ completedDays }}</strong>
              <span>天完成</span>
            </div>

            <div>
              <strong>{{ totalDays }}</strong>
              <span>条记录</span>
            </div>
          </div>
        </section>

        <section class="calendar-section">
          <header class="section-heading">
            <div>
              <span>每日打卡</span>
              <h2>近 30 天</h2>
            </div>

            <small>{{ rangeText }}</small>
          </header>

          <div
            v-if="loading"
            class="calendar-loading"
          >
            正在加载打卡记录…
          </div>

          <div
            v-else
            class="calendar-card"
          >
            <div class="calendar-weekdays">
              <span>一</span>
              <span>二</span>
              <span>三</span>
              <span>四</span>
              <span>五</span>
              <span>六</span>
              <span>日</span>
            </div>

            <div class="calendar-grid">
              <template
                v-for="cell in calendarGrid"
                :key="cell.key"
              >
                <span
                  v-if="cell.placeholder"
                  class="calendar-empty"
                ></span>

                <button
                  v-else
                  type="button"
                  class="calendar-day"
                  :class="[
                    getStatusClass(cell.record),
                    {
                      selected: selectedDate === cell.date,
                    },
                  ]"
                  :aria-label="`${formatDate(cell.date)}，${getDayRateText(cell.record)}`"
                  @click="selectDate(cell.date)"
                >
                  <strong>{{ cell.day }}</strong>
                  <small>{{ getDayRateText(cell.record) }}</small>
                </button>
              </template>
            </div>

            <div class="calendar-legend">
              <span>
                <i class="complete"></i>
                已完成
              </span>

              <span>
                <i class="partial"></i>
                部分完成
              </span>

              <span>
                <i class="pending"></i>
                未完成
              </span>
            </div>
          </div>
        </section>

        <section class="selected-record-card">
          <div class="selected-record-top">
            <div>
              <span>选中日期</span>
              <strong>{{ selectedInfo.dateText }}</strong>
            </div>

            <em :class="selectedInfo.statusClass">
              {{ selectedInfo.status }}
            </em>
          </div>

          <div class="selected-record-main">
            <div>
              <strong>{{ selectedInfo.rate }}%</strong>
              <span>任务完成率</span>
            </div>

            <p>
              {{
                selectedInfo.totalCount > 0
                  ? `已完成 ${selectedInfo.completedCount} / ${selectedInfo.totalCount} 项任务`
                  : '当天暂无任务安排'
              }}
            </p>
          </div>

          <van-progress
            :percentage="selectedInfo.rate"
            :show-pivot="false"
            stroke-width="7"
            color="#1677ff"
            track-color="#dfe8f4"
          />
        </section>

        <section
          v-if="latestRecord"
          class="latest-hint"
        >
          <CheckCircleFilled />

          <span>
            最新记录：{{ formatDate(latestRecord.date) }}，完成率 {{ latestRecord.rate }}%
          </span>
        </section>

        <section
          v-else-if="!loading"
          class="empty-record"
        >
          <ClockCircleOutlined />

          <strong>还没有打卡记录</strong>

          <small>
            完成生活方案中的任务后，这里会自动生成每日打卡记录。
          </small>
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
  height: 56px;
  flex: 0 0 auto;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  align-items: center;
  padding: 0 10px;
  background: rgba(246, 248, 252, 0.98);
}

.records-nav strong {
  color: #17243a;
  font-size: 18px;
  font-weight: 900;
  text-align: center;
}

.nav-back,
.analysis-nav-button {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}

.nav-back {
  justify-self: center;
  color: #17243a;
  background: transparent;
  font-size: 21px;
}

.analysis-nav-button {
  justify-self: center;
  color: #1677ff;
  background: #eaf3ff;
  font-size: 18px;
  transition:
    background 0.16s ease,
    transform 0.16s ease;
}

.nav-back:active {
  background: #eaf3ff;
}

.analysis-nav-button:active {
  background: #dceeff;
  transform: scale(0.92);
}

.records-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 32px;
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
  border: 1px solid #dceafa;
  border-radius: 21px;
  padding: 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(22, 119, 255, 0.14), transparent 43%),
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
  font-size: 43px;
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1;
}

.summary-side {
  display: grid;
  min-width: 112px;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  align-content: center;
}

.summary-side div {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
}

.summary-side strong {
  color: #25364d;
  font-size: 18px;
  font-weight: 900;
}

.summary-side span {
  margin-top: 4px;
  color: #7c90a8;
  font-size: 9px;
  font-weight: 800;
}

.calendar-section {
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
  font-size: 21px;
  font-weight: 900;
}

.section-heading small {
  margin-bottom: 2px;
  color: #8b9aae;
  font-size: 10px;
  font-weight: 800;
}

.calendar-loading {
  display: grid;
  min-height: 220px;
  place-items: center;
  border-radius: 18px;
  color: #8394aa;
  background: #ffffff;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(45, 89, 142, 0.05);
}

.calendar-card {
  overflow: hidden;
  border-radius: 19px;
  padding: 14px 12px 12px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(45, 89, 142, 0.06);
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.calendar-weekdays {
  margin-bottom: 8px;
}

.calendar-weekdays span {
  color: #9aa8b8;
  font-size: 10px;
  font-weight: 900;
  text-align: center;
}

.calendar-day,
.calendar-empty {
  min-width: 0;
  aspect-ratio: 1 / 0.96;
}

.calendar-day {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
}

.calendar-day:active {
  transform: scale(0.92);
}

.calendar-day strong {
  color: #52657d;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.calendar-day small {
  margin-top: 4px;
  color: #91a1b4;
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
}

.calendar-day.complete {
  background: #e6f8f0;
}

.calendar-day.complete strong,
.calendar-day.complete small {
  color: #00a870;
}

.calendar-day.partial {
  background: #fff3df;
}

.calendar-day.partial strong,
.calendar-day.partial small {
  color: #e68800;
}

.calendar-day.pending {
  background: #f1f5f9;
}

.calendar-day.selected {
  color: #ffffff;
  background: #1677ff;
  box-shadow: 0 7px 13px rgba(22, 119, 255, 0.24);
}

.calendar-day.selected strong,
.calendar-day.selected small {
  color: #ffffff;
}

.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 13px;
  margin-top: 13px;
  color: #8c9caf;
  font-size: 9px;
  font-weight: 800;
}

.calendar-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.calendar-legend i {
  width: 8px;
  height: 8px;
  border-radius: 3px;
}

.calendar-legend .complete {
  background: #00a870;
}

.calendar-legend .partial {
  background: #f0a120;
}

.calendar-legend .pending {
  background: #c4d0de;
}

.selected-record-card {
  margin-top: 16px;
  border-radius: 18px;
  padding: 16px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(45, 89, 142, 0.06);
}

.selected-record-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.selected-record-top span {
  display: block;
  color: #8798ad;
  font-size: 10px;
  font-weight: 800;
}

.selected-record-top strong {
  display: block;
  margin-top: 5px;
  color: #25364d;
  font-size: 15px;
  font-weight: 900;
}

.selected-record-top em {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.selected-record-top em.complete {
  color: #00a870;
  background: #e6f8f0;
}

.selected-record-top em.partial {
  color: #e68800;
  background: #fff3df;
}

.selected-record-top em.pending {
  color: #7f8fa3;
  background: #eef2f6;
}

.selected-record-main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0 12px;
}

.selected-record-main strong,
.selected-record-main span {
  display: block;
}

.selected-record-main strong {
  color: #1677ff;
  font-size: 31px;
  font-weight: 900;
  letter-spacing: -1px;
  line-height: 1;
}

.selected-record-main span {
  margin-top: 5px;
  color: #8395aa;
  font-size: 10px;
  font-weight: 800;
}

.selected-record-main p {
  max-width: 180px;
  margin: 0 0 2px;
  color: #6e829b;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.5;
  text-align: right;
}

.latest-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  color: #7d90a7;
  font-size: 10px;
  font-weight: 800;
}

.latest-hint svg {
  color: #00a870;
  font-size: 15px;
}

.empty-record {
  display: grid;
  min-height: 170px;
  place-items: center;
  align-content: center;
  gap: 8px;
  margin-top: 16px;
  border-radius: 18px;
  color: #8a9aae;
  background: #ffffff;
  box-shadow: 0 7px 17px rgba(45, 89, 142, 0.05);
  text-align: center;
}

.empty-record svg {
  color: #b6cde8;
  font-size: 29px;
}

.empty-record strong {
  color: #60758f;
  font-size: 13px;
  font-weight: 900;
}

.empty-record small {
  max-width: 240px;
  color: #9aa8b8;
  font-size: 10px;
  font-weight: 750;
  line-height: 1.55;
}

@media (max-width: 360px) {
  .records-scroll {
    padding-right: 13px;
    padding-left: 13px;
  }

  .record-summary {
    gap: 10px;
    padding: 15px;
  }

  .summary-side {
    min-width: 100px;
  }

  .calendar-card {
    padding-right: 9px;
    padding-left: 9px;
  }

  .calendar-grid {
    gap: 4px;
  }

  .calendar-day {
    border-radius: 10px;
  }

  .calendar-day strong {
    font-size: 11px;
  }

  .calendar-day small {
    font-size: 7px;
  }

  .calendar-legend {
    gap: 8px;
    font-size: 8px;
  }
}
</style>