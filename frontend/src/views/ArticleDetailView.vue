<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Star, View } from '@element-plus/icons-vue'
import { articles } from '../data/appData'

const route = useRoute()
const router = useRouter()

const article = computed(() => {
    return articles.find((item) => item.id === Number(route.params.id)) || articles[0]
})
</script>

<template>
    <div class="page article-detail-page">
        <header class="detail-header">
            <button class="icon-button" aria-label="返回" @click="router.back()">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <h1>健康科普</h1>

            <button class="icon-button" aria-label="收藏文章">
                <el-icon>
                    <Star />
                </el-icon>
            </button>
        </header>

        <section class="cover-panel" :class="article.color">
            <span>{{ article.tag }}</span>
        </section>

        <article class="content-card surface-card">
            <span class="app-chip" :class="article.color">
                {{ article.tag }}
            </span>

            <h2>{{ article.title }}</h2>

            <div class="meta-row">
                <span>{{ article.date }}</span>
                <span>{{ article.time }}</span>
                <span>
                    <el-icon>
                        <View />
                    </el-icon>
                    {{ article.views }} 浏览
                </span>
            </div>

            <p class="summary">{{ article.summary }}</p>

            <div class="article-body">
                <p
                    v-for="paragraph in article.content"
                    :key="paragraph"
                >
                    {{ paragraph }}
                </p>
            </div>
        </article>

        <section class="notice">
            本文仅用于健康管理科普，不作为医学诊断或治疗依据。若指标异常或身体不适，请及时咨询医生。
        </section>
    </div>
</template>

<style scoped>
.article-detail-page {
    padding-top: 14px;
}

.detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.detail-header h1 {
    margin: 0;
    color: var(--ink-900);
    font-size: 18px;
}

.cover-panel {
    height: 190px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 16px;
    border-radius: 24px;
    color: #ffffff;
    font-size: 28px;
    font-weight: 900;
    box-shadow: var(--shadow-card);
}

.cover-panel.blue {
    background: linear-gradient(135deg, #2167f3, #86c7ff);
}

.cover-panel.green {
    background: linear-gradient(135deg, #18b981, #7bd8aa);
}

.cover-panel.amber {
    background: linear-gradient(135deg, #f09a2a, #f7c767);
}

.cover-panel.coral {
    background: linear-gradient(135deg, #ed7667, #ffa28c);
}

.content-card {
    margin-top: 14px;
    padding: 20px;
}

.content-card h2 {
    margin: 14px 0 0;
    color: var(--ink-900);
    font-size: 24px;
    line-height: 1.35;
}

.meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 12px;
    color: var(--ink-500);
    font-size: 11px;
}

.meta-row span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
}

.summary {
    margin: 18px 0 0;
    padding: 13px;
    border-radius: 14px;
    color: var(--ink-700);
    font-size: 13px;
    line-height: 1.65;
    background: #f1f7fc;
}

.article-body {
    margin-top: 18px;
}

.article-body p {
    margin: 0 0 15px;
    color: #4b6680;
    font-size: 14px;
    line-height: 1.9;
}

.notice {
    margin-top: 14px;
    padding: 14px;
    border-radius: 16px;
    color: #5f7d99;
    font-size: 12px;
    line-height: 1.65;
    background: #eaf8ff;
}
</style>
