<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BellOutlined,
  FileProtectOutlined,
  LeftOutlined,
  LockOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPut, getStoredUser } from '../../api/request'

const router = useRouter()

const user = ref(getStoredUser())
const toastText = ref('')
const loading = ref(false)
const updating = ref(false)

const SETTINGS_KEY = 'diabetesPrivacySettings'

const defaultSettings = {
  personalizedAdvice: true,
  assistantContext: true,
  messageReminder: true,
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}

    return {
      ...defaultSettings,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    }
  } catch {
    return {
      ...defaultSettings,
    }
  }
}

const settings = ref(readSettings())

const displayName = computed(() => {
  return user.value?.nickname || user.value?.username || '当前用户'
})

const accountText = computed(() => {
  return user.value?.username || user.value?.account || '未同步'
})

function showToast(text) {
  toastText.value = text

  window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({
    name: 'profile',
  })
}

function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings.value),
  )
}

function applySettings(data = {}) {
  settings.value = {
    personalizedAdvice: Boolean(data.personalized_advice_enabled),
    assistantContext: Boolean(data.assistant_context_enabled),
    messageReminder: data.health_reminder_enabled !== false,
  }
  saveSettings()
}

async function loadSettings() {
  loading.value = true

  try {
    const response = await apiGet('/api/privacy-settings')
    applySettings(response.data || {})
  } catch (error) {
    showToast(error.message || '暂未读取到隐私设置，先显示本地缓存。')
  } finally {
    loading.value = false
  }
}

async function updateSetting(key, value) {
  if (updating.value) {
    return
  }

  const previous = { ...settings.value }
  settings.value = {
    ...settings.value,
    [key]: value,
  }
  saveSettings()
  updating.value = true

  try {
    const payload = {}

    if (key === 'personalizedAdvice') {
      payload.personalized_advice_enabled = value
    } else if (key === 'assistantContext') {
      payload.assistant_context_enabled = value
    } else if (key === 'messageReminder') {
      payload.health_reminder_enabled = value
    }

    const response = await apiPut('/api/privacy-settings', payload)
    applySettings(response.data?.privacy_settings || response.data || {})
    showToast(value ? '设置已开启。' : '设置已关闭。')
  } catch (error) {
    settings.value = previous
    saveSettings()
    showToast(error.message || '设置失败，请稍后再试。')
  } finally {
    updating.value = false
  }
}

function go(route) {
  router.push({
    name: route,
  })
}

onMounted(loadSettings)
</script>

<template>
  <main class="privacy-page">
    <section class="privacy-phone">
      <div class="privacy-scroll">
        <header class="page-nav">
          <button
            type="button"
            aria-label="返回"
            @click="goBack"
          >
            <LeftOutlined />
          </button>

          <strong>账号与隐私设置</strong>

          <span></span>
        </header>

        <section class="account-summary">
          <div class="summary-icon">
            <span>{{ displayName.slice(0, 1) }}</span>
          </div>

          <div class="summary-copy">
            <p>当前健康账户</p>
            <h1>{{ displayName }}</h1>
            <small>账号：{{ accountText }}</small>
          </div>

          <SafetyCertificateOutlined class="summary-badge" />
        </section>

        <section class="setting-group">
          <p class="group-title">账号设置</p>

          <button
            class="setting-row"
            type="button"
            @click="go('personalInfo')"
          >
            <span class="row-icon blue">
              <UserOutlined />
            </span>

            <span class="row-copy">
              <strong>个人信息</strong>
              <small>昵称、性别、出生日期和所在地</small>
            </span>

            <RightOutlined />
          </button>

          <button
            class="setting-row"
            type="button"
            @click="go('changePassword')"
          >
            <span class="row-icon slate">
              <LockOutlined />
            </span>

            <span class="row-copy">
              <strong>账户安全</strong>
              <small>修改登录密码</small>
            </span>

            <RightOutlined />
          </button>
        </section>

        <section class="setting-group">
          <p class="group-title">隐私与体验</p>

          <div class="setting-row switch-row">
            <span class="row-icon blue">
              <FileProtectOutlined />
            </span>

            <span class="row-copy">
              <strong>个性化健康建议</strong>
              <small>根据档案和记录调整方案与资讯推荐</small>
            </span>

            <van-switch
              :model-value="settings.personalizedAdvice"
              :loading="loading"
              :disabled="loading || updating"
              size="22px"
              active-color="#1677ff"
              @update:model-value="updateSetting('personalizedAdvice', $event)"
            />
          </div>

          <div class="setting-row switch-row">
            <span class="row-icon green">
              <SafetyCertificateOutlined />
            </span>

            <span class="row-copy">
              <strong>AI 助手健康档案上下文</strong>
              <small>关闭后，AI 助手不会读取档案摘要</small>
            </span>

            <van-switch
              :model-value="settings.assistantContext"
              :loading="loading"
              :disabled="loading || updating"
              size="22px"
              active-color="#00a870"
              @update:model-value="updateSetting('assistantContext', $event)"
            />
          </div>

          <div class="setting-row switch-row">
            <span class="row-icon orange">
              <BellOutlined />
            </span>

            <span class="row-copy">
              <strong>健康提醒</strong>
              <small>用于计划打卡、复查和健康资讯提醒</small>
            </span>

            <van-switch
              :model-value="settings.messageReminder"
              :loading="loading"
              :disabled="loading || updating"
              size="22px"
              active-color="#1677ff"
              @update:model-value="updateSetting('messageReminder', $event)"
            />
          </div>
        </section>
      </div>

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
.privacy-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.privacy-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f1f2f4;
  box-shadow: 0 0 36px rgba(47, 87, 144, 0.1);
}

