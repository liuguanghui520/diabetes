<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CoffeeOutlined,
  FireOutlined,
  SmileOutlined,
  LeftOutlined,
} from '@ant-design/icons-vue'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'
import TopUserActions from '../../components/navigation/TopUserActions.vue'
import { apiGet, apiPost } from '../../api/request'

const TASK_KEY = 'diafitDailyTasksV2'
const DONE_KEY = 'diafitDailyTaskDoneV2'

const router = useRouter()
const toastText = ref('')
const plan = ref(null)
const selectedDate = ref(toDateKey(new Date()))
const cursorMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const customTasks = ref([])
const doneMap = ref({})
const loadingTaskId = ref('')
const todayKey = toDateKey(new Date())

const categoryMeta = {
  diet:    { label:'饮食', color:'#ff7a00', bg:'#fff2df', icon:CoffeeOutlined },
  exercise:{ label:'运动', color:'#1677ff', bg:'#e8f3ff', icon:FireOutlined },
  sleep:   { label:'睡眠', color:'#7c3aed', bg:'#f0e9ff', icon:ClockCircleOutlined },
  water:   { label:'饮水', color:'#00a6a6', bg:'#ddf8f6', icon:SmileOutlined },
  review:  { label:'复查', color:'#00a870', bg:'#e6f8f0', icon:CheckCircleFilled },
}

const defaultTasks = [
  { id:'diet-breakfast',  title:'早餐记录主食和蛋白质', desc:'吃完后补一笔',                           category:'diet',    target:'1 次', time:'08:30' },
  { id:'walk-after-meal', title:'饭后轻走 20 分钟',    desc:'不要追求强度，先稳定完成',                category:'exercise',target:'20分', time:'19:30' },
  { id:'water-1500',      title:'今天喝水达到目标',     desc:'分几次喝，别一次性猛灌',                 category:'water',   target:'1500ml',time:'全天'   },
  { id:'sleep-before',    title:'睡前 30 分钟放下手机', desc:'给睡眠留出缓冲，明早状态更稳',           category:'sleep',   target:'30分',  time:'22:30'  },
]

const tasks = computed(() => {
  const fromPlan = Array.isArray(plan.value?.tasks)
    ? plan.value.tasks.map((t,i)=> {
        if (typeof t === 'string') return { id:`plan-${i}`, title:t, desc:'来自生活方案', category:i===0?'review':i===1?'diet':'exercise', target:'1次', time:'建议' }
        return { id:t.id||t.plan_task_id||`plan-${i}`, title:t.title||t.task_name||'任务', desc:t.desc||t.detail||'来自生活方案', category:t.task_type||t.category||'review', target:t.target||t.unit||'1次', time:t.time||'建议' }
      })
    : []
  return [...defaultTasks, ...fromPlan, ...customTasks.value]
})

const todayTasks = computed(() => tasks.value.filter(t => isTaskForDate(t, selectedDate.value)))
const doneIds = computed(() => new Set(doneMap.value[selectedDate.value] || []))
const completedCount = computed(() => todayTasks.value.filter(t => doneIds.value.has(t.id)).length)
const completionRate = computed(() => todayTasks.value.length ? Math.round((completedCount.value/todayTasks.value.length)*100) : 0)

const streakDays = computed(() => {
  let c = 0
  const cur = new Date(`${todayKey}T00:00:00`)
  while (c < 366) {
    if (getCompletionRate(toDateKey(cur)) !== 100) break
    c++
    cur.setDate(cur.getDate()-1)
  }
  return c
})

const selectedDateText = computed(() => {
  const d = new Date(`${selectedDate.value}T00:00:00`)
  return new Intl.DateTimeFormat('zh-CN', { month:'long', day:'numeric', weekday:'short' }).format(d)
})

const monthTitle = computed(() => {
  return new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'long' }).format(cursorMonth.value)
})

