<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CommentOutlined,
  EyeOutlined,
  LikeFilled,
  LikeOutlined,
  LeftOutlined,
  MessageFilled,
  MoreOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons-vue'
import LiquidTabBar from '../../components/navigation/LiquidTabBar.vue'
import TopUserActions from '../../components/navigation/TopUserActions.vue'
import { apiGet, apiPost, getStoredUser, hasAuthSession } from '../../api/request'

const router = useRouter()
const route = useRoute()
const keyword = ref('')
const activeCategory = ref('推荐')
const articles = ref([])
const toastText = ref('')
const selectedArticle = ref(null)
const commentBlockRef = ref(null)
const commentDraft = ref('')
const replyTarget = ref(null)
const comments = ref([])
const loadingDetail = ref(false)
const submittingComment = ref(false)

const categories = ['热点', '推荐', '饮食', '运动', '筛查', '管理', '血糖', '复查', '并发症', '指南', '直播']

const isFavoritesMode = computed(() => route.query.favorites === '1')

const visibleArticles = computed(() => {
  const text = keyword.value.trim()

  return articles.value.filter((item) => {
    if (isFavoritesMode.value && !item.favorited) {
      return false
    }

    const categoryMatch = activeCategory.value === '推荐' || activeCategory.value === '热点'
      ? true
      : item.category?.includes(activeCategory.value)
    const keywordMatch = !text || `${item.title}${item.summary}${item.author}`.includes(text)

    return categoryMatch && keywordMatch
  })
})

const articleParagraphs = computed(() => {
  if (!selectedArticle.value) return []

  return [
    selectedArticle.value.content || selectedArticle.value.detail || selectedArticle.value.summary,
    '这篇内容仅用于健康管理参考。若出现持续异常血糖、明显不适或用药相关问题，请及时咨询医生。',
  ].filter(Boolean)
})

const commentPlaceholder = computed(() => {
  if (replyTarget.value) {
    return `回复 ${replyTarget.value.user}…`
  }

  return '说点什么…'
})

const hasUserCommented = computed(() => {
  const currentUser = getStoredUser()
  if (!currentUser) return false

  return comments.value.some((item) => item.user === (currentUser.nickname || currentUser.username))
})

function showToast(text) {
  toastText.value = text
  window.setTimeout(() => {
    toastText.value = ''
  }, 2200)
}

function normalizeArticle(item) {
  return {
    ...item,
    author: item.author || item.source || '健康编辑部',
    badge: item.badge || item.category || '健康资讯',
    views: item.view_count || item.views || 0,
    likes: item.like_count || item.likes || 0,
    saves: item.favorite_count || item.saves || 0,
    favorited: Boolean(item.favorited),
    liked: Boolean(item.liked),
  }
}

function applyRouteArticle() {
  const targetId = String(route.query.article || '')
  if (!targetId) return

  const matched = articles.value.find((item) => String(item.id) === targetId)
  if (matched) {
    openArticle(matched)
  }
}

async function loadArticles() {
  try {
    const path = isFavoritesMode.value
      ? '/api/articles/favorites?page=1&pageSize=50'
      : '/api/articles?page=1&pageSize=50'
    const response = await apiGet(path)
    const source = response.data?.items || response.data?.list || response.data?.articles || []
    articles.value = source.map(normalizeArticle)
  } catch {
    articles.value = []
  }
}

async function loadComments(articleId) {
  try {
    const response = await apiGet(`/api/articles/${articleId}/comments`)
    comments.value = response.data?.items || []
  } catch {
    comments.value = []
  }
}

async function openArticle(article) {
  loadingDetail.value = true

  try {
    const response = await apiGet(`/api/articles/${article.id}`)
    selectedArticle.value = normalizeArticle({
      ...article,
      ...(response.data || {}),
      detail: response.data?.content || response.data?.summary || article.summary,
    })
    await loadComments(article.id)
    router.replace({
      name: 'news',
      query: {
        article: article.id,
      },
    })
  } catch (error) {
    showToast(error.message || '文章详情加载失败。')
  } finally {
    loadingDetail.value = false
  }
}

