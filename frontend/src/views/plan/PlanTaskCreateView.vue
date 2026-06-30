<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CoffeeOutlined,
  FireOutlined,
  SaveOutlined,
  SmileOutlined,
} from '@ant-design/icons-vue'
import { apiDelete, apiGet, apiPost } from '../../api/request'

const router = useRouter()
const route = useRoute()
const toastText = ref('')
const aiSuggestions = ref([])
const existingTasks = ref([])
const loading = ref(false)
const today = new Date().toISOString().slice(0, 10)
const minEndDate = ref(today)
const editingId = ref('')

const categories = [
  { key:'diet', label:'饮食', hint:'主食、加餐', icon:CoffeeOutlined, color:'#ff7a00' },
  { key:'exercise', label:'运动', hint:'步行、力量', icon:FireOutlined, color:'#1677ff' },
  { key:'sleep', label:'睡眠', hint:'入睡、午休', icon:ClockCircleOutlined, color:'#7c3aed' },
  { key:'water', label:'饮水', hint:'水量、频次', icon:SmileOutlined, color:'#00a6a6' },
  { key:'review', label:'复查', hint:'血糖、血压', icon:CheckCircleFilled, color:'#00a870' },
]

const form = reactive({
  category:'diet',
  title:'',
  desc:'',
  target:'',
  time:'',
  startDate: today,
  endDate:'',
})

function showToast(text) {
  toastText.value = text
  window.setTimeout(()=>{ toastText.value='' }, 1800)
}

function goBack() {
  if (window.history.length>1) { router.back(); return }
  router.push({ name:'plan' })
}

function validateTask(t) {
  if (!t.title.trim()) { showToast('请填写任务内容'); return false }
  if (!t.startDate||t.startDate<today) { showToast('开始日期不能早于今天'); return false }
  if (!t.endDate||t.endDate<=t.startDate) { showToast('结束日期必须晚于开始日期'); return false }
  return true
}

function onStartDateChange(e) {
  const val = e?.target?.value||form.startDate
  if (val) { minEndDate.value=val; if (form.endDate&&form.endDate<=val) form.endDate='' }
}

async function loadTasks() {
  try {
    const response = await apiGet('/api/plan-tasks')
    existingTasks.value = response.data?.items || []
  } catch {
    existingTasks.value = []
  }
}

async function saveTask() {
  if (!validateTask(form)) return

  const payload = {
    id: editingId.value || undefined,
    category: form.category,
    title: form.title.trim(),
    desc: form.desc.trim() || '',
    target: form.target.trim() || '',
    time: form.time.trim() || '',
    startDate: form.startDate,
    endDate: form.endDate,
  }

  try {
    await apiPost('/api/plan-tasks', payload, { idempotent: true })
    showToast(editingId.value ? '任务已更新' : '已保存')
    await loadTasks()
    window.setTimeout(goBack, 320)
  } catch (error) {
    showToast(error.message || '任务保存失败。')
  }
}

function loadTask(task) {
  editingId.value = task.id
  form.category=task.category; form.title=task.title; form.desc=task.desc
  form.target=task.target; form.time=task.time
  form.startDate=task.startDate; form.endDate=task.endDate
  minEndDate.value=task.startDate||today
}

function cancelEdit() {
  editingId.value=''
  form.category='diet'; form.title=''; form.desc=''
  form.target=''; form.time=''
  form.startDate=today; form.endDate=''
  minEndDate.value=today
  showToast('已取消编辑')
}

async function deleteTask(task) {
  if (!window.confirm(`确认删除“${task.title}”？`)) return

  try {
    await apiDelete(`/api/plan-tasks/${task.id}`)
    existingTasks.value = existingTasks.value.filter(i=>i.id!==task.id)
    if (editingId.value===task.id) cancelEdit()
    showToast('已删除')
  } catch (error) {
    showToast(error.message || '任务删除失败。')
  }
}