const calendarDays = computed(() => {
  const year = cursorMonth.value.getFullYear()
  const month = cursorMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells = Array.from({ length: lead }, () => null)

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    const key = toDateKey(date)
    const rate = getCompletionRate(key)

    cells.push({
      key,
      date: day,
      today: key === todayKey,
      done: rate === 100,
      partial: rate > 0 && rate < 100,
    })
  }

  return cells
})

function toDateKey(date) {
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}
function readJson(k, fb) { try { return JSON.parse(localStorage.getItem(k))||fb } catch { return fb } }
function writeJson(k,v) { localStorage.setItem(k, JSON.stringify(v)) }
function getMeta(k) { return categoryMeta[k]||categoryMeta.review }
function isTaskForDate(t, dk) {
  const s=String(t.startDate||t.date||''), e=String(t.endDate||'')
  return !(s&&s>dk) && !(e&&e<dk)
}
function getCompletionRate(dk) {
  const dt = tasks.value.filter(t=>isTaskForDate(t,dk))
  if (!dt.length) return 0
  return Math.round((dt.filter(t=>new Set(doneMap.value[dk]||[]).has(t.id)).length/dt.length)*100)
}
function showToast(text) {
  toastText.value = text
  window.setTimeout(()=>{ toastText.value='' }, 1800)
}

async function loadPlan() {
  customTasks.value = readJson(TASK_KEY, [])
  doneMap.value = readJson(DONE_KEY, {})
  try { const r = await apiGet('/api/plans/active'); plan.value = r.data } catch { plan.value = null }
}

function selectDate(k) { selectedDate.value = k }

function prevMonth() {
  cursorMonth.value = new Date(cursorMonth.value.getFullYear(), cursorMonth.value.getMonth() - 1, 1)
}

function nextMonth() {
  cursorMonth.value = new Date(cursorMonth.value.getFullYear(), cursorMonth.value.getMonth() + 1, 1)
}

function editTask(opts={}) {
  router.push({ name:'planTaskCreate', query:opts.ai?{ ai:'1' }:undefined })
}

function isCustomTask(t) { return String(t.id).startsWith('custom-') }

function deleteTask(task) {
  customTasks.value = customTasks.value.filter(i=>i.id!==task.id)
  writeJson(TASK_KEY, customTasks.value)
  const nm = { ...doneMap.value }
  Object.keys(nm).forEach(dk=>{ nm[dk]=(nm[dk]||[]).filter(id=>id!==task.id) })
  doneMap.value = nm; writeJson(DONE_KEY, nm)
  showToast('任务已删除')
}

async function toggleTask(task) {
  if (loadingTaskId.value) return
  const dk = selectedDate.value, cur = new Set(doneMap.value[dk]||[]), done = cur.has(task.id)
  if (done) {
    cur.delete(task.id); doneMap.value={...doneMap.value,[dk]:[...cur]}; writeJson(DONE_KEY,doneMap.value)
    showToast('已取消'); return
  }
  loadingTaskId.value = task.id
  try {
    await apiPost('/api/checkins', { type:task.category, value:1, unit:task.target||'次', recorded_at:`${dk}T12:00:00.000Z`, detail_text:task.title }, { idempotent:true })
    cur.add(task.id); doneMap.value={...doneMap.value,[dk]:[...cur]}; writeJson(DONE_KEY,doneMap.value)
    showToast('已完成')
  } catch(e) { showToast(e.message||'打卡失败') }
  finally { loadingTaskId.value='' }
}

function handleTabChange(k) { router.push({ name:k==='home'?'home':k }) }
onMounted(loadPlan)
</script>

