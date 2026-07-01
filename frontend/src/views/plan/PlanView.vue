<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CoffeeOutlined,
  FireOutlined,
  MedicineBoxOutlined,
  RightOutlined,
  RobotOutlined,
  TrophyOutlined,
} from '@ant-design/icons-vue'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'
import TopUserActions from '../../components/navigation/TopUserActions.vue'
import { apiGet, apiPost, pollWorkflowRun } from '../../api/request'

const router = useRouter()

const plan = ref(null)
const toastText = ref('')
const generatingPlan = ref(false)
const doneMap = ref({})

const taskMeta = {
  diet: {
    label: '饮食',
    icon: CoffeeOutlined,
    color: '#ff8a00',
    soft: '#fff3df',
  },
  exercise: {
    label: '运动',
    icon: FireOutlined,
    color: '#00a870',
    soft: '#e6f8f0',
  },
  sleep: {
    label: '睡眠',
    icon: ClockCircleOutlined,
    color: '#7c3aed',
    soft: '#f0e9ff',
  },
  water: {
    label: '饮水',
    icon: MedicineBoxOutlined,
    color: '#1677ff',
    soft: '#eaf3ff',
  },
  glucose: {
    label: '血糖',
    icon: MedicineBoxOutlined,
    color: '#00a6a6',
    soft: '#ddf8f6',
  },
  review: {
    label: '复查',
    icon: ClockCircleOutlined,
    color: '#ff4d4f',
    soft: '#ffecec',
  },
}

const currentDateText = computed(() => {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
})

const tasks = computed(() => {
  const source = Array.isArray(plan.value?.tasks)
    ? plan.value.tasks
    : []

  return source.map((task, index) => {
    const id = task.id || task.task_id || `task-${index}`

    return {
      id,
      taskType: normalizeTaskType(
        task.task_type || task.category || task.type,
        index,
      ),
      title: task.title || task.name || '生活任务',
      target: task.target || task.target_value || '',
      time: task.target_time || task.time || task.schedule_time || '全天',
      completed: Object.prototype.hasOwnProperty.call(doneMap.value, id)
        ? doneMap.value[id]
        : Boolean(task.completed || task.is_completed),
    }
  })
})

const totalCount = computed(() => {
  return tasks.value.length
})

const completedCount = computed(() => {
  return tasks.value.filter((task) => task.completed).length
})

const completionRate = computed(() => {
  if (!totalCount.value) {
    return 0
  }

  return Math.round((completedCount.value / totalCount.value) * 100)
})

const planStatusText = computed(() => {
  if (!totalCount.value) {
    return '待生成'
  }

  if (completedCount.value === totalCount.value) {
    return '今日已完成'
  }

  if (completedCount.value > 0) {
    return '进行中'
  }

  return '待执行'
})

function normalizeTaskType(value, index) {
  const type = String(value || '').toLowerCase()

  if (taskMeta[type]) {
    return type
  }

  if (type.includes('diet') || type.includes('food') || type.includes('meal')) {
    return 'diet'
  }

  if (type.includes('exercise') || type.includes('sport')) {
    return 'exercise'
  }

  if (type.includes('sleep')) {
    return 'sleep'
  }

  if (type.includes('water')) {
    return 'water'
  }

  if (type.includes('glucose') || type.includes('sugar')) {
    return 'glucose'
  }

  if (type.includes('review') || type.includes('check')) {
    return 'review'
  }

  return index % 2 === 0 ? 'diet' : 'exercise'
}

function getTaskMeta(type) {
  return taskMeta[type] || taskMeta.review
}

function showToast(text) {
  toastText.value = text

  window.setTimeout(() => {
    toastText.value = ''
  }, 2000)
}

