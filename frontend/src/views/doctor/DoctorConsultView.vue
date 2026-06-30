<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CameraOutlined,
  FileImageOutlined,
  MedicineBoxOutlined,
  PaperClipOutlined,
  SearchOutlined,
  SendOutlined,
  SmileOutlined,
} from '@ant-design/icons-vue'
import { apiGet, authorizedFetch } from '../../api/request'

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
const filterStripRef = ref(null)
const doctorFileInput = ref(null)
const doctorFileAccept = ref('.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg')
const pendingFiles = ref([])
const doctorList = ref([])
const threads = reactive({})
const readDoctorIds = ref(new Set())
const filterDrag = reactive({
  active: false,
  moved: false,
  startX: 0,
  scrollLeft: 0,
})

const filters = computed(() => {
  const values = new Set(['全部'])
  doctorList.value.forEach((doctor) => {
    ;(doctor.tags || []).forEach((tag) => {
      if (tag) values.add(tag)
    })
  })
  return Array.from(values).slice(0, 8)
})

const currentDoctor = computed(() => doctorList.value.find((item) => item.id === activeDoctor.value) || doctorList.value[0] || null)

const filteredDoctors = computed(() => {
  const query = keyword.value.trim().toLowerCase()

  return doctorList.value.filter((doctor) => {
    const tags = doctor.tags || []
    const matchFilter = activeFilter.value === '全部' || tags.includes(activeFilter.value)
    const haystack = [
      doctor.name,
      doctor.title,
      doctor.department,
      doctor.hospital,
      doctor.last,
      ...tags,
    ].join(' ').toLowerCase()
    const matchKeyword = !query || haystack.includes(query)

    return matchFilter && matchKeyword
  })
})

const currentMessages = computed(() => getThread(activeDoctor.value))

function getUnreadCount(doctor) {
  return readDoctorIds.value.has(doctor.id) ? 0 : Number(doctor.unread || 0)
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

  router.push({ name: 'health' })
}

function getThread(id) {
  if (!threads[id]) {
    const doctor = doctorList.value.find((item) => item.id === id) || currentDoctor.value || {
      greeting: '你好，可以把近期血糖、复查指标和问题发来。'
    }
    threads[id] = [
      { role: 'time', content: '刚刚' },
      { role: 'assistant', content: doctor.greeting },
    ]
  }

  return threads[id]
}

async function scrollToBottom() {
  await nextTick()
  if (!chatBodyRef.value) return

  chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
}

async function openChat(doctor) {
  activeDoctor.value = doctor.id
  if (doctor.unread) {
    readDoctorIds.value = new Set([...readDoctorIds.value, doctor.id])
  }
  getThread(doctor.id)
  pageMode.value = 'chat'
  await scrollToBottom()
}

function openDoctorProfile(doctor) {
  router.push({ name: 'doctorProfile', params: { id: doctor.id } })
}

function setFilter(item) {
  if (filterDrag.moved) return
  activeFilter.value = item
}

function beginFilterDrag(event) {
  const row = filterStripRef.value
  if (!row) return

  filterDrag.active = true
  filterDrag.moved = false
  filterDrag.startX = event.clientX
  filterDrag.scrollLeft = row.scrollLeft
  row.setPointerCapture?.(event.pointerId)
}

function moveFilterDrag(event) {
  const row = filterStripRef.value
  if (!row || !filterDrag.active) return

  const delta = event.clientX - filterDrag.startX
  if (Math.abs(delta) > 4) {
    filterDrag.moved = true
  }
  row.scrollLeft = filterDrag.scrollLeft - delta
}

function endFilterDrag(event) {
  filterDrag.active = false
  filterStripRef.value?.releasePointerCapture?.(event.pointerId)
  window.setTimeout(() => {
    filterDrag.moved = false
  }, 0)
}

function scrollFilterRow(event) {
  const row = filterStripRef.value
  if (!row || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

  row.scrollLeft += event.deltaY
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
      const line = chunk.split('\n').find((item) => item.startsWith('data:'))
      if (!line) continue

      try {
        const data = JSON.parse(line.replace(/^data:\s*/, ''))
        target.content += data.delta || data.content || ''
      } catch {
        target.content += line.replace(/^data:\s*/, '')
      }
    }
  }
}

