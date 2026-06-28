<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ExperimentOutlined,
  FileSearchOutlined,
  HeartOutlined,
  LeftOutlined,
  MedicineBoxOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPut } from '../../api/request'

const router = useRouter()
const toastText = ref('')
const saving = ref(false)
const reportInput = ref(null)
const reportFiles = ref([])

const form = reactive({
  diagnosed_diabetes: null,
  diabetes_type: '',
  family_history_diabetes: null,
  height_cm: '',
  weight_kg: '',
  waist_cm: '',
  sbp_mm_hg: '',
  fasting_glucose: '',
  postprandial_glucose: '',
  hba1c: '',
  medication_status: '',
  past_history: '',
})

const diabetesTypes = [
  { label: '1 型', value: 'type1' },
  { label: '2 型', value: 'type2' },
  { label: '妊娠型', value: 'gestational' },
  { label: '暂不确定', value: 'unknown' },
]

const healthFields = [
  'diagnosed_diabetes',
  'family_history_diabetes',
  'height_cm',
  'weight_kg',
  'waist_cm',
  'sbp_mm_hg',
  'fasting_glucose',
  'postprandial_glucose',
  'hba1c',
]

const completionRate = computed(() => {
  const done = healthFields.filter((key) => hasValue(form[key])).length

  return Math.round((done / healthFields.length) * 100)
})

const scoreReady = computed(() => {
  return Boolean(
    hasValue(form.diagnosed_diabetes) &&
      hasValue(form.family_history_diabetes) &&
      form.height_cm &&
      form.weight_kg &&
      form.waist_cm &&
      form.sbp_mm_hg,
  )
})

const archiveHint = computed(() => {
  if (scoreReady.value) return '正式评分资料已就绪'

  const missing = []
  if (!hasValue(form.family_history_diabetes)) missing.push('家族史')
  if (!form.height_cm || !form.weight_kg) missing.push('身高体重')
  if (!form.waist_cm) missing.push('腰围')
  if (!form.sbp_mm_hg) missing.push('收缩压')

  return missing.length ? `还差 ${missing.slice(0, 3).join('、')}` : '可先保存，之后再补'
})

function hasValue(value) {
  return value !== '' && value !== null && value !== undefined
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

  router.push({ name: 'health' })
}

function applyProfile(data = {}) {
  const profile = data.profile || data
  Object.assign(form, {
    diagnosed_diabetes: hasValue(profile.diagnosed_diabetes) ? Boolean(profile.diagnosed_diabetes) : null,
    diabetes_type: profile.diabetes_type || '',
    family_history_diabetes: hasValue(profile.family_history_diabetes)
      ? Boolean(profile.family_history_diabetes)
      : hasValue(profile.family_history)
        ? Boolean(profile.family_history)
        : null,
    height_cm: profile.height_cm || '',
    weight_kg: profile.weight_kg || '',
    waist_cm: profile.waist_cm || '',
    sbp_mm_hg: profile.sbp_mm_hg || profile.systolic_bp || '',
    fasting_glucose: profile.fasting_glucose || '',
    postprandial_glucose: profile.postprandial_glucose || '',
    hba1c: profile.hba1c || '',
    medication_status: profile.medication_status || '',
    past_history: Array.isArray(profile.past_history)
      ? profile.past_history.join('、')
      : profile.past_history || '',
  })
}

async function loadProfile() {
  try {
    const response = await apiGet('/api/profile')
    applyProfile(response.data)
  } catch {
    showToast('暂未读取到档案，先填写本页资料。')
  }
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function saveProfile() {
  saving.value = true

  try {
    await apiPut('/api/profile', {
      diagnosed_diabetes: form.diagnosed_diabetes,
      diabetes_type: form.diagnosed_diabetes ? form.diabetes_type || 'unknown' : null,
      family_history_diabetes: form.family_history_diabetes,
      height_cm: toNullableNumber(form.height_cm),
      weight_kg: toNullableNumber(form.weight_kg),
      waist_cm: toNullableNumber(form.waist_cm),
      sbp_mm_hg: toNullableNumber(form.sbp_mm_hg),
      fasting_glucose: toNullableNumber(form.fasting_glucose),
      postprandial_glucose: toNullableNumber(form.postprandial_glucose),
      hba1c: toNullableNumber(form.hba1c),
      medication_status: form.medication_status.trim() || null,
      past_history: form.past_history
        ? form.past_history.split(/[、,，\s]+/).filter(Boolean)
        : [],
    })

    showToast('健康档案已保存。')
  } catch (error) {
    showToast(error.message || '保存失败，请稍后再试。')
  } finally {
    saving.value = false
  }
}

function openReportPicker() {
  reportInput.value?.click()
}

function handleReportFiles(event) {
  const files = Array.from(event.target.files || []).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || 'file',
  }))

  if (files.length === 0) return

  reportFiles.value = [...reportFiles.value, ...files].slice(0, 4)
  event.target.value = ''
  showToast('报告已加入待确认列表。')
}

