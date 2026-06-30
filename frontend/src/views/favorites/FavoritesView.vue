<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  DeleteOutlined,
  EyeOutlined,
  LeftOutlined,
  LikeOutlined,
  MoreOutlined,
  SearchOutlined,
  StarOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPost } from '../../api/request'

const router = useRouter()

const keyword = ref('')
const showSearch = ref(false)
const toastText = ref('')
const articles = ref([])

const favoriteArticles = computed(() => {
  const text = keyword.value.trim()

  return articles.value.filter((item) => {
    const keywordMatch = !text || `${item.title}${item.summary}${item.author}${item.category}`.includes(text)
    return keywordMatch
  })
})

function showToast(text) {
  toastText.value = text
  window.setTimeout(() => {
    toastText.value = ''
  }, 1800)
}

async function loadArticles() {
  try {
    const response = await apiGet('/api/articles/favorites?page=1&pageSize=50')
    const source = response.data?.items || []
    articles.value = source.map((item) => ({
      ...item,
      author: item.author || item.source || '健康编辑部',
      badge: item.badge || item.category || '健康资讯',
      views: item.view_count || item.views || 0,
      likes: item.like_count || item.likes || 0,
      saves: item.favorite_count || item.saves || 0,
    }))
  } catch {
    articles.value = []
  }
}

function openArticle(article) {
  router.push({
    name: 'news',
    query: {
      article: article.id,
    },
  })
}

async function removeFavorite(article) {
  try {
    await apiPost(`/api/articles/${article.id}/favorite`, {})
    articles.value = articles.value.filter((item) => item.id !== article.id)
    showToast('已从收藏移除')
  } catch (error) {
    showToast(error.message || '移除收藏失败。')
  }
}

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    keyword.value = ''
  }
}

onMounted(loadArticles)
</script>

<template>
  <main class="favorites-page">
    <section class="favorites-phone">
      <header class="favorites-nav">
        <button class="nav-back" type="button" aria-label="返回" @click="router.back()">
          <LeftOutlined />
        </button>

        <h1>收藏</h1>

        <button class="nav-search" type="button" aria-label="搜索收藏" @click="toggleSearch">
          <SearchOutlined />
        </button>
      </header>

      <div v-if="showSearch" class="favorite-search">
        <SearchOutlined />
        <input
          v-model="keyword"
          name="favorite_search"
          autocomplete="off"
          aria-label="搜索收藏的资讯"
          placeholder="搜索收藏的资讯"
        />
        <button type="button" @click="toggleSearch">取消</button>
      </div>

      <section class="favorite-list">
        <van-swipe-cell v-for="article in favoriteArticles" :key="article.id">
          <article
            class="favorite-article"
            role="button"
            tabindex="0"
            @click="openArticle(article)"
            @keydown.enter="openArticle(article)"
            @keydown.space.prevent="openArticle(article)"
          >
            <div class="article-meta">
              <span class="author-avatar">{{ String(article.author || '健').slice(0, 1) }}</span>
              <strong>{{ article.author }}</strong>
              <em>{{ article.badge }}</em>
              <small>{{ article.category }}</small>
            </div>

            <h2>{{ article.title }}</h2>
            <p>{{ article.summary }}</p>

            <footer>
              <span><EyeOutlined /> {{ article.views || '0' }}</span>
              <span><LikeOutlined /> {{ article.likes || 0 }}</span>
              <span><StarOutlined /> {{ article.saves || 0 }}</span>
              <button type="button" aria-label="移除收藏" @click.stop="removeFavorite(article)">
                <MoreOutlined />
              </button>
            </footer>
          </article>

          <template #right>
            <button class="swipe-remove" type="button" @click="removeFavorite(article)">
              <DeleteOutlined />
              移除
            </button>
          </template>
        </van-swipe-cell>

        <van-empty
          v-if="favoriteArticles.length === 0"
          image="search"
          :description="keyword ? '没有找到匹配的收藏' : '还没有收藏内容'"
        >
          <van-button round type="primary" size="small" @click="router.push({ name: 'news' })">
            去资讯看看
          </van-button>
        </van-empty>
      </section>

      <transition name="toast">
        <div v-if="toastText" class="app-toast" role="status" aria-live="polite">{{ toastText }}</div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.favorites-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.favorites-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.favorites-nav {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  height: 64px;
  flex: 0 0 auto;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #eef1f5;
  background: rgba(255, 255, 255, 0.96);
}

.favorites-nav h1 {
  position: relative;
  justify-self: center;
  margin: 0;
  color: #1677ff;
  font-size: 20px;
  font-weight: 950;
  line-height: 34px;
  letter-spacing: 0;
}

.favorites-nav h1::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 18px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  content: '';
  transform: translateX(-50%);
}

.nav-back,
.nav-search {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #17243a;
  font-size: 21px;
}

.nav-search {
  justify-self: end;
}

.favorite-search {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  margin: 10px 16px 0;
  padding: 0 14px;
  border-radius: 14px;
  background: #eef3f8;
  color: #7f8a99;
}

.favorite-search input {
  min-width: 0;
  flex: 1;
  height: 40px;
  border: 0;
  background: transparent;
  color: #17243a;
  font-size: 14px;
  font-weight: 800;
}

.favorite-search button {
  border: 0;
  background: transparent;
  color: #1677ff;
  font-size: 12px;
  font-weight: 900;
}

.favorite-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid #edf1f5;
  margin-top: 12px;
  scrollbar-width: none;
}

.favorite-list::-webkit-scrollbar {
  display: none;
}

.favorite-article {
  border-bottom: 1px solid #edf1f5;
  padding: 13px 18px 12px;
  background: #fff;
  cursor: pointer;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #999a9f;
}

.author-avatar {
  display: grid;
  width: 21px;
  height: 21px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #1677ff, #00c48c);
  font-size: 10px;
  font-weight: 900;
}

.article-meta strong {
  overflow: hidden;
  color: #8f9096;
  font-size: 11px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-meta em {
  color: #8b8fa3;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.article-meta small {
  margin-left: auto;
  border-radius: 999px;
  padding: 3px 7px;
  color: #00a870;
  background: #e5f8f1;
  font-size: 10px;
  font-weight: 900;
}

.favorite-article h2 {
  margin: 9px 0 0;
  color: #17191d;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.45;
}

.favorite-article p {
  display: -webkit-box;
  overflow: hidden;
  margin: 6px 0 0;
  color: #78879a;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.favorite-article footer {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 9px;
  color: #9a9a9f;
}

.favorite-article footer span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 900;
}

.favorite-article footer button {
  margin-left: auto;
  border: 0;
  color: #9a9a9f;
  background: transparent;
  font-size: 18px;
}

.swipe-remove {
  display: inline-flex;
  width: 78px;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  background: #ff4d4f;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
}

.app-toast {
  position: absolute;
  bottom: 28px;
  left: 50%;
  z-index: 20;
  border-radius: 999px;
  padding: 9px 14px;
  background: rgba(17, 24, 39, 0.86);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  transform: translateX(-50%);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
