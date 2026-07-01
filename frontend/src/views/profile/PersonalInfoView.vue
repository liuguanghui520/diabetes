<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  EnvironmentOutlined,
  IdcardOutlined,
  LeftOutlined,
  SaveOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPut, getStoredUser, updateStoredUser } from '../../api/request'

const router = useRouter()
const storedUser = ref(getStoredUser())
const toastText = ref('')
const saving = ref(false)
const showBirthCalendar = ref(false)

const minBirthDate = new Date(1900, 0, 1)
const maxBirthDate = new Date()

const form = reactive({
  nickname: storedUser.value?.nickname || storedUser.value?.username || '',
  birth_date: '',
  gender: '',
  hometown: '',
  city: '',
  occupation: '',
})

const ageText = computed(() => {
  const age = calculateAge(form.birth_date)

  return age ? `${age} 岁` : '填写后用于健康档案和个性化建议'
})

const birthDateText = computed(() => {
  if (!form.birth_date) {
    return '请选择出生日期'
  }

  return form.birth_date.replaceAll('-', '/')
})

const birthCalendarDefaultDate = computed(() => {
  const parts = parseDateParts(form.birth_date)

  if (parts) {
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
    )
  }

  return new Date(2000, 0, 1)
})

const genderOptions = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '暂不说明', value: 'unknown' },
]

function parseDateParts(value) {
  if (!value) {
    return null
  }

  const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!year || !month || !day) {
    return null
  }

  return {
    year,
    month,
    day,
  }
}

function formatDateParts(year, month, day) {
  return [
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

function getTodayParts() {
  const now = new Date()

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  }
}

function calculateAge(value) {
  const birth = parseDateParts(value)

  if (!birth) {
    return null
  }

  const today = getTodayParts()

  let age = today.year - birth.year

  if (
    today.month < birth.month
    || (today.month === birth.month && today.day < birth.day)
  ) {
    age -= 1
  }

  return age >= 0 && age < 130 ? age : null
}

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

function formatDateInput(value) {
  const parts = parseDateParts(value)

  if (!parts) {
    return ''
  }

  return formatDateParts(
    parts.year,
    parts.month,
    parts.day,
  )
}

function openBirthCalendar() {
  showBirthCalendar.value = true
}

function closeBirthCalendar() {
  showBirthCalendar.value = false
}

function confirmBirthCalendar(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return
  }

  form.birth_date = formatDateParts(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
  )

  showBirthCalendar.value = false
}

function applyProfile(data = {}) {
  const profile = data.profile || data

  Object.assign(form, {
    nickname: profile.nickname
      || storedUser.value?.nickname
      || storedUser.value?.username
      || '',
    birth_date: formatDateInput(profile.birth_date),
    gender: profile.gender || '',
    hometown: profile.hometown || '',
    city: profile.city || '',
    occupation: profile.occupation || '',
  })
}

async function loadProfile() {
  try {
    const response = await apiGet('/api/profile')
    applyProfile(response.data)
  } catch {
    showToast('暂未读取到个人信息，可以先填写本页。')
  }
}