onMounted(loadProfile)
</script>

<template>
  <main class="archive-page">
    <section class="archive-phone">
      <div class="archive-scroll">
        <header class="archive-nav">
          <button type="button" aria-label="返回" @click="goBack">
            <LeftOutlined />
          </button>
          <strong>健康档案</strong>
          <span></span>
        </header>

        <section class="archive-hero">
          <span>糖尿病资料</span>
          <h1>把能确认的健康信息先放进来</h1>
          <p>这些信息会用于健康档案、预测分数和 AI 建议；不确定的项目可以先空着。</p>
          <div class="hero-meter">
            <strong>{{ completionRate }}%</strong>
            <div>
              <van-progress
                :percentage="completionRate"
                color="linear-gradient(90deg, #1677ff, #00c48c, #ff8a00)"
                track-color="#e8eef7"
                :show-pivot="false"
                stroke-width="6"
              />
              <small>{{ archiveHint }}</small>
            </div>
          </div>
        </section>

        <van-form class="archive-form" @submit="saveProfile">
          <section class="data-section">
            <div class="section-title">
              <SafetyCertificateOutlined />
              <span>基础状态</span>
            </div>

            <van-cell-group class="line-list" :border="false">
              <van-field label="是否确诊">
                <template #input>
                  <div class="choice-row">
                    <button
                      type="button"
                      :class="{ active: form.diagnosed_diabetes === false }"
                      @click="form.diagnosed_diabetes = false"
                    >
                      未确诊
                    </button>
                    <button
                      type="button"
                      :class="{ active: form.diagnosed_diabetes === true }"
                      @click="form.diagnosed_diabetes = true"
                    >
                      已确诊
                    </button>
                    <button
                      type="button"
                      :class="{ active: form.diagnosed_diabetes === null }"
                      @click="form.diagnosed_diabetes = null"
                    >
                      暂不确定
                    </button>
                  </div>
                </template>
              </van-field>

              <van-field v-if="form.diagnosed_diabetes" label="糖尿病类型">
                <template #input>
                  <div class="pill-row">
                    <button
                      v-for="item in diabetesTypes"
                      :key="item.value"
                      type="button"
                      :class="{ active: form.diabetes_type === item.value }"
                      @click="form.diabetes_type = item.value"
                    >
                      {{ item.label }}
                    </button>
                  </div>
                </template>
              </van-field>

              <van-field label="家族史">
                <template #input>
                  <div class="choice-row">
                    <button
                      type="button"
                      :class="{ active: form.family_history_diabetes === false }"
                      @click="form.family_history_diabetes = false"
                    >
                      无
                    </button>
                    <button
                      type="button"
                      :class="{ active: form.family_history_diabetes === true }"
                      @click="form.family_history_diabetes = true"
                    >
                      有
                    </button>
                    <button
                      type="button"
                      :class="{ active: form.family_history_diabetes === null }"
                      @click="form.family_history_diabetes = null"
                    >
                      不确定
                    </button>
                  </div>
                </template>
              </van-field>
            </van-cell-group>
          </section>

          <section class="data-section">
            <div class="section-title">
              <HeartOutlined />
              <span>身体数据</span>
            </div>

            <van-cell-group class="line-list" :border="false">
              <van-field v-model="form.height_cm" label="身高" placeholder="例如 170" inputmode="decimal" clearable>
                <template #right-icon><span class="field-unit">cm</span></template>
              </van-field>
              <van-field v-model="form.weight_kg" label="体重" placeholder="例如 65" inputmode="decimal" clearable>
                <template #right-icon><span class="field-unit">kg</span></template>
              </van-field>
              <van-field v-model="form.waist_cm" label="腰围" placeholder="正式评分需要" inputmode="decimal" clearable>
                <template #right-icon><span class="field-unit">cm</span></template>
              </van-field>
              <van-field v-model="form.sbp_mm_hg" label="收缩压" placeholder="正式评分需要" inputmode="numeric" clearable>
                <template #right-icon><span class="field-unit">mmHg</span></template>
              </van-field>
            </van-cell-group>
          </section>

          <section class="data-section">
            <div class="section-title">
              <ExperimentOutlined />
              <span>血糖与报告</span>
            </div>

            <van-cell-group class="line-list" :border="false">
              <van-field
                v-model="form.fasting_glucose"
                label="空腹血糖"
                placeholder="例如 5.6"
                inputmode="decimal"
                clearable
              >
                <template #right-icon><span class="field-unit">mmol/L</span></template>
              </van-field>
              <van-field
                v-model="form.postprandial_glucose"
                label="餐后血糖"
                placeholder="餐后 2 小时"
                inputmode="decimal"
                clearable
              >
                <template #right-icon><span class="field-unit">mmol/L</span></template>
              </van-field>
              <van-field v-model="form.hba1c" label="HbA1c" placeholder="例如 5.8" inputmode="decimal" clearable>
                <template #right-icon><span class="field-unit">%</span></template>
              </van-field>
            </van-cell-group>
          </section>

          <section class="data-section">
            <div class="section-title">
              <MedicineBoxOutlined />
              <span>管理补充</span>
            </div>

            <van-cell-group class="line-list" :border="false">
              <van-field
                v-model="form.medication_status"
                label="用药情况"
                placeholder="如未用药可不填"
                maxlength="80"
                clearable
              />
              <van-field
                v-model="form.past_history"
                label="既往史"
                type="textarea"
                autosize
                rows="2"
                maxlength="120"
                show-word-limit
                placeholder="例如：高血压、脂肪肝、心血管疾病"
              />
            </van-cell-group>
          </section>

          <section class="next-list">
            <button type="button" @click="openReportPicker">
              <FileSearchOutlined />
              <span>
                <strong>上传体检报告</strong>
                <small>先放入待确认列表，后端接入后再解析指标。</small>
              </span>
              <van-icon name="arrow" />
            </button>
          </section>

          <section v-if="reportFiles.length" class="report-files">
            <button
              v-for="(file, index) in reportFiles"
              :key="`${file.name}-${index}`"
              type="button"
              @click="reportFiles.splice(index, 1)"
            >
              <FileSearchOutlined />
              <span>{{ file.name }}</span>
              <em>待确认</em>
            </button>
          </section>

          <input
            ref="reportInput"
            class="report-input"
            type="file"
            aria-label="上传体检报告"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.csv"
            @change="handleReportFiles"
          />

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
              <template #icon><SaveOutlined /></template>
              保存健康档案
            </van-button>
          </div>
        </van-form>
      </div>

      <transition name="toast">
        <div v-if="toastText" class="app-toast">{{ toastText }}</div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.archive-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.archive-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at 14% 8%, rgba(22, 119, 255, 0.14), transparent 26%),
    radial-gradient(circle at 92% 0%, rgba(0, 196, 140, 0.14), transparent 28%),
    linear-gradient(180deg, #f7fbff 0%, #f4f7fb 58%, #ffffff 100%);
}

