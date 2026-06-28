<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircleFilled, CoffeeOutlined, FireOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'
import { apiGet, apiPost } from '../../api/request'

const router = useRouter()
const mode = ref('plan')
const plan = ref(null)
const analysis = ref(null)
const toastText = ref('')
const doneMap = ref(readDoneMap())

const defaultGroups = [
  {
    key: 'diet',
    title: '饮食管理',
    subtitle: '定制专属饮食计划',
    tasks: [
      { id: 'breakfast', title: '早餐建议', time: '7:30-8:00', text: '一碗燕麦粥（无糖）、一个水煮蛋和一小把坚果。' },
      { id: 'lunch', title: '午餐建议', time: '12:00-12:30', text: '一份清蒸鱼、半碗糙米饭和一份清炒时蔬。' },
      { id: 'dinner', title: '晚餐建议', time: '18:00-18:30', text: '一份鸡胸肉、一份凉拌黄瓜和半碗杂粮粥。' },
      { id: 'snack', title: '加餐建议', time: '15:00-15:30', text: '一个低糖水果和一小杯无糖酸奶。' },
    ],
  },
  {
    key: 'exercise',
    title: '运动管理',
    subtitle: '科学运动指导',
    tasks: [
      { id: 'morning', title: '晨练运动', time: '7:00-7:30', text: '三十分钟慢跑，一周五次。' },
      { id: 'evening', title: '晚间运动', time: '18:00-18:45', text: '四十五分钟有氧运动，如游泳或骑自行车，一周三次。' },
      { id: 'weekend', title: '周末运动', time: '9:00-10:00', text: '一小时综合训练，包括力量训练和有氧运动，每周一次。' },
    ],
  },
]

const groupMeta = {
  diet: {
    icon: CoffeeOutlined,
    color: '#1d74ff',
    soft: '#eef6ff',
    accent: '#ff9f2f',
    head: 'linear-gradient(135deg, #f78f2f 0%, #ffb454 44%, #2e8ee8 100%)',
    label: '饮食',
  },
  exercise: {
    icon: FireOutlined,
    color: '#16a37b',
    soft: '#eaf8f2',
    accent: '#20b486',
    head: 'linear-gradient(135deg, #16a37b 0%, #29c7a6 42%, #2675d9 100%)',
    label: '运动',
  },
}

const groupedTasks = computed(() => {
  const apiTasks = Array.isArray(plan.value?.tasks) ? plan.value.tasks : []
  if (!apiTasks.length) return defaultGroups

  const groups = defaultGroups.map((group) => ({ ...group, tasks: [] }))
  apiTasks.forEach((task, index) => {
    const key = task.task_type || task.category || (index % 2 === 0 ? 'diet' : 'exercise')
    const group = groups.find((item) => item.key === key) || groups[0]
    group.tasks.push({
      id: task.id || `api-${index}`,
      title: task.title || '方案任务',
      time: task.time || task.target_time || '建议',
      text: task.description || task.desc || '来自个性化生活方案。',
    })
  })

  return groups.map((group) => group.tasks.length ? group : defaultGroups.find((item) => item.key === group.key))
})

const flatTasks = computed(() => groupedTasks.value.flatMap((group) => group.tasks.map((task) => ({
  ...task,
  group: group.key,
  groupTitle: group.title,
}))))

const completedCount = computed(() => flatTasks.value.filter((task) => doneMap.value[task.id]).length)
const completionRate = computed(() => flatTasks.value.length ? Math.round((completedCount.value / flatTasks.value.length) * 100) : 0)

function readDoneMap() {
  try {
    return JSON.parse(localStorage.getItem('diafitPlanDoneMap') || '{}')
  } catch {
    return {}
  }
}

function saveDoneMap() {
  localStorage.setItem('diafitPlanDoneMap', JSON.stringify(doneMap.value))
}

function showToast(text) {
  toastText.value = text
  window.setTimeout(() => {
    toastText.value = ''
  }, 1800)
}

async function loadPlan() {
  try {
    const result = await apiGet('/api/plans/active')
    plan.value = result.data
  } catch {
    plan.value = null
  }
}

async function loadAnalysis() {
  mode.value = 'analysis'
  try {
    const result = await apiGet('/api/checkins/analysis')
    analysis.value = result.data
  } catch {
    analysis.value = {
      completion_rate: completionRate.value,
      evaluation: '打卡记录越完整，AI 分析越贴近日常生活。',
      advice: '优先完成饮食和运动两类核心任务。',
    }
  }
}

