<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CustomerServiceOutlined,
  FileProtectOutlined,
  LeftOutlined,
  MessageOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPost } from '../../api/request'

const UNREAD_KEY = 'diafitUnreadMessages'

const router = useRouter()
const activeFilter = ref('all')
const messages = ref([])
const loading = ref(false)
const toastText = ref('')
const selectedMessage = ref(null)

const filters = computed(() => [
  { key: 'all', label: '全部', count: messages.value.length },
  { key: 'reminder', label: '提醒', count: messages.value.filter((item) => item.group === 'reminder').length },
  { key: 'service', label: '服务', count: messages.value.filter((item) => item.group === 'service').length },
  { key: 'assistant', label: '助手', count: messages.value.filter((item) => item.group === 'assistant').length },
])

const visibleMessages = computed(() => {
  if (activeFilter.value === 'all') return messages.value

  return messages.value.filter((item) => item.group === activeFilter.value)
})

const unreadCount = computed(() => messages.value.filter((item) => !item.read).length)

const fallbackMessages = [
  {
    id: 'archive',
    title: '健康档案待完善',
    content: '腰围、血压和家族史会影响风险判断，补齐后可以做正式评估。',
    group: 'service',
    tag: '档案',
    tone: 'blue',
    icon: FileProtectOutlined,
    route: 'healthArchive',
    time: new Date().toISOString(),
    read: false,
  },
  {
    id: 'review',
    title: '复查提醒已生成',
    content: '建议关注空腹血糖、餐后 2 小时血糖和 HbA1c，复查前先记录近期状态。',
    group: 'reminder',
    tag: '复查',
    tone: 'orange',
    icon: BellOutlined,
    route: 'plan',
    time: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    read: false,
  },
  {
    id: 'assistant',
    title: '健康助手可以继续上次对话',
    content: '已经保留最近一次咨询记录，可以直接接着问饮食、风险解释或报告怎么看。',
    group: 'assistant',
    tag: '助手',
    tone: 'purple',
    icon: MessageOutlined,
    route: 'assistant',
    time: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read: true,
  },
  {
    id: 'plan',
    title: '今日生活方案待确认',
    content: '饮食、运动、睡眠任务会根据你的档案和评估结果调整。',
    group: 'service',
    tag: '方案',
    tone: 'green',
    icon: CalendarOutlined,
    route: 'plan',
    time: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    read: true,
  },
]

function iconFor(type) {
  const icons = {
    archive: FileProtectOutlined,
    risk: SafetyCertificateOutlined,
    reminder: BellOutlined,
    plan: CalendarOutlined,
    assistant: MessageOutlined,
    doctor: CustomerServiceOutlined,
  }

  return icons[type] || BellOutlined
}

function normalizeMessage(item, index) {
  const type = item.type || item.category || item.group || 'reminder'
  const group = ['assistant', 'service', 'reminder'].includes(item.group)
    ? item.group
    : type === 'assistant' || type === 'doctor'
      ? 'assistant'
      : type === 'archive' || type === 'risk' || type === 'plan'
        ? 'service'
        : 'reminder'

  return {
    id: item.id || item.message_id || `${type}-${index}`,
    title: item.title || '健康提醒',
    content: item.content || item.note || item.summary || '有一条新的健康消息。',
    group,
    tag: item.tag || item.label || (group === 'assistant' ? '助手' : group === 'service' ? '服务' : '提醒'),
    tone: item.tone || (group === 'assistant' ? 'purple' : group === 'service' ? 'blue' : 'orange'),
    icon: iconFor(type),
    route: item.route || item.action_route || item.route_name || '',
    time: item.time || item.created_at || item.updated_at || item.due_date || new Date().toISOString(),
    read: Boolean(item.read || item.status === 'read' || item.status === 'done'),
  }
}

function syncUnread() {
  localStorage.setItem(UNREAD_KEY, String(unreadCount.value))
  window.dispatchEvent(
    new CustomEvent('diafit:messages-updated', {
      detail: { unread: unreadCount.value },
    }),
  )
}

function showToast(text) {
  toastText.value = text
  window.setTimeout(() => {
    toastText.value = ''
  }, 1800)
}

function formatTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '刚刚'

  const now = new Date()
  const diff = now - date
  const minute = 1000 * 60
  const hour = minute * 60
  const day = hour * 24

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < day * 2) return '昨天'

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