.archive-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom);
  scrollbar-width: none;
}

.archive-scroll::-webkit-scrollbar {
  display: none;
}

.archive-nav {
  display: grid;
  height: 48px;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  align-items: center;
  padding: 0 12px;
}

.archive-nav button {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  color: #101936;
  background: transparent;
  font-size: 18px;
}

.archive-nav strong {
  color: #101936;
  font-size: 15px;
  font-weight: 900;
  text-align: center;
}

.archive-hero {
  padding: 10px 20px 18px;
}

.archive-hero > span,
.section-title span {
  display: block;
  color: #6f86a8;
  font-size: 11px;
  font-weight: 900;
}

.archive-hero h1 {
  margin: 5px 0 0;
  color: #101936;
  font-size: 21px;
  font-weight: 900;
  line-height: 1.24;
}

.archive-hero p {
  margin: 7px 0 0;
  color: #70819b;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.5;
}

.hero-meter {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 13px;
  align-items: center;
  margin-top: 15px;
  border-radius: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 10px 24px rgba(36, 61, 96, 0.06);
}

.hero-meter strong {
  color: #1677ff;
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.hero-meter small {
  display: block;
  margin-top: 6px;
  color: #7f91a8;
  font-size: 10px;
  font-weight: 900;
}

.archive-form {
  padding: 0;
}

.data-section {
  margin-top: 10px;
  background: #ffffff;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #edf1f5;
  padding: 13px 20px;
}

.section-title svg {
  color: #1677ff;
  font-size: 16px;
}

.line-list {
  background: transparent;
}

.line-list :deep(.van-cell) {
  min-height: 52px;
  align-items: center;
  padding: 9px 20px;
  background: transparent;
}

.line-list :deep(.van-cell::after) {
  right: 20px;
  left: 20px;
  border-color: #edf1f5;
}

.line-list :deep(.van-field__label) {
  width: 78px;
  color: #536984;
  font-size: 12px;
  font-weight: 900;
  line-height: 32px;
}

.line-list :deep(.van-field__control) {
  color: #101936;
  font-size: 13px;
  font-weight: 800;
  line-height: 32px;
}

.line-list :deep(.van-field__control::placeholder) {
  color: #a0abb8;
  font-weight: 700;
}

.choice-row {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.choice-row button,
.pill-row button {
  display: grid;
  min-width: 0;
  height: 31px;
  place-items: center;
  border-radius: 999px;
  color: #63748b;
  background: #f1f5fa;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.choice-row button.active,
.pill-row button.active {
  color: #1677ff;
  background: #e4f2ff;
}

.pill-row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 7px;
}

.pill-row button {
  padding: 0 12px;
}

.field-unit {
  color: #8091a8;
  font-size: 10px;
  font-weight: 900;
  line-height: 32px;
}

.next-list {
  margin-top: 10px;
  background: #ffffff;
}

.next-list button {
  display: grid;
  width: 100%;
  grid-template-columns: 28px minmax(0, 1fr) 18px;
  gap: 13px;
  align-items: center;
  border-bottom: 1px solid #edf1f5;
  padding: 13px 20px;
  color: #101936;
  background: transparent;
  text-align: left;
}

.next-list button:last-child {
  border-bottom: 0;
}

.next-list button > svg {
  color: #1677ff;
  font-size: 20px;
}

.next-list strong {
  display: block;
  font-size: 13px;
  font-weight: 900;
}

.next-list small {
  display: block;
  overflow: hidden;
  margin-top: 4px;
  color: #7f91a8;
  font-size: 10px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.next-list :deep(.van-icon) {
  color: #b7c0ce;
}

.report-files {
  display: grid;
  gap: 1px;
  margin-top: 10px;
  background: #ffffff;
}

.report-files button {
  display: grid;
  width: 100%;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: #123055;
  background: #ffffff;
  text-align: left;
}

.report-files svg {
  color: #00b86b;
  font-size: 18px;
}

.report-files span {
  overflow: hidden;
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-files em {
  color: #00a870;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.report-input {
  display: none;
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
  background: linear-gradient(180deg, rgba(247, 249, 252, 0), rgba(247, 249, 252, 0.9) 34%, #f7f9fc 100%);
}

.submit-bar :deep(.van-button) {
  height: 42px;
  border: 0;
  background: linear-gradient(90deg, #1677ff 0%, #00b8ff 48%, #00c48c 100%);
  box-shadow: 0 12px 24px rgba(22, 119, 255, 0.18);
  font-size: 13px;
  font-weight: 900;
}

@media (max-width: 360px) {
  .archive-nav {
    grid-template-columns: 42px minmax(0, 1fr) 42px;
  }

  .line-list :deep(.van-field__label) {
    width: 68px;
  }

  .choice-row {
    gap: 5px;
  }

  .choice-row button,
  .pill-row button {
    font-size: 10px;
  }
}
</style>
