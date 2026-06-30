<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginByPassword, registerByPassword } from '../../api/auth'
import { ApiRequestError, saveAuthSession } from '../../api/request'

const TEST_ACCOUNT = 'test'
const TEST_PASSWORD = '123456'

function isTestAccount(account, password) {
  return (
    String(account || '').trim() === TEST_ACCOUNT &&
    String(password || '') === TEST_PASSWORD
  )
}

function createTestSession() {
  return {
    token: 'local-test-account-token',
    user: {
      id: 'local-test-user',
      username: TEST_ACCOUNT,
      nickname: '测试用户',
      role: 'user',
      avatar: '',
      phone: '',
      email: '',
    },
  }
}

const router = useRouter()
const route = useRoute()

const mode = ref('login')
const account = ref('')
const password = ref('')
const confirmPassword = ref('')
const agreed = ref(false)
const showPassword = ref(false)
const focusedField = ref('')
const submitting = ref(false)
const noticeText = ref('')

let noticeTimer = null
let redirectTimer = null

const isRegister = computed(() => mode.value === 'register')

const pageTitle = computed(() => {
  return isRegister.value ? '创建健康账户' : '账号密码登录'
})

const pageDesc = computed(() => {
  return isRegister.value
    ? '建立账户后，健康档案、评估结果与生活方案会被安全保存。'
    : '继续记录，让健康变化变得更清晰。'
})

const submitText = computed(() => {
  if (submitting.value) {
    return isRegister.value ? '正在创建账户' : '正在验证身份'
  }

  return isRegister.value ? '创建账户' : '登录'
})

const canSubmit = computed(() => {
  if (!account.value.trim() || !password.value.trim() || !agreed.value) {
    return false
  }

  if (isRegister.value && !confirmPassword.value.trim()) {
    return false
  }

  return true
})

function showNotice(text) {
  noticeText.value = text

  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }

  noticeTimer = window.setTimeout(() => {
    noticeText.value = ''
  }, 2600)
}

function goBack() {
  router.push('/journey')
}

function switchMode(nextMode) {
  mode.value = nextMode
  password.value = ''
  confirmPassword.value = ''
  showPassword.value = false
  focusedField.value = ''
  noticeText.value = ''
}

function getErrorMessage(error) {
  if (error instanceof ApiRequestError) {
    return error.message
  }

  return '操作失败，请稍后重试。'
}

