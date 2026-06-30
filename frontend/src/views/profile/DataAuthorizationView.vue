<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleFilled,
  FileTextOutlined,
  LeftOutlined,
  MedicineBoxOutlined,
  ReadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()

const toastText = ref('')
const showWithdrawConfirm = ref(false)

const AUTHORIZATION_KEY = 'diabetesDataAuthorizations'

const defaultAuthorizations = {
  healthData: true,
  assistantContext: true,
  planSuggestion: true,
  newsRecommendation: true,
}

function readAuthorizations() {
  try {
    const raw = localStorage.getItem(AUTHORIZATION_KEY)
    const parsed = raw ? JSON.parse(raw) : {}

    return {
      ...defaultAuthorizations,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    }
  } catch {
    return {
      ...defaultAuthorizations,
    }
  }
}

const authorizations = ref(readAuthorizations())

const authorizationActive = computed(() => {
  return authorizations.value.healthData
})

const enabledCount = computed(() => {
  return [
    authorizations.value.assistantContext,
    authorizations.value.planSuggestion,
    authorizations.value.newsRecommendation,
  ].filter(Boolean).length
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

function saveAuthorizations() {
  localStorage.setItem(
    AUTHORIZATION_KEY,
    JSON.stringify(authorizations.value),
  )
}

function updateMaster(value) {
  if (value) {
    authorizations.value = {
      ...authorizations.value,
      healthData: true,
    }

    saveAuthorizations()
    showToast('已恢复健康数据智能分析授权。')
    return
  }

  authorizations.value = {
    healthData: false,
    assistantContext: false,
    planSuggestion: false,
    newsRecommendation: false,
  }

  saveAuthorizations()
  showToast('已撤回全部智能分析授权。')
}

function updateAuthorization(key, value) {
  if (!authorizations.value.healthData) {
    showToast('请先开启健康数据智能分析授权。')
    return
  }

  authorizations.value = {
    ...authorizations.value,
    [key]: value,
  }

  saveAuthorizations()
  showToast(value ? '授权已开启。' : '授权已关闭。')
}

function openWithdrawConfirm() {
  showWithdrawConfirm.value = true
}

function closeWithdrawConfirm() {
  showWithdrawConfirm.value = false
}

function confirmWithdrawAll() {
  authorizations.value = {
    healthData: false,
    assistantContext: false,
    planSuggestion: false,
    newsRecommendation: false,
  }

  saveAuthorizations()
  showWithdrawConfirm.value = false
  showToast('已撤回全部智能分析授权。')
}
</script>

<template>
  <main class="authorization-page">
    <section class="authorization-phone">
      <div class="authorization-scroll">
        <header class="page-nav">
          <button
            type="button"
            aria-label="返回"
            @click="goBack"
          >
            <LeftOutlined />
          </button>

          <strong>数据授权管理</strong>

          <span></span>
        </header>

        <section
          class="authorization-hero"
          :class="{ inactive: !authorizationActive }"
        >
          <div class="hero-icon">
            <CheckCircleFilled v-if="authorizationActive" />
            <StopOutlined v-else />
          </div>

          <div class="hero-copy">
            <p>健康数据智能分析</p>

            <h1>
              {{ authorizationActive ? '已授权' : '已撤回授权' }}
            </h1>

            <small>
              {{
                authorizationActive
                  ? `当前已开启 ${enabledCount} 项数据使用范围，可随时调整。`
                  : '新的智能分析、方案和推荐将不再读取健康数据。'
              }}
            </small>
          </div>
        </section>

        <section class="authorization-group">
          <div class="group-head">
            <div>
              <strong>核心授权</strong>
              <small>控制健康数据是否可用于智能分析</small>
            </div>
          </div>

          <div class="authorization-row master-row">
            <span class="row-icon blue">
              <SafetyCertificateOutlined />
            </span>

            <span class="row-copy">
              <strong>健康数据智能分析授权</strong>
              <small>用于风险分析、健康档案解读和个性化服务</small>
            </span>

            <van-switch
              :model-value="authorizations.healthData"
              size="22px"
              active-color="#1677ff"
              @update:model-value="updateMaster($event)"
            />
          </div>
        </section>

        <section class="authorization-group">
          <div class="group-head">
            <div>
              <strong>已授权使用范围</strong>
              <small>关闭任一项后，该功能将不再读取对应健康数据</small>
            </div>
          </div>

          <div class="authorization-row">
            <span class="row-icon purple">
              <RobotOutlined />
            </span>

            <span class="row-copy">
              <strong>AI 健康助手</strong>
              <small>读取健康档案摘要，提供更贴合的问题解答</small>
            </span>

            <van-switch
              :model-value="authorizations.assistantContext"
              :disabled="!authorizationActive"
              size="22px"
              active-color="#6f42ff"
              @update:model-value="updateAuthorization('assistantContext', $event)"
            />
          </div>

          <div class="authorization-row">
            <span class="row-icon orange">
              <MedicineBoxOutlined />
            </span>

            <span class="row-copy">
              <strong>生活方案定制</strong>
              <small>参考血糖、运动和生活习惯生成建议</small>
            </span>

            <van-switch
              :model-value="authorizations.planSuggestion"
              :disabled="!authorizationActive"
              size="22px"
              active-color="#f06b00"
              @update:model-value="updateAuthorization('planSuggestion', $event)"
            />
          </div>

          <div class="authorization-row">
            <span class="row-icon green">
              <ReadOutlined />
            </span>

            <span class="row-copy">
              <strong>健康资讯推荐</strong>
              <small>根据关注重点筛选控糖和复查内容</small>
            </span>

            <van-switch
              :model-value="authorizations.newsRecommendation"
              :disabled="!authorizationActive"
              size="22px"
              active-color="#00a870"
              @update:model-value="updateAuthorization('newsRecommendation', $event)"
            />
          </div>
        </section>

        <section class="explain-card">
          <span class="explain-icon">
            <FileTextOutlined />
          </span>

          <div>
            <strong>授权说明</strong>

            <p>
              你可以随时关闭单项授权或撤回全部授权。撤回后，不影响已保存的健康档案，但新的智能分析将不再使用对应数据。
            </p>
          </div>
        </section>

        <section class="safe-note">
          <UserOutlined />
          <span>授权设置仅用于当前账号的健康管理服务，不用于公开展示。</span>
        </section>

        <button
          v-if="authorizationActive"
          class="withdraw-button"
          type="button"
          @click="openWithdrawConfirm"
        >
          撤回全部智能分析授权
          <RightOutlined />
        </button>
      </div>

      <transition name="confirm">
        <section
          v-if="showWithdrawConfirm"
          class="confirm-mask"
          @click.self="closeWithdrawConfirm"
        >
          <div class="confirm-sheet">
            <div class="sheet-handle"></div>

            <h2>确认撤回全部授权？</h2>

            <p>
              撤回后，AI 健康助手、生活方案和资讯推荐将不再读取你的健康数据。
            </p>

            <div class="confirm-actions">
              <button
                type="button"
                class="cancel"
                @click="closeWithdrawConfirm"
              >
                暂不撤回
              </button>

              <button
                type="button"
                class="confirm"
                @click="confirmWithdrawAll"
              >
                确认撤回
              </button>
            </div>
          </div>
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
    </section>
  </main>
</template>

<style scoped>
.authorization-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.authorization-phone {
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

.authorization-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(28px + env(safe-area-inset-bottom));
  scrollbar-width: none;
}

.authorization-scroll::-webkit-scrollbar {
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

.authorization-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 20px 25px;
  color: #ffffff;
  background:
    radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.22), transparent 30%),
    linear-gradient(125deg, #1677ff 0%, #338bf3 54%, #1eb9ad 100%);
}

.authorization-hero.inactive {
  background:
    radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.2), transparent 30%),
    linear-gradient(125deg, #718096 0%, #8796aa 100%);
}