async function loadMessages() {
  loading.value = true

  try {
    const response = await apiGet('/api/messages')
    const source = response.data?.list || response.data?.messages || response.data || []
    messages.value = (Array.isArray(source) && source.length ? source : fallbackMessages)
      .map(normalizeMessage)
  } catch {
    messages.value = fallbackMessages
  } finally {
    loading.value = false
    syncUnread()
  }
}

async function markAllRead() {
  if (!messages.value.some((item) => !item.read)) {
    showToast('当前没有未读消息。')
    return
  }

  messages.value = messages.value.map((item) => ({ ...item, read: true }))
  syncUnread()
  showToast('已全部设为已读。')

  try {
    await apiPost('/api/messages/read-all', {})
  } catch {
    // Mock 或后端未接好时，前端状态先保持已读。
  }
}

function openMessage(item) {
  messages.value = messages.value.map((message) => (
    message.id === item.id ? { ...message, read: true } : message
  ))
  syncUnread()

  if (item.route) {
    router.push({ name: item.route })
    return
  }

  selectedMessage.value = item
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({ name: 'home' })
}

onMounted(loadMessages)
</script>

<template>
  <main class="message-page">
    <section class="message-phone">
      <div class="message-scroll">
        <header class="message-top">
          <button class="back-button" type="button" aria-label="返回" @click="goBack">
            <LeftOutlined />
          </button>
          <div>
            <p>个人中心</p>
            <h1>消息</h1>
          </div>
          <button class="read-button" type="button" @click="markAllRead">
            全部已读
          </button>
        </header>

        <section class="message-summary">
          <div>
            <strong>{{ unreadCount }}</strong>
            <span>未读</span>
          </div>
          <div>
            <strong>{{ messages.length }}</strong>
            <span>全部消息</span>
          </div>
          <div>
            <strong>{{ filters.find((item) => item.key === 'reminder')?.count || 0 }}</strong>
            <span>健康提醒</span>
          </div>
        </section>

        <van-tabs
          v-model:active="activeFilter"
          class="message-tabs"
          shrink
          swipeable
          :ellipsis="false"
          line-width="16"
          line-height="3"
          color="#1677ff"
          title-active-color="#111827"
          title-inactive-color="#7f8fa3"
        >
          <van-tab
            v-for="item in filters"
            :key="item.key"
            :name="item.key"
            :title="item.count ? `${item.label} ${item.count}` : item.label"
          />
        </van-tabs>

        <section class="message-list">
          <button
            v-for="item in visibleMessages"
            :key="item.id"
            class="message-row"
            type="button"
            @click="openMessage(item)"
          >
            <span class="message-icon" :class="item.tone">
              <component :is="item.icon" />
            </span>

            <span class="message-copy">
              <span class="message-title">
                <strong>{{ item.title }}</strong>
                <i v-if="!item.read"></i>
              </span>
              <small>{{ item.content }}</small>
            </span>

            <span class="message-meta">
              <time>{{ formatTime(item.time) }}</time>
              <RightOutlined />
            </span>
          </button>

          <div v-if="!loading && visibleMessages.length === 0" class="message-empty">
            <CheckCircleOutlined />
            <p>这里暂时没有消息</p>
          </div>
        </section>
      </div>

      <transition name="toast">
        <div v-if="toastText" class="app-toast">{{ toastText }}</div>
      </transition>
      <transition name="message-detail">
        <section v-if="selectedMessage" class="message-detail-mask" @click.self="selectedMessage = null">
          <article class="message-detail">
            <header>
              <span>{{ selectedMessage.tag }}</span>
              <button type="button" @click="selectedMessage = null">完成</button>
            </header>
            <h2>{{ selectedMessage.title }}</h2>
            <time>{{ formatTime(selectedMessage.time) }}</time>
            <p>{{ selectedMessage.content }}</p>
          </article>
        </section>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.message-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.message-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fb;
}

.message-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px 34px;
  scrollbar-width: none;
}

.message-scroll::-webkit-scrollbar {
  display: none;
}

.message-top {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  align-items: center;
  gap: 12px;
}

.back-button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  color: #142033;
  background: #ffffff;
  box-shadow: 0 7px 18px rgba(36, 61, 96, 0.08);
  cursor: pointer;
  font-size: 17px;
}