async function generateAi() {
  loading.value=true
  try {
    let profile = null
    try {
      const r = await apiGet('/api/profile')
      profile = r.data?.profile || r.data
    } catch {}
    const end = new Date(today); end.setDate(end.getDate()+13)
    const ed = end.toISOString().slice(0,10)
    const isD = profile?.diagnosed_diabetes===true
    const hw = profile?.weight_kg, hb = profile?.sbp_mm_hg, hg = profile?.fasting_glucose
    const s = []

    s.push(isD||hg
      ? { id:'ai-diet', category:'diet', title:'记录三餐主食和蛋白质', desc:`结合${hg?'血糖':'健康'}数据稳定早餐`, target:'3次', time:'早中晚', startDate:today, endDate:ed }
      : { id:'ai-diet', category:'diet', title:'早餐记录主食和蛋白质', desc:'先稳定早餐结构', target:'1次', time:'08:30', startDate:today, endDate:ed })

    s.push(hw&&hb
      ? { id:'ai-exercise', category:'exercise', title:'每天快走 30 分钟', desc:`体重${profile.weight_kg}kg，适合中等强度有氧`, target:'30分', time:'18:00', startDate:today, endDate:ed }
      : { id:'ai-exercise', category:'exercise', title:'饭后轻走 20 分钟', desc:'先做低强度运动目标', target:'20分', time:'19:30', startDate:today, endDate:ed })

    s.push({ id:'ai-water', category:'water', title:'分次喝水达到目标量', desc:'上午下午分开完成', target:'1500ml', time:'全天', startDate:today, endDate:ed })

    s.push(isD
      ? { id:'ai-sleep', category:'sleep', title:'睡前 1 小时放下手机', desc:'优质睡眠有助于血糖稳定', target:'1h', time:'22:00', startDate:today, endDate:ed }
      : { id:'ai-sleep', category:'sleep', title:'睡前放下手机 30 分钟', desc:'给睡眠留出缓冲', target:'30分', time:'22:30', startDate:today, endDate:ed })

    aiSuggestions.value = s
  } finally { loading.value=false }
}

function pickSuggestion(item) {
  editingId.value=''
  form.category=item.category; form.title=item.title; form.desc=item.desc
  form.target=item.target; form.time=item.time
  form.startDate=item.startDate; form.endDate=item.endDate
  showToast('已填入')
}

function acceptAll() {
  const v = aiSuggestions.value.filter(s=>s.title.trim()&&s.startDate&&s.startDate>=today&&s.endDate&&s.endDate>s.startDate)
  if (!v.length) return

  Promise.all(v.map((item) => apiPost('/api/plan-tasks', {
    category: item.category,
    title: item.title,
    desc: item.desc,
    target: item.target,
    time: item.time,
    startDate: item.startDate,
    endDate: item.endDate,
  }, { idempotent: true })))
    .then(async () => {
      showToast(`已采纳 ${v.length} 个`)
      await loadTasks()
      window.setTimeout(goBack, 420)
    })
    .catch((error) => {
      showToast(error.message || '采纳推荐失败。')
    })
}

onMounted(() => {
  loadTasks()
  if (route.query.ai==='1') generateAi()
})
</script>

