<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AudioOutlined,
  CameraOutlined,
  CloseOutlined,
  CopyOutlined,
  HistoryOutlined,
  LeftOutlined,
  PaperClipOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  ShareAltOutlined,
  SoundOutlined,
} from '@ant-design/icons-vue'
import { apiGet, authorizedFetch } from '../../api/request'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'

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
const attachments = ref([])
const showHistory = ref(false)
const conversationHistory = ref([])
const loadingHistory = ref(false)

const messages = ref([
  { ...welcomeMessage },
])

const suggestions = [
  '控糖饮食',
  '风险解读',
  '生活计划',
  '报告解读',
]

const activeTask = ref(suggestions[0])

const activeHistoryKey = computed(() => {
  return conversationId.value
    ? `remote-${conversationId.value}`
    : localConversationId.value
})

const inputPlaceholder = computed(() => {
  return `${activeTask.value}，说说你的情况…`
})

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function showToast(text) {
  toastText.value = text

  window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

function cloneMessages(list) {
  return list.map((item) => ({
    role: item.role,
    content: item.content,
    files: Array.isArray(item.files)
      ? item.files.map((file) => ({ ...file }))
      : undefined,
  }))
}

async function refreshHistory() {
  loadingHistory.value = true

  try {
    const result = await apiGet('/api/assistant/conversations')

    conversationHistory.value = (result.data || []).map((item) => ({
      id: `remote-${item.id}`,
      remoteId: item.id,
      title: item.title || '新的健康对话',
      task: item.task || '',
      updatedAt: item.updated_at
        ? new Date(item.updated_at).getTime()
        : Date.now(),
      status: item.status,
    }))
  } catch {
    conversationHistory.value = []
  } finally {
    loadingHistory.value = false
  }
}

async function loadConversationMessages(item) {
  loadingHistory.value = true

  try {
    const result = await apiGet(
      `/api/assistant/conversations/${item.remoteId}/messages`,
    )

    const serverMessages = (result.data || []).map((messageItem) => ({
      role: messageItem.role,
      content: messageItem.content,
    }))

    localConversationId.value = item.id || `remote-${item.remoteId}`
    conversationId.value = item.remoteId
    activeTask.value = item.task || suggestions[0]
    attachments.value = []
    message.value = ''

    messages.value = serverMessages.length
      ? [{ ...welcomeMessage }, ...serverMessages]
      : [{ ...welcomeMessage }]
  } catch {
    localConversationId.value = item.id || createLocalId()
    conversationId.value = item.remoteId
    activeTask.value = item.task || suggestions[0]
    attachments.value = []
    message.value = ''
    messages.value = [{ ...welcomeMessage }]
  } finally {
    loadingHistory.value = false
    showHistory.value = false

    await nextTick()
  }
}

async function loadConversation(item) {
  if (item.remoteId) {
    await loadConversationMessages(item)
    return
  }

  localConversationId.value = item.id || createLocalId()
  conversationId.value = item.remoteId || null
  activeTask.value = item.task || suggestions[0]
  attachments.value = []
  message.value = ''

  messages.value = item.messages?.length
    ? cloneMessages(item.messages)
    : [{ ...welcomeMessage }]

  showHistory.value = false

  await nextTick()
}

function newConversation() {
  localConversationId.value = createLocalId()
  conversationId.value = null
  activeTask.value = suggestions[0]
  attachments.value = []
  message.value = ''
  messages.value = [{ ...welcomeMessage }]
  showHistory.value = false
}

function openHistory() {
  showHistory.value = true
  refreshHistory()
}

async function readSse(response, target) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, {
      stream: true,
    })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      const dataLine = chunk
        .split('\n')
        .find((line) => line.startsWith('data:'))

      if (!dataLine) {
        continue
      }

      try {
        const data = JSON.parse(
          dataLine.replace(/^data:\s*/, ''),
        )

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
  const content = (preset || message.value).trim()

  if ((!content && attachments.value.length === 0) || sending.value) {
    return
  }

  const pendingFiles = attachments.value.slice()

  const visibleContent = content
    || `已添加 ${pendingFiles.length} 个文件，请帮我看一下。`

  messages.value.push({
    role: 'user',
    content: visibleContent,
    files: pendingFiles,
  })

  const reply = {
    role: 'assistant',
    content: '',
  }

  messages.value.push(reply)

  message.value = ''
  attachments.value = []
  sending.value = true

  try {
    const response = await authorizedFetch('/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

      if (!response.ok || (payload?.code !== undefined && payload.code !== 0)) {
        throw new Error(payload?.message || '发送失败。')
      }

      reply.content = payload.data?.reply
        || payload.data?.answer
        || '我收到了，我们可以继续细化。'

      conversationId.value = payload.data?.conversation_id || conversationId.value
    }

    refreshHistory()
  } catch (error) {
    reply.content = '助手暂时不可用，稍后再试一次。'
    showToast(error.message || '发送失败。')
  } finally {
    sending.value = false
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
      // 用户取消系统分享时，自动回退为复制。
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
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({
    name: 'home',
  })
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
  if (!size) {
    return ''
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

function formatHistoryTime(timestamp) {
  if (!timestamp) {
    return '刚刚'
  }

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return '刚刚'
  }

  const now = new Date()

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )

  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )

  const dayDiff = Math.round((today - targetDay) / 86400000)

  const timeText = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  if (dayDiff === 0) {
    return timeText
  }

  if (dayDiff === 1) {
    return `昨天 ${timeText}`
  }

  if (dayDiff > 1 && dayDiff < 7) {
    return [
      '周日',
      '周一',
      '周二',
      '周三',
      '周四',
      '周五',
      '周六',
    ][date.getDay()]
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function handleFileChange(event) {
  const files = Array.from(event.target.files || []).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || 'file',
  }))

  if (files.length === 0) {
    return
  }

  attachments.value = [
    ...attachments.value,
    ...files,
  ].slice(0, 4)

  event.target.value = ''

  showToast(`已添加 ${files.length} 个文件。`)
}