function closeArticle() {
  selectedArticle.value = null
  commentDraft.value = ''
  replyTarget.value = null
  comments.value = []
  router.replace({ name: 'news' })
}

async function toggleFavorite(article) {
  if (!hasAuthSession()) {
    showToast('请先登录后再收藏。')
    return
  }

  try {
    const result = await apiPost(`/api/articles/${article.id}/favorite`, {})
    const favorited = Boolean(result.data?.favorited)
    const delta = favorited ? 1 : -1

    articles.value = articles.value.map((item) => item.id === article.id
      ? { ...item, favorited, saves: Math.max(0, Number(item.saves || 0) + delta) }
      : item)

    if (selectedArticle.value?.id === article.id) {
      selectedArticle.value = {
        ...selectedArticle.value,
        favorited,
        saves: Math.max(0, Number(selectedArticle.value.saves || 0) + delta),
      }
    }

    showToast(favorited ? '已收藏。' : '已取消收藏。')

    if (isFavoritesMode.value) {
      await loadArticles()
    }
  } catch (error) {
    showToast(error.message || '收藏操作失败。')
  }
}

async function toggleLike(article) {
  if (!hasAuthSession()) {
    showToast('请先登录后再点赞。')
    return
  }

  try {
    const result = await apiPost(`/api/articles/${article.id}/like`, {})
    const liked = Boolean(result.data?.liked)
    const delta = liked ? 1 : -1

    articles.value = articles.value.map((item) => item.id === article.id
      ? { ...item, liked, likes: Math.max(0, Number(item.likes || 0) + delta) }
      : item)

    if (selectedArticle.value?.id === article.id) {
      selectedArticle.value = {
        ...selectedArticle.value,
        liked,
        likes: Math.max(0, Number(selectedArticle.value.likes || 0) + delta),
      }
    }
  } catch (error) {
    showToast(error.message || '点赞失败。')
  }
}

async function submitComment() {
  const text = commentDraft.value.trim()

  if (!text) {
    showToast('先写一句评论。')
    return
  }

  if (!hasAuthSession()) {
    showToast('请先登录后再评论。')
    return
  }

  submittingComment.value = true
  try {
    const response = await apiPost(`/api/articles/${selectedArticle.value.id}/comments`, {
      content: text,
      parent_id: replyTarget.value?.id || null,
    })
    comments.value = [...comments.value, response.data]
    showToast(replyTarget.value ? '回复已发布。' : '评论已发布。')
    commentDraft.value = ''
    replyTarget.value = null
  } catch (error) {
    showToast(error.message || '评论发布失败。')
  } finally {
    submittingComment.value = false
  }
}

async function toggleCommentLike(comment) {
  if (!hasAuthSession()) {
    showToast('请先登录后再点赞评论。')
    return
  }

  try {
    const result = await apiPost(`/api/articles/${selectedArticle.value.id}/comments/${comment.id}/like`, {})
    const liked = Boolean(result.data?.liked)
    const delta = liked ? 1 : -1

    comments.value = comments.value.map((item) => item.id === comment.id
      ? { ...item, liked, like_count: Math.max(0, Number(item.like_count || 0) + delta) }
      : item)
  } catch (error) {
    showToast(error.message || '评论点赞失败。')
  }
}

function getCommentLikes(comment) {
  return Number(comment.like_count || 0)
}

function replyToComment(comment) {
  replyTarget.value = comment
  commentDraft.value = ''
}