async function handleSubmit() {
  if (!account.value.trim()) {
    showNotice('请输入账号、手机号或邮箱')
    return
  }

  if (!password.value.trim()) {
    showNotice('请输入密码')
    return
  }

  if (isRegister.value && password.value.length < 6) {
    showNotice('密码至少需要 6 位')
    return
  }

  if (isRegister.value && password.value !== confirmPassword.value) {
    showNotice('两次输入的密码不一致')
    return
  }

  if (!agreed.value) {
    showNotice('请先阅读并同意隐私政策与健康数据说明')
    return
  }

  submitting.value = true

  try {
    let session

    if (isRegister.value) {
      session = await registerByPassword({
        username: account.value.trim(),
        password: password.value,
        nickname: account.value.trim(),
      })

      showNotice('账户创建成功，正在进入健康空间。')
    } else if (isTestAccount(account.value, password.value)) {
      session = createTestSession()
      saveAuthSession(session)

      showNotice('测试账号登录成功，正在进入健康空间。')
    } else {
      session = await loginByPassword(
        account.value.trim(),
        password.value,
      )

      showNotice('登录成功，正在进入健康空间。')
    }

    redirectTimer = window.setTimeout(() => {
      const role = session?.user?.role
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
      const safeRedirect = redirect.startsWith('/') ? redirect : ''
      const target = ['admin', 'super_admin'].includes(role)
        ? '/admin/dashboard'
        : safeRedirect || '/home'

      router.replace(target)
    }, 520)
  } catch (error) {
    showNotice(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

function openPhoneLogin() {
  showNotice('请使用已注册账号和密码登录。')
}

function openPrivacy() {
  showNotice('仅收集账号、健康档案和对话所需的最小信息，用于智能分析与个性化建议。')
}

function openHealthDataInfo() {
  showNotice('健康数据属于敏感信息，可在个人中心关闭智能分析上下文。')
}

onBeforeUnmount(() => {
  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }

  if (redirectTimer) {
    window.clearTimeout(redirectTimer)
  }
})
</script>

<template>
  <main class="login-page">
    <section
      class="login-phone"
      :class="{ 'register-mode': isRegister }"
    >
      <header class="login-topbar">
        <button
          class="back-button"
          type="button"
          aria-label="返回健康旅程引导页"
          @click="goBack"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M14.8 5.5L8.3 12L14.8 18.5"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button class="privacy-button" type="button" @click="openPrivacy">
          隐私说明
        </button>
      </header>

      <section class="login-main">
        <div class="login-heading">
          <div class="heading-mark" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <p class="heading-eyebrow">
            {{ isRegister ? 'HEALTH ACCOUNT' : 'WELCOME BACK' }}
          </p>

          <h1>{{ pageTitle }}</h1>

          <p class="heading-desc">
            {{ pageDesc }}
          </p>

          <div class="health-trace" aria-hidden="true">
            <svg viewBox="0 0 260 42" fill="none">
              <path
                d="M1 27H38L54 27L68 14L83 35L102 7L118 27H151L165 19L180 27H259"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <i></i>
          </div>

          <p v-if="!isRegister" class="test-account-tip">
            测试账号：<b>test</b>
            <span>密码：<b>123456</b></span>
          </p>
        </div>

        <form class="login-form" @submit.prevent="handleSubmit">
          <label
            class="input-row"
            :class="{ focused: focusedField === 'account' }"
          >
            <span class="field-name">
              {{ isRegister ? '设置账号' : '账号' }}
            </span>

            <span class="input-main">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle
                  cx="12"
                  cy="8.1"
                  r="3.1"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
                <path
                  d="M5.5 19C6.3 15.8 8.5 14 12 14C15.5 14 17.7 15.8 18.5 19"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                />
              </svg>

              <input
                v-model="account"
                type="text"
                :aria-label="isRegister ? '注册账号' : '登录账号'"
                :placeholder="
                  isRegister
                    ? '用户名、手机号或邮箱'
                    : '输入账号、手机号或邮箱'
                "
                autocomplete="username"
                @focus="focusedField = 'account'"
                @blur="focusedField = ''"
              />
            </span>

            <i class="field-line"></i>
          </label>

          <label
            class="input-row"
            :class="{ focused: focusedField === 'password' }"
          >
            <span class="field-name">
              {{ isRegister ? '设置密码' : '密码' }}
            </span>

            <span class="input-main">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="5.3"
                  y="10"
                  width="13.4"
                  height="9"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
                <path
                  d="M8.3 10V7.8C8.3 5.8 9.9 4.2 12 4.2C14.1 4.2 15.7 5.8 15.7 7.8V10"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                />
              </svg>

              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :aria-label="isRegister ? '设置密码' : '登录密码'"
                placeholder="请输入密码"
                :autocomplete="isRegister ? 'new-password' : 'current-password'"
                @focus="focusedField = 'password'"
                @blur="focusedField = ''"
              />

              <button
                class="password-button"
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @mousedown.prevent
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3.7 12C5.6 8.7 8.4 7 12 7C15.6 7 18.4 8.7 20.3 12C18.4 15.3 15.6 17 12 17C8.4 17 5.6 15.3 3.7 12Z"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="2.4"
                    stroke="currentColor"
                    stroke-width="1.7"
                  />
                </svg>

                <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4.2 4.2L19.8 19.8"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                  />
                  <path
                    d="M9.9 7.2C10.6 7 11.3 7 12 7C15.6 7 18.4 8.7 20.3 12C19.6 13.2 18.7 14.2 17.7 14.9"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                  />
                  <path
                    d="M14 16.7C13.4 16.9 12.7 17 12 17C8.4 17 5.6 15.3 3.7 12C4.5 10.7 5.5 9.6 6.6 8.9"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                  />
                  <path
                    d="M10 10C9.7 10.4 9.6 10.9 9.6 11.4C9.6 12.7 10.7 13.8 12 13.8C12.5 13.8 13 13.6 13.4 13.3"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </span>

            <i class="field-line"></i>
          </label>

          <label
            v-if="isRegister"
            class="input-row"
            :class="{ focused: focusedField === 'confirmPassword' }"
          >
            <span class="field-name">确认密码</span>

            <span class="input-main">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 12.2L10.2 15.3L17.2 8.4"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <rect
                  x="4.7"
                  y="4.7"
                  width="14.6"
                  height="14.6"
                  rx="3"
                  stroke="currentColor"
                  stroke-width="1.7"
                />
              </svg>

              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="再次输入密码"
                autocomplete="new-password"
                @focus="focusedField = 'confirmPassword'"
                @blur="focusedField = ''"
              />
            </span>

            <i class="field-line"></i>
          </label>

          <label class="agreement-row">
            <input v-model="agreed" type="checkbox" />

            <span>
              我已阅读并同意
              <button type="button" @click.prevent="openPrivacy">
                隐私政策
              </button>
              和
              <button type="button" @click.prevent="openHealthDataInfo">
                健康数据说明
              </button>
            </span>
          </label>

          <button
            class="submit-button"
            :class="{ ready: canSubmit, loading: submitting }"
            type="submit"
            :disabled="submitting"
          >
            <span>{{ submitText }}</span>

            <i>
              <svg v-if="!submitting" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12H19M14 7L19 12L14 17"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>

              <b v-else></b>
            </i>
          </button>

        </form>
      </section>

      <footer class="login-footer">
        <template v-if="!isRegister">
          <div class="footer-divider"></div>

          <div class="footer-options">
            <button type="button" @click="openPhoneLogin">
              <span class="option-icon">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="7.1"
                    y="3.7"
                    width="9.8"
                    height="16.6"
                    rx="2.1"
                    stroke="currentColor"
                    stroke-width="1.7"
                  />
                  <path
                    d="M10.2 17.2H13.8"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
              <small>手机号登录</small>
            </button>

          </div>

          <button class="register-prompt" type="button" @click="switchMode('register')">
            <span>还没有健康账户？</span>
            <strong>创建账户</strong>
            <i>→</i>
          </button>
        </template>

        <template v-else>
          <button class="login-prompt" type="button" @click="switchMode('login')">
            <span>已有健康账户？</span>
            <strong>去登录</strong>
            <i>→</i>
          </button>
        </template>

        <p class="footer-note">
          本系统用于日常健康管理与风险筛查参考，不替代医生诊断、处方或线下治疗建议。
        </p>
      </footer>

      <transition name="toast">
        <div v-if="noticeText" class="notice-toast">
          <span></span>
          <p>{{ noticeText }}</p>
        </div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 16% 10%, rgba(255, 255, 255, 0.74), transparent 27%),
    radial-gradient(circle at 84% 84%, rgba(198, 220, 255, 0.82), transparent 29%),
    linear-gradient(135deg, #dce8f8 0%, #c7daf4 100%);
}

.login-phone {
  position: relative;
  display: grid;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background:
    radial-gradient(circle at 68% 16%, rgba(196, 237, 255, 0.74), transparent 27%),
    linear-gradient(145deg, #f9fcff 0%, #f3f8ff 56%, #f8fbff 100%);
  box-shadow: 0 0 52px rgba(43, 73, 132, 0.16);
}

.login-phone::before {
  position: absolute;
  top: -72px;
  right: -82px;
  width: 260px;
  height: 260px;
  border: 1px solid rgba(28, 108, 230, 0.11);
  border-radius: 50%;
  content: "";
  pointer-events: none;
}

.login-phone::after {
  position: absolute;
  bottom: -122px;
  left: -102px;
  width: 278px;
  height: 278px;
  border: 1px solid rgba(28, 108, 230, 0.09);
  border-radius: 50%;
  content: "";
  pointer-events: none;
}

.login-topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 0;
}

.back-button,
.privacy-button {
  padding: 0;
  color: #6f7f99;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
}

.back-button {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border-radius: 50%;
  color: #2549bb;
  background: rgba(255, 255, 255, 0.58);
}

.back-button svg {
  width: 20px;
  height: 20px;
}

.privacy-button {
  color: #5270bd;
  font-weight: 700;
}

.login-main {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 0 28px;
}

.login-heading {
  margin-top: 43px;
}

.register-mode .login-heading {
  margin-top: 27px;
}

.heading-mark {
  display: flex;
  width: 38px;
  height: 28px;
  align-items: end;
  gap: 4px;
}

.heading-mark span {
  display: block;
  width: 6px;
  border-radius: 99px;
  background: #0d48ed;
}

.heading-mark span:nth-child(1) {
  height: 11px;
}

.heading-mark span:nth-child(2) {
  height: 20px;
  background: #2b81e8;
}

.heading-mark span:nth-child(3) {
  height: 27px;
  background: #51c9ce;
}

.heading-eyebrow {
  margin: 14px 0 0;
  color: #3277ca;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
}

.login-heading h1 {
  margin: 8px 0 0;
  color: #16213d;
  font-size: 33px;
  line-height: 1.12;
  letter-spacing: 0;
}

.register-mode .login-heading h1 {
  font-size: 30px;
}

.heading-desc {
  width: 86%;
  margin: 10px 0 0;
  color: #8292ac;
  font-size: 11px;
  line-height: 1.65;
}

.register-mode .heading-desc {
  width: 92%;
  font-size: 10px;
  line-height: 1.55;
}

.health-trace {
  position: relative;
  width: 164px;
  height: 28px;
  margin-top: 16px;
  overflow: hidden;
  color: #2578ec;
}

.register-mode .health-trace {
  height: 23px;
  margin-top: 12px;
}

.test-account-tip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 0;
  color: #8a9ab2;
  font-size: 10px;
  line-height: 1.5;
}