async function loadPlan() {
  try {
    const result = await apiGet('/api/plans/active')

    plan.value = result.data?.plan || result.data || null

    const nextDoneMap = {}

    ;(plan.value?.tasks || []).forEach((task, index) => {
      const id = task.id || task.task_id || `task-${index}`

      nextDoneMap[id] = Boolean(
        task.completed || task.is_completed,
      )
    })

    doneMap.value = nextDoneMap
  } catch {
    plan.value = null
    doneMap.value = {}
  }
}

async function generatePlan() {
  generatingPlan.value = true

  try {
    const result = await apiPost(
      '/api/plans/generate',
      {
        preferences: {
          goal: '控糖、规律运动、饮食管理和复查提醒',
        },
      },
      {
        idempotent: true,
      },
    )

    const requestId = result.data?.workflow?.request_id
      || result.data?.request_id

    showToast('AI 生活方案已提交。')

    if (requestId) {
      const workflow = await pollWorkflowRun(requestId)

      if (workflow.status === 'failed') {
        throw new Error(
          workflow.error_message || '生成方案失败，请稍后再试。',
        )
      }
    }

    await loadPlan()
    showToast('AI 生活方案已生成。')
  } catch (error) {
    showToast(error.message || '生成方案失败，请稍后再试。')
  } finally {
    generatingPlan.value = false
  }
}

async function toggleTask(task) {
  if (!task.id || String(task.id).startsWith('task-')) {
    showToast('该任务暂未同步到后端。')
    return
  }

  const nextCompleted = !task.completed

  try {
    await apiPost(
      `/api/plan-tasks/${task.id}/completion`,
      {
        completed: nextCompleted,
      },
      {
        idempotent: true,
      },
    )

    doneMap.value = {
      ...doneMap.value,
      [task.id]: nextCompleted,
    }

    showToast(nextCompleted ? '已完成打卡。' : '已取消打卡。')
  } catch (error) {
    showToast(error.message || '打卡状态更新失败。')
  }
}

function openCheckinRecords() {
  router.push({
    name: 'checkinRecords',
  })
}

function handleTabChange(key) {
  router.push({
    name: key,
  })
}

onMounted(loadPlan)
</script>