<template>
  <main class="ep-page">
    <section class="ep-phone">
      <div class="ep-scroll">
        <!-- 导航 — 参考 personal-nav 模式 -->
        <header class="ep-nav">
          <button type="button" aria-label="返回" @click="goBack"><ArrowLeftOutlined /></button>
          <strong>{{ editingId ? '修改任务' : '新建任务' }}</strong>
          <button v-if="editingId" type="button" class="ep-cancel-nav" @click="cancelEdit">取消</button>
          <span v-else></span>
        </header>

        <!-- 引导 -->
        <section class="ep-hero">
          <h2>{{ editingId ? '修改打卡目标' : '设定打卡目标' }}</h2>
          <p>选择类别、写清内容和日期范围。</p>
        </section>

        <!-- AI 智能推荐 -->
        <section class="ep-band">
          <div class="ep-band-head">
            <van-icon name="star-o" size="14" color="#1677ff" />
            <span>AI 推荐</span>
            <button type="button" class="ep-gen-btn" :class="{ loading }" :disabled="loading" @click="generateAi">
              <van-icon name="magic" size="12" />
              {{ loading ? '生成中' : '生成' }}
            </button>
          </div>

          <div v-if="aiSuggestions.length" class="ep-ai-box">
            <div class="ep-ai-top">
              <span>推荐目标</span>
              <button type="button" @click="acceptAll">全部采纳</button>
            </div>
            <button
              v-for="(item, idx) in aiSuggestions"
              :key="item.id"
              type="button"
              class="ep-ai-row"
              :class="{ last: idx===aiSuggestions.length-1 }"
              @click="pickSuggestion(item)"
            >
              <span class="ep-ai-ico" :style="{ color: categories.find(c=>c.key===item.category)?.color }">
                <component :is="categories.find(c=>c.key===item.category)?.icon" />
              </span>
              <span class="ep-ai-copy">
                <strong>{{ item.title }}</strong>
                <small>{{ item.desc }}</small>
              </span>
              <van-tag round type="primary" size="mini">填入</van-tag>
            </button>
          </div>
          <p v-else class="ep-ai-hint">点「生成」获取 AI 根据健康档案推荐的目标</p>
        </section>

        <!-- 类型选择 -->
        <section class="ep-band">
          <div class="ep-band-head">
            <van-icon name="bars" size="14" color="#1677ff" />
            <span>任务类型</span>
          </div>
          <div class="ep-cat-grid">
            <button
              v-for="c in categories"
              :key="c.key"
              type="button"
              class="ep-cat"
              :class="{ active: form.category===c.key }"
              :style="{ '--clr': c.color }"
              @click="form.category=c.key"
            >
              <span class="ep-cat-ico"><component :is="c.icon" /></span>
              <strong>{{ c.label }}</strong>
            </button>
          </div>
        </section>

        <!-- 表单 -->
        <section class="ep-band">
          <div class="ep-band-head">
            <van-icon name="edit" size="14" color="#1677ff" />
            <span>任务内容</span>
          </div>
          <van-cell-group class="ep-fields" :border="false">
            <van-field v-model="form.title" label="内容" placeholder="如：饭后步行 20 分钟" maxlength="50" clearable />
            <van-row>
              <van-col span="12"><van-field v-model="form.target" label="目标" placeholder="如 20 分钟" clearable /></van-col>
              <van-col span="12"><van-field v-model="form.time" label="时间" placeholder="如 19:30" clearable /></van-col>
            </van-row>
            <van-row>
              <van-col span="12"><van-field v-model="form.startDate" label="开始" type="date" :min="today" @change="onStartDateChange" /></van-col>
              <van-col span="12"><van-field v-model="form.endDate" label="结束" type="date" :min="minEndDate||form.startDate||today" /></van-col>
            </van-row>
            <van-field v-model="form.desc" label="备注" type="textarea" rows="2" placeholder="执行说明" maxlength="100" autosize />
          </van-cell-group>
        </section>

        <!-- 已有目标 -->
        <section v-if="existingTasks.length" class="ep-band">
          <div class="ep-band-head">
            <van-icon name="checked" size="14" color="#1677ff" />
            <span>已有目标（{{ existingTasks.length }}）</span>
          </div>
          <div class="ep-ex-list">
            <div v-for="(task, idx) in existingTasks" :key="task.id" class="ep-ex-row-wrap">
              <button
                type="button"
                class="ep-ex-row"
                :class="{ editing: editingId===task.id, last: idx===existingTasks.length-1 }"
                @click="loadTask(task)"
              >
                <span class="ep-ex-dot" :style="{ background: categories.find(c=>c.key===task.category)?.color||'#1677ff' }"></span>
                <span class="ep-ex-copy">
                  <strong>{{ task.title }}</strong>
                  <small>{{ task.startDate }} ~ {{ task.endDate }} · {{ task.target }}</small>
                </span>
                <van-icon name="arrow" color="#c8d0db" size="13" />
              </button>
              <button type="button" class="ep-ex-del" @click="deleteTask(task)">
                <van-icon name="delete" size="14" color="#e8453c" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- 底部保存 -->
      <div class="ep-bar">
        <van-button block round type="primary" size="large" @click="saveTask" class="ep-save">
          <template #icon><SaveOutlined /></template>
          {{ editingId ? '更新任务' : '保存任务' }}
        </van-button>
      </div>

      <transition name="toast-fade">
        <div v-if="toastText" class="app-toast" role="status" aria-live="polite">{{ toastText }}</div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.ep-page {
  display: flex;
  min-height: 100vh; min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dee8f6;
}
.ep-phone {
  position: relative;
  display: flex;
  width: 100%; max-width: 430px;
  height: 100vh; height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f5f8fc;
}
.ep-scroll {
  min-height: 0; flex: 1;
  overflow-y: auto;
  padding: 0 18px 24px;
  scrollbar-width: none;
}
.ep-scroll::-webkit-scrollbar { display: none; }

