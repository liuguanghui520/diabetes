<script setup>
import { HomeOutlined, LeftOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.replace({ name: 'home' })
}
</script>

<template>
  <main class="not-found-page">
    <section class="not-found-card">
      <div class="not-found-badge">
        <SearchOutlined />
      </div>

      <p>页面走丢了</p>
      <h1>这条路径暂时打不开</h1>
      <small>你访问的页面可能已调整位置，或者链接地址不完整。可以返回上一页，或者直接回到首页继续操作。</small>

      <div class="not-found-actions">
        <button
          type="button"
          class="ghost"
          @click="goBack"
        >
          <LeftOutlined />
          返回上一页
        </button>

        <button
          type="button"
          class="primary"
          @click="router.replace({ name: 'home' })"
        >
          <HomeOutlined />
          回到首页
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.not-found-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.not-found-card {
  width: min(100%, 420px);
  border-radius: 30px;
  padding: 28px 24px;
  color: #17304a;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.8), transparent 30%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(237, 245, 255, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 24px 50px rgba(39, 69, 112, 0.12);
}

.not-found-badge {
  display: grid;
  width: 62px;
  height: 62px;
  place-items: center;
  border-radius: 22px;
  color: #1677ff;
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.14), rgba(0, 181, 120, 0.12));
  font-size: 28px;
}

.not-found-card p {
  margin: 18px 0 0;
  color: #5f7692;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.not-found-card h1 {
  margin: 10px 0 0;
  color: #102038;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.18;
}

.not-found-card small {
  display: block;
  margin-top: 12px;
  color: #6f8198;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.7;
}

.not-found-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 22px;
}

.not-found-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.not-found-actions .ghost {
  color: #46617f;
  background: rgba(255, 255, 255, 0.72);
}

.not-found-actions .primary {
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00a870);
  box-shadow: 0 12px 24px rgba(22, 119, 255, 0.18);
}

@media (max-width: 420px) {
  .not-found-actions {
    grid-template-columns: 1fr;
  }
}
</style>
