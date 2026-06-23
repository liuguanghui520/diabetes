<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
    Search,
    Star,
    StarFilled,
    ArrowRight,
    Close,
    Check,
    Reading,
    CircleCheckFilled
} from '@element-plus/icons-vue'
import { articles as sharedArticles } from '../data/appData'

const router = useRouter()

const categories = [
    '全部',
    '控糖饮食',
    '科学运动',
    '血糖监测',
    '并发症预防'
]

const articles = sharedArticles

const activeCategory = ref('全部')
const searchText = ref('')
const showFavoriteOnly = ref(false)
const selectedArticle = ref(null)
const favoriteIds = ref([2])
const readIds = ref([1])

const filteredArticles = computed(() => {
    const keyword = searchText.value.trim().toLowerCase()

    return articles.filter((article) => {
        const matchCategory = activeCategory.value === '全部'
            || article.tag === activeCategory.value

        const matchFavorite = !showFavoriteOnly.value
            || favoriteIds.value.includes(article.id)

        const matchKeyword = !keyword
            || article.title.toLowerCase().includes(keyword)
            || article.summary.toLowerCase().includes(keyword)
            || article.tag.toLowerCase().includes(keyword)

        return matchCategory && matchFavorite && matchKeyword
    })
})

const favoriteArticles = computed(() => {
    return articles.filter((article) => {
        return favoriteIds.value.includes(article.id)
    })
})

const recommendArticle = computed(() => {
    const unreadArticle = articles.find((article) => {
        return !readIds.value.includes(article.id)
    })

    return unreadArticle || articles[0]
})

function setCategory(category) {
    activeCategory.value = category
    showFavoriteOnly.value = false
}

function toggleFavoriteOnly() {
    showFavoriteOnly.value = !showFavoriteOnly.value
}

function isFavorite(articleId) {
    return favoriteIds.value.includes(articleId)
}

function isRead(articleId) {
    return readIds.value.includes(articleId)
}

function toggleFavorite(articleId) {
    if (isFavorite(articleId)) {
        favoriteIds.value = favoriteIds.value.filter((id) => id !== articleId)
        return
    }

    favoriteIds.value.push(articleId)
}

function openArticle(article) {
    if (!isRead(article.id)) {
        readIds.value.push(article.id)
    }

    router.push(`/article/${article.id}`)
}

function closeArticle() {
    selectedArticle.value = null
}

function clearSearch() {
    searchText.value = ''
}
</script>