function removeAttachment(index) {
  attachments.value.splice(index, 1)
}

function selectSuggestion(item) {
  activeTask.value = item
}

function handleTabChange(key) {
  if (key === 'assistant') {
    return
  }

  router.push({
    name: key === 'home' ? 'home' : key,
  })
}

onMounted(refreshHistory)
</script>

<template>
  <main class="assistant-shell">
    <section class="assistant-phone">
      <header class="q-header">
        <button
          type="button"
          aria-label="返回"
          @click="goBack"
        >
          <LeftOutlined />
        </button>

        <h1>健康助手</h1>

        <button
          type="button"
          aria-label="最近对话"
          @click="openHistory"
        >
          <HistoryOutlined />
        </button>
      </header>

      <div class="q-scroll">
        <section class="assistant-brand">
          <span class="brand-mark">健</span>

          <div>
            <strong>糖尿病智能助手</strong>

            <small>
              {{ conversationId ? `会话 #${conversationId}` : '新对话' }}
              · 看风险、理报告、做今天能执行的清单
            </small>
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

            <div
              v-if="item.files?.length"
              class="message-files"
            >
              <span
                v-for="file in item.files"
                :key="file.name"
              >
                <PaperClipOutlined />
                {{ file.name }}
              </span>
            </div>

            <div
              v-if="item.role === 'assistant'"
              class="message-actions"
            >
              <button
                type="button"
                aria-label="朗读回复"
                @click="speakText(item.content)"
              >
                <SoundOutlined />
              </button>

              <button
                type="button"
                aria-label="分享回复"
                @click="shareText(item.content)"
              >
                <ShareAltOutlined />
              </button>

              <button
                type="button"
                aria-label="复制回复"
                @click="copyText(item.content)"
              >
                <CopyOutlined />
              </button>
            </div>
          </article>
        </section>
      </div>

      <footer class="q-input-area">
        <div class="suggestion-row">
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

        <div
          v-if="attachments.length"
          class="attachment-row"
        >
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

        <form
          class="q-input"
          @submit.prevent="sendMessage()"
        >
          <button
            type="button"
            aria-label="语音"
            @click="handleVoiceInput"
          >
            <AudioOutlined />
          </button>

          <input
            v-model="message"
            name="assistant_message"
            autocomplete="off"
            aria-label="输入健康助手问题"
            :placeholder="inputPlaceholder"
          >

          <button
            type="button"
            aria-label="添加文件"
            @click="openFilePicker"
          >
            <PaperClipOutlined />
          </button>

          <button
            type="button"
            aria-label="拍照"
            @click="handleCameraUpload"
          >
            <CameraOutlined />
          </button>

          <button
            v-if="message.trim() || attachments.length"
            class="send"
            type="submit"
            aria-label="发送消息"
            :disabled="sending"
          >
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
        >

        <p class="ai-generated-note">内容由 AI 生成</p>
      </footer>

      <transition name="sidebar">
        <section
          v-if="showHistory"
          class="sidebar-overlay"
          @click.self="showHistory = false"
        >
          <aside class="sidebar-panel">
            <header class="sidebar-header">
              <strong>最近对话</strong>

              <button
                type="button"
                aria-label="关闭最近对话"
                @click="showHistory = false"
              >
                <CloseOutlined />
              </button>
            </header>

            <button
              class="sidebar-new"
              type="button"
              @click="newConversation"
            >
              <PlusOutlined />
              新建对话
            </button>

            <div
              v-if="conversationHistory.length"
              class="sidebar-list"
            >
              <button
                v-for="item in conversationHistory"
                :key="item.id"
                type="button"
                :class="{ active: item.id === activeHistoryKey }"
                @click="loadConversation(item)"
              >
                <span class="sidebar-item-icon">
                  <RobotOutlined />
                </span>

                <span class="sidebar-item-copy">
                  <strong>{{ item.title }}</strong>

                  <small>
                    {{ item.task || '健康助手' }}
                    ·
                    {{ formatHistoryTime(item.updatedAt) }}
                  </small>
                </span>
              </button>
            </div>

            <p
              v-else
              class="sidebar-empty"
            >
              {{ loadingHistory ? '正在读取历史对话…' : '还没有历史对话' }}
            </p>
          </aside>
        </section>
      </transition>

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

      <LiquidTabBar
        active-key="assistant"
        @change="handleTabChange"
      />
    </section>
  </main>
