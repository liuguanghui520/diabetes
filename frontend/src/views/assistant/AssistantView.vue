<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AudioOutlined,
  BarChartOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  FileDoneOutlined,
  HistoryOutlined,
  HeartOutlined,
  LeftOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SendOutlined,
  ShareAltOutlined,
  SoundOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { apiGet, authorizedFetch } from '../../api/request'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'

const HISTORY_KEY = 'diafitAssistantConversations'
const welcomeMessage = {
  role: 'assistant',
  content: '嗨，我是糖尿病预治助手，帮你看风险、理思路、做规划，或者整理一份今天能执行的健康清单。现在我们从哪里开始？',
}

const router = useRouter()
const message = ref('')
const sending = ref(false)
const toastText = ref('')
const conversationId = ref(null)
const localConversationId = ref(createLocalId())
const fileInput = ref(null)
const fileAccept = ref('.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg')
const suggestionRowRef = ref(null)
const attachments = ref([])
const showHistory = ref(false)
const hasStarted = ref(false)
const conversationHistory = ref([])
const loadingHistory = ref(false)
const messages = ref([{ ...welcomeMessage }])
const suggestionDrag = reactive({
  active: false,
  moved: false,
  startX: 0,
  scrollLeft: 0,
})

const suggestions = ['控糖饮食', '风险解释', '生成计划', '报告怎么看', '复查提醒']
const featureItems = [
  { icon: MessageOutlined, tone: 'blue', title: '糖尿病信息问答', desc: '了解控糖饮食、复查指标和日常管理' },
  { icon: BarChartOutlined, tone: 'purple', title: '糖尿病风险解释', desc: '结合档案和评估结果梳理风险重点' },
  { icon: FileDoneOutlined, tone: 'green', title: '生活方案生成', desc: '把建议拆成饮食、运动和复查任务' },
  { icon: UserOutlined, tone: 'yellow', title: '个人信息管理', desc: '记录并追踪健康档案和关键指标' },
]
const activeTask = ref(suggestions[0])
const inputPlaceholder = computed(() => `${activeTask.value}，说说你的情况…`)

function showToast(text) {
  toastText.value = text
  window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 12)))
}

async function refreshHistory() {
  try {
    const result = await apiGet('/api/assistant/conversations')
    const remoteList = (result.data || []).map((item) => ({
      id: `remote-${item.id}`,
      remoteId: item.id,
      title: item.title || '新的健康对话',
      updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
      status: item.status,
    }))
    conversationHistory.value = remoteList
  } catch {
    conversationHistory.value = readHistory()
  }
}

function conversationTitle(list = messages.value) {
  const userMessage = list.find((item) => item.role === 'user')?.content
  return (userMessage || activeTask.value || '新的健康对话').slice(0, 22)
}

function saveConversationSnapshot() {
  const hasUserMessage = messages.value.some((item) => item.role === 'user')
  if (!hasUserMessage) return

  const record = {
    id: localConversationId.value,
    remoteId: conversationId.value,
    task: activeTask.value,
    title: conversationTitle(),
    updatedAt: Date.now(),
    messages: messages.value,
  }

  const next = [
    record,
    ...readHistory().filter((item) => item.id !== record.id),
  ].sort((a, b) => b.updatedAt - a.updatedAt)

  writeHistory(next)
}

async function loadLatestConversation() {
  await refreshHistory()
  const latest = conversationHistory.value[0]
  if (!latest?.remoteId) return

  await loadConversationMessages(latest)
}

async function loadConversationMessages(item) {
  loadingHistory.value = true
  try {
    const result = await apiGet(`/api/assistant/conversations/${item.remoteId}/messages`)
    const serverMessages = (result.data || []).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    hasStarted.value = true
    localConversationId.value = item.id || `remote-${item.remoteId}`
    conversationId.value = item.remoteId
    activeTask.value = item.task || suggestions[0]
    messages.value = serverMessages.length
      ? [{ ...welcomeMessage }, ...serverMessages]
      : [{ ...welcomeMessage }]
  } catch {
    const local = readHistory().find((h) => h.remoteId === item.remoteId)
    hasStarted.value = true
    localConversationId.value = item.id || createLocalId()
    conversationId.value = item.remoteId
    messages.value = local?.messages?.length ? local.messages : [{ ...welcomeMessage }]
  } finally {
    loadingHistory.value = false
    showHistory.value = false
  }
}