<template>
  <main class="plan-page">
    <section class="plan-phone">
      <header class="plan-nav">
        <h1>生活方案</h1>

        <TopUserActions />
      </header>

      <div class="plan-scroll">
        <section class="plan-overview">
          <header class="overview-head">
            <div class="overview-title-group">
              <span>{{ currentDateText }}</span>
              <h2>今日生活方案</h2>
            </div>

            <span
              class="overview-status"
              :class="{
                complete: completionRate === 100 && totalCount > 0,
              }"
            >
              {{ planStatusText }}
            </span>
          </header>

          <p class="overview-summary">
            生成个性化方案后，系统会根据你的健康档案安排每日任务。
          </p>

          <div class="overview-progress">
            <strong>
              {{ completedCount }}
              <small>/ {{ totalCount || '—' }}</small>
            </strong>

            <span>今日已完成任务</span>
          </div>

          <van-progress
            :percentage="completionRate"
            :show-pivot="false"
            stroke-width="7"
            color="#1677ff"
            track-color="#dce8f7"
          />

          <div class="overview-actions">
            <van-button
              type="primary"
              round
              :loading="generatingPlan"
              loading-text="生成中"
              @click="generatePlan"
            >
              <RobotOutlined />
              AI 生成方案
            </van-button>

            <van-button
              plain
              type="primary"
              round
              @click="openCheckinRecords"
            >
              <ClockCircleOutlined />
              打卡记录
            </van-button>
          </div>
        </section>

        <section class="today-section">
          <header class="section-heading">
            <div>
              <span>今日安排</span>
              <h2>任务清单</h2>
            </div>

            <small>
              {{ completedCount }}/{{ totalCount || 0 }} 已完成
            </small>
          </header>

          <div
            v-if="tasks.length === 0"
            class="task-empty"
          >
            <RobotOutlined />

            <strong>还没有生活方案</strong>

            <small>
              点击“AI 生成方案”，系统会基于健康档案生成饮食、运动和复查任务。
            </small>
          </div>

          <article
            v-for="task in tasks"
            :key="task.id"
            class="task-row"
            :class="{ done: task.completed }"
          >
            <button
              type="button"
              class="task-main"
              :aria-pressed="task.completed"
              @click="toggleTask(task)"
            >
              <span
                class="task-icon"
                :style="{
                  color: getTaskMeta(task.taskType).color,
                  background: getTaskMeta(task.taskType).soft,
                }"
              >
                <component :is="getTaskMeta(task.taskType).icon" />
              </span>

              <span class="task-copy">
                <em>{{ getTaskMeta(task.taskType).label }}</em>
                <strong>{{ task.title }}</strong>
                <small>
                  {{ task.target ? `${task.target} · ` : '' }}{{ task.time }}
                </small>
              </span>

              <span
                class="task-status"
                :class="{ complete: task.completed }"
              >
                <CheckCircleFilled v-if="task.completed" />
                <span v-else>去打卡</span>
              </span>
            </button>
          </article>
        </section>

        <button
          type="button"
          class="record-entry"
          @click="openCheckinRecords"
        >
          <span class="record-entry-icon">
            <TrophyOutlined />
          </span>

          <span class="record-entry-copy">
            <strong>打卡记录</strong>
            <small>查看每日完成情况，再进入打卡分析</small>
          </span>

          <RightOutlined />
        </button>
      </div>

      <LiquidTabBar
        active-key="plan"
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
.plan-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.plan-phone {
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

.plan-nav {
  display: flex;
  height: 64px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 4px;
  background: transparent;
}

.plan-nav h1 {
  margin: 0;
  color: #17243a;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.3px;
}

.plan-nav :deep(.top-user-actions) {
  gap: 6px;
}

.plan-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 28px;
  scrollbar-width: none;
}

.plan-scroll::-webkit-scrollbar {
  display: none;
}