async function saveProfile() {
  saving.value = true

  try {
    const response = await apiPut('/api/profile', {
      nickname: form.nickname.trim() || storedUser.value?.username || '',
      birth_date: form.birth_date || null,
      gender: form.gender || null,
      hometown: form.hometown.trim() || null,
      city: form.city.trim() || null,
      occupation: form.occupation.trim() || null,
    })

    const savedProfile = response.data?.profile || {}
    const savedUser = response.data?.user || {}

    storedUser.value = updateStoredUser({
      nickname: savedProfile.nickname
        || savedUser.nickname
        || form.nickname.trim(),
    }) || storedUser.value

    applyProfile({
      profile: savedProfile,
    })

    showToast('个人信息已保存。')
  } catch (error) {
    showToast(error.message || '保存失败，请稍后再试。')
  } finally {
    saving.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <main class="personal-page">
    <section class="personal-phone">
      <div class="personal-scroll">
        <header class="personal-nav">
          <button
            type="button"
            aria-label="返回"
            @click="goBack"
          >
            <LeftOutlined />
          </button>

          <strong>个人信息</strong>

          <span></span>
        </header>

        <section class="identity-block">
          <div class="avatar-box">
            <span>{{ (form.nickname || '测').slice(0, 1) }}</span>
          </div>

          <div>
            <p>基础资料</p>
            <h1>{{ form.nickname || '未设置昵称' }}</h1>
            <small>
              出生日期和性别会参与糖尿病风险评分，健康指标放在健康档案里。
            </small>
          </div>
        </section>

        <van-form
          class="personal-form"
          @submit="saveProfile"
        >
          <section class="form-band">
            <div class="band-title">
              <UserOutlined />
              <span>身份资料</span>
            </div>

            <van-cell-group
              class="field-list"
              :border="false"
            >
              <van-field
                v-model="form.nickname"
                label="姓名"
                placeholder="怎么称呼你"
                maxlength="16"
                clearable
              />

              <van-field label="性别">
                <template #input>
                  <div class="segment-row">
                    <button
                      v-for="item in genderOptions"
                      :key="item.value"
                      type="button"
                      :class="{ active: form.gender === item.value }"
                      @click="form.gender = item.value"
                    >
                      {{ item.label }}
                    </button>
                  </div>
                </template>
              </van-field>

              <van-field
                label="出生日期"
                readonly
                clickable
                :model-value="birthDateText"
                @click="openBirthCalendar"
              >
                <template #right-icon>
                  <span class="birth-field-right">
                    <van-icon name="calendar-o" />
                    <span class="age-tip">{{ ageText }}</span>
                  </span>
                </template>
              </van-field>
            </van-cell-group>
          </section>

          <section class="form-band">
            <div class="band-title">
              <EnvironmentOutlined />
              <span>所在地</span>
            </div>

            <van-cell-group
              class="field-list"
              :border="false"
            >
              <van-field
                v-model="form.hometown"
                label="家乡"
                placeholder="例如：辽宁沈阳"
                maxlength="24"
                clearable
              />

              <van-field
                v-model="form.city"
                label="常住地"
                placeholder="例如：南京江宁"
                maxlength="24"
                clearable
              />

              <van-field
                v-model="form.occupation"
                label="身份"
                placeholder="学生、职员、自由职业等"
                maxlength="24"
                clearable
              />
            </van-cell-group>
          </section>

          <button
            class="archive-link"
            type="button"
            @click="router.push({ name: 'healthArchive' })"
          >
            <IdcardOutlined />

            <span>
              <strong>继续完善糖尿病健康档案</strong>
              <small>身高体重、腰围血压、家族史和血糖数据都放在那里。</small>
            </span>

            <van-icon name="arrow" />
          </button>

          <div class="submit-spacer"></div>

          <div class="submit-bar">
            <van-button
              block
              round
              type="primary"
              native-type="submit"
              :loading="saving"
              loading-text="保存中"
            >
              <template #icon>
                <SaveOutlined />
              </template>

              保存个人信息
            </van-button>
          </div>
        </van-form>
      </div>

      <div
        v-if="showBirthCalendar"
        class="birth-calendar-layer"
      >
        <button
          type="button"
          class="birth-calendar-mask"
          aria-label="关闭出生日期选择"
          @click="closeBirthCalendar"
        ></button>

        <section class="birth-calendar-sheet">
          <header class="calendar-sheet-header">
            <button
              type="button"
              @click="closeBirthCalendar"
            >
              取消
            </button>

            <strong>选择出生日期</strong>

            <span></span>
          </header>

          <van-calendar
            :key="form.birth_date || 'default-birth-date'"
            :poppable="false"
            :show-title="false"
            :show-confirm="false"
            :show-mark="false"
            :default-date="birthCalendarDefaultDate"
            :min-date="minBirthDate"
            :max-date="maxBirthDate"
            switch-mode="year-month"
            color="#1677ff"
            :row-height="42"
            @confirm="confirmBirthCalendar"
          />

          <p class="calendar-tip">
            点击上方的年月切换按钮，再选择具体日期。
          </p>
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
.personal-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.personal-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 14% 10%, rgba(22, 119, 255, 0.12), transparent 25%),
    radial-gradient(circle at 86% 6%, rgba(0, 196, 140, 0.12), transparent 28%),
    #f7f9fc;
}

.personal-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
  scrollbar-width: none;
}

.personal-scroll::-webkit-scrollbar {
  display: none;
}

.personal-nav {
  display: grid;
  height: 48px;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  align-items: center;
  padding: 0 12px;
}

