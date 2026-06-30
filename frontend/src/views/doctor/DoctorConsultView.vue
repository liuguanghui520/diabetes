<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CameraOutlined,
  FileImageOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  PaperClipOutlined,
  RightOutlined,
  SearchOutlined,
  SendOutlined,
  SmileOutlined,
} from '@ant-design/icons-vue'
import { apiGet, authorizedFetch } from '../../api/request'
import { uploadSingleFile } from '../../api/uploads'
import { renderChatHtml } from '../../utils/chatRichText'

const router = useRouter()
const route = useRoute()

const pageMode = ref('list')
const activeDoctor = ref(1)
const keyword = ref('')
const activeFilter = ref('全部')
const message = ref('')
const toastText = ref('')
const sending = ref(false)
const chatBodyRef = ref(null)
const doctorFileInput = ref(null)
const doctorFileAccept = ref('.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg')
const pendingFiles = ref([])
const doctorList = ref([])
const threads = reactive({})
const readDoctorIds = ref(new Set())

const filterOrder = [
  '全部',
  '内分泌',
  '营养',
  '全科',
  '心血管',
  '慢病管理',
]

const filters = computed(() => {
  const available = new Set(
    doctorList.value.map((doctor) => doctor.category).filter(Boolean),
  )

  return filterOrder.filter((item) => {
    return item === '全部' || available.has(item)
  })
})

const currentDoctor = computed(() => {
  return doctorList.value.find((item) => item.id === activeDoctor.value)
    || doctorList.value[0]
    || null
})

const filteredDoctors = computed(() => {
  const query = keyword.value.trim().toLowerCase()

  return doctorList.value.filter((doctor) => {
    const matchFilter = activeFilter.value === '全部'
      || doctor.category === activeFilter.value

    const haystack = [
      doctor.name,
      doctor.title,
      doctor.department,
      doctor.hospital,
      doctor.goodAt,
      doctor.last,
      doctor.category,
      ...(doctor.tags || []),
    ]
      .join(' ')
      .toLowerCase()

    const matchKeyword = !query || haystack.includes(query)

    return matchFilter && matchKeyword
  })
})

const currentMessages = computed(() => {
  return getThread(activeDoctor.value)
})

function getUnreadCount(doctor) {
  return readDoctorIds.value.has(doctor.id)
    ? 0
    : Number(doctor.unread || 0)
}

function showToast(text) {
  toastText.value = text

  window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

function goBack() {
  if (pageMode.value === 'chat') {
    pageMode.value = 'list'
    return
  }

  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({
    name: 'health',
  })
}

function getThread(id) {
  if (!threads[id]) {
    const doctor = doctorList.value.find((item) => item.id === id)
      || currentDoctor.value
      || {
        greeting: '你好，可以把近期血糖、复查指标和问题发来。',
      }

    threads[id] = [
      {
        role: 'time',
        content: '刚刚',
      },
      {
        role: 'assistant',
        content: doctor.greeting,
        html: renderChatHtml(doctor.greeting).html,
      },
    ]
  }

  return threads[id]
}

async function scrollToBottom() {
  await nextTick()

  if (!chatBodyRef.value) {
    return
  }

  chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
}

async function openChat(doctor) {
  activeDoctor.value = doctor.id

  if (doctor.unread) {
    readDoctorIds.value = new Set([
      ...readDoctorIds.value,
      doctor.id,
    ])
  }

  getThread(doctor.id)
  pageMode.value = 'chat'

  await scrollToBottom()
}

function openDoctorProfile(doctor) {
  router.push({
    name: 'doctorProfile',
    params: {
      id: doctor.id,
    },
  })
}

function inferDoctorCategory(item) {
  const text = [
    item.department,
    item.specialty,
    item.intro,
    item.profile_md,
  ]
    .filter(Boolean)
    .join(' ')

  if (/内分泌|糖尿病|血糖|甲状腺/.test(text)) {
    return '内分泌'
  }

  if (/营养|饮食|减重|体重/.test(text)) {
    return '营养'
  }

  if (/心血管|高血压|血压|冠心病/.test(text)) {
    return '心血管'
  }

  if (/全科|家庭|社区|综合/.test(text)) {
    return '全科'
  }

  return '慢病管理'
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
      const line = chunk
        .split('\n')
        .find((item) => item.startsWith('data:'))

      if (!line) {
        continue
      }

      const rawText = line.replace(/^data:\s*/, '')

      if (rawText === '[DONE]') {
        continue
      }

      try {
        const data = JSON.parse(rawText)
        target.content += data.delta || data.content || data.answer || ''
        target.html = renderChatHtml(target.content).html
      } catch {
        target.content += rawText
        target.html = renderChatHtml(target.content).html
      }
    }
  }
}

