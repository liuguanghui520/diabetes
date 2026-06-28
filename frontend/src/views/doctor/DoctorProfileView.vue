<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CheckCircleFilled,
  LeftOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  StarFilled,
} from '@ant-design/icons-vue'
import { doctors } from '../../data/doctors'
import { apiGet } from '../../api/request'

const route = useRoute()
const router = useRouter()
const remoteDoctor = ref(null)

const doctor = computed(() => {
  const id = Number(route.params.id || 0)
  return remoteDoctor.value || doctors.find((item) => item.id === id) || doctors[0]
})

const avatarText = computed(() => {
  return doctor.value.avatar || String(doctor.value.name || '医').slice(0, 1)
})

const goodAtText = computed(() => {
  return doctor.value.goodAt || doctor.value.specialty || doctor.value.intro || '糖尿病风险筛查、血糖波动、复查指标解读'
})

const hospitalText = computed(() => doctor.value.hospital || doctor.value.department || '慢病管理门诊')

function startChat() {
  router.push({
    name: 'doctorConsult',
    query: {
      doctor: doctor.value.id,
    },
  })
}

async function loadDoctor() {
  try {
    const result = await apiGet(`/api/doctors/${route.params.id}`, { auth: false })
    remoteDoctor.value = {
      ...result.data,
      avatar: String(result.data.name || '医').slice(0, 1),
      license: result.data.license_no || '执业信息由管理员维护',
      goodAt: result.data.specialty || result.data.intro || '',
      hospital: result.data.profile_md || result.data.department || '',
      consultCount: result.data.consult_count || '0',
      score: result.data.score || '4.8',
      status: result.data.online_status === 'online' ? '在线' : '离线',
      tags: (result.data.specialty || result.data.department || '糖尿病').split(/[、,，\\s]+/).filter(Boolean).slice(0, 4),
      tone: 'blue',
    }
  } catch {
    remoteDoctor.value = null
  }
}

onMounted(loadDoctor)
</script>

<template>
  <main class="doctor-profile-page">
    <section class="profile-phone">
      <header class="profile-nav">
        <button type="button" aria-label="返回" @click="router.back()">
          <LeftOutlined />
        </button>
        <strong>医生简介</strong>
        <span></span>
      </header>

      <section class="doctor-hero">
        <span
          class="profile-avatar"
          :class="doctor.tone"
          :style="doctor.avatar_url ? { backgroundImage: `url(${doctor.avatar_url})` } : {}"
        >
          <span v-if="!doctor.avatar_url">{{ avatarText }}</span>
        </span>
        <div>
          <h1>{{ doctor.name }}</h1>
          <p>{{ doctor.department }} · {{ doctor.title }}</p>
          <em><CheckCircleFilled /> {{ doctor.license }}</em>
        </div>
      </section>

      <section class="profile-stats">
        <div>
          <strong>{{ doctor.score }}</strong>
          <span>用户评分</span>
        </div>
        <div>
          <strong>{{ doctor.consultCount || '0' }}</strong>
          <span>咨询量</span>
        </div>
        <div>
          <strong>{{ doctor.status }}</strong>
          <span>当前状态</span>
        </div>
      </section>

      <section class="profile-section">
        <h2>擅长方向</h2>
        <p>{{ goodAtText }}</p>
        <div class="tag-list">
          <span v-for="tag in doctor.tags || []" :key="tag">{{ tag }}</span>
        </div>
      </section>

      <section class="profile-section">
        <h2>执业信息</h2>
        <button type="button" class="info-row">
          <MedicineBoxOutlined />
          <span>
            <strong>{{ hospitalText }}</strong>
            <small>{{ doctor.department }}持续管理与复查建议</small>
          </span>
        </button>
        <button type="button" class="info-row">
          <StarFilled />
          <span>
            <strong>{{ doctor.score }} 分服务评价</strong>
            <small>适合先整理问题，再进入咨询沟通</small>
          </span>
        </button>
      </section>

      <footer class="profile-action">
        <button type="button" @click="startChat">
          <MessageOutlined />
          开始咨询
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.doctor-profile-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.profile-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow-y: auto;
  background: #eef4ff;
}

.profile-nav {
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
  height: 52px;
  padding: 8px 16px 4px;
  background: rgba(248, 251, 255, 0.94);
}

.profile-nav button {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  background: transparent;
  color: #101936;
  font-size: 22px;
}

.profile-nav strong {
  justify-self: center;
  color: #101936;
  font-size: 16px;
  font-weight: 900;
}

.doctor-hero {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 22px 20px 18px;
}

.profile-avatar {
  display: grid;
  width: 68px;
  height: 68px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #1677ff, #00b8ff);
  background-position: center;
  background-size: cover;
  font-size: 24px;
  font-weight: 950;
}

.profile-avatar.green {
  background: linear-gradient(135deg, #00b86b, #00c8d8);
}

.profile-avatar.orange {
  background: linear-gradient(135deg, #ff8a00, #ff4d4f);
}

.profile-avatar.purple {
  background: linear-gradient(135deg, #7b3cff, #1677ff);
}

.doctor-hero h1 {
  margin: 0;
  color: #101936;
  font-size: 24px;
  font-weight: 950;
}

.doctor-hero p {
  margin: 5px 0 0;
  color: #526984;
  font-size: 13px;
  font-weight: 850;
}

.doctor-hero em {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  color: #00a870;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  overflow: hidden;
  margin: 0 16px 14px;
  border-radius: 18px;
  background: #e6edf7;
}

.profile-stats div {
  padding: 13px 8px;
  background: #fff;
  text-align: center;
}

.profile-stats strong,
.profile-stats span {
  display: block;
}

.profile-stats strong {
  color: #101936;
  font-size: 16px;
  font-weight: 950;
}

.profile-stats span {
  margin-top: 4px;
  color: #7b8798;
  font-size: 11px;
  font-weight: 800;
}

.profile-section {
  margin: 0 16px 14px;
  border-radius: 20px;
  padding: 16px;
  background: #fff;
}

.profile-section h2 {
  margin: 0 0 10px;
  color: #101936;
  font-size: 16px;
  font-weight: 950;
}

.profile-section p {
  margin: 0;
  color: #536984;
  font-size: 13px;
  font-weight: 760;
  line-height: 1.65;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.tag-list span {
  border-radius: 999px;
  padding: 6px 10px;
  color: #1677ff;
  background: #eef6ff;
  font-size: 11px;
  font-weight: 900;
}

.info-row {
  display: grid;
  width: 100%;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
  border: 0;
  border-top: 1px solid #eef1f5;
  padding: 13px 0;
  background: transparent;
  text-align: left;
}

.info-row svg {
  color: #1677ff;
  font-size: 22px;
}

.info-row strong,
.info-row small {
  display: block;
}

.info-row strong {
  color: #101936;
  font-size: 14px;
  font-weight: 900;
}

.info-row small {
  margin-top: 4px;
  color: #8a95a5;
  font-size: 11px;
  font-weight: 760;
}

.profile-action {
  margin-top: auto;
  padding: 14px 18px calc(16px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
}

.profile-action button {
  display: inline-flex;
  width: 100%;
  height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 16px;
  color: #fff;
  background: #1677ff;
  font-size: 15px;
  font-weight: 950;
}
</style>