async function loadConversation(item) {
  if (item.remoteId) {
    await loadConversationMessages(item)
    return
  }

  hasStarted.value = true
  localConversationId.value = item.id || createLocalId()
  conversationId.value = item.remoteId || null
  activeTask.value = item.task || suggestions[0]
  messages.value = item.messages?.length ? item.messages : [{ ...welcomeMessage }]
  showHistory.value = false
}

function newConversation() {
  hasStarted.value = true
  localConversationId.value = createLocalId()
  conversationId.value = null
  activeTask.value = suggestions[0]
  attachments.value = []
  message.value = ''
  messages.value = [{ ...welcomeMessage }]
  showHistory.value = false
}

function openHistory() {
  refreshHistory()
  showHistory.value = true
}

async function continueLatestConversation() {
  await refreshHistory()
  const latest = conversationHistory.value[0]

  if (latest?.remoteId) {
    await loadConversationMessages(latest)
    return
  }

  if (latest?.messages?.length) {
    loadConversation(latest)
    return
  }

  startAssistant()
}

async function readSse(response, target) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'))
      if (!dataLine) continue

      try {
        const data = JSON.parse(dataLine.replace(/^data:\s*/, ''))
        if (data.delta || data.content) {
          target.content += data.delta || data.content
        }
        if (data.conversation_id) {
          conversationId.value = data.conversation_id
        }
      } catch {
        target.content += dataLine.replace(/^data:\s*/, '')
      }
    }
  }
}

async function sendMessage(preset = '') {
  hasStarted.value = true
  const content = (preset || message.value).trim()
  if ((!content && attachments.value.length === 0) || sending.value) return

  const pendingFiles = attachments.value.slice()
  const visibleContent = content || `已添加 ${pendingFiles.length} 个文件，请帮我看一下。`

  messages.value.push({ role: 'user', content: visibleContent, files: pendingFiles })
  const reply = { role: 'assistant', content: '' }
  messages.value.push(reply)
  message.value = ''
  attachments.value = []
  sending.value = true

  try {
    const response = await authorizedFetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId.value,
        message: visibleContent,
        content: visibleContent,
        task: activeTask.value,
        attachments: pendingFiles,
      }),
    })

    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
      await readSse(response, reply)
    } else {
      const payload = await response.json()
      reply.content = payload.data?.reply || payload.data?.answer || '我收到了，我们可以继续细化。'
      conversationId.value = payload.data?.conversation_id || conversationId.value
    }
  } catch (error) {
    reply.content = '助手暂时不可用，稍后再试一次。'
    showToast(error.message || '发送失败。')
  } finally {
    sending.value = false
    saveConversationSnapshot()
    await nextTick()
  }
}

function copyText(text) {
  navigator.clipboard?.writeText(text)
  showToast('已复制。')
}

async function shareText(text) {
  const content = text || '这条回复还在生成中。'

  if (navigator.share) {
    try {
      await navigator.share({
        title: '糖尿病预治助手',
        text: content,
      })
      return
    } catch {
      // 用户取消系统分享时回落为复制。
    }
  }

  copyText(content)
  showToast('已复制，可粘贴分享。')
}