function scrollToComments() {
  commentBlockRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function handleTabChange(key) {
  router.push({ name: key })
}

function clearFavoritesMode() {
  router.replace({ name: 'news' })
}

onMounted(async () => {
  await loadArticles()
  applyRouteArticle()
})
</script>

<template>
  <main class="feed-page">
    <section class="feed-phone">
      <div v-if="!selectedArticle" class="feed-scroll">
        <header class="feed-header">
          <div>
            <span>{{ isFavoritesMode ? '个人收藏' : '健康内容' }}</span>
            <h1>{{ isFavoritesMode ? '我的收藏' : '资讯' }}</h1>
          </div>
          <TopUserActions />
        </header>

        <button v-if="isFavoritesMode" class="favorites-back" type="button" @click="clearFavoritesMode">
          <LeftOutlined />
          返回全部资讯
        </button>

        <section class="feed-search">
          <label>
            <SearchOutlined />
            <input
              v-model="keyword"
              name="news_search"
              autocomplete="off"
              aria-label="搜索健康资讯"
              placeholder="控糖饮食 风险筛查"
            />
          </label>
        </section>

        <van-tabs
          v-model:active="activeCategory"
          class="feed-tabs"
          shrink
          swipeable
          animated
          :ellipsis="false"
          line-width="18"
          line-height="3"
          color="#1677ff"
          title-active-color="#111827"
          title-inactive-color="#6f7c8f"
        >
          <van-tab
            v-for="item in categories"
            :key="item"
            :name="item"
            :title="item"
          />
        </van-tabs>

        <section class="article-feed">
          <article
            v-for="article in visibleArticles"
            :key="article.id"
            class="feed-article"
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
              <span><EyeOutlined /> {{ article.views }}</span>
              <span><LikeOutlined /> {{ article.likes }}</span>
              <span><StarOutlined /> {{ article.saves }}</span>
              <button
                type="button"
                :aria-label="article.favorited ? '取消收藏' : '收藏文章'"
                :class="{ collected: article.favorited }"
                @click.stop="toggleFavorite(article)"
              >
                <MoreOutlined />
              </button>
            </footer>
          </article>

          <div v-if="visibleArticles.length === 0" class="empty-feed">
            <StarOutlined />
            <strong>{{ isFavoritesMode ? '还没有收藏内容' : '暂时没有匹配内容' }}</strong>
            <small>{{ isFavoritesMode ? '遇到值得复查的内容，点收藏后会出现在这里。' : '换个关键词或分类再看看。' }}</small>
          </div>
        </section>
      </div>

      <article v-else class="article-detail-page">
        <header class="detail-nav">
          <button type="button" aria-label="返回资讯列表" @click="closeArticle">
            <LeftOutlined />
          </button>
          <div>
            <span>{{ selectedArticle.author }}</span>
            <small>{{ selectedArticle.badge }}</small>
          </div>
          <span class="nav-spacer"></span>
        </header>

        <div class="detail-scroll">
          <div v-if="loadingDetail" class="empty-feed">
            <strong>正在加载文章详情</strong>
            <small>请稍候。</small>
          </div>
          <h1>{{ selectedArticle.title }}</h1>

          <section class="detail-author">
            <span class="detail-avatar">{{ String(selectedArticle.author || '健').slice(0, 1) }}</span>
            <div>
              <strong>{{ selectedArticle.author }}</strong>
              <small>{{ selectedArticle.badge }} · {{ selectedArticle.category }}</small>
            </div>
          </section>

          <p class="detail-stats">
            {{ selectedArticle.likes || 0 }} 人点赞 · {{ selectedArticle.views || 0 }} 人阅读
          </p>

          <section class="detail-body">
            <h2>{{ selectedArticle.title }}</h2>
            <p v-for="paragraph in articleParagraphs" :key="paragraph">
              {{ paragraph }}
            </p>
            <div class="detail-note">
              本内容仅用于健康管理参考，不替代医生诊断、处方或线下治疗建议。
            </div>
          </section>

          <section ref="commentBlockRef" class="comment-block">
            <h2>评论 {{ comments.length }}</h2>
            <form class="comment-input" @submit.prevent="submitComment">
              <input
                v-model="commentDraft"
                name="article_comment"
                autocomplete="off"
                aria-label="输入评论"
                :placeholder="commentPlaceholder"
              />
              <button type="submit" :disabled="submittingComment">发送</button>
            </form>

            <article v-for="comment in comments" :key="comment.id" class="comment-row">
              <span class="comment-avatar">{{ comment.user.slice(0, 1) }}</span>
              <div>
                <header>
                  <strong>{{ comment.user }}</strong>
                  <button
                    :aria-label="comment.liked ? '取消点赞评论' : '点赞评论'"
                    type="button"
                    :class="{ active: comment.liked }"
                    @click="toggleCommentLike(comment)"
                  >
                    <LikeFilled v-if="comment.liked" />
                    <LikeOutlined v-else />
                    {{ getCommentLikes(comment) }}
                  </button>
                </header>
                <small v-if="comment.parent_id" class="reply-label">回复上级评论</small>
                <p>{{ comment.content }}</p>
                <small class="comment-actions">
                  <button type="button" @click="replyToComment(comment)">回复</button>
                  <span>{{ new Date(comment.created_at).toLocaleString('zh-CN') }}</span>
                </small>
              </div>
            </article>
            <div v-if="comments.length === 0" class="empty-feed">
              <strong>还没有评论</strong>
              <small>第一条评论会直接写入数据库。</small>
            </div>
          </section>
        </div>

        <footer class="detail-toolbar">
          <button
            type="button"
            :aria-label="selectedArticle.liked ? '取消点赞文章' : '点赞文章'"
            :class="{ active: selectedArticle.liked }"
            @click="toggleLike(selectedArticle)"
          >
            <LikeFilled v-if="selectedArticle.liked" />
            <LikeOutlined v-else />
            <span>{{ selectedArticle.likes || 0 }} 赞</span>
          </button>
          <button
            type="button"
            :aria-label="selectedArticle.favorited ? '取消收藏文章' : '收藏文章'"
            :class="{ active: selectedArticle.favorited }"
            @click="toggleFavorite(selectedArticle)"
          >
            <StarFilled v-if="selectedArticle.favorited" />
            <StarOutlined v-else />
            <span>{{ selectedArticle.favorited ? '已藏' : '收藏' }}</span>
          </button>
          <button type="button" aria-label="查看评论" :class="{ active: hasUserCommented }" @click="scrollToComments">
            <MessageFilled v-if="hasUserCommented" />
            <CommentOutlined v-else />
            <span>评论</span>
          </button>
        </footer>
      </article>

      <LiquidTabBar v-if="!selectedArticle" active-key="news" @change="handleTabChange" />
      <transition name="toast">
        <div v-if="toastText" class="app-toast" role="status" aria-live="polite">{{ toastText }}</div>
      </transition>
    </section>
  </main>
</template>

<style scoped>
.feed-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  justify-content: center;
  overflow: hidden;
  background: #dbe8f7;
}