.message-top p {
  margin: 0;
  color: #7f91a8;
  font-size: 10px;
  font-weight: 800;
}

.message-top h1 {
  margin: 3px 0 0;
  color: #142033;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0;
}

.read-button {
  border-radius: 999px;
  padding: 7px 11px;
  color: #1677ff;
  background: #e8f2ff;
  cursor: pointer;
  font-size: 11px;
  font-weight: 900;
}

.message-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 18px -20px 0;
  border-top: 1px solid #edf0f4;
  border-bottom: 1px solid #edf0f4;
  background: #ffffff;
}

.message-summary div {
  padding: 13px 0 12px;
  text-align: center;
}

.message-summary div + div {
  border-left: 1px solid #edf0f4;
}

.message-summary strong {
  display: block;
  color: #1677ff;
  font-size: 19px;
  font-weight: 900;
}

.message-summary span {
  display: block;
  margin-top: 2px;
  color: #7f8fa3;
  font-size: 10px;
  font-weight: 800;
}

.message-tabs {
  margin: 10px -20px 0;
  background: #ffffff;
  --van-tab-font-size: 12px;
  --van-tabs-line-height: 34px;
}

.message-tabs :deep(.van-tabs__wrap) {
  height: 34px;
  border-bottom: 1px solid #edf0f4;
  padding: 0 12px;
}

.message-tabs :deep(.van-tab) {
  flex: 0 0 auto;
  padding: 0 12px;
  font-weight: 900;
}

.message-list {
  margin: 0 -20px;
  background: #ffffff;
}

.message-row {
  display: flex;
  width: 100%;
  min-height: 78px;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #edf0f4;
  padding: 12px 20px;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
}

.message-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  font-size: 19px;
}

.message-icon.blue {
  color: #1677ff;
  background: #eaf4ff;
}

.message-icon.green {
  color: #00b86b;
  background: #e6fbf0;
}

.message-icon.orange {
  color: #ff7a00;
  background: #fff1df;
}

.message-icon.purple {
  color: #7b3cff;
  background: #f1e9ff;
}

.message-copy {
  min-width: 0;
  flex: 1;
}

.message-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.message-title strong {
  overflow: hidden;
  color: #17243a;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-title i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #ff3b30;
}

.message-copy small {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 5px;
  color: #7f8fa3;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.message-meta {
  display: flex;
  width: 58px;
  flex: 0 0 auto;
  align-items: flex-end;
  flex-direction: column;
  gap: 9px;
  color: #b6bfcc;
  font-size: 13px;
}

.message-meta time {
  color: #98a4b5;
  font-size: 10px;
  font-weight: 800;
}

.message-empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: #9aa7b8;
  font-size: 23px;
}

.message-empty p {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
}

.message-row:active,
.back-button:active,
.read-button:active {
  transform: scale(0.98);
}

.message-detail-mask {
  position: absolute;
  z-index: 80;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.16);
}

.message-detail {
  width: 100%;
  border-radius: 22px 22px 0 0;
  padding: 18px 20px 24px;
  background: #ffffff;
  box-shadow: 0 -18px 42px rgba(19, 42, 86, 0.14);
}

.message-detail header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.message-detail header span {
  border-radius: 999px;
  padding: 4px 9px;
  color: #1677ff;
  background: #e8f2ff;
  font-size: 10px;
  font-weight: 900;
}

.message-detail header button {
  color: #1677ff;
  background: transparent;
  font-size: 13px;
  font-weight: 900;
}

.message-detail h2 {
  margin: 14px 0 0;
  color: #111827;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.4;
}

.message-detail time {
  display: block;
  margin-top: 7px;
  color: #9aa6b6;
  font-size: 11px;
  font-weight: 800;
}

.message-detail p {
  margin: 14px 0 0;
  color: #435166;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.75;
}

.message-detail-enter-active,
.message-detail-leave-active {
  transition: opacity 0.2s ease;
}

.message-detail-enter-active .message-detail,
.message-detail-leave-active .message-detail {
  transition: transform 0.22s ease;
}

.message-detail-enter-from,
.message-detail-leave-to {
  opacity: 0;
}

.message-detail-enter-from .message-detail,
.message-detail-leave-to .message-detail {
  transform: translateY(18px);
}
</style>