async function toggleTask(task) {
  const next = !doneMap.value[task.id]
  doneMap.value = { ...doneMap.value, [task.id]: next }
  saveDoneMap()

  if (next) {
    try {
      await apiPost('/api/checkins', {
        type: task.group,
        value: 1,
        unit: '次',
        detail_text: task.title,
      }, { idempotent: true })
    } catch {
      showToast('本地已打卡，后端稍后同步。')
      return
    }
  }

  showToast(next ? '已打卡' : '已取消')
}

function handleTabChange(key) {
  router.push({ name: key === 'home' ? 'home' : key })
}

function getGroupMeta(key) {
  return groupMeta[key] || groupMeta.diet
}

onMounted(loadPlan)
</script>

<template>
  <main class="plan-page">
    <section class="plan-phone">
      <header class="plan-nav">
        <button type="button" aria-label="返回" @click="mode === 'analysis' ? mode = 'plan' : router.back()">
          <LeftOutlined />
        </button>
        <h1>{{ mode === 'analysis' ? 'AI智能打卡分析' : '生活方案' }}</h1>
        <button v-if="mode === 'plan'" type="button" @click="loadAnalysis">打卡分析</button>
        <span v-else></span>
      </header>

      <div v-if="mode === 'plan'" class="plan-scroll">
        <section v-for="group in groupedTasks" :key="group.key" class="plan-group">
          <header
            class="group-head"
            :style="{ '--group-head': getGroupMeta(group.key).head, '--group-accent': getGroupMeta(group.key).accent }"
          >
            <div>
              <span class="group-icon">
                <component :is="getGroupMeta(group.key).icon" />
              </span>
              <h2>{{ group.title }}</h2>
              <p>{{ group.subtitle }}</p>
            </div>
            <span class="group-badge">{{ group.tasks.filter((task) => doneMap[task.id]).length }}/{{ group.tasks.length }}</span>
          </header>

          <button
            v-for="task in group.tasks"
            :key="task.id"
            type="button"
            class="plan-task"
            :class="{ done: doneMap[task.id] }"
            :style="{ '--task-color': getGroupMeta(group.key).color, '--task-soft': getGroupMeta(group.key).soft, '--task-accent': getGroupMeta(group.key).accent }"
            :aria-pressed="doneMap[task.id] ? 'true' : 'false'"
            @click="toggleTask({ ...task, group: group.key })"
          >
            <span class="task-status">
              <CheckCircleFilled v-if="doneMap[task.id]" />
              <i v-else></i>
            </span>
            <div>
              <strong>{{ task.title }}</strong>
              <p>{{ task.text }}</p>
            </div>
            <time>{{ task.time }}</time>
          </button>
        </section>

        <section class="checkin-cards">
          <h2>今日打卡记录</h2>
          <button
            v-for="group in groupedTasks"
            :key="`card-${group.key}`"
            type="button"
            @click="loadAnalysis"
          >
            <span>{{ group.key === 'diet' ? '今日饮食' : '今日运动' }}</span>
            <em>{{ group.title }}打卡</em>
            <b>{{ group.tasks.filter((task) => doneMap[task.id]).length === group.tasks.length ? '已达成' : '待完成' }}</b>
            <RightOutlined />
          </button>
        </section>
      </div>

      <div v-else class="analysis-scroll">
        <section class="analysis-card">
          <h2>计划完成状态</h2>
          <div class="ring" :class="{ low: (analysis?.completion_rate ?? completionRate) < 60 }">
            {{ analysis?.completion_rate ?? completionRate }}%
          </div>
          <p>
            通过分析您上一周的打卡情况，饮食打卡完成{{ completedCount }}次，总完成率{{ analysis?.completion_rate ?? completionRate }}%。
          </p>
        </section>
        <section class="analysis-card">
          <h2>生活评价</h2>
          <p>{{ analysis?.evaluation }}</p>
        </section>
        <section class="analysis-card">
          <h2>改进建议</h2>
          <p>{{ analysis?.advice }}</p>
        </section>
      </div>

      <LiquidTabBar active-key="plan" @change="handleTabChange" />
      <transition name="toast">
        <div v-if="toastText" class="app-toast" role="status" aria-live="polite">{{ toastText }}</div>
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
  background: #dfe8f5;
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
  background: #f7f9fc;
}