.privacy-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(28px + env(safe-area-inset-bottom));
  scrollbar-width: none;
}

.privacy-scroll::-webkit-scrollbar {
  display: none;
}

.page-nav {
  display: grid;
  height: 52px;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  align-items: center;
  padding: 0 12px;
  background: #ffffff;
}

.page-nav button {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  color: #101936;
  background: transparent;
  font-size: 18px;
}

.page-nav strong {
  color: #101936;
  font-size: 15px;
  font-weight: 900;
  text-align: center;
}

.account-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 21px 20px 24px;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.08), rgba(0, 184, 148, 0.08)),
    #ffffff;
}

.summary-icon {
  display: grid;
  width: 62px;
  height: 62px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, #dff3ff, #dff9ed);
}

.summary-icon span {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  color: #1677ff;
  background: #ffffff;
  font-size: 20px;
  font-weight: 900;
}

.summary-copy {
  min-width: 0;
  flex: 1;
}

.summary-copy p {
  margin: 0;
  color: #6e85a8;
  font-size: 10px;
  font-weight: 900;
}

.summary-copy h1 {
  overflow: hidden;
  margin: 4px 0 0;
  color: #1f2329;
  font-size: 19px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-copy small {
  display: block;
  overflow: hidden;
  margin-top: 5px;
  color: #7f91a8;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-badge {
  color: #1677ff;
  font-size: 24px;
}

.setting-group {
  margin-top: 10px;
  background: #ffffff;
}

.group-title {
  margin: 0;
  border-bottom: 1px solid #edf1f5;
  padding: 12px 20px 10px;
  color: #8b98aa;
  font-size: 11px;
  font-weight: 900;
}

.setting-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 13px;
  border-bottom: 1px solid #edf1f5;
  padding: 13px 20px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.setting-group .setting-row:last-child {
  border-bottom: 0;
}

.switch-row {
  cursor: default;
}

.row-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  font-size: 18px;
}

.blue {
  color: #1677ff;
  background: #eef5ff;
}

.green {
  color: #00a870;
  background: #e8f8f0;
}

.orange {
  color: #f06b00;
  background: #fff3e2;
}

.slate {
  color: #475467;
  background: #f2f4f7;
}

.row-copy {
  min-width: 0;
  flex: 1;
}

.row-copy strong {
  display: block;
  color: #2d333c;
  font-size: 13px;
  font-weight: 900;
}

.row-copy small {
  display: block;
  overflow: hidden;
  margin-top: 4px;
  color: #8996a9;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-row > svg {
  color: #c3c9d1;
  font-size: 15px;
}

.app-toast {
  position: absolute;
  z-index: 120;
  right: 50%;
  bottom: calc(28px + env(safe-area-inset-bottom));
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
  .privacy-phone {
    max-width: none;
    box-shadow: none;
  }
}
</style>
