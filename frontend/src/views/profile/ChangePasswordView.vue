<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  LeftOutlined,
  LockOutlined,
} from '@ant-design/icons-vue'
import {
  apiPut,
  clearAuthSession,
} from '../../api/request'

const router = useRouter()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const toastText = ref('')

let redirectTimer = null

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
    name: 'privacySettings',
  })
}

async function submitPassword() {
  const oldValue = oldPassword.value
  const newValue = newPassword.value
  const confirmValue = confirmPassword.value

  if (!oldValue) {
    showToast('请输入当前密码。')
    return
  }

  if (!newValue) {
    showToast('请输入新密码。')
    return
  }

  if (newValue.length < 6) {
    showToast('新密码至少需要 6 位。')
    return
  }

  if (newValue !== confirmValue) {
    showToast('两次输入的新密码不一致。')
    return
  }

  if (oldValue === newValue) {
    showToast('新密码不能与当前密码相同。')
    return
  }

  submitting.value = true

  try {
    await apiPut(
      '/api/auth/password',
      {
        old_password: oldValue,
        new_password: newValue,
      },
      {
        idempotent: true,
      },
    )

    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''

    clearAuthSession()

    showToast('密码已修改，请使用新密码重新登录。')

    redirectTimer = window.setTimeout(() => {
      router.replace({
        name: 'login',
      })
    }, 900)
  } catch (error) {
    showToast(error.message || '密码修改失败，请稍后再试。')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="password-page">
    <section class="password-phone">
      <header class="page-nav">
        <button
          type="button"
          aria-label="返回"
          @click="goBack"
        >
          <LeftOutlined />
        </button>

        <strong>修改密码</strong>

        <span></span>
      </header>

      <div class="password-scroll">
        <section class="password-intro">
          <span class="intro-icon">
            <LockOutlined />
          </span>

          <div>
            <h1>修改登录密码</h1>
            <p>修改成功后需要重新登录，请牢记新密码。</p>
          </div>
        </section>

        <form
          class="password-form"
          @submit.prevent="submitPassword"
        >
          <van-cell-group
            inset
            class="password-fields"
          >
            <van-field
              v-model="oldPassword"
              type="password"
              label="当前密码"
              placeholder="请输入当前密码"
              autocomplete="current-password"
              clearable
            />

            <van-field
              v-model="newPassword"
              type="password"
              label="新密码"
              placeholder="至少 6 位"
              autocomplete="new-password"
              clearable
            />

            <van-field
              v-model="confirmPassword"
              type="password"
              label="确认密码"
              placeholder="再次输入新密码"
              autocomplete="new-password"
              clearable
            />
          </van-cell-group>

          <p class="password-tip">
            为保障账户安全，密码修改成功后当前登录状态会失效。
          </p>

          <van-button
            block
            round
            type="primary"
            native-type="submit"
            :loading="submitting"
            loading-text="修改中"
          >
            确认修改
          </van-button>
        </form>
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
.password-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.password-phone {
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

.page-nav {
  display: grid;
  height: 52px;
  flex: 0 0 auto;
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
  border: 0;
  border-radius: 50%;
  color: #101936;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
}

.page-nav button:active {
  background: #edf4fb;
  transform: scale(0.94);
}

.page-nav strong {
  color: #101936;
  font-size: 15px;
  font-weight: 900;
  text-align: center;
}

.password-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px calc(32px + env(safe-area-inset-bottom));
  scrollbar-width: none;
}

.password-scroll::-webkit-scrollbar {
  display: none;
}

.password-intro {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 2px 4px 18px;
}

.intro-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  color: #1677ff;
  background: #eaf3ff;
  font-size: 21px;
}

.password-intro h1 {
  margin: 0;
  color: #17243a;
  font-size: 18px;
  font-weight: 900;
}

.password-intro p {
  margin: 5px 0 0;
  color: #7c8da2;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.45;
}

.password-form {
  margin: 0;
}

.password-fields {
  overflow: hidden;
  margin: 0 !important;
  border-radius: 16px;
  box-shadow: 0 8px 18px rgba(45, 89, 142, 0.05);
}

.password-fields :deep(.van-field) {
  padding: 15px 14px;
}

.password-fields :deep(.van-field__label) {
  width: 64px;
  color: #536a86;
  font-size: 12px;
  font-weight: 900;
}

.password-fields :deep(.van-field__control) {
  color: #1f2b3c;
  font-size: 12px;
  font-weight: 800;
}

.password-fields :deep(.van-field__control::placeholder) {
  color: #b0bcc9;
}

.password-tip {
  margin: 12px 4px 18px;
  color: #8c9bae;
  font-size: 10px;
  font-weight: 750;
  line-height: 1.55;
}

.password-form :deep(.van-button) {
  height: 44px;
  font-size: 14px;
  font-weight: 900;
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
  .password-phone {
    max-width: none;
    box-shadow: none;
  }
}
</style>