async function sendDoctorMessage(preset = '') {
  const content = (preset || message.value).trim()

  if (sending.value) {
    return
  }

  if (!content && pendingFiles.value.length === 0) {
    showToast('先写下想咨询的问题。')
    return
  }

  const thread = getThread(activeDoctor.value)

  const finalContent = content
    || `我上传了 ${pendingFiles.value.length} 个文件，请先帮我整理重点。`

  const files = pendingFiles.value.slice()

  thread.push({
    role: 'user',
    content: files.length
      ? `${finalContent}\n${files.map((file) => `附件：${file.name}`).join('\n')}`
      : finalContent,
  })

  const reply = {
    role: 'assistant',
    content: '',
    html: '',
  }

  thread.push(reply)

  message.value = ''
  pendingFiles.value = []
  sending.value = true

  await scrollToBottom()

  try {
    const uploadedAttachments = []

    for (const file of files) {
      if (file.raw instanceof File) {
        const uploaded = await uploadSingleFile(file.raw, 'doctor')
        uploadedAttachments.push({
          file_id: uploaded.file_id,
          name: uploaded.file_name,
          size: uploaded.size,
          type: uploaded.mime_type,
          url: uploaded.url,
        })
      } else {
        uploadedAttachments.push(file)
      }
    }

    const response = await authorizedFetch(
      `/api/doctors/${activeDoctor.value}/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: null,
          message: finalContent,
          attachments: uploadedAttachments,
        }),
      },
    )

    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
      await readSse(response, reply)
    } else {
      const payload = await response.json()

      reply.content = payload.data?.reply
        || payload.data?.answer
        || '已收到咨询，我会按医学参考思路帮你梳理。'
      reply.html = renderChatHtml(reply.content).html
    }
  } catch (error) {
    reply.content = '医生咨询助手暂时不可用。急性不适或明显异常指标，请优先线下就医。'
    reply.html = renderChatHtml(reply.content).html
    showToast(error.message || '发送失败。')
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function fillSummaryPrompt() {
  message.value = '请帮我按就诊前病情摘要整理：最近血糖、用药、饮食、运动、既往病史和需要问医生的问题。'

  showToast('已填入病情摘要模板。')
}

function handleTool(type) {
  if (type === 'image' || type === 'photo' || type === 'file') {
    doctorFileAccept.value = type === 'image' || type === 'photo'
      ? 'image/*'
      : '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'

    doctorFileInput.value?.click()
    return
  }

  if (type === 'emoji') {
    message.value = `${message.value} 🙂`.trimStart()
    return
  }

  fillSummaryPrompt()
}

function handleDoctorFileChange(event) {
  const files = Array.from(event.target.files || []).map((file) => {
    return {
      raw: file,
      name: file.name,
      size: file.size,
      type: file.type || 'file',
    }
  })

  if (files.length === 0) {
    return
  }

  pendingFiles.value = [
    ...pendingFiles.value,
    ...files,
  ].slice(0, 4)

  event.target.value = ''

  showToast(`已添加 ${files.length} 个附件。`)
}

function normalizeDoctor(item, index) {
  const specialty = item.specialty || item.intro || '糖尿病慢病管理'
  const category = inferDoctorCategory(item)

  const tags = [
    category,
    ...specialty
      .split(/[、,，\s]+/)
      .filter(Boolean),
  ]
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 4)

  return {
    ...item,
    avatar: String(item.name || '医').slice(0, 1),
    hospital: item.profile_md || item.hospital || item.department || '慢病管理门诊',
    license: item.license_no || '执业信息由管理员维护',
    consultCount: item.consult_count || '0',
    goodAt: specialty,
    status: item.online_status === 'offline' ? '离线' : '在线',
    score: item.score || '4.8',
    time: index === 0 ? '刚刚' : '今天',
    unread: 0,
    category,
    tags,
    last: item.intro || '可以把近期血糖、复查指标和问题发来，我先帮你整理重点。',
    greeting: item.greeting || `你好，我是${item.name || '医生'}咨询助手。可以帮你整理复查、指标和生活管理问题。`,
    tone: ['blue', 'green', 'orange', 'purple'][index % 4],
  }
}

async function loadDoctors() {
  try {
    const result = await apiGet('/api/doctors', {
      auth: false,
    })

    const items = result.data?.items || result.data?.list || []

    doctorList.value = items.map(normalizeDoctor)

    if (!filters.value.includes(activeFilter.value)) {
      activeFilter.value = '全部'
    }
  } catch {
    doctorList.value = []
  }
}

onMounted(async () => {
  await loadDoctors()

  const doctorId = Number(route.query.doctor || 0)

  const doctor = doctorList.value.find((item) => {
    return item.id === doctorId
  })

  if (doctor) {
    openChat(doctor)
  }
})
</script>

<template>
  <main class="doctor-page">
    <section
      class="doctor-phone"
      :class="{ chatting: pageMode === 'chat' }"
    >
      <van-nav-bar
        class="doctor-nav"
        left-arrow
        :border="false"
        @click-left="goBack"
      >
        <template #title>
          <div
            v-if="pageMode === 'chat' && currentDoctor"
            class="chat-title"
          >
            <strong>{{ currentDoctor.name }}</strong>
            <span>{{ currentDoctor.status }} · {{ currentDoctor.department }}</span>
          </div>

          <span v-else>医生咨询</span>
        </template>
      </van-nav-bar>

      <section
        v-if="pageMode === 'list'"
        class="doctor-list-page"
      >
        <label class="search-box">
          <SearchOutlined />

          <input
            v-model="keyword"
            name="doctor_search"
            autocomplete="off"
            aria-label="搜索医生、科室或擅长方向"
            placeholder="搜索医生、科室、控糖问题"
          />
        </label>

        <van-tabs
          v-model:active="activeFilter"
          class="doctor-tabs"
          shrink
          swipeable
          animated
          :ellipsis="false"
          line-width="18"
          line-height="3"
          color="#1677ff"
          title-active-color="#111827"
          title-inactive-color="#6f7c8f"
        >
          <van-tab
            v-for="item in filters"
            :key="item"
            :name="item"
            :title="item"
          />
        </van-tabs>

        <section class="doctor-feed">
          <article
            v-for="doctor in filteredDoctors"
            :key="doctor.id"
            class="doctor-item"
            role="button"
            tabindex="0"
            @click="openChat(doctor)"
            @keydown.enter="openChat(doctor)"
            @keydown.space.prevent="openChat(doctor)"
          >
            <button
              type="button"
              class="avatar-button"
              :aria-label="`查看${doctor.name}资料`"
              @click.stop="openDoctorProfile(doctor)"
            >
              <span
                class="doctor-avatar"
                :class="doctor.tone"
                :style="doctor.avatar_url ? { backgroundImage: `url(${doctor.avatar_url})` } : {}"
              >
                <b v-if="!doctor.avatar_url">
                  {{ doctor.avatar }}
                </b>

                <i v-if="doctor.status === '在线'"></i>
              </span>
            </button>

            <div class="doctor-content">
              <div class="doctor-meta">
                <span>{{ doctor.department || '慢病管理门诊' }}</span>
                <em :class="{ offline: doctor.status === '离线' }">
                  {{ doctor.status }}
                </em>
              </div>

              <h2>
                {{ doctor.name }}
                <small>{{ doctor.title || '医生' }}</small>
              </h2>

              <p>{{ doctor.goodAt }}</p>

              <footer>
                <span>{{ doctor.hospital }}</span>

                <b>
                  <MessageOutlined />
                  进入咨询
                </b>
              </footer>
            </div>

            <RightOutlined class="doctor-arrow" />

            <strong
              v-if="getUnreadCount(doctor)"
              class="unread-badge"
            >
              {{ getUnreadCount(doctor) > 99 ? '99+' : getUnreadCount(doctor) }}
            </strong>
          </article>

          <div
            v-if="filteredDoctors.length === 0"
            class="empty-result"
          >
            <MedicineBoxOutlined />

            <strong>暂未找到匹配医生</strong>

            <small>
              {{
                keyword
                  ? '换一个医生姓名、科室或擅长方向试试。'
                  : '请在管理后台维护医生资料后展示。'
              }}
            </small>
          </div>
        </section>
      </section>

      <section
        v-else
        class="chat-page"
      >
        <section
          ref="chatBodyRef"
          class="chat-body"
        >
          <template
            v-for="(item, index) in currentMessages"
            :key="index"
          >
            <div
              v-if="item.role === 'time'"
              class="time-line"
            >
              {{ item.content }}
            </div>

            <article
              v-else
              :class="['message-row', item.role]"
            >
              <button
                v-if="item.role === 'assistant'"
                type="button"
                class="message-avatar"
                :class="currentDoctor?.tone"
                :aria-label="`查看${currentDoctor?.name || '医生'}简介`"
                @click="openDoctorProfile(currentDoctor)"
              >
                {{ currentDoctor?.avatar || '医' }}
              </button>

              <div
                v-if="item.role === 'assistant'"
                class="doctor-rich"
                v-html="item.html || renderChatHtml(item.content || '正在整理回复…').html"
              ></div>
              <p v-else>{{ item.content || '正在整理回复…' }}</p>

              <span
                v-if="item.role === 'user'"
                class="message-avatar user-avatar"
              >
                我
              </span>
            </article>
          </template>
        </section>
      </section>

      <form
        v-if="pageMode === 'chat'"
        class="chat-input"
        @submit.prevent="sendDoctorMessage()"
      >
        <input
          v-model="message"
          name="doctor_message"
          autocomplete="off"
          aria-label="输入医生咨询问题"
          enterkeyhint="send"
          placeholder="输入想咨询的问题"
        />

        <div
          v-if="pendingFiles.length"
          class="doctor-attachments"
        >
          <button
            v-for="(file, index) in pendingFiles"
            :key="`${file.name}-${index}`"
            type="button"
            :aria-label="`移除咨询附件 ${file.name}`"
            @click="pendingFiles.splice(index, 1)"
          >
            <PaperClipOutlined />
            {{ file.name }}
          </button>
        </div>

        <div class="tool-row">
          <button
            type="button"
            aria-label="选择图片"
            @click="handleTool('image')"
          >
            <FileImageOutlined />
          </button>

          <button
            type="button"
            aria-label="拍照上传"
            @click="handleTool('photo')"
          >
            <CameraOutlined />
          </button>

          <button
            type="button"
            aria-label="添加表情"
            @click="handleTool('emoji')"
          >
            <SmileOutlined />
          </button>

          <button
            type="button"
            aria-label="选择文件"
            @click="handleTool('file')"
          >
            <PaperClipOutlined />
          </button>

          <button
            class="send-tool"
            type="submit"
            aria-label="发送咨询消息"
            :disabled="sending"
          >
            <SendOutlined />
          </button>
        </div>

        <input
          ref="doctorFileInput"
          class="doctor-file-input"
          type="file"
          aria-label="上传咨询附件"
          multiple
          :accept="doctorFileAccept"
          @change="handleDoctorFileChange"
        />
      </form>

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
.doctor-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.doctor-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.doctor-phone.chatting {
  background: #f0f2f6;
}

.doctor-nav {
  flex: 0 0 auto;
  border-bottom: 1px solid #edf1f5;
  --van-nav-bar-height: 52px;
  --van-nav-bar-background: rgba(255, 255, 255, 0.96);
  --van-nav-bar-icon-color: #17243a;
  --van-nav-bar-arrow-size: 22px;
  --van-nav-bar-title-text-color: #17243a;
  --van-nav-bar-title-font-size: 16px;
}

.doctor-phone.chatting .doctor-nav {
  --van-nav-bar-background: rgba(248, 249, 252, 0.97);
}

.doctor-nav :deep(.van-nav-bar__title) {
  font-weight: 900;
}

.chat-title {
  display: grid;
  justify-items: center;
  line-height: 1.1;
}

.chat-title strong {
  color: #17243a;
  font-size: 15px;
  font-weight: 900;
}

.chat-title span {
  margin-top: 4px;
  color: #8b95a4;
  font-size: 10px;
  font-weight: 800;
}

.doctor-list-page {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px 28px;
  scrollbar-width: none;
}

.doctor-list-page::-webkit-scrollbar,
.chat-body::-webkit-scrollbar {
  display: none;
}

.search-box {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  height: 42px;
  border-radius: 14px;
  padding: 0 14px;
  color: #78899d;
  background: #eef3f8;
  font-size: 17px;
}

.search-box input {
  min-width: 0;
  border: 0;
  outline: 0;
  color: #17243a;
  background: transparent;
  font-size: 13px;
  font-weight: 800;
}

.search-box input::placeholder {
  color: #9aa7b5;
}

.doctor-tabs {
  margin: 10px -18px 0;
  padding: 0;
  --van-tabs-nav-background: #ffffff;
  --van-tabs-bottom-bar-color: #1677ff;
  --van-tab-active-text-color: #111827;
  --van-tab-text-color: #6f7c8f;
  --van-tab-font-size: 12px;
  --van-tabs-line-height: 33px;
}

.doctor-tabs :deep(.van-tabs__wrap) {
  height: 35px;
  overflow: hidden;
  border-bottom: 1px solid #edf1f5;
  mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 18px,
    #000 calc(100% - 18px),
    transparent 100%
  );
}

.doctor-tabs :deep(.van-tabs__nav) {
  gap: 2px;
  padding: 0 18px;
}

.doctor-tabs :deep(.van-tab) {
  min-width: 54px;
  padding: 0 8px;
  font-weight: 800;
}

.doctor-tabs :deep(.van-tab--active) {
  font-size: 13px;
  font-weight: 900;
}

.doctor-tabs :deep(.van-tabs__line) {
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  box-shadow: 0 2px 7px rgba(22, 119, 255, 0.24);
}

.doctor-tabs :deep(.van-tabs__content) {
  display: none;
}

.doctor-feed {
  overflow: hidden;
  margin: 10px -18px 0;
  border-top: 1px solid #edf1f5;
  background: #ffffff;
}

.doctor-item {
  position: relative;
  display: grid;
  width: 100%;
  grid-template-columns: 52px minmax(0, 1fr) 16px;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid #edf1f5;
  padding: 14px 18px;
  color: #17243a;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
}

.doctor-item:active {
  background: #f7faff;
}

.avatar-button {
  width: 52px;
  height: 52px;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.doctor-avatar {
  position: relative;
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00b8ff);
  background-position: center;
  background-size: cover;
  font-size: 18px;
  font-weight: 900;
}

.doctor-avatar.green {
  background: linear-gradient(135deg, #00b86b, #00c8d8);
}

.doctor-avatar.orange {
  background: linear-gradient(135deg, #ff8a00, #ff4d4f);
}

.doctor-avatar.purple {
  background: linear-gradient(135deg, #7b3cff, #1677ff);
}

.doctor-avatar i {
  position: absolute;
  right: 2px;
  bottom: 3px;
  width: 11px;
  height: 11px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #00c48c;
}

.doctor-content {
  min-width: 0;
}

.doctor-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doctor-meta span {
  overflow: hidden;
  color: #8e9caf;
  font-size: 10px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doctor-meta em {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 2px 6px;
  color: #00a870;
  background: #e6f8f0;
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
}

.doctor-meta em.offline {
  color: #9aa4b2;
  background: #f0f3f6;
}

.doctor-content h2 {
  overflow: hidden;
  margin: 5px 0 0;
  color: #17243a;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doctor-content h2 small {
  margin-left: 6px;
  color: #7e8da1;
  font-size: 11px;
  font-weight: 800;
}

.doctor-content p {
  display: -webkit-box;
  overflow: hidden;
  margin: 5px 0 0;
  color: #73859b;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.doctor-content footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}

.doctor-content footer > span {
  overflow: hidden;
  color: #a0a9b5;
  font-size: 10px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doctor-content footer b {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  color: #1677ff;
  font-size: 10px;
  font-weight: 900;
}

.doctor-content footer b svg {
  font-size: 12px;
}

.doctor-arrow {
  color: #b5c0cf;
  font-size: 14px;
}

.unread-badge {
  position: absolute;
  top: 20px;
  right: 16px;
  display: grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border-radius: 999px;
  padding: 0 4px;
  color: #ffffff;
  background: #ff4d4f;
  box-shadow: 0 0 0 2px #ffffff;
  font-size: 9px;
}

.empty-result {
  display: grid;
  min-height: 240px;
  place-items: center;
  align-content: center;
  gap: 9px;
  color: #9aa7b5;
  text-align: center;
}

.empty-result svg {
  color: #c4d6ee;
  font-size: 32px;
}

.empty-result strong {
  color: #566779;
  font-size: 14px;
  font-weight: 900;
}

.empty-result small {
  max-width: 230px;
  color: #94a1b0;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.5;
}

.chat-page {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.chat-body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 18px 14px 12px;
  scrollbar-width: none;
}

.time-line {
  margin: 8px 0 15px;
  color: #9da3ad;
  text-align: center;
  font-size: 11px;
  font-weight: 800;
}

.message-row {
  display: grid;
  grid-template-columns: 38px minmax(0, auto);
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 13px;
}

.message-row.user {
  grid-template-columns: minmax(0, auto) 38px;
  justify-content: end;
}

.message-avatar {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00b8ff);
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.message-avatar.green {
  background: linear-gradient(135deg, #00b86b, #00c8d8);
}

.message-avatar.orange {
  background: linear-gradient(135deg, #ff8a00, #ff4d4f);
}

.message-avatar.purple {
  background: linear-gradient(135deg, #7b3cff, #1677ff);
}

.user-avatar {
  color: #1677ff;
  background: #ffffff;
}

.message-row p {
  max-width: 260px;
  margin: 0;
  border-radius: 8px 18px 18px;
  padding: 10px 12px;
  color: #101936;
  background: #ffffff;
  font-size: 13px;
  font-weight: 760;
  line-height: 1.58;
  white-space: pre-wrap;
}

.doctor-rich :deep(p),
.doctor-rich :deep(ul),
.doctor-rich :deep(pre),
.doctor-rich :deep(h1),
.doctor-rich :deep(h2),
.doctor-rich :deep(h3) {
  margin: 0;
}

.doctor-rich :deep(p + p),
.doctor-rich :deep(p + ul),
.doctor-rich :deep(ul + p),
.doctor-rich :deep(details) {
  margin-top: 10px;
}

.doctor-rich :deep(ul) {
  padding-left: 18px;
}

.doctor-rich :deep(li + li) {
  margin-top: 6px;
}

.doctor-rich :deep(code) {
  border-radius: 8px;
  padding: 2px 6px;
  background: rgba(23, 25, 29, 0.08);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.92em;
}

.doctor-rich :deep(a) {
  color: #1677ff;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.doctor-rich :deep(.chat-thinking) {
  border: 1px solid rgba(22, 119, 255, 0.15);
  border-radius: 16px;
  padding: 10px 12px;
  background: rgba(22, 119, 255, 0.04);
}

.doctor-rich :deep(.chat-thinking summary) {
  cursor: pointer;
  color: #4f6480;
  font-size: 12px;
  font-weight: 900;
}

.doctor-rich :deep(.chat-thinking pre) {
  margin-top: 10px;
  white-space: pre-wrap;
  color: #51667f;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
}

.message-row.user p {
  border-radius: 18px 8px 18px 18px;
  color: #ffffff;
  background: #1296ff;
}

.chat-input {
  flex: 0 0 auto;
  padding: 10px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
}

.chat-input input {
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 13px;
  padding: 0 13px;
  color: #101936;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #edf1f5;
  font-size: 13px;
  font-weight: 800;
}

.chat-input input::placeholder {
  color: #a1a8b3;
}

.doctor-attachments {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0 0;
  scrollbar-width: none;
}

.doctor-attachments::-webkit-scrollbar {
  display: none;
}

.doctor-attachments button {
  display: inline-flex;
  max-width: 180px;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 6px 9px;
  color: #1677ff;
  background: #eef6ff;
  font-size: 11px;
  font-weight: 800;
}

.doctor-file-input {
  display: none;
}

.tool-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.tool-row button {
  display: grid;
  height: 34px;
  place-items: center;
  border: 0;
  color: #252a33;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
}

.tool-row .send-tool {
  border-radius: 12px;
  color: #ffffff;
  background: #1296ff;
}

.tool-row .send-tool:disabled {
  opacity: 0.58;
}

.app-toast {
  position: absolute;
  z-index: 60;
  right: 50%;
  bottom: calc(84px + env(safe-area-inset-bottom));
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
  .doctor-list-page {
    padding-right: 14px;
    padding-left: 14px;
  }

  .doctor-tabs,
  .doctor-feed {
    margin-right: -14px;
    margin-left: -14px;
  }

  .doctor-tabs :deep(.van-tabs__nav) {
    padding-right: 14px;
    padding-left: 14px;
  }

  .doctor-item {
    grid-template-columns: 47px minmax(0, 1fr) 14px;
    gap: 10px;
    padding-right: 14px;
    padding-left: 14px;
  }

  .avatar-button,
  .doctor-avatar {
    width: 47px;
    height: 47px;
  }

  .doctor-content h2 {
    font-size: 15px;
  }

  .doctor-content footer b {
    display: none;
  }
}
</style>