.feed-phone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.feed-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px 26px;
  scrollbar-width: none;
}

.feed-scroll::-webkit-scrollbar {
  display: none;
}

.feed-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.feed-header span {
  display: block;
  color: #7f8fa3;
  font-size: 11px;
  font-weight: 800;
}

.feed-header h1 {
  margin: 3px 0 0;
  color: #17243a;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0;
}

.feed-search {
  margin-top: 14px;
}

.favorites-back {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  border-radius: 999px;
  padding: 0 11px;
  color: #1677ff;
  background: #edf6ff;
  font-size: 11px;
  font-weight: 900;
}

.favorites-back svg {
  font-size: 13px;
}

.feed-search label {
  display: flex;
  min-width: 0;
  height: 40px;
  align-items: center;
  gap: 9px;
  border-radius: 14px;
  padding: 0 14px;
  color: #7f7f86;
  background: #eef3f8;
  font-size: 17px;
}

.feed-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  color: #1f2329;
  background: transparent;
  font-size: 14px;
  font-weight: 900;
}

.feed-tabs {
  margin: 10px -18px 0;
  padding: 0 0 2px;
  --van-tabs-nav-background: #ffffff;
  --van-tabs-bottom-bar-color: #1677ff;
  --van-tab-active-text-color: #111827;
  --van-tab-text-color: #6f7c8f;
  --van-tab-font-size: 12px;
  --van-tabs-line-height: 30px;
}