function speakText(text) {
  if (!window.speechSynthesis || !text) {
    showToast('当前浏览器不支持朗读。')
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.94
  window.speechSynthesis.speak(utterance)
  showToast('正在朗读。')
}

function goBack() {
  if (hasStarted.value) {
    hasStarted.value = false
    return
  }

  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({ name: 'health' })
}

function handleVoiceInput() {
  message.value = message.value || `${activeTask.value}：`
  showToast('已切换到语音提问格式，可直接补充描述。')
}

function handleCameraUpload() {
  fileAccept.value = 'image/*'
  fileInput.value?.click()
}

function openFilePicker() {
  fileAccept.value = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg'
  fileInput.value?.click()
}

function formatFileSize(size) {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`
  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

function formatHistoryTime(timestamp) {
  if (!timestamp) return '刚刚'

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '刚刚'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((today - targetDay) / 86400000)
  const timeText = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  if (dayDiff === 0) return timeText
  if (dayDiff === 1) return `昨天 ${timeText}`
  if (dayDiff > 1 && dayDiff < 7) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  }
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function handleFileChange(event) {
  const files = Array.from(event.target.files || []).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || 'file',
  }))

  if (files.length === 0) return

  attachments.value = [...attachments.value, ...files].slice(0, 4)
  event.target.value = ''
  showToast(`已添加 ${files.length} 个文件。`)
}

function removeAttachment(index) {
  attachments.value.splice(index, 1)
}

function scrollSuggestionRow(event) {
  const row = suggestionRowRef.value
  if (!row || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

  row.scrollLeft += event.deltaY
}

function beginSuggestionDrag(event) {
  const row = suggestionRowRef.value
  if (!row) return

  suggestionDrag.active = true
  suggestionDrag.moved = false
  suggestionDrag.startX = event.clientX
  suggestionDrag.scrollLeft = row.scrollLeft
  row.setPointerCapture?.(event.pointerId)
}

function moveSuggestionDrag(event) {
  const row = suggestionRowRef.value
  if (!row || !suggestionDrag.active) return

  const delta = event.clientX - suggestionDrag.startX
  if (Math.abs(delta) > 4) {
    suggestionDrag.moved = true
  }
  row.scrollLeft = suggestionDrag.scrollLeft - delta
}

function endSuggestionDrag(event) {
  suggestionDrag.active = false
  suggestionRowRef.value?.releasePointerCapture?.(event.pointerId)
  window.setTimeout(() => {
    suggestionDrag.moved = false
  }, 0)
}

function selectSuggestion(item) {
  if (suggestionDrag.moved) return
  activeTask.value = item
}

function startAssistant() {
  hasStarted.value = true
}

function handleTabChange(key) {
  if (key === 'assistant') return
  router.push({ name: key === 'home' ? 'home' : key })
}

onMounted(loadLatestConversation)
</script>

<template>
  <main class="chat-page">
    <section class="chat-phone">
      <template v-if="!hasStarted">
        <header class="guide-header">
          <h1>健康助手</h1>
          <button type="button" aria-label="历史对话" @click="openHistory">
            <HistoryOutlined />
          </button>
        </header>

        <section class="guide-scroll">
          <section class="assistant-hero">
            <span class="hero-icon" aria-hidden="true">
              <HeartOutlined />
            </span>
            <h2>今天想聊什么？</h2>
            <p>饮食、风险、复查、报告……把问题发过来，帮你一步步理清楚。</p>
          </section>

          <section class="quick-panel">
            <button type="button" class="quick-action primary" @click="newConversation">
              <MessageOutlined />
              <span>
                <strong>新建对话</strong>
                <small>直接说出你想了解的问题</small>
              </span>
            </button>
          </section>
        </section>
      </template>

      <template v-else>
        <header class="q-header">
          <button type="button" aria-label="返回" @click="goBack">
            <LeftOutlined />
          </button>
          <h1>健康助手</h1>
          <button type="button" aria-label="历史对话" @click="openHistory">
            <HistoryOutlined />
          </button>
        </header>

        <div class="q-scroll">
          <section class="assistant-brand">
            <span class="brand-mark">健</span>
            <div>
              <strong>糖尿病预治助手</strong>
              <small>看风险、理报告、做今天能执行的清单</small>
            </div>
          </section>

          <section class="q-messages">
            <article
              v-for="(item, index) in messages"
              :key="index"
              class="q-message"
              :class="item.role"
            >
              <p>{{ item.content || '生成中…' }}</p>
              <div v-if="item.files?.length" class="message-files">
                <span v-for="file in item.files" :key="file.name">
                  <PaperClipOutlined />
                  {{ file.name }}
                </span>
              </div>
              <div v-if="item.role === 'assistant'" class="message-actions">
                <button type="button" aria-label="朗读回复" @click="speakText(item.content)"><SoundOutlined /></button>
                <button type="button" aria-label="分享回复" @click="shareText(item.content)"><ShareAltOutlined /></button>
                <button type="button" aria-label="复制回复" @click="copyText(item.content)"><CopyOutlined /></button>
              </div>
            </article>
          </section>
        </div>

        <footer class="q-input-area">
          <div
            ref="suggestionRowRef"
            class="suggestion-row"
            @wheel.prevent="scrollSuggestionRow"
            @pointerdown="beginSuggestionDrag"
            @pointermove="moveSuggestionDrag"
            @pointerup="endSuggestionDrag"
            @pointercancel="endSuggestionDrag"
            @pointerleave="endSuggestionDrag"
          >
            <button
              v-for="item in suggestions"
              :key="item"
              type="button"
              :class="{ active: activeTask === item }"
              :aria-pressed="activeTask === item"
              @click="selectSuggestion(item)"
            >
              {{ item }}
            </button>
          </div>

          <div v-if="attachments.length" class="attachment-row">
            <button
              v-for="(file, index) in attachments"
              :key="`${file.name}-${index}`"
              type="button"
              :aria-label="`移除附件 ${file.name}`"
              @click="removeAttachment(index)"
            >
              <PaperClipOutlined />
              <span>{{ file.name }}</span>
              <em>{{ formatFileSize(file.size) }}</em>
            </button>
          </div>

          <form class="q-input" @submit.prevent="sendMessage()">
            <button type="button" aria-label="语音" @click="handleVoiceInput">
              <AudioOutlined />
            </button>
            <input
              v-model="message"
              name="assistant_message"
              autocomplete="off"
              aria-label="输入健康助手问题"
              :placeholder="inputPlaceholder"
            />
            <button type="button" aria-label="添加文件" @click="openFilePicker">
              <PaperClipOutlined />
            </button>
            <button type="button" aria-label="拍照" @click="handleCameraUpload">
              <CameraOutlined />
            </button>
            <button v-if="message.trim() || attachments.length" class="send" type="submit" aria-label="发送消息" :disabled="sending">
              <SendOutlined />
            </button>
          </form>
          <input
            ref="fileInput"
            class="file-input"
            type="file"
            aria-label="上传健康助手附件"
            multiple
            :accept="fileAccept"
            @change="handleFileChange"
          />
          <p>内容由 AI 生成</p>
        </footer>

        <transition name="toast">
          <div v-if="toastText" class="app-toast" role="status" aria-live="polite">{{ toastText }}</div>
        </transition>
      </template>

      <transition name="history">
        <section v-if="showHistory" class="history-mask" @click.self="showHistory = false">
          <div class="history-panel">
            <header>
              <strong>最近对话</strong>
              <button type="button" @click="newConversation">
                <PlusOutlined />
                新建
              </button>
            </header>

            <div v-if="conversationHistory.length" class="history-list">
              <button
                v-for="item in conversationHistory"
                :key="item.id"
                type="button"
                @click="loadConversation(item)"
              >
                <span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.task || '健康助手' }}</small>
                </span>
                <em>{{ formatHistoryTime(item.updatedAt) }}</em>
              </button>
            </div>
            <p v-else>还没有历史对话</p>
          </div>
        </section>
      </transition>

      <LiquidTabBar active-key="assistant" @change="handleTabChange" />
    </section>
  </main>
</template>

<style scoped>
.chat-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.chat-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.guide-header {
  display: flex;
  height: 52px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  position: relative;
  border-bottom: 1px solid #edf1f5;
  background: #ffffff;
}

.guide-header h1 {
  margin: 0;
  color: #101936;
  font-size: 18px;
  font-weight: 900;
}

.guide-header button {
  position: absolute;
  right: 14px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 12px;
  color: #1677ff;
  background: #eef5ff;
  font-size: 18px;
}

.guide-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 18px;
  background: linear-gradient(180deg, #f6faf8 0%, #f1f7f3 72%, #f8fbf9 100%);
  scrollbar-width: none;
}

.guide-scroll::-webkit-scrollbar {
  display: none;
}

.assistant-hero {
  display: grid;
  justify-items: center;
  border-radius: 20px;
  padding: 36px 24px 32px;
  color: #ffffff;
  background:
    radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.18) 0 58px, transparent 59px),
    radial-gradient(circle at 14% 74%, rgba(255, 255, 255, 0.12) 0 44px, transparent 45px),
    linear-gradient(145deg, #16a34a 0%, #0e8a5c 42%, #0b6e4a 100%);
  box-shadow: 0 14px 28px rgba(16, 122, 60, 0.16);
  text-align: center;
}

.hero-icon {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  font-size: 30px;
}

.assistant-hero h2 {
  margin: 16px 0 0;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.3px;
}

.assistant-hero p {
  max-width: 280px;
  margin: 10px 0 0;
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.6;
}

.quick-panel {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.quick-action {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
  border-radius: 8px;
  padding: 12px;
  color: #162033;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(35, 75, 130, 0.06);
  text-align: left;
}

.quick-action.primary {
  color: #ffffff;
  background:
    radial-gradient(circle at 88% 20%, rgba(255,255,255,0.24) 0 42px, transparent 43px),
    linear-gradient(135deg, #3157ff, #15a1ff);
  box-shadow: 0 12px 24px rgba(49, 87, 255, 0.22);
}

.quick-action > span {
  min-width: 0;
}

.quick-action svg {
  font-size: 24px;
}

.quick-action strong,
.quick-action small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-action strong {
  font-size: 15px;
  font-weight: 900;
}

.quick-action small {
  margin-top: 4px;
  color: inherit;
  opacity: 0.72;
  font-size: 11px;
  font-weight: 800;
}

.q-header {
  display: grid;
  height: 66px;
  flex: 0 0 auto;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
  padding: 8px 16px 0;
}

.q-header h1 {
  margin: 0;
  color: #17191d;
  font-size: 17px;
  font-weight: 900;
  text-align: center;
}

.q-header button {
  position: relative;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #17191d;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
}

.q-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 22px 20px 18px;
  scrollbar-width: none;
}

.q-scroll::-webkit-scrollbar {
  display: none;
}

.assistant-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 15px;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00b578);
  font-size: 17px;
  font-weight: 900;
}

.assistant-brand strong {
  display: block;
  color: #17191d;
  font-size: 18px;
  font-weight: 900;
}

.assistant-brand small {
  display: block;
  margin-top: 3px;
  color: #7f8a99;
  font-size: 11px;
  font-weight: 800;
}

.q-messages {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.q-message {
  max-width: 100%;
}

.q-message p {
  margin: 0;
  border-radius: 19px;
  padding: 15px 15px;
  color: #22252a;
  background: #f1f1f2;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.55;
  white-space: pre-wrap;
}

.message-files {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.message-files span {
  display: inline-flex;
  max-width: 260px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border-radius: 10px;
  padding: 7px 9px;
  color: #42607f;
  background: #eef5ff;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-message.user {
  justify-self: end;
}

.q-message.user p {
  max-width: 300px;
  color: #ffffff;
  background: #1677ff;
  font-size: 14px;
}

.message-actions {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-left: 12px;
}

.message-actions button {
  color: #696d73;
  background: transparent;
  font-size: 18px;
}

.q-input-area {
  flex: 0 0 auto;
  padding: 10px 14px 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), #ffffff 22%);
}

.suggestion-row {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  margin: 0 -14px;
  padding: 0 14px 14px;
  mask-image: linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
  overscroll-behavior-x: contain;
  scroll-padding: 14px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  touch-action: pan-x;
  -webkit-overflow-scrolling: touch;
  cursor: grab;
  user-select: none;
}

.suggestion-row:active {
  cursor: grabbing;
}

.suggestion-row::-webkit-scrollbar {
  display: none;
}

.suggestion-row button {
  flex: 0 0 auto;
  min-width: max-content;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  padding: 9px 13px;
  color: #22252a;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  font-size: 13px;
  font-weight: 900;
  scroll-snap-align: start;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.suggestion-row button.active {
  border-color: rgba(22, 119, 255, 0.28);
  color: #1677ff;
  background: #eef5ff;
  transform: translateY(-1px);
  box-shadow: 0 7px 16px rgba(22, 119, 255, 0.12);
}

.attachment-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 0 10px;
  scrollbar-width: none;
}

.attachment-row::-webkit-scrollbar {
  display: none;
}

.attachment-row button {
  display: inline-flex;
  max-width: 190px;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  border-radius: 12px;
  padding: 8px 10px;
  color: #17243a;
  background: #eef5ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.attachment-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-row em {
  color: #7f8a99;
  font-size: 10px;
  font-style: normal;
}

.q-input {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e8e8ea;
  border-radius: 22px;
  padding: 10px 12px;
  background: #ffffff;
  box-shadow: 0 5px 18px rgba(15, 23, 42, 0.07);
}

.q-input input {
  min-width: 0;
  flex: 1;
  border: 0;
  color: #17191d;
  font-size: 14px;
  font-weight: 800;
}

.q-input input::placeholder {
  color: #b0b2b6;
}

.q-input button {
  display: grid;
  width: 29px;
  height: 29px;
  flex: 0 0 auto;
  place-items: center;
  color: #17191d;
  background: transparent;
  font-size: 20px;
}

.q-input .send {
  border-radius: 50%;
  color: #ffffff;
  background: #1677ff;
  font-size: 15px;
}

.q-input-area p {
  margin: 7px 0 0;
  color: #c6c7cb;
  font-size: 9px;
  font-weight: 800;
  text-align: center;
}

.file-input {
  display: none;
}

.sidebar-overlay {
  position: absolute;
  z-index: 80;
  inset: 0;
  background: rgba(15, 23, 42, 0.24);
}

.sidebar-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(300px, 82vw);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 18px 18px 24px;
  background: #ffffff;
  box-shadow: 2px 0 32px rgba(15, 23, 42, 0.14);
}

.sidebar-panel header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sidebar-panel header strong {
  color: #17243a;
  font-size: 16px;
  font-weight: 900;
}

.sidebar-panel header button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  color: #6f7b8c;
  background: #f3f4f6;
  font-size: 16px;
}

.sidebar-new {
  display: flex;
  width: 100%;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 14px;
  padding: 11px 0;
  color: #ffffff;
  background: linear-gradient(135deg, #16a34a, #0d9488);
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(16, 122, 60, 0.18);
}

.sidebar-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
  scrollbar-width: none;
}

.sidebar-list::-webkit-scrollbar {
  display: none;
}

.sidebar-list button {
  display: block;
  width: 100%;
  border-bottom: 1px solid #f1f3f5;
  padding: 14px 0 12px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.sidebar-list strong,
.sidebar-list small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-list strong {
  color: #17243a;
  font-size: 14px;
  font-weight: 900;
}

.sidebar-list small {
  margin-top: 5px;
  color: #98a0ab;
  font-size: 11px;
  font-weight: 800;
}

.sidebar-empty {
  margin-top: 24px;
  color: #98a0ab;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.sidebar-enter-active,
.sidebar-leave-active {
  transition: opacity 0.22s ease;
}

.sidebar-enter-active .sidebar-panel,
.sidebar-leave-active .sidebar-panel {
  transition: transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
}

.sidebar-enter-from .sidebar-panel,
.sidebar-leave-to .sidebar-panel {
  transform: translateX(-100%);
}
</style>