.hero-icon {
  display: grid;
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 25px;
}

.hero-copy {
  min-width: 0;
}

.hero-copy p {
  margin: 0;
  color: rgba(255, 255, 255, 0.79);
  font-size: 10px;
  font-weight: 900;
}

.hero-copy h1 {
  margin: 4px 0 0;
  color: #ffffff;
  font-size: 21px;
  font-weight: 900;
}

.hero-copy small {
  display: block;
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.45;
}

.authorization-group {
  margin-top: 10px;
  background: #ffffff;
}

.group-head {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #edf1f5;
  padding: 13px 20px 11px;
}

.group-head strong {
  display: block;
  color: #2d333c;
  font-size: 13px;
  font-weight: 900;
}

.group-head small {
  display: block;
  margin-top: 4px;
  color: #8996a9;
  font-size: 10px;
  font-weight: 700;
}

.authorization-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 13px;
  border-bottom: 1px solid #edf1f5;
  padding: 13px 20px;
}

.authorization-group .authorization-row:last-child {
  border-bottom: 0;
}

.master-row {
  padding-top: 14px;
  padding-bottom: 14px;
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

.purple {
  color: #6f42ff;
  background: #f1edff;
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

.explain-card {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-top: 10px;
  padding: 16px 20px;
  background: #ffffff;
}

.explain-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  color: #1677ff;
  background: #eef5ff;
  font-size: 17px;
}

.explain-card strong {
  display: block;
  color: #2d333c;
  font-size: 13px;
  font-weight: 900;
}

.explain-card p {
  margin: 5px 0 0;
  color: #74849a;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.6;
}

.safe-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 13px 20px 4px;
  color: #8b98aa;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.55;
}

.safe-note svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #6b88b3;
  font-size: 13px;
}

.withdraw-button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 14px 20px;
  color: #f04438;
  background: #ffffff;
  font-size: 13px;
  font-weight: 900;
}

.withdraw-button svg {
  color: #c6ceda;
  font-size: 15px;
}

.confirm-mask {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.42);
}

.confirm-sheet {
  width: 100%;
  border-radius: 22px 22px 0 0;
  padding: 10px 22px calc(22px + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 0 -16px 34px rgba(15, 23, 42, 0.2);
}

.sheet-handle {
  width: 34px;
  height: 4px;
  margin: 0 auto 18px;
  border-radius: 99px;
  background: #d8dee8;
}

.confirm-sheet h2 {
  margin: 0;
  color: #101936;
  font-size: 17px;
  font-weight: 900;
}

.confirm-sheet p {
  margin: 13px 0 0;
  color: #65758b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.7;
}

.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 21px;
}

.confirm-actions button {
  border-radius: 12px;
  padding: 12px 8px;
  font-size: 13px;
  font-weight: 900;
}

.confirm-actions .cancel {
  color: #536984;
  background: #eff3f8;
}

.confirm-actions .confirm {
  color: #ffffff;
  background: #f04438;
}

.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.22s ease;
}

.confirm-enter-active .confirm-sheet,
.confirm-leave-active .confirm-sheet {
  transition: transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-from .confirm-sheet,
.confirm-leave-to .confirm-sheet {
  transform: translateY(100%);
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
  .authorization-phone {
    max-width: none;
    box-shadow: none;
  }
}
</style>