<template>
  <main class="plan-page">
    <section class="plan-phone">
      <div class="plan-scroll">
        <!-- 顶部，与全站一致 -->
        <header class="plan-topbar">
          <div>
            <p>生活方案</p>
            <h1>每日任务</h1>
          </div>
          <TopUserActions />
        </header>

        <!-- 今日进度 — 轻量一行，参考 hobits StatsSummary -->
        <section class="today-progress">
          <div class="today-progress-row">
            <span class="today-date">{{ selectedDateText }}</span>
            <span class="today-streak">🔥 {{ streakDays }}天</span>
          </div>
          <div class="today-bar-track">
            <div class="today-bar-fill" :style="{ width: completionRate + '%' }"></div>
          </div>
          <div class="today-progress-row today-bottom">
            <span class="today-count">{{ completedCount }}/{{ todayTasks.length }} 项</span>
            <span class="today-pct">{{ completionRate }}%</span>
            <button class="today-ai-btn" @click="editTask({ ai: true })">✨ AI 方案</button>
          </div>
        </section>

        <!-- 日历 — 简洁卡片 -->
        <section class="cal-card">
          <div class="cal-head">
            <button class="cal-arrow" @click="prevMonth"><van-icon name="arrow-left" /></button>
            <span class="cal-title">{{ monthTitle }}</span>
            <button class="cal-arrow" @click="nextMonth"><van-icon name="arrow" /></button>
          </div>
          <div class="cal-weeks">
            <span v-for="w in ['一','二','三','四','五','六','日']" :key="w">{{ w }}</span>
          </div>
          <div class="cal-grid">
            <template v-for="(day, idx) in calendarDays" :key="idx">
              <div v-if="!day" class="cal-empty"></div>
              <button v-else class="cal-cell" :class="{ 'is-today':day.today, 'is-done':day.done, 'is-partial':day.partial, 'is-active':day.key===selectedDate }" @click="selectDate(day.key)">
                <span class="cal-num">{{ day.date }}</span>
                <span v-if="day.today" class="cal-badge">今</span>
              </button>
            </template>
          </div>
        </section>

        <!-- 任务清单 — 参考 hobits HabitTable + SwipeableRow -->
        <section class="task-section">
          <div class="task-head">
            <h2>{{ selectedDate === todayKey ? '今日任务' : '当天任务' }}</h2>
            <button class="task-add-btn" @click="editTask()">
              <van-icon name="plus" size="14" />
              编辑
            </button>
          </div>

          <div v-if="todayTasks.length === 0" class="task-empty">
            <van-icon name="records" size="40" color="#d0d8e6" />
            <p>这天还没有任务</p>
            <button class="task-empty-btn" @click="editTask()">+ 新建任务</button>
          </div>

          <div v-else class="task-list">
            <div
              v-for="(task, idx) in todayTasks"
              :key="task.id"
              class="task-row"
              :class="{ 'is-done': doneIds.has(task.id) }"
              @click="toggleTask(task)"
            >
              <span class="task-cb" :class="{ checked: doneIds.has(task.id) }" :style="doneIds.has(task.id) ? {} : { '--cb-clr': getMeta(task.category).color, '--cb-bg': getMeta(task.category).bg }">
                <svg v-if="doneIds.has(task.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <component v-else :is="getMeta(task.category).icon" />
              </span>
              <span class="task-body">
                <strong :class="{ done: doneIds.has(task.id) }">{{ task.title }}</strong>
                <small>
                  <em>{{ task.time }}</em>
                  {{ task.desc }}
                </small>
              </span>
              <span class="task-tag" :style="{ color: getMeta(task.category).color, background: getMeta(task.category).bg }">{{ getMeta(task.category).label }}</span>
              <button v-if="isCustomTask(task)" class="task-x" @click.stop="deleteTask(task)">
                <van-icon name="delete" size="13" color="#b0bed0" />
              </button>
            </div>
          </div>
        </section>

        <!-- 底部提示 -->
        <section class="tip-row">
          <van-icon name="info-o" size="16" color="#1677ff" />
          <div>
            <strong>AI 会根据完成记录调整建议</strong>
            <p>运动、睡眠、饮食和饮水完成得越稳定，后续方案会越贴近你的真实节奏。</p>
          </div>
        </section>
      </div>

      <!-- FAB 编辑按钮 — 参考 hobits FAB -->
      <button class="plan-fab" @click="editTask()" aria-label="编辑任务">
        <van-icon name="edit" size="20" />
      </button>

      <LiquidTabBar active-key="plan" @change="handleTabChange" />
      <transition name="toast-fade">
        <div v-if="toastText" class="app-toast">{{ toastText }}</div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.plan-page {
  display: flex;
  min-height: 100vh; min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dee8f6;
}
.plan-phone {
  position: relative;
  display: flex;
  width: 100%; max-width: 430px;
  height: 100vh; height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f5f8fc;
}
.plan-scroll {
  min-height: 0; flex: 1;
  overflow-y: auto;
  padding: 18px 18px 80px;
  scrollbar-width: none;
}
.plan-scroll::-webkit-scrollbar { display: none; }