</template>

<style scoped>
.assistant-shell {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.assistant-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 0 36px rgba(47, 87, 144, 0.1);
}

.q-header {
  display: grid;
  height: 66px;
  flex: 0 0 auto;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
  padding: 8px 16px 0;
  background: #ffffff;
}

.q-header h1 {
  margin: 0;
  color: #17191d;
  font-size: 17px;
  font-weight: 900;
  text-align: center;
}

.q-header button {
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
  background: #ffffff;
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
  padding: 15px;
  color: #22252a;
  background: #f1f1f2;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.55;
  white-space: pre-wrap;
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
  padding: 8px 14px 3px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0),
    #ffffff 22%
  );
}

.suggestion-row {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 0 0 10px;
}

.suggestion-row button {
  min-width: 0;
  border: 1px solid #e5e5e7;
  border-radius: 14px;
  padding: 10px 2px;
  color: #22252a;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
  white-space: nowrap;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.suggestion-row button:active {
  transform: scale(0.96);
}

.suggestion-row button.active {
  border-color: rgba(22, 119, 255, 0.35);
  color: #1677ff;
  background: #eef5ff;
  box-shadow: 0 7px 16px rgba(22, 119, 255, 0.12);
}

.attachment-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 0 8px;
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
  background: transparent;
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

.q-input .send:disabled {
  opacity: 0.55;
}

.ai-generated-note {
  display: table;
  width: auto;
  margin: 3px auto 0;
  color: #c6c7cb;
  font-size: 8px;
  font-weight: 800;
  line-height: 10px;
  text-align: center;
}

.file-input {
  display: none;
}

.sidebar-overlay {
  position: absolute;
  z-index: 100;
  inset: 0;
  background: rgba(15, 23, 42, 0.3);
}

.sidebar-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  width: min(306px, 82vw);
  flex-direction: column;
  overflow: hidden;
  padding: 18px 16px calc(22px + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 4px 0 32px rgba(15, 23, 42, 0.16);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-header strong {
  color: #17243a;
  font-size: 18px;
  font-weight: 900;
}

.sidebar-header button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  color: #6f7b8c;
  background: #f2f5f8;
  font-size: 16px;
}

.sidebar-new {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 18px;
  border-radius: 14px;
  padding: 12px 0;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00a870);
  box-shadow: 0 10px 20px rgba(22, 119, 255, 0.2);
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
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
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #eef1f5;
  padding: 14px 4px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.sidebar-list button.active {
  border-radius: 12px;
  border-bottom-color: transparent;
  padding-right: 8px;
  padding-left: 8px;
  background: #eef5ff;
}

.sidebar-item-icon {
  display: grid;
  width: 31px;
  height: 31px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 9px;
  color: #1677ff;
  background: #edf5ff;
  font-size: 16px;
}

.sidebar-list button.active .sidebar-item-icon {
  color: #ffffff;
  background: #1677ff;
}

.sidebar-item-copy {
  min-width: 0;
  flex: 1;
}

.sidebar-item-copy strong,
.sidebar-item-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item-copy strong {
  color: #17243a;
  font-size: 13px;
  font-weight: 900;
}

.sidebar-item-copy small {
  margin-top: 5px;
  color: #98a0ab;
  font-size: 10px;
  font-weight: 800;
}

.sidebar-empty {
  margin: 42px 0 0;
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

.app-toast {
  position: absolute;
  z-index: 120;
  right: 50%;
  bottom: calc(78px + env(safe-area-inset-bottom));
  max-width: calc(100% - 48px);
  border-radius: 999px;
  padding: 10px 15px;
  color: #ffffff;
  background: rgba(19, 37, 66, 0.92);
  box-shadow: 0 10px 24px rgba(20, 36, 65, 0.16);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.35;
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

@media (max-width: 430px) {
  .assistant-phone {
    max-width: none;
    box-shadow: none;
  }
}

@media (max-width: 360px) {
  .q-scroll {
    padding-right: 16px;
    padding-left: 16px;
  }

  .q-input-area {
    padding-right: 10px;
    padding-left: 10px;
  }

  .suggestion-row {
    gap: 6px;
  }

  .suggestion-row button {
    font-size: 11px;
  }

  .assistant-brand strong {
    font-size: 16px;
  }

  .assistant-brand small {
    font-size: 10px;
  }

  .sidebar-panel {
    width: min(286px, 84vw);
  }
}
</style>