<template>
    <div class="page news-page">
        <header class="page-header">
            <div>
                <h1 class="page-title">健康资讯</h1>
                <p class="page-subtitle">为您推荐更适合的健康管理知识</p>
            </div>

            <button
                class="icon-button favorite-button"
                :class="{ active: showFavoriteOnly }"
                @click="toggleFavoriteOnly"
            >
                <el-icon>
                    <StarFilled v-if="showFavoriteOnly" />
                    <Star v-else />
                </el-icon>
            </button>
        </header>

        <div class="search-box">
            <el-icon>
                <Search />
            </el-icon>

            <input
                v-model="searchText"
                type="text"
                placeholder="搜索控糖、饮食、运动等内容"
            >

            <button
                v-if="searchText"
                class="clear-search"
                @click="clearSearch"
            >
                ×
            </button>
        </div>

        <div class="category-list">
            <button
                v-for="category in categories"
                :key="category"
                :class="{ active: activeCategory === category }"
                @click="setCategory(category)"
            >
                {{ category }}
            </button>
        </div>

        <section class="recommend-card">
            <div>
                <span>为你推荐</span>
                <h2>{{ recommendArticle.title }}</h2>
                <p>{{ recommendArticle.summary }}</p>

                <button @click="openArticle(recommendArticle)">
                    立即阅读
                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>

            <div class="recommend-icon">
                <span>{{ recommendArticle.tag.slice(0, 2) }}</span>
            </div>
        </section>

        <section>
            <div class="section-header">
                <div>
                    <h2 class="section-title">
                        {{ showFavoriteOnly ? '我的收藏' : '推荐资讯' }}
                    </h2>

                    <p class="section-desc">
                        {{
                            showFavoriteOnly
                                ? `已收藏 ${favoriteArticles.length} 篇资讯`
                                : '健康科普内容仅供健康管理参考'
                        }}
                    </p>
                </div>

                <span class="section-link">
                    {{ filteredArticles.length }} 篇
                </span>
            </div>

            <div v-if="filteredArticles.length > 0" class="article-list">
                <article
                    v-for="article in filteredArticles"
                    :key="article.id"
                    class="article-card surface-card"
                    @click="openArticle(article)"
                >
                    <div class="article-cover" :class="article.color">
                        <span>{{ article.tag }}</span>
                    </div>

                    <div class="article-info">
                        <div class="article-title-row">
                            <strong>{{ article.title }}</strong>

                            <span v-if="isRead(article.id)" class="read-tag">
                                已读
                            </span>
                        </div>

                        <p>{{ article.summary }}</p>

                        <span>
                            {{ article.date }} · {{ article.time }}
                        </span>
                    </div>

                    <button
                        class="card-favorite"
                        :class="{ active: isFavorite(article.id) }"
                        @click.stop="toggleFavorite(article.id)"
                    >
                        <el-icon>
                            <StarFilled v-if="isFavorite(article.id)" />
                            <Star v-else />
                        </el-icon>
                    </button>
                </article>
            </div>

            <div v-else class="empty-card surface-card">
                <span class="empty-icon">
                    <el-icon>
                        <Reading />
                    </el-icon>
                </span>

                <strong>暂未找到相关资讯</strong>

                <p>
                    可尝试更换分类，或输入“控糖、饮食、运动”等关键词进行搜索。
                </p>

                <button @click="clearSearch">
                    清空搜索
                </button>
            </div>
        </section>

        <section class="news-tip">
            <span>
                <el-icon>
                    <CircleCheckFilled />
                </el-icon>
            </span>

            <p>
                健康资讯用于日常健康管理参考，不代替医生诊断、处方或专业治疗建议。
            </p>
        </section>

        <div
            v-if="selectedArticle"
            class="article-mask"
            @click.self="closeArticle"
        >
            <section class="article-dialog">
                <header class="dialog-header">
                    <span class="dialog-tag" :class="selectedArticle.color">
                        {{ selectedArticle.tag }}
                    </span>

                    <button @click="closeArticle">
                        <el-icon>
                            <Close />
                        </el-icon>
                    </button>
                </header>

                <h2>{{ selectedArticle.title }}</h2>

                <div class="dialog-meta">
                    <span>{{ selectedArticle.date }}</span>
                    <span>{{ selectedArticle.time }}</span>
                    <span>健康科普</span>
                </div>

                <div class="dialog-content">
                    <p
                        v-for="paragraph in selectedArticle.content"
                        :key="paragraph"
                    >
                        {{ paragraph }}
                    </p>
                </div>

                <div class="dialog-bottom">
                    <button
                        class="dialog-favorite"
                        :class="{ active: isFavorite(selectedArticle.id) }"
                        @click="toggleFavorite(selectedArticle.id)"
                    >
                        <el-icon>
                            <StarFilled v-if="isFavorite(selectedArticle.id)" />
                            <Star v-else />
                        </el-icon>

                        {{
                            isFavorite(selectedArticle.id)
                                ? '已收藏'
                                : '收藏资讯'
                        }}
                    </button>

                    <button class="dialog-close" aria-label="关闭文章详情" @click="closeArticle">
                        阅读完成
                        <el-icon>
                            <Check />
                        </el-icon>
                    </button>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.news-page {
    padding-top: 14px;
    padding-bottom: 24px;
}