.feed-tabs :deep(.van-tabs__wrap) {
  height: 32px;
  overflow: hidden;
  border-bottom: 1px solid #edf1f5;
  mask-image: linear-gradient(to right, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
}

.feed-tabs :deep(.van-tabs__nav) {
  gap: 2px;
  padding: 0 18px;
}

.feed-tabs :deep(.van-tab) {
  min-width: 48px;
  padding: 0 8px;
  font-weight: 800;
  letter-spacing: 0;
}

.feed-tabs :deep(.van-tab--active) {
  font-size: 13px;
  font-weight: 900;
}

.feed-tabs :deep(.van-tabs__line) {
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  box-shadow: 0 2px 7px rgba(22, 119, 255, 0.25);
}

.feed-tabs :deep(.van-tabs__content) {
  display: none;
}

.article-feed {
  display: grid;
  gap: 0;
  margin: 10px -18px 0;
  border-top: 1px solid #edf1f5;
}

.feed-article {
  border-bottom: 1px solid #edf1f5;
  border-radius: 0;
  padding: 13px 18px 12px;
  background: #ffffff;
  box-shadow: none;
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
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00c48c);
  font-size: 10px;
  font-weight: 900;
}

.article-meta strong {
  overflow: hidden;
  color: #8f9096;
  font-size: 11px;
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

.feed-article h2 {
  margin: 9px 0 0;
  color: #17191d;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.45;
}

.feed-article p {
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

.feed-article footer {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 9px;
  color: #9a9a9f;
}

.feed-article footer span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 900;
}

.feed-article footer button {
  margin-left: auto;
  color: #9a9a9f;
  background: transparent;
  font-size: 18px;
}

.feed-article footer button.collected {
  color: #1677ff;
}

.empty-feed {
  display: grid;
  min-height: 220px;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 28px 22px;
  color: #9aa4b3;
  text-align: center;
}

.empty-feed svg {
  color: #c4d6ee;
  font-size: 30px;
}

.empty-feed strong {
  color: #3b4658;
  font-size: 14px;
  font-weight: 900;
}

.empty-feed small {
  max-width: 220px;
  color: #8d99aa;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.5;
}

.article-detail-page {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.detail-nav {
  display: grid;
  height: 58px;
  flex: 0 0 auto;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 9px;
  padding: 8px 18px 6px;
  border-bottom: 1px solid #f1f3f6;
  background: rgba(255, 255, 255, 0.96);
}

.detail-nav button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: #22252d;
  background: transparent;
  font-size: 21px;
}

.detail-nav div {
  min-width: 0;
}

.detail-nav span,
.detail-nav small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-nav span {
  color: #20242c;
  font-size: 13px;
  font-weight: 900;
}

.detail-nav small {
  margin-top: 2px;
  color: #8d95a5;
  font-size: 10px;
  font-weight: 800;
}

.nav-spacer {
  display: block;
  width: 34px;
  height: 34px;
}

.detail-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 24px 18px 96px;
  scrollbar-width: none;
}

.detail-scroll::-webkit-scrollbar {
  display: none;
}

.detail-scroll > h1 {
  margin: 0;
  color: #252932;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.25;
}

.detail-author {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-top: 18px;
}

.detail-avatar {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff, #00c48c);
  font-size: 18px;
  font-weight: 900;
}

.detail-author strong,
.detail-author small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-author strong {
  color: #252932;
  font-size: 15px;
  font-weight: 900;
}

.detail-author small {
  margin-top: 4px;
  color: #8f96a6;
  font-size: 11px;
  font-weight: 800;
}

.detail-stats {
  margin: 16px 0 0;
  color: #777f91;
  font-size: 13px;
  font-weight: 800;
}