/* 顶部 */
.plan-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.plan-topbar p {
  margin: 0; color: #5f7ea4;
  font-size: 11px; font-weight: 900;
}
.plan-topbar h1 {
  margin: 5px 0 0; color: #101936;
  font-size: 25px; font-weight: 900; line-height: 1.2;
}

/* 今日进度 — 轻量 */
.today-progress {
  margin-top: 16px;
  padding: 0 2px;
}
.today-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.today-date {
  font-size: 14px; font-weight: 800; color: #101936;
}
.today-streak {
  font-size: 12px; font-weight: 700; color: #7f91a8;
}
.today-bar-track {
  height: 4px; margin: 10px 0 8px;
  border-radius: 999px;
  background: #e8edf4;
  overflow: hidden;
}
.today-bar-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #1677ff, #3ba0ff);
  transition: width 0.4s;
}
.today-bottom {
  font-size: 12px;
}
.today-count { font-weight: 700; color: #7f91a8; }
.today-pct { font-weight: 800; color: #1677ff; }
.today-ai-btn {
  padding: 2px 10px;
  border: none; border-radius: 999px;
  background: #eaf5ff; color: #1677ff;
  font-size: 11px; font-weight: 800;
  cursor: pointer;
}

/* 日历 */
.cal-card {
  margin-top: 14px;
  border-radius: 16px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.cal-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.cal-arrow {
  display: grid; width: 30px; height: 30px; place-items: center;
  border-radius: 50%; border: none;
  background: #f2f6fb; color: #4a6a8a;
  cursor: pointer; font-size: 16px;
}
.cal-arrow:active { background: #e3eaf3; }
.cal-title { font-size: 15px; font-weight: 900; color: #0f1e3a; }
.cal-weeks {
  display: grid; grid-template-columns: repeat(7,1fr); gap: 2px;
  margin-bottom: 4px;
}
.cal-weeks span {
  text-align: center; font-size: 11px; font-weight: 800; color: #7f9bbf; padding: 4px 0;
}
.cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
.cal-empty { min-height: 0; }
.cal-cell {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 38px; border-radius: 12px; border: none;
  background: transparent; cursor: pointer; gap: 1px;
}
.cal-cell:active { transform: scale(0.92); }
.cal-num { font-size: 13px; font-weight: 800; color: #2a405c; line-height: 1; }
.cal-cell.is-today .cal-num { color: #1677ff; font-weight: 900; }
.cal-cell.is-done .cal-num { color: #fff; }
.cal-cell.is-done { background: #00a870; }
.cal-cell.is-partial { background: #fff6e5; }
.cal-cell.is-partial .cal-num { color: #cc7a00; }
.cal-cell.is-active:not(.is-done):not(.is-partial) { background: #e8f3ff; box-shadow: inset 0 0 0 1.5px #1677ff; }
.cal-cell.is-active.is-done { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #00a870; }
.cal-badge { font-size: 8px; font-weight: 900; color: #1677ff; line-height: 1; }
.cal-cell.is-done .cal-badge { display: none; }

/* 任务清单 — 参考 hobits HabitTable */
.task-section { margin-top: 18px; }
.task-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px; padding: 0 2px;
}
.task-head h2 { margin: 0; color: #101936; font-size: 17px; font-weight: 900; }
.task-add-btn {
  display: inline-flex; align-items: center; gap: 3px;
  height: 28px; border: none; border-radius: 8px;
  padding: 0 10px;
  background: #1677ff; color: #fff;
  font-size: 12px; font-weight: 800;
  cursor: pointer;
}
.task-add-btn:active { opacity: 0.85; }

.task-list {
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.task-row {
  position: relative;
  display: flex; width: 100%;
  align-items: center; gap: 12px;
  padding: 14px 14px 14px 16px;
  border: none; border-bottom: 1px solid #f0f3f8;
  background: transparent;
  text-align: left; cursor: pointer;
  font: inherit;
  transition: background 0.1s;
}
.task-row:active { background: #f5f8fc; }
.task-row:last-child { border-bottom: none; }
.task-row.is-done { opacity: 0.65; }

.task-cb {
  display: grid;
  width: 34px; height: 34px;
  flex-shrink: 0; place-items: center;
  border-radius: 12px;
  color: var(--cb-clr, #1677ff);
  background: var(--cb-bg, #e8f3ff);
  font-size: 16px;
}
.task-cb.checked { color: #fff; background: #00a870; }

.task-body { flex: 1; min-width: 0; }
.task-body strong {
  display: block;
  font-size: 14px; font-weight: 900; color: #101936;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.task-body strong.done { text-decoration: line-through; color: #b0bed0; }
.task-body small {
  display: block; margin-top: 2px;
  font-size: 11px; font-weight: 700; color: #7f9bbf;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.task-body small em { font-style: normal; color: #1677ff; margin-right: 6px; }

.task-tag {
  flex-shrink: 0;
  border-radius: 999px; padding: 2px 8px;
  font-size: 10px; font-weight: 900; white-space: nowrap;
}
.task-x {
  position: absolute; top: 4px; right: 4px;
  display: grid; width: 22px; height: 22px; place-items: center;
  border-radius: 50%; border: none;
  background: transparent; cursor: pointer;
}
.task-row:hover .task-x,
.task-row:active .task-x { background: #f0f4fa; }

/* 空状态 */
.task-empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 10px; padding: 36px 20px;
  text-align: center;
  background: #fff; border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.task-empty p { color: #7f9bbf; font-size: 13px; font-weight: 700; margin: 0; }
.task-empty-btn {
  border: none; border-radius: 999px;
  padding: 8px 20px;
  background: #1677ff; color: #fff;
  font-size: 13px; font-weight: 800;
  cursor: pointer;
}

/* 底部提示 */
.tip-row {
  display: flex; align-items: flex-start; gap: 10px;
  margin-top: 18px;
  border-radius: 16px; padding: 14px;
  background: #eef6ff;
}
.tip-row div { flex: 1; }
.tip-row strong { display: block; font-size: 13px; font-weight: 900; color: #0f1e3a; }
.tip-row p { margin: 4px 0 0; font-size: 11px; font-weight: 700; color: #607b9d; line-height: 1.5; }

/* FAB — 参考 hobits 浮动按钮 */
.plan-fab {
  position: absolute;
  bottom: 76px; right: 18px;
  z-index: 20;
  width: 48px; height: 48px;
  border-radius: 50%; border: none;
  background: #1677ff; color: #fff;
  box-shadow: 0 6px 18px rgba(22,119,255,0.3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform 0.15s;
}
.plan-fab:active { transform: scale(0.92); }

/* Toast */
.app-toast {
  position: absolute; bottom: 90px; left: 50%; z-index: 30;
  border-radius: 999px; padding: 9px 16px;
  background: rgba(16,25,54,0.88); color: #fff;
  font-size: 12px; font-weight: 800;
  transform: translateX(-50%); pointer-events: none;
  white-space: nowrap;
}
.toast-fade-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-fade-enter-from,
.toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
