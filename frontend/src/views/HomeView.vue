<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  EyeOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import LiquidTabBar from '../components/navigation/LiquidTabBar.vue'
import { apiGet, hasAuthSession } from '../api/request'

const router = useRouter()
const summary = ref(createEmptySummary())
const doctors = ref([])
const diabetesTypes = ref([])
const toastText = ref('')
let toastTimer = null

const articleList = computed(() => {
  const items = Array.isArray(summary.value.hot_articles) ? summary.value.hot_articles : []
  return items.slice(0, 3)
})

const doctorList = computed(() => {
  return doctors.value.slice(0, 5)
})

function createEmptySummary() {
  return {
    hot_articles: [],
    diabetesTypes: [],
  }
}

function initials(name) {
  return String(name || '医').slice(0, 1)
}

function showToast(text) {
  toastText.value = text
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

function requireLogin(text) {
  if (hasAuthSession()) return false
  showToast(text)
  return true
}

async function loadData() {
  try {
    const home = await apiGet('/api/home/summary')
    summary.value = {
      ...createEmptySummary(),
      ...(home.data || {}),
    }
    diabetesTypes.value = home.data?.diabetes_types || []
  } catch {
    summary.value = createEmptySummary()
    diabetesTypes.value = []
  }

  try {
    const result = await apiGet('/api/doctors')
    doctors.value = result.data?.items || []
  } catch {
    doctors.value = []
  }
}

function openDoctor(doctor) {
  if (requireLogin('请先登录后再咨询医生。')) return
  router.push({ name: 'doctorConsult', query: { doctor: doctor.id } })
}

function openArticle(article) {
  router.push({ name: 'news', query: { article: article.id } })
}

function handleTabChange(key) {
  if (key === 'home') return
  router.push({ name: key })
}

onMounted(loadData)

onBeforeUnmount(() => {
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>

<template>
  <main class="home-shell">
    <section class="home-phone">
      <div class="home-scroll">
        <header class="home-top">
          <div class="brand-lockup">
            <span class="brand-mark"></span>
            <strong>糖尿病智能助手</strong>
          </div>
          <button class="search-btn" type="button" aria-label="搜索" @click="router.push({ name: 'news' })">
            <SearchOutlined />
          </button>
        </header>

        <section class="banner-card" aria-label="糖尿病管理轮播图">
          <div>
            <span>今日管理</span>
            <h1>糖尿病管理</h1>
            <p>医生咨询、生活方案、打卡分析和 AI 问答集中管理。</p>
          </div>
          <div class="banner-visual">
            <i></i><i></i><i></i>
          </div>
        </section>

        <section class="home-section">
          <header class="section-title">
            <h2>专业医师团队</h2>
            <button type="button" @click="router.push({ name: 'doctorConsult' })">
              查看全部
              <RightOutlined />
            </button>
          </header>

          <div class="doctor-strip">
            <article v-for="doctor in doctorList" :key="doctor.id" class="doctor-card">
              <div class="doctor-avatar" :style="doctor.avatar_url ? { backgroundImage: `url(${doctor.avatar_url})` } : {}">
                <span v-if="!doctor.avatar_url">{{ initials(doctor.name) }}</span>
              </div>
              <em>{{ doctor.title || '医生' }}</em>
              <strong>{{ doctor.name }}</strong>
              <small>{{ doctor.department || '内分泌科' }}</small>
              <button type="button" @click="openDoctor(doctor)">立即咨询</button>
            </article>
            <div v-if="doctorList.length === 0" class="home-empty">
              <strong>暂无医生数据</strong>
              <small>请在管理后台维护医生后展示。</small>
            </div>
          </div>
        </section>

        <section class="home-section">
          <header class="section-title">
            <h2>健康科普</h2>
            <button type="button" @click="router.push({ name: 'news' })">
              更多
              <RightOutlined />
            </button>
          </header>

          <div class="article-list">
            <button
              v-for="(article, index) in articleList"
              :key="article.id"
              type="button"
              class="article-row"
              @click="openArticle(article)"
            >
              <span class="article-thumb">{{ index === 0 ? '饮食' : index === 1 ? '运动' : '管理' }}</span>
              <span class="article-copy">
                <strong>{{ article.title }}</strong>
                <small>{{ article.summary }}</small>
                <em><EyeOutlined /> {{ article.view_count || article.views || 0 }} 浏览</em>
              </span>
            </button>
            <div v-if="articleList.length === 0" class="home-empty article-empty">
              <strong>暂无科普内容</strong>
              <small>请在管理后台发布文章后展示。</small>
            </div>
          </div>
        </section>

        <section class="home-section type-section">
          <header class="section-title">
            <h2>糖尿病类型</h2>
          </header>
          <div class="type-grid">
            <article v-for="item in diabetesTypes" :key="item.id" class="type-card">
              <div class="type-image">{{ item.name || '糖尿病' }}</div>
              <strong>{{ item.name }}</strong>
              <p>{{ item.pathogenesis || item.clinical_features || '请在后台补充糖尿病类型说明。' }}</p>
            </article>
            <div v-if="diabetesTypes.length === 0" class="home-empty article-empty">
              <strong>暂无类型说明</strong>
              <small>请在数据库初始化后展示。</small>
            </div>
          </div>
        </section>
      </div>

      <LiquidTabBar active-key="home" @change="handleTabChange" />
      <transition name="toast">
        <div v-if="toastText" class="app-toast" role="status" aria-live="polite">{{ toastText }}</div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.home-shell {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dfe8f5;
}

.home-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #f7f9fc;
}

.home-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px 26px;
  scrollbar-width: none;
}

.home-scroll::-webkit-scrollbar,
.doctor-strip::-webkit-scrollbar {
  display: none;
}

.home-top {
  display: flex;
  height: 48px;
  align-items: center;
  justify-content: space-between;
}

.brand-lockup {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.brand-mark {
  position: relative;
  width: 25px;
  height: 29px;
  border-radius: 18px 18px 18px 5px;
  background: linear-gradient(145deg, #2f6dff 0%, #4dc7ff 100%);
  box-shadow: 0 7px 14px rgba(46, 116, 255, 0.18);
  transform: rotate(28deg);
}

.brand-mark::after {
  position: absolute;
  right: 7px;
  bottom: 5px;
  width: 7px;
  height: 15px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  content: "";
}

.brand-lockup strong {
  color: #2674f6;
  font-size: 13px;
  font-weight: 900;
}

.search-btn {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #7e8796;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
}

.banner-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  min-height: 151px;
  overflow: hidden;
  border-radius: 8px;
  padding: 17px 16px;
  color: #ffffff;
  background:
    radial-gradient(circle at 84% 18%, rgba(255, 255, 255, 0.46), transparent 23%),
    radial-gradient(circle at 16% 88%, rgba(255, 173, 64, 0.22), transparent 30%),
    linear-gradient(125deg, #75cff0 0%, #2f93dc 48%, #1767be 100%);
  box-shadow: 0 10px 22px rgba(38, 112, 190, 0.14);
}

.banner-card span {
  display: inline-flex;
  width: max-content;
  border-radius: 999px;
  padding: 4px 9px;
  color: #075ea3;
  background: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  font-weight: 900;
}

.banner-card h1 {
  margin: 13px 0 0;
  font-size: 26px;
  font-weight: 900;
}

.banner-card p {
  margin: 8px 0 0;
  max-width: 188px;
  color: rgba(255,255,255,0.92);
  font-size: 12px;
  line-height: 1.55;
}

.banner-visual {
  position: relative;
  min-height: 105px;
}

.banner-visual::before {
  position: absolute;
  right: 2px;
  bottom: 9px;
  width: 116px;
  height: 76px;
  border: 2px solid rgba(255,255,255,0.82);
  border-radius: 9px;
  background:
    linear-gradient(180deg, transparent 48%, rgba(255,255,255,0.42) 49%, transparent 51%),
    linear-gradient(90deg, rgba(255,255,255,0.16) 50%, transparent 50%) 0 0 / 18px 100%,
    rgba(255,255,255,0.16);
  content: "";
}

.banner-visual::after {
  position: absolute;
  right: 14px;
  bottom: 72px;
  width: 88px;
  height: 28px;
  border-radius: 7px;
  background: rgba(255,255,255,0.23);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.46);
  content: "";
}

.banner-visual i {
  position: absolute;
  display: block;
  border-radius: 50%;
  background: rgba(255,255,255,0.92);
  box-shadow: 0 9px 14px rgba(16, 49, 84, 0.1);
}

.banner-visual i:nth-child(1) {
  right: 83px;
  bottom: 22px;
  width: 26px;
  height: 26px;
}

.banner-visual i:nth-child(2) {
  right: 47px;
  bottom: 21px;
  width: 30px;
  height: 30px;
}

.banner-visual i:nth-child(3) {
  right: 13px;
  bottom: 20px;
  width: 28px;
  height: 28px;
}

.home-section {
  margin-top: 18px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title h2 {
  position: relative;
  margin: 0;
  padding-left: 10px;
  color: #151c2a;
  font-size: 20px;
  font-weight: 900;
}

.section-title h2::before {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 0;
  width: 4px;
  border-radius: 999px;
  background: #2489ff;
  content: "";
}

.section-title button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #1d76ff;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.doctor-strip {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  margin: 14px -16px 0;
  padding: 0 16px 8px;
  scrollbar-width: none;
}

.doctor-card {
  display: grid;
  width: 128px;
  min-width: 128px;
  justify-items: center;
  border-radius: 6px;
  padding: 12px 10px 16px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(27, 55, 95, 0.08);
}

.doctor-avatar {
  display: grid;
  width: 68px;
  height: 68px;
  place-items: center;
  border: 2px solid #2b76ff;
  border-radius: 50%;
  color: #1d76ff;
  background:
    linear-gradient(135deg, #eaf3ff, #c8dcff);
  background-position: center;
  background-size: cover;
  font-size: 22px;
  font-weight: 900;
}

.doctor-card em {
  margin-top: -6px;
  border-radius: 999px;
  padding: 2px 7px;
  color: #2373ff;
  background: #eef5ff;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.doctor-card strong {
  margin-top: 18px;
  color: #141c2b;
  font-size: 15px;
  font-weight: 900;
}

.doctor-card small {
  margin-top: 10px;
  color: #8a94a4;
  font-size: 12px;
  font-weight: 800;
}

.doctor-card button {
  margin-top: 13px;
  border: 1px solid #2373ff;
  border-radius: 4px;
  padding: 5px 8px;
  color: #2373ff;
  background: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.home-empty {
  display: grid;
  width: 100%;
  min-width: 100%;
  min-height: 96px;
  place-items: center;
  align-content: center;
  gap: 5px;
  border-radius: 8px;
  background: #ffffff;
  color: #7f8fa3;
  box-shadow: 0 6px 16px rgba(27, 55, 95, 0.06);
}

.home-empty strong {
  color: #17243a;
  font-size: 13px;
  font-weight: 900;
}

.home-empty small {
  font-size: 11px;
  font-weight: 800;
}

.article-empty {
  min-height: 108px;
  box-shadow: none;
}

.article-list {
  overflow: hidden;
  margin-top: 12px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 5px 14px rgba(27, 55, 95, 0.06);
}

.article-row {
  display: grid;
  width: 100%;
  grid-template-columns: 106px minmax(0, 1fr);
  align-items: stretch;
  border-bottom: 1px solid #eef1f5;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.article-row:last-child {
  border-bottom: 0;
}

.article-thumb {
  display: grid;
  min-height: 88px;
  place-items: center;
  color: #51739b;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.42), transparent 44%),
    #dce8f6;
  font-size: 15px;
  font-weight: 800;
}

.article-copy {
  min-width: 0;
  padding: 13px 14px 9px;
}

.article-copy strong,
.article-copy small,
.article-copy em {
  display: block;
}

.article-copy strong {
  overflow: hidden;
  color: #141c2b;
  font-size: 15px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-copy small {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 7px;
  color: #7e8896;
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.article-copy em {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 9px;
  color: #a0a8b5;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 13px;
}

.type-card {
  overflow: hidden;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(27, 55, 95, 0.08);
  text-align: center;
}

.type-image {
  display: grid;
  min-height: 118px;
  margin: 12px 12px 0;
  place-items: center;
  color: #527397;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.55), transparent 40%),
    #dbe7f4;
  font-size: 14px;
  font-weight: 800;
}

.type-card strong {
  display: block;
  margin-top: 16px;
  color: #141c2b;
  font-size: 16px;
  font-weight: 900;
}

.type-card p {
  display: -webkit-box;
  overflow: hidden;
  min-height: 42px;
  margin: 8px 11px 14px;
  color: #8c95a3;
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 360px) {
  .banner-card {
    grid-template-columns: 1fr 105px;
  }

  .doctor-card {
    width: 120px;
    min-width: 120px;
  }

  .article-row {
    grid-template-columns: 96px minmax(0, 1fr);
  }
}
</style>