.detail-body {
  margin-top: 26px;
}

.detail-body h2 {
  margin: 0 0 18px;
  color: #3b3f47;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.35;
}

.detail-body p {
  margin: 0 0 20px;
  color: #4b515e;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.82;
  text-align: justify;
}

.detail-note {
  border-left: 3px solid #1677ff;
  border-radius: 0 12px 12px 0;
  margin-top: 20px;
  padding: 10px 12px;
  color: #5d6d85;
  background: #f2f7ff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.65;
}

.related-block {
  margin-top: 28px;
  border-top: 1px solid #eef1f5;
  padding-top: 18px;
}

.related-block h2,
.comment-block h2 {
  margin: 0 0 14px;
  color: #272b33;
  font-size: 18px;
  font-weight: 900;
}

.related-block button {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #f0f2f6;
  padding: 13px 0;
  background: #ffffff;
  text-align: left;
}

.related-block strong,
.related-block small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-block strong {
  color: #262a33;
  font-size: 15px;
  font-weight: 900;
}

.related-block small {
  margin-top: 6px;
  color: #969dad;
  font-size: 11px;
  font-weight: 800;
}

.related-block em {
  border-radius: 999px;
  padding: 5px 9px;
  color: #00a870;
  background: #e6f8f0;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.comment-block {
  margin-top: 26px;
  border-top: 1px solid #eef1f5;
  padding-top: 18px;
}

.comment-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  gap: 8px;
  margin-bottom: 18px;
}

.comment-input input {
  min-width: 0;
  height: 42px;
  border: 0;
  border-radius: 18px;
  padding: 0 14px;
  color: #252932;
  background: #f3f5fa;
  font-size: 14px;
  font-weight: 800;
}

.comment-input input::placeholder {
  color: #a9afbd;
}

.comment-input button {
  border-radius: 18px;
  color: #ffffff;
  background: #1677ff;
  font-size: 13px;
  font-weight: 900;
}

.comment-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 11px;
  padding: 14px 0;
}

.comment-avatar {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  color: #ffffff;
  background: linear-gradient(135deg, #ff7a00, #ff4d4f);
  font-size: 14px;
  font-weight: 900;
}

.comment-row header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-row header strong {
  color: #2e333d;
  font-size: 14px;
  font-weight: 900;
}

.comment-row header button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6d7480;
  background: transparent;
  font-size: 13px;
  font-weight: 800;
}

.comment-row header button.active {
  color: #1677ff;
}

.comment-row p {
  margin: 8px 0 0;
  color: #2e333d;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.58;
}

.comment-row small {
  display: block;
  margin-top: 8px;
  color: #9aa1ae;
  font-size: 11px;
  font-weight: 800;
}

.reply-label {
  color: #7b8da8;
}

.comment-row .comment-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-row .comment-actions button {
  border: 0;
  padding: 0;
  color: #7f8da3;
  background: transparent;
  font-size: 11px;
  font-weight: 900;
}

.comment-row .comment-actions span {
  color: #9aa1ae;
}

.detail-toolbar {
  position: absolute;
  z-index: 30;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  height: calc(64px + env(safe-area-inset-bottom));
  grid-template-columns: repeat(3, 1fr);
  align-items: center;
  border-top: 1px solid #edf0f4;
  padding: 6px 6px env(safe-area-inset-bottom);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 -8px 22px rgba(15, 23, 42, 0.05);
}

.detail-toolbar button {
  display: grid;
  min-width: 0;
  place-items: center;
  gap: 3px;
  color: #8a8f99;
  background: transparent;
  font-size: 23px;
}

.detail-toolbar button.active {
  color: #1677ff;
}

.detail-toolbar span {
  font-size: 10px;
  font-weight: 900;
}

@media (max-width: 360px) {
  .detail-scroll > h1,
  .detail-body h2 {
    font-size: 22px;
  }

  .detail-body p {
    font-size: 16px;
  }
}
</style>