/* 导航 */
.ep-nav {
  display: grid; height: 48px;
  grid-template-columns: 48px 1fr 48px;
  align-items: center; padding: 0 4px;
}
.ep-nav button {
  display: grid; width: 36px; height: 36px; place-items: center;
  border-radius: 50%; color: #101936;
  background: transparent; font-size: 18px; cursor: pointer; border: none;
}
.ep-nav button:active { background: #f0f4fa; }
.ep-nav strong { color: #101936; font-size: 15px; font-weight: 900; text-align: center; }
.ep-cancel-nav {
  font-size: 12px !important; font-weight: 800 !important; color: #1677ff !important;
}

/* 引导 */
.ep-hero {
  border-radius: 16px; padding: 18px;
  background: linear-gradient(135deg, #1a3a6b, #1677ff, #0099cc);
  color: #fff;
}
.ep-hero h2 { margin: 0; font-size: 19px; font-weight: 900; }
.ep-hero p { margin: 6px 0 0; font-size: 12px; font-weight: 700; opacity: 0.85; }

/* 区块 */
.ep-band { margin-top: 18px; }
.ep-band-head {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 10px; padding: 0 2px;
}
.ep-band-head span { color: #5f7ea4; font-size: 12px; font-weight: 900; flex: 1; }

.ep-gen-btn {
  display: inline-flex; align-items: center; gap: 4px;
  height: 26px; border-radius: 999px; padding: 0 10px;
  border: none; background: #eaf5ff; color: #1677ff;
  font-size: 11px; font-weight: 900; cursor: pointer;
}

/* AI 推荐 */
.ep-ai-box {
  border-radius: 14px; padding: 12px;
  background: linear-gradient(135deg, #eef6ff, #f0faf6);
}
.ep-ai-top {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
}
.ep-ai-top span { font-size: 12px; font-weight: 900; color: #0f1e3a; }
.ep-ai-top button {
  border: none; border-radius: 999px; padding: 4px 10px;
  background: #1677ff; color: #fff;
  font-size: 10px; font-weight: 800; cursor: pointer;
}
.ep-ai-row {
  display: flex; width: 100%; align-items: center; gap: 10px;
  padding: 10px 12px; margin-bottom: 6px;
  border: none; border-radius: 12px;
  background: rgba(255,255,255,0.92);
  text-align: left; cursor: pointer;
}
.ep-ai-row.last { margin-bottom: 0; }
.ep-ai-ico {
  display: grid; width: 32px; height: 32px; place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--clr,#1677ff) 12%, #fff);
  font-size: 15px; flex-shrink: 0;
}
.ep-ai-copy { flex: 1; min-width: 0; }
.ep-ai-copy strong {
  display: block; font-size: 13px; font-weight: 900; color: #0f1e3a;
}
.ep-ai-copy small {
  display: block; margin-top: 1px;
  font-size: 11px; font-weight: 700; color: #7f9bbf;
}
.ep-ai-hint {
  margin: 0; padding: 8px 4px;
  color: #7f9bbf; font-size: 12px; font-weight: 700;
}

/* 分类 */
.ep-cat-grid {
  display: grid; grid-template-columns: repeat(5,1fr); gap: 8px;
}
.ep-cat {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 4px;
  border-radius: 14px; border: 1.5px solid #f0f3f8;
  background: #fff; cursor: pointer;
  text-align: center;
}
.ep-cat:active { transform: scale(0.96); }
.ep-cat-ico {
  display: grid; width: 32px; height: 32px; place-items: center;
  border-radius: 10px;
  color: var(--clr);
  background: color-mix(in srgb, var(--clr) 12%, #fff);
  font-size: 16px;
}
.ep-cat strong { font-size: 11px; font-weight: 900; color: #101936; }
.ep-cat.active { border-color: var(--clr); background: color-mix(in srgb, var(--clr) 6%, #fff); }

/* 表单 */
.ep-fields {
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.03);
}
.ep-fields :deep(.van-field) { padding: 11px 14px; background: #fff; }
.ep-fields :deep(.van-field__label) {
  width: 50px; color: #5f7ea4;
  font-size: 12px; font-weight: 800;
}
.ep-fields :deep(.van-field__body input),
.ep-fields :deep(.van-field__body textarea) {
  font-size: 13px; font-weight: 700; color: #101936;
}
.ep-fields :deep(.van-field__body input::placeholder),
.ep-fields :deep(.van-field__body textarea::placeholder) { color: #c8d0db; }

/* 已有目标 */
.ep-ex-list {
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.03);
}
.ep-ex-row-wrap {
  display: flex; background: #fff;
  border-bottom: 1px solid #f0f3f8;
}
.ep-ex-row-wrap:last-child { border-bottom: none; }
.ep-ex-row {
  display: flex; flex: 1; align-items: center; gap: 10px;
  padding: 12px 10px 12px 14px;
  border: none; background: transparent;
  text-align: left; cursor: pointer; font: inherit; min-width: 0;
}
.ep-ex-row:active { background: #f5f8fc; }
.ep-ex-row.editing { background: #e8f3ff; box-shadow: inset 3px 0 0 #1677ff; }
.ep-ex-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ep-ex-copy { flex: 1; min-width: 0; }
.ep-ex-copy strong {
  display: block; font-size: 13px; font-weight: 900; color: #101936;
}
.ep-ex-copy small {
  display: block; margin-top: 1px;
  font-size: 11px; font-weight: 700; color: #7f9bbf;
}
.ep-ex-del {
  display: grid; width: 38px; place-items: center;
  border: none; background: transparent; cursor: pointer; flex-shrink: 0;
}
.ep-ex-del:active { background: #fff0f0; }

/* 底部 */
.ep-bar {
  padding: 12px 18px calc(14px+env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(245,248,252,0), rgba(245,248,252,0.95) 40%);
}
.ep-save {
  height: 44px; font-size: 15px; font-weight: 900;
  border-radius: 999px;
  --van-button-primary-background: linear-gradient(135deg, #1677ff, #0099cc);
  box-shadow: 0 8px 20px rgba(22,119,255,0.2);
}

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