.plan-overview {
  overflow: hidden;
  border: 1px solid #dceafa;
  border-radius: 20px;
  padding: 16px;
  background:
    radial-gradient(circle at 100% 0%, rgba(22, 119, 255, 0.12), transparent 36%),
    linear-gradient(135deg, #ffffff, #edf6ff);
  box-shadow: 0 10px 22px rgba(45, 89, 142, 0.07);
}

.overview-head {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.overview-title-group {
  min-width: 0;
  flex: 1;
}

.overview-head span,
.section-heading span {
  display: block;
  color: #7187a4;
  font-size: 11px;
  font-weight: 800;
}

.overview-head h2 {
  overflow: hidden;
  margin: 5px 0 0;
  color: #17243a;
  font-size: 19px;
  font-weight: 900;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-status {
  flex: 0 0 auto;
  max-width: 76px;
  overflow: hidden;
  border-radius: 999px;
  padding: 5px 9px;
  color: #1677ff !important;
  background: #eaf3ff;
  font-size: 10px !important;
  font-weight: 900 !important;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-status.complete {
  color: #00a870 !important;
  background: #e6f8f0;
}

.overview-summary {
  display: -webkit-box;
  overflow: hidden;
  min-height: 38px;
  margin: 12px 0 0;
  color: #71859e;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.58;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.overview-progress {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0 10px;
}

.overview-progress strong {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: baseline;
  color: #1677ff;
  font-size: 39px;
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 1;
}

.overview-progress strong small {
  margin-left: 4px;
  color: #6d84a0;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0;
}

.overview-progress > span {
  overflow: hidden;
  margin-bottom: 3px;
  color: #7890aa;
  font-size: 11px;
  font-weight: 800;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-actions {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.overview-actions :deep(.van-button) {
  min-width: 0;
  height: 40px;
  font-size: 12px;
  font-weight: 900;
}

.overview-actions :deep(.van-button__content) {
  min-width: 0;
  gap: 5px;
  overflow: hidden;
  white-space: nowrap;
}

.overview-actions :deep(.van-button__text) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.today-section {
  margin-top: 25px;
}

.section-heading {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
}

.section-heading h2 {
  margin: 5px 0 0;
  color: #17243a;
  font-size: 19px;
  font-weight: 900;
}

.section-heading small {
  flex: 0 0 auto;
  color: #8193a9;
  font-size: 11px;
  font-weight: 800;
}

.task-row {
  overflow: hidden;
  margin-top: 10px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 7px 17px rgba(45, 89, 142, 0.06);
}

.task-row.done {
  background: linear-gradient(90deg, #effaf6, #ffffff 72%);
}

.task-main {
  display: grid;
  width: 100%;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 0;
  padding: 13px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.task-main:active {
  background: rgba(22, 119, 255, 0.03);
}

.task-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 12px;
  font-size: 18px;
}

.task-copy {
  min-width: 0;
}

.task-copy em,
.task-copy strong,
.task-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-copy em {
  color: #8495aa;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
}

.task-copy strong {
  margin-top: 3px;
  color: #25364d;
  font-size: 13px;
  font-weight: 900;
}

.task-copy small {
  margin-top: 4px;
  color: #8e9db0;
  font-size: 10px;
  font-weight: 800;
}

.task-status {
  display: inline-flex;
  min-width: 48px;
  align-items: center;
  justify-content: center;
  color: #1677ff;
  font-size: 10px;
  font-weight: 900;
}

.task-status.complete {
  color: #00a870;
  font-size: 20px;
}

.task-empty {
  display: grid;
  min-height: 150px;
  place-items: center;
  align-content: center;
  gap: 8px;
  border-radius: 16px;
  color: #9aa8b8;
  background: #ffffff;
  box-shadow: 0 7px 17px rgba(45, 89, 142, 0.05);
  text-align: center;
}

.task-empty svg {
  color: #b4cae4;
  font-size: 30px;
}

.task-empty strong {
  color: #60758f;
  font-size: 14px;
  font-weight: 900;
}

.task-empty small {
  max-width: 250px;
  color: #9aa8b8;
  font-size: 10px;
  font-weight: 750;
  line-height: 1.6;
}

.record-entry {
  display: grid;
  width: 100%;
  grid-template-columns: 42px minmax(0, 1fr) 18px;
  gap: 11px;
  align-items: center;
  margin-top: 22px;
  border: 0;
  border-radius: 17px;
  padding: 14px;
  color: #9cafc6;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(45, 89, 142, 0.06);
  cursor: pointer;
  text-align: left;
}

.record-entry:active {
  background: #f7fbff;
}

.record-entry-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 13px;
  color: #1677ff;
  background: #eaf3ff;
  font-size: 20px;
}

.record-entry-copy {
  min-width: 0;
}

.record-entry-copy strong,
.record-entry-copy small {
  display: block;
}

.record-entry-copy strong {
  color: #25364d;
  font-size: 14px;
  font-weight: 900;
}

.record-entry-copy small {
  overflow: hidden;
  margin-top: 4px;
  color: #8999ad;
  font-size: 10px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
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

@media (max-width: 360px) {
  .plan-scroll {
    padding-right: 13px;
    padding-left: 13px;
  }

  .plan-nav {
    padding-right: 13px;
    padding-left: 13px;
  }

  .plan-nav h1 {
    font-size: 18px;
  }

  .overview-head h2 {
    font-size: 18px;
  }

  .overview-status {
    max-width: 68px;
    padding-right: 8px;
    padding-left: 8px;
  }

  .overview-actions {
    gap: 8px;
  }

  .overview-actions :deep(.van-button) {
    font-size: 11px;
  }

  .task-copy strong {
    font-size: 12px;
  }

  .task-status {
    min-width: 42px;
  }
}
</style>