.icon-button {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    color: #1687ff;
    font-size: 19px;
    background: #ffffff;
    box-shadow: 0 8px 18px rgba(40, 99, 174, 0.1);
}

.favorite-button.active {
    color: #f5a21d;
    background: #fff4dc;
}

.search-box {
    height: 49px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
    padding: 0 14px;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 8px 20px rgba(48, 105, 178, 0.08);
}

.search-box > .el-icon {
    flex: 0 0 auto;
    color: #1687ff;
    font-size: 19px;
}

.search-box input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 3px solid transparent;
    color: #35577f;
    font-size: 13px;
    background: transparent;
}

.search-box input::placeholder {
    color: #9aaac0;
}

.clear-search {
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #8194ad;
    font-size: 17px;
    background: #eef3f8;
}

.category-list {
    display: flex;
    gap: 9px;
    overflow-x: auto;
    margin: 17px -18px 0;
    padding: 0 18px 4px;
    scrollbar-width: none;
}

.category-list::-webkit-scrollbar {
    display: none;
}

.category-list button {
    flex: 0 0 auto;
    padding: 8px 13px;
    border-radius: 12px;
    color: #8293ad;
    font-size: 12px;
    font-weight: 700;
    background: #edf3fa;
}

.category-list button.active {
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 7px 14px rgba(22, 135, 255, 0.18);
}

.recommend-card {
    min-height: 193px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 22px;
    padding: 23px;
    overflow: hidden;
    border-radius: 25px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 18px 30px rgba(13, 143, 220, 0.18);
}

.recommend-card > div:first-child {
    flex: 1;
    min-width: 0;
}

.recommend-card > div:first-child span {
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
}

.recommend-card h2 {
    margin: 9px 0 0;
    font-size: 22px;
    line-height: 1.35;
}

.recommend-card p {
    margin: 9px 0 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: 12px;
    line-height: 1.55;
}

.recommend-card button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 13px;
    padding: 8px 11px;
    border-radius: 10px;
    color: #1687ff;
    font-size: 12px;
    font-weight: 800;
    background: #ffffff;
}

.recommend-icon {
    width: 76px;
    height: 76px;
    flex: 0 0 76px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255, 255, 255, 0.38);
    border-radius: 25px;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.13);
    transform: rotate(8deg);
}

.recommend-icon span {
    font-size: 16px;
    font-weight: 800;
    transform: rotate(-8deg);
}

.section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: 27px;
    margin-bottom: 13px;
}

.section-title {
    margin: 0;
    color: #29476f;
    font-size: 18px;
}

.section-desc {
    margin: 5px 0 0;
    color: #9caabc;
    font-size: 11px;
}

.section-link {
    color: #6e91b8;
    font-size: 11px;
}

.article-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.article-card {
    min-height: 103px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px;
    cursor: pointer;
    transition: transform 0.2s ease;
}

.article-card:active {
    transform: scale(0.985);
}

.article-cover {
    width: 69px;
    height: 69px;
    flex: 0 0 69px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 7px;
    border-radius: 18px;
    color: #ffffff;
    text-align: center;
    background: var(--main-gradient);
}

.article-cover span {
    font-size: 12px;
    font-weight: 800;
    line-height: 1.35;
}