.test-account-tip span {
  position: relative;
  padding-left: 9px;
}

.test-account-tip span::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #65a9df;
  content: "";
  transform: translateY(-50%);
}

.test-account-tip b {
  color: #2c6fd8;
  font-weight: 800;
}

.health-trace svg {
  width: 100%;
  height: 100%;
}

.health-trace i {
  position: absolute;
  top: 0;
  left: -40%;
  width: 28%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.96),
    transparent
  );
  transform: skewX(-20deg);
  animation: trace-sweep 4.4s ease-in-out infinite;
}

.login-form {
  margin-top: 27px;
}

.register-mode .login-form {
  margin-top: 20px;
}

.input-row {
  position: relative;
  display: block;
  margin-top: 14px;
  border-radius: 19px;
  padding: 13px 17px 12px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 20px rgba(55, 89, 146, 0.068);
  overflow: hidden;
  transition:
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.register-mode .input-row {
  margin-top: 11px;
  border-radius: 18px;
  padding-top: 11px;
  padding-bottom: 10px;
}

.input-row.focused {
  box-shadow:
    0 0 0 2px rgba(33, 111, 236, 0.18),
    0 13px 24px rgba(42, 93, 183, 0.1);
  transform: translateY(-1px);
}

.field-name {
  display: block;
  color: #5d7394;
  font-size: 11px;
  font-weight: 800;
}

.register-mode .field-name {
  font-size: 10px;
}

.input-main {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.input-main > svg {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: #6585b4;
  transition: color 0.2s ease;
}

.register-mode .input-main > svg {
  width: 18px;
  height: 18px;
}

.input-row.focused .input-main > svg {
  color: #1767e8;
}

.input-main input {
  width: 100%;
  min-width: 0;
  border: 0;
  margin-left: 11px;
  padding: 0;
  color: #1e2b45;
  background: transparent;
  font-size: 15px;
}

.register-mode .input-main input {
  font-size: 14px;
}

.input-main input::placeholder {
  color: #b4c2d8;
}

.password-button {
  display: grid;
  width: 29px;
  height: 29px;
  flex: 0 0 auto;
  place-items: center;
  margin-left: 5px;
  border-radius: 50%;
  color: #6e8bbb;
  background: transparent;
  cursor: pointer;
}

.password-button svg {
  width: 19px;
  height: 19px;
}

.field-line {
  position: absolute;
  right: 50%;
  bottom: 0;
  left: 50%;
  height: 2px;
  border-radius: 99px;
  background: linear-gradient(90deg, #1d6fed, #58c9d2);
  transition:
    right 0.24s ease,
    left 0.24s ease;
}

.input-row.focused .field-line {
  right: 17px;
  left: 17px;
}

.agreement-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 15px;
  color: #8695ac;
  font-size: 10px;
  line-height: 1.55;
}

.register-mode .agreement-row {
  margin-top: 13px;
  font-size: 9px;
}

.agreement-row input {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  margin: 0;
  accent-color: #1767e8;
}

.register-mode .agreement-row input {
  width: 14px;
  height: 14px;
}

.agreement-row span {
  display: block;
}

.agreement-row button {
  padding: 0;
  color: #2466d6;
  background: transparent;
  cursor: pointer;
  font-size: inherit;
}

.submit-button {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  margin-top: 21px;
  border-radius: 18px;
  padding: 7px 7px 7px 19px;
  color: #ffffff;
  background: #a8cfee;
  box-shadow: 0 11px 21px rgba(64, 127, 205, 0.1);
  cursor: pointer;
  transition:
    background 0.25s ease,
    box-shadow 0.25s ease,
    transform 0.2s ease;
}

.register-mode .submit-button {
  margin-top: 16px;
  border-radius: 16px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.submit-button.ready {
  background:
    linear-gradient(108deg, #1c6fe8 0%, #247eec 48%, #4ac3d1 100%);
  box-shadow: 0 13px 24px rgba(33, 103, 225, 0.21);
}

.submit-button::before {
  position: absolute;
  top: 0;
  left: -36%;
  width: 24%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.44),
    transparent
  );
  content: "";
  transform: skewX(-20deg);
}

.submit-button.ready::before {
  animation: button-shine 4.6s ease-in-out infinite;
}

.submit-button:active {
  transform: scale(0.98);
}

.submit-button:disabled {
  cursor: default;
}

.submit-button > span {
  position: relative;
  z-index: 1;
  font-size: 15px;
  font-weight: 800;
}

.register-mode .submit-button > span {
  font-size: 14px;
}

.submit-button > i {
  position: relative;
  z-index: 1;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 13px;
  color: #2672e6;
  background: #ffffff;
  font-style: normal;
}

.register-mode .submit-button > i {
  width: 35px;
  height: 35px;
  border-radius: 11px;
}

.submit-button svg {
  width: 20px;
  height: 20px;
}

.submit-button b {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(38, 114, 230, 0.27);
  border-top-color: #2672e6;
  border-radius: 50%;
  animation: loading-spin 0.8s linear infinite;
}

.login-footer {
  position: relative;
  z-index: 2;
  padding: 18px 28px 21px;
  background: linear-gradient(
    180deg,
    rgba(244, 248, 255, 0.18),
    rgba(239, 246, 255, 0.82)
  );
}

.footer-divider {
  width: 100%;
  border-top: 1px solid rgba(202, 217, 238, 0.8);
}

.footer-options {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 54px;
  padding-top: 17px;
}

.footer-options button {
  display: flex;
  width: 88px;
  align-items: center;
  flex-direction: column;
  color: #52627a;
  background: transparent;
  cursor: pointer;
}

.option-icon {
  display: grid;
  width: 45px;
  height: 45px;
  place-items: center;
  border: 1px solid #d8e2ef;
  border-radius: 50%;
  color: #3d5578;
  background: rgba(255, 255, 255, 0.52);
  transition:
    transform 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.option-icon svg {
  width: 21px;
  height: 21px;
}

.footer-options button:hover .option-icon {
  border-color: #5f9ff0;
  color: #1767e8;
  transform: translateY(-2px);
}

.footer-options small {
  margin-top: 7px;
  color: #58677d;
  font-size: 10px;
}

.register-prompt,
.login-prompt {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 16px;
  padding: 0;
  color: #8291a8;
  background: transparent;
  cursor: pointer;
  font-size: 10px;
}

.register-prompt strong,
.login-prompt strong {
  color: #1767e8;
  font-size: 11px;
}

.register-prompt i,
.login-prompt i {
  color: #1767e8;
  font-size: 14px;
  font-style: normal;
}

.register-mode .login-footer {
  padding-top: 15px;
  padding-bottom: 18px;
}

.register-mode .login-prompt {
  margin-top: 0;
  padding: 4px 0;
}

.footer-note {
  margin: 14px 0 0;
  border-top: 1px solid rgba(205, 219, 237, 0.68);
  padding-top: 11px;
  color: #96a5b8;
  font-size: 9px;
  line-height: 1.55;
}

.notice-toast {
  position: absolute;
  z-index: 10;
  right: 23px;
  bottom: 97px;
  left: 23px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border-radius: 14px;
  padding: 11px 13px;
  color: #ffffff;
  background: rgba(24, 40, 74, 0.93);
  box-shadow: 0 13px 25px rgba(21, 37, 68, 0.19);
}

.register-mode .notice-toast {
  bottom: 78px;
}

.notice-toast span {
  display: block;
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  margin-top: 5px;
  border-radius: 50%;
  background: #62d0d0;
}

.notice-toast p {
  margin: 0;
  font-size: 10px;
  line-height: 1.55;
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
  transform: translateY(10px);
}

.back-button:active,
.privacy-button:active,
.password-button:active,
.footer-options button:active,
.register-prompt:active,
.login-prompt:active {
  transform: scale(0.95);
}

@keyframes trace-sweep {
  0%,
  54% {
    transform: translateX(0) skewX(-20deg);
  }

  84%,
  100% {
    transform: translateX(620%) skewX(-20deg);
  }
}

@keyframes button-shine {
  0%,
  52% {
    transform: translateX(0) skewX(-20deg);
  }

  84%,
  100% {
    transform: translateX(640%) skewX(-20deg);
  }
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 430px) {
  .login-phone {
    box-shadow: none;
  }
}

@media (max-height: 760px) {
  .login-topbar {
    padding-top: 16px;
  }

  .login-heading {
    margin-top: 21px;
  }

  .register-mode .login-heading {
    margin-top: 14px;
  }

  .login-heading h1 {
    font-size: 29px;
  }

  .register-mode .login-heading h1 {
    font-size: 27px;
  }

  .heading-desc {
    margin-top: 7px;
  }

  .health-trace {
    height: 20px;
    margin-top: 10px;
  }

  .login-form {
    margin-top: 17px;
  }

  .register-mode .login-form {
    margin-top: 13px;
  }

  .input-row {
    margin-top: 10px;
    padding-top: 10px;
    padding-bottom: 9px;
  }

  .register-mode .input-row {
    margin-top: 8px;
    padding-top: 9px;
    padding-bottom: 8px;
  }

  .agreement-row {
    margin-top: 11px;
  }

  .submit-button {
    margin-top: 13px;
  }

  .register-mode .submit-button {
    margin-top: 11px;
  }

  .login-footer {
    padding-top: 13px;
    padding-bottom: 14px;
  }

  .footer-options {
    padding-top: 11px;
  }

  .option-icon {
    width: 40px;
    height: 40px;
  }

  .footer-note {
    margin-top: 10px;
    padding-top: 8px;
  }
}

@media (max-width: 360px) {
  .login-topbar,
  .login-main,
  .login-footer {
    padding-right: 20px;
    padding-left: 20px;
  }

  .login-heading h1 {
    font-size: 28px;
  }

  .input-main input {
    font-size: 14px;
  }

  .footer-options {
    gap: 38px;
  }

  .footer-options button {
    width: 76px;
  }
}
</style>