.personal-nav button {
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

.personal-nav button:active {
  background: rgba(231, 240, 251, 0.86);
}

.personal-nav strong {
  color: #101936;
  font-size: 15px;
  font-weight: 900;
  text-align: center;
}

.identity-block {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  padding: 22px 22px 28px;
  background:
    linear-gradient(135deg, rgba(22, 119, 255, 0.08), rgba(0, 196, 140, 0.08)),
    #ffffff;
}

.avatar-box {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  border-radius: 18px;
  background: linear-gradient(135deg, #dff3ff, #dff9ed);
}

.avatar-box span {
  display: grid;
  width: 45px;
  height: 45px;
  place-items: center;
  border-radius: 50%;
  color: #1677ff;
  background: #ffffff;
  font-size: 24px;
  font-weight: 900;
}

.identity-block p {
  margin: 0;
  color: #6f86a8;
  font-size: 11px;
  font-weight: 900;
}

.identity-block h1 {
  margin: 5px 0 0;
  color: #1f2329;
  font-size: 21px;
  font-weight: 900;
  line-height: 1.2;
}

.identity-block small {
  display: block;
  margin-top: 7px;
  color: #7f91a8;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.45;
}

.personal-form {
  padding: 14px 0 0;
}

.form-band {
  margin-top: 10px;
  background: #ffffff;
}

.band-title {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #edf1f5;
  padding: 13px 20px;
  color: #101936;
  font-size: 13px;
  font-weight: 900;
}

.band-title svg {
  color: #1677ff;
  font-size: 16px;
}

.field-list {
  background: transparent;
}

.field-list :deep(.van-cell) {
  min-height: 52px;
  align-items: center;
  padding: 9px 20px;
  background: transparent;
}

.field-list :deep(.van-cell::after) {
  right: 20px;
  left: 20px;
  border-color: #edf1f5;
}

.field-list :deep(.van-field__label) {
  width: 72px;
  color: #536984;
  font-size: 12px;
  font-weight: 900;
  line-height: 32px;
}

.field-list :deep(.van-field__control) {
  color: #101936;
  font-size: 13px;
  font-weight: 800;
  line-height: 32px;
}

.field-list :deep(.van-field__control::placeholder) {
  color: #a0abb8;
  font-weight: 700;
}

.segment-row {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.segment-row button {
  display: grid;
  height: 31px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: #63748b;
  background: #f1f5fa;
  cursor: pointer;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.segment-row button.active {
  color: #1677ff;
  background: #e4f2ff;
}

.birth-field-right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.birth-field-right :deep(.van-icon) {
  color: #6e87a5;
  font-size: 16px;
}

.age-tip {
  display: inline-block;
  max-width: 116px;
  overflow: hidden;
  color: #7f91a8;
  font-size: 10px;
  font-weight: 900;
  line-height: 32px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-link {
  display: grid;
  width: 100%;
  grid-template-columns: 32px minmax(0, 1fr) 18px;
  gap: 12px;
  align-items: center;
  margin-top: 10px;
  border: 0;
  border-top: 8px solid #f1f2f4;
  padding: 15px 20px;
  color: #101936;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
}

.archive-link > svg {
  color: #00a870;
  font-size: 20px;
}

.archive-link strong {
  display: block;
  font-size: 13px;
  font-weight: 900;
}

.archive-link small {
  display: block;
  overflow: hidden;
  margin-top: 4px;
  color: #7f91a8;
  font-size: 10px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-link :deep(.van-icon) {
  color: #b7c0ce;
}

.submit-spacer {
  height: 100px;
}

.submit-bar {
  position: absolute;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 9px 20px calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(
    180deg,
    rgba(247, 249, 252, 0),
    rgba(247, 249, 252, 0.9) 34%,
    #f7f9fc 100%
  );
}

.submit-bar :deep(.van-button) {
  height: 42px;
  border: 0;
  background: linear-gradient(90deg, #1677ff 0%, #00b8ff 48%, #00c48c 100%);
  box-shadow: 0 12px 24px rgba(22, 119, 255, 0.18);
  font-size: 13px;
  font-weight: 900;
}

.birth-calendar-layer {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  flex-direction: column;
}

.birth-calendar-mask {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(18, 30, 49, 0.64);
}

.birth-calendar-sheet {
  position: relative;
  z-index: 1;
  overflow: hidden;
  border-radius: 22px 22px 0 0;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 0 -12px 30px rgba(18, 30, 49, 0.16);
}

.calendar-sheet-header {
  display: grid;
  height: 54px;
  grid-template-columns: 58px minmax(0, 1fr) 58px;
  align-items: center;
  border-bottom: 1px solid #edf1f5;
  padding: 0 14px;
}

.calendar-sheet-header button {
  border: 0;
  padding: 0;
  color: #7b8da4;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  text-align: left;
}

.calendar-sheet-header strong {
  color: #17243a;
  font-size: 16px;
  font-weight: 900;
  text-align: center;
}

.birth-calendar-sheet :deep(.van-calendar) {
  height: 430px;
}

.birth-calendar-sheet :deep(.van-calendar__header) {
  box-shadow: none;
}

.birth-calendar-sheet :deep(.van-calendar__subtitle) {
  color: #17243a;
  font-size: 15px;
  font-weight: 900;
}

.birth-calendar-sheet :deep(.van-calendar__month-title) {
  display: none;
}

.birth-calendar-sheet :deep(.van-calendar__weekdays) {
  color: #8495aa;
  font-size: 11px;
  font-weight: 800;
}

.birth-calendar-sheet :deep(.van-calendar__day) {
  color: #25364d;
  font-size: 13px;
  font-weight: 800;
}

.birth-calendar-sheet :deep(.van-calendar__selected-day) {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: #1677ff;
}

.birth-calendar-sheet :deep(.van-calendar__bottom-info) {
  display: none;
}

.calendar-tip {
  margin: 0;
  padding: 4px 18px 10px;
  color: #8a9aae;
  font-size: 10px;
  font-weight: 750;
  text-align: center;
}

.app-toast {
  position: absolute;
  z-index: 120;
  right: 50%;
  bottom: calc(86px + env(safe-area-inset-bottom));
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

@media (max-width: 360px) {
  .identity-block {
    grid-template-columns: 66px minmax(0, 1fr);
    gap: 13px;
    padding-right: 18px;
    padding-left: 18px;
  }

  .avatar-box {
    width: 66px;
    height: 66px;
  }

  .field-list :deep(.van-field__label) {
    width: 64px;
  }

  .age-tip {
    max-width: 88px;
  }
}
</style>