.article-cover.green {
    background: linear-gradient(135deg, #00c985, #69d6a8);
}

.article-cover.blue {
    background: linear-gradient(135deg, #1687ff, #75c0ff);
}

.article-cover.orange {
    background: linear-gradient(135deg, #ff9a21, #ffcf65);
}

.article-cover.amber {
    background: linear-gradient(135deg, #ff9a21, #ffcf65);
}

.article-cover.purple {
    background: linear-gradient(135deg, #8874f6, #b7a6ff);
}

.article-cover.red {
    background: linear-gradient(135deg, #ff6f7e, #ff9d88);
}

.article-cover.coral {
    background: linear-gradient(135deg, #ff6f7e, #ff9d88);
}

.article-info {
    flex: 1;
    min-width: 0;
}

.article-title-row {
    display: flex;
    align-items: center;
    gap: 7px;
}

.article-info strong {
    overflow: hidden;
    color: #29456d;
    font-size: 14px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.read-tag {
    flex: 0 0 auto;
    padding: 3px 5px;
    border-radius: 6px;
    color: #00a979;
    font-size: 9px;
    background: #e4fbf1;
}

.article-info p {
    display: -webkit-box;
    overflow: hidden;
    margin: 6px 0;
    color: #98a7bb;
    font-size: 11px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.article-info > span {
    color: #8e9eb5;
    font-size: 10px;
}

.card-favorite {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    color: #a1b1c4;
    font-size: 16px;
    background: #f1f5f9;
}

.card-favorite.active {
    color: #f4a21d;
    background: #fff3d9;
}

.empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 29px 23px;
    text-align: center;
}

.empty-icon {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    color: #1687ff;
    font-size: 25px;
    background: #e4f3ff;
}

.empty-card strong {
    margin-top: 13px;
    color: #34567e;
    font-size: 14px;
}

.empty-card p {
    margin: 8px 0 16px;
    color: #95a6ba;
    font-size: 11px;
    line-height: 1.65;
}

.empty-card button {
    padding: 9px 13px;
    border-radius: 11px;
    color: #1687ff;
    font-size: 11px;
    font-weight: 800;
    background: #e6f4ff;
}

.news-tip {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 20px;
    padding: 14px;
    border-radius: 18px;
    color: #5f89ad;
    background: #e7f7ff;
}

.news-tip > span {
    margin-top: 1px;
    color: #1687ff;
    font-size: 17px;
}

.news-tip p {
    margin: 0;
    font-size: 11px;
    line-height: 1.65;
}

.article-mask {
    position: fixed;
    z-index: 60;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(21, 47, 77, 0.4);
}

.article-dialog {
    width: 100%;
    max-width: 520px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    padding: 22px 20px 22px;
    overflow-y: auto;
    border-radius: 28px 28px 0 0;
    background: #ffffff;
}

.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.dialog-tag {
    padding: 6px 9px;
    border-radius: 9px;
    color: #1687ff;
    font-size: 11px;
    font-weight: 800;
    background: #e6f4ff;
}

.dialog-tag.green {
    color: #00a879;
    background: #e3fbf0;
}

.dialog-tag.blue {
    color: #1687ff;
    background: #e6f4ff;
}

.dialog-tag.orange {
    color: #e78618;
    background: #fff0dc;
}

.dialog-tag.amber {
    color: #e78618;
    background: #fff0dc;
}

.dialog-tag.purple {
    color: #7768ed;
    background: #efecff;
}

.dialog-tag.red {
    color: #ed5f67;
    background: #ffeaec;
}

.dialog-tag.coral {
    color: #ed5f67;
    background: #ffeaec;
}

.dialog-header button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    color: #6983a1;
    font-size: 18px;
    background: #eff4f9;
}

.article-dialog h2 {
    margin: 18px 0 0;
    color: #28476f;
    font-size: 22px;
    line-height: 1.4;
}

.dialog-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
    color: #94a5ba;
    font-size: 11px;
}

.dialog-meta span::after {
    margin-left: 8px;
    color: #c6d1dd;
    content: '·';
}

.dialog-meta span:last-child::after {
    display: none;
}

.dialog-content {
    margin-top: 19px;
}

.dialog-content p {
    margin: 0 0 15px;
    color: #58718e;
    font-size: 14px;
    line-height: 1.85;
}

.dialog-bottom {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 10px;
    margin-top: 8px;
}

.dialog-bottom button {
    min-height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 800;
}

.dialog-favorite {
    color: #758aa5;
    background: #eef3f8;
}

.dialog-favorite.active {
    color: #ed9a15;
    background: #fff2d9;
}

.dialog-close {
    color: #ffffff;
    background: var(--main-gradient);
}
</style>