.plan-nav {
  display: grid;
  height: 52px;
  flex: 0 0 auto;
  grid-template-columns: 52px minmax(0, 1fr) 84px;
  align-items: center;
  border-bottom: 1px solid #edf1f5;
  background: #ffffff;
}

.plan-nav h1 {
  margin: 0;
  color: #101936;
  font-size: 17px;
  font-weight: 900;
  text-align: center;
}

.plan-nav button {
  color: #1f2937;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.plan-scroll,
.analysis-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 14px 15px 26px;
  scrollbar-width: none;
}

.plan-scroll::-webkit-scrollbar,
.analysis-scroll::-webkit-scrollbar {
  display: none;
}

.plan-group {
  margin-bottom: 18px;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  border-radius: 8px;
  padding: 13px 14px;
  color: #ffffff;
  background:
    radial-gradient(circle at 88% 22%, rgba(255,255,255,0.28), transparent 24%),
    linear-gradient(135deg, rgba(255,255,255,0.16), transparent 42%),
    var(--group-head);
  box-shadow: 0 8px 18px rgba(45, 121, 231, 0.16);
}

.group-head > div {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  column-gap: 10px;
  align-items: center;
}

.group-icon {
  display: grid;
  width: 36px;
  height: 36px;
  grid-row: span 2;
  place-items: center;
  border-radius: 12px;
  color: #ffffff;
  background: rgba(255,255,255,0.2);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.28);
  font-size: 19px;
}

.group-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.group-head p {
  margin: 3px 0 0;
  font-size: 12px;
}

.group-badge {
  border-radius: 4px;
  padding: 5px 11px;
  color: #13345b;
  background: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 900;
}

.plan-task {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  margin-top: 10px;
  border-left: 3px solid var(--task-accent);
  border-radius: 8px;
  padding: 13px 12px;
  background: #ffffff;
  box-shadow: 0 5px 14px rgba(31, 65, 110, 0.06);
  cursor: pointer;
  text-align: left;
}

.plan-task.done {
  background:
    linear-gradient(90deg, var(--task-soft), #ffffff 70%);
}

.task-status {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 12px;
  color: #ffffff;
  background: var(--task-color);
  font-size: 16px;
}

.task-status i {
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  border-radius: 50%;
}

.plan-task strong {
  color: #111827;
  font-size: 14px;
  font-weight: 900;
}

.plan-task p {
  margin: 6px 0 0;
  color: #5f6f83;
  font-size: 12px;
  line-height: 1.55;
}

.plan-task time {
  align-self: start;
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--task-color);
  background: color-mix(in srgb, var(--task-color) 10%, #ffffff);
  font-size: 11px;
  font-weight: 800;
}

.checkin-cards {
  margin-top: 20px;
}

.checkin-cards h2 {
  margin: 0 0 11px;
  color: #101936;
  font-size: 16px;
  font-weight: 900;
}

.checkin-cards button {
  display: grid;
  width: 100%;
  grid-template-columns: 58px minmax(0, 1fr) auto 20px;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  border-radius: 8px;
  padding: 12px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(27, 55, 95, 0.06);
  text-align: left;
}

.checkin-cards span {
  color: #1677ff;
  font-size: 12px;
  font-weight: 900;
}

.checkin-cards em {
  color: #536174;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.checkin-cards b {
  border-radius: 999px;
  padding: 5px 11px;
  color: #1d5cff;
  background: #ecefff;
  font-size: 12px;
}

.analysis-card {
  border-radius: 12px;
  margin-bottom: 18px;
  padding: 18px 16px;
  background: #ffffff;
  box-shadow: 0 5px 14px rgba(27, 55, 95, 0.05);
}

.analysis-card h2 {
  margin: 0 0 14px;
  border-bottom: 1px dashed #dce4ee;
  padding-bottom: 12px;
  color: #082044;
  font-size: 24px;
  font-weight: 900;
}

.ring {
  display: grid;
  width: 94px;
  height: 94px;
  place-items: center;
  border: 8px solid #18bd82;
  border-left-color: #e5e9ef;
  border-radius: 50%;
  margin: 0 auto 18px;
  color: #18bd82;
  font-size: 20px;
  font-weight: 900;
}

.ring.low {
  border-color: #ff4d4f;
  border-left-color: #e5e9ef;
  color: #ff4d4f;
}

.analysis-card p {
  margin: 0;
  color: #66748a;
  font-size: 15px;
  line-height: 1.65;
}
</style>