async function sendDoctorMessage(preset = '') {
  const content = (preset || message.value).trim()
  if (sending.value) return

  if (!content && pendingFiles.value.length === 0) {
    showToast('先写下想咨询的问题。')
    return
  }

  const thread = getThread(activeDoctor.value)
  const finalContent = content || `我上传了 ${pendingFiles.value.length} 个文件，请先帮我整理重点。`
  const files = pendingFiles.value.slice()
  thread.push({
    role: 'user',
    content: files.length
      ? `${finalContent}\n${files.map((file) => `附件：${file.name}`).join('\n')}`
      : finalContent,
  })
  const reply = { role: 'assistant', content: '' }
  thread.push(reply)
  message.value = ''
  pendingFiles.value = []
  sending.value = true
  await scrollToBottom()

  try {
    const response = await authorizedFetch(`/api/doctors/${activeDoctor.value}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: null,
        message: finalContent,
        attachments: files,
      }),
    })

    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
      await readSse(response, reply)
    } else {
      const payload = await response.json()
      reply.content = payload.data?.reply || payload.data?.answer || '已收到咨询，我会按医学参考思路帮你梳理。'
    }
  } catch (error) {
    reply.content = '医生咨询助手暂时不可用。急性不适或明显异常指标，请优先线下就医。'
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
  const files = Array.from(event.target.files || []).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || 'file',
  }))

  if (files.length === 0) return

  pendingFiles.value = [...pendingFiles.value, ...files].slice(0, 4)
  event.target.value = ''
  showToast(`已添加 ${files.length} 个附件。`)
}

function normalizeDoctor(item, index) {
  const specialty = item.specialty || item.intro || '糖尿病慢病管理'
  const tags = specialty.split(/[、,，\\s]+/).filter(Boolean).slice(0, 4)

  return {
    ...item,
    avatar: String(item.name || '医').slice(0, 1),
    hospital: item.profile_md || item.department || '慢病管理门诊',
    license: item.license_no || '执业信息由管理员维护',
    consultCount: item.consult_count || '0',
    goodAt: specialty,
    status: item.online_status === 'offline' ? '离线' : '在线',
    score: item.score || '4.8',
    time: index === 0 ? '刚刚' : '今天',
    unread: 0,
    tags: tags.length ? tags : ['糖尿病'],
    last: item.intro || '可以把近期血糖、复查指标和问题发来，我先帮你整理重点。',
    greeting: item.greeting || `你好，我是${item.name || '医生'}咨询助手。可以帮你整理复查、指标和生活管理问题。`,
    tone: ['blue', 'green', 'orange', 'purple'][index % 4],
  }
}

async function loadDoctors() {
  try {
    const result = await apiGet('/api/doctors', { auth: false })
    const items = result.data?.items || []
    doctorList.value = items.map(normalizeDoctor)
  } catch {
    doctorList.value = []
  }
}

onMounted(async () => {
  await loadDoctors()
  const doctorId = Number(route.query.doctor || 0)
  const doctor = doctorList.value.find((item) => item.id === doctorId)
  if (doctor) {
    openChat(doctor)
  }
})
</script>

<template>
  <main class="doctor-page">
    <section class="doctor-phone" :class="{ chatting: pageMode === 'chat' }">
      <van-nav-bar class="doctor-nav" left-arrow :border="false" @click-left="goBack">
        <template #title>
          <div v-if="pageMode === 'chat'" class="chat-title">
            <strong>{{ currentDoctor.name }}</strong>
            <span>{{ currentDoctor.status }} · {{ currentDoctor.department }}</span>
          </div>
          <span v-else>医生咨询</span>
        </template>
      </van-nav-bar>

      <section v-if="pageMode === 'list'" class="doctor-list-page">
        <header class="list-hero">
          <div class="hero-avatar"><MedicineBoxOutlined /></div>
          <div>
            <h1>找医生</h1>
            <p>搜索科室、方向或问题，进入后像聊天一样咨询。</p>
          </div>
        </header>

        <label class="search-box">
          <SearchOutlined />
          <input
            v-model="keyword"
            name="doctor_search"
            autocomplete="off"
            aria-label="搜索医生、科室或控糖问题"
            placeholder="搜索医生、科室、控糖问题"
          />
        </label>

        <section
          ref="filterStripRef"
          class="filter-strip"
          aria-label="医生筛选"
          @wheel.prevent="scrollFilterRow"
          @pointerdown="beginFilterDrag"
          @pointermove="moveFilterDrag"
          @pointerup="endFilterDrag"
          @pointercancel="endFilterDrag"
          @pointerleave="endFilterDrag"
        >
          <button
            v-for="item in filters"
            :key="item"
            type="button"
            :class="{ active: activeFilter === item }"
            @click="setFilter(item)"
          >
            {{ item }}
          </button>
        </section>

        <section class="doctor-list">
          <article
            v-for="doctor in filteredDoctors"
            :key="doctor.id"
            class="doctor-row"
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
              <span class="row-avatar" :class="doctor.tone">
              {{ doctor.avatar }}
              <i v-if="doctor.status === '在线'"></i>
              </span>
            </button>
            <span class="row-main">
              <span class="row-top">
                <strong>{{ doctor.name }}</strong>
                <em>{{ doctor.time }}</em>
              </span>
              <span class="row-meta">
                {{ doctor.department }} · {{ doctor.title }} · {{ doctor.score }} 分
              </span>
              <span class="row-last">{{ doctor.last }}</span>
            </span>
            <b v-if="getUnreadCount(doctor)" class="unread-badge">
              {{ getUnreadCount(doctor) > 99 ? '99+' : getUnreadCount(doctor) }}
            </b>
          </article>

          <div v-if="filteredDoctors.length === 0" class="empty-result">
            没找到匹配医生，换个关键词试试。
          </div>
        </section>
      </section>

      <section v-else class="chat-page">
        <section ref="chatBodyRef" class="chat-body">
          <template v-for="(item, index) in currentMessages" :key="index">
            <div v-if="item.role === 'time'" class="time-line">{{ item.content }}</div>
            <article v-else :class="['message-row', item.role]">
              <button
                v-if="item.role === 'assistant'"
                type="button"
                class="message-avatar"
                :class="currentDoctor.tone"
                :aria-label="`查看${currentDoctor.name}简介`"
                @click="openDoctorProfile(currentDoctor)"
              >
                {{ currentDoctor.avatar }}
              </button>
              <p>{{ item.content || '正在整理回复…' }}</p>
              <span v-if="item.role === 'user'" class="message-avatar user-avatar">我</span>
            </article>
          </template>
        </section>
      </section>

      <form v-if="pageMode === 'chat'" class="chat-input" @submit.prevent="sendDoctorMessage()">
        <input
          v-model="message"
          name="doctor_message"
          autocomplete="off"
          aria-label="输入医生咨询问题"
          enterkeyhint="send"
          placeholder="输入想咨询的问题"
        />
        <div v-if="pendingFiles.length" class="doctor-attachments">
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
          <button type="button" aria-label="选择图片" @click="handleTool('image')"><FileImageOutlined /></button>
          <button type="button" aria-label="拍照上传" @click="handleTool('photo')"><CameraOutlined /></button>
          <button type="button" aria-label="添加表情" @click="handleTool('emoji')"><SmileOutlined /></button>
          <button type="button" aria-label="选择文件" @click="handleTool('file')"><PaperClipOutlined /></button>
          <button class="send-tool" type="submit" aria-label="发送咨询消息" :disabled="sending"><SendOutlined /></button>
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
        <div v-if="toastText" class="app-toast" role="status" aria-live="polite">{{ toastText }}</div>
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
  background: #eef4ff;
}

.doctor-phone.chatting {
  background: #f0f1f5;
}

.doctor-nav {
  flex: 0 0 auto;
  border-bottom: 1px solid rgba(16, 25, 54, 0.06);
  --van-nav-bar-height: 47px;
  --van-nav-bar-background: rgba(248, 251, 255, 0.92);
  --van-nav-bar-icon-color: #101936;
  --van-nav-bar-arrow-size: 23px;
  --van-nav-bar-title-text-color: #101936;
  --van-nav-bar-title-font-size: 15px;
}

.doctor-phone.chatting .doctor-nav {
  --van-nav-bar-background: rgba(244, 245, 248, 0.95);
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
  color: #101936;
  font-size: 15px;
  font-weight: 900;
}

.chat-title span {
  margin-top: 4px;
  color: #7d8795;
  font-size: 10px;
  font-weight: 800;
}

.doctor-list-page {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px 24px;
  scrollbar-width: none;
}

.doctor-list-page::-webkit-scrollbar,
.chat-body::-webkit-scrollbar,
.filter-strip::-webkit-scrollbar {
  display: none;
}

.list-hero {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 2px 0 14px;
}

.hero-avatar {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 18px;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00c48c);
  font-size: 23px;
}

.list-hero h1 {
  margin: 0;
  color: #101936;
  font-size: 23px;
  font-weight: 900;
}

.list-hero p {
  margin: 5px 0 0;
  color: #6f7e92;
  font-size: 11px;
  font-weight: 750;
}

.search-box {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  height: 42px;
  border-radius: 15px;
  padding: 0 13px;
  color: #8a95a5;
  background: #ffffff;
}

.search-box input {
  min-width: 0;
  border: 0;
  color: #101936;
  background: transparent;
  font-size: 13px;
  font-weight: 800;
}

.search-box input::placeholder {
  color: #9aa4b2;
}

.filter-strip {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  margin: 12px -16px 0;
  padding: 0 16px 8px;
  mask-image: linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);
  overscroll-behavior-x: contain;
  scroll-padding: 16px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  touch-action: pan-x;
  -webkit-overflow-scrolling: touch;
  cursor: grab;
  user-select: none;
}

.filter-strip:active {
  cursor: grabbing;
}

.filter-strip button {
  flex: 0 0 auto;
  height: 31px;
  border-radius: 999px;
  padding: 0 13px;
  color: #60748e;
  background: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  scroll-snap-align: start;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.filter-strip button.active {
  color: #ffffff;
  background: #1677ff;
  transform: translateY(-1px);
  box-shadow: 0 7px 16px rgba(22, 119, 255, 0.18);
}

.doctor-list {
  overflow: hidden;
  margin: 3px -16px 0;
  background: #ffffff;
}

.doctor-row {
  position: relative;
  display: grid;
  width: 100%;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 13px;
  align-items: center;
  padding: 14px 16px;
  text-align: left;
  background: #ffffff;
  cursor: pointer;
}

.doctor-row::after {
  position: absolute;
  right: 16px;
  bottom: 0;
  left: 81px;
  height: 1px;
  background: #eef1f5;
  content: "";
}

.row-avatar,
.message-avatar {
  position: relative;
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00b8ff);
  font-size: 18px;
  font-weight: 900;
}

.row-avatar.green,
.message-avatar.green {
  background: linear-gradient(135deg, #00b86b, #00c8d8);
}

.row-avatar.orange,
.message-avatar.orange {
  background: linear-gradient(135deg, #ff8a00, #ff4d4f);
}

.row-avatar.purple,
.message-avatar.purple {
  background: linear-gradient(135deg, #7b3cff, #1677ff);
}

.row-avatar i {
  position: absolute;
  right: 2px;
  bottom: 4px;
  width: 11px;
  height: 11px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #00c48c;
}

.row-main {
  min-width: 0;
}

.row-top,
.row-meta,
.row-last {
  display: flex;
  min-width: 0;
  align-items: center;
}

.row-top {
  justify-content: space-between;
  gap: 10px;
}

.row-top strong {
  overflow: hidden;
  color: #141821;
  font-size: 16px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-top em {
  flex: 0 0 auto;
  color: #a1a8b3;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.row-meta {
  overflow: hidden;
  margin-top: 5px;
  color: #69788b;
  font-size: 11px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-last {
  overflow: hidden;
  margin-top: 4px;
  color: #9aa4b2;
  font-size: 11px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doctor-row .unread-badge {
  position: absolute;
  top: 42px;
  right: 16px;
  display: grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 999px;
  padding: 0 5px;
  color: #ffffff;
  background: #ff4d4f;
  font-size: 10px;
  box-shadow: 0 0 0 2px #fff;
}

.empty-result {
  padding: 42px 16px;
  color: #8a95a5;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
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
  border: 0;
  width: 38px;
  height: 38px;
  font-size: 13px;
}

.user-avatar {
  color: #1677ff;
  background: #ffffff;
}

.message-row p {
  max-width: 260px;
  margin: 0;
  border-radius: 8px 18px 18px 18px;
  padding: 10px 12px;
  color: #101936;
  background: #ffffff;
  font-size: 13px;
  font-weight: 760;
  line-height: 1.58;
  white-space: pre-wrap;
}

.message-row.user p {
  border-radius: 18px 8px 18px 18px;
  color: #ffffff;
  background: #1296ff;
}

.chat-input {
  flex: 0 0 auto;
  padding: 10px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
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
</style>
