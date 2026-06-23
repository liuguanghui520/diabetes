<script setup>
import { useRouter } from 'vue-router'
import {
    Search,
    Bell,
    ArrowRight,
    View,
    ChatDotRound,
    DataAnalysis,
    Notebook,
    FirstAidKit
} from '@element-plus/icons-vue'
import { articles, diabetesTypes, doctors, quickStats } from '../data/appData'

const router = useRouter()

function go(path) {
    router.push(path)
}

function openDoctor(doctorId) {
    router.push(`/doctor-consult/${doctorId}`)
}

function openArticle(articleId) {
    router.push(`/article/${articleId}`)
}

function openType(typeCode) {
    router.push(`/diabetes-type/${typeCode}`)
}
</script>

<template>
    <div class="page home-page">
        <header class="home-topbar">
            <button class="brand-lockup" @click="go('/home')">
                <span class="brand-mark">
                    <FirstAidKit />
                </span>

                <span>
                    糖尿病预治智能助手
                </span>
            </button>

            <div class="topbar-actions">
                <button class="icon-button" aria-label="查看健康资讯" @click="go('/news')">
                    <el-icon>
                        <Search />
                    </el-icon>
                </button>

                <button class="icon-button notify" @click="go('/messages')">
                    <el-icon>
                        <Bell />
                    </el-icon>
                    <i></i>
                </button>
            </div>
        </header>

        <section class="hero-panel">
            <div class="hero-copy">
                <span class="app-chip blue">AI 慢病管理</span>
                <h1>健康同行，稳住每一天的血糖节奏</h1>
                <p>整合风险预测、生活方案、专家风格问答与智能助手，为糖尿病高危人群提供连续健康管理。</p>

                <div class="hero-actions">
                    <button @click="go('/health-archive')">
                        完善档案
                    </button>
                    <button @click="go('/risk-predict')">
                        风险评估
                    </button>
                </div>
            </div>

            <div class="hero-visual" aria-hidden="true">
                <div class="screen-card">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div class="pulse-ring">
                    78%
                </div>
            </div>
        </section>

        <section class="stats-strip">
            <article
                v-for="stat in quickStats"
                :key="stat.label"
            >
                <span>{{ stat.label }}</span>
                <strong>{{ stat.value }}<small>{{ stat.unit }}</small></strong>
                <em>{{ stat.status }}</em>
            </article>
        </section>

        <section class="risk-entry surface-card">
            <span class="risk-icon">
                <el-icon>
                    <DataAnalysis />
                </el-icon>
            </span>

            <div>
                <span>中国糖尿病风险评分</span>
                <strong>当前为低风险，建议每年复评一次</strong>
                <p>基于年龄、BMI、性别、家族史、腰围和收缩压综合判断。</p>
            </div>

            <button @click="go('/risk-predict')">
                <el-icon>
                    <ArrowRight />
                </el-icon>
            </button>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">专家风格问答</h2>

                <button class="section-link" @click="go('/doctors')">
                    查看全部
                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>

            <div class="doctor-scroll">
                <article
                    v-for="doctor in doctors"
                    :key="doctor.id"
                    class="doctor-card surface-card"
                >
                    <span class="doctor-avatar" :class="doctor.accent">
                        {{ doctor.avatar }}
                    </span>

                    <span class="app-chip" :class="doctor.accent">
                        {{ doctor.title }}
                    </span>

                    <strong>{{ doctor.name }}</strong>
                    <p>{{ doctor.department }}</p>

                    <button @click="openDoctor(doctor.id)">
                        开始问答
                    </button>
                </article>
            </div>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">健康科普</h2>

                <button class="section-link" @click="go('/news')">
                    更多
                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>

            <div class="article-list">
                <button
                    v-for="article in articles.slice(0, 3)"
                    :key="article.id"
                    class="article-row surface-card"
                    @click="openArticle(article.id)"
                >
                    <span class="article-thumb" :class="article.color">
                        {{ article.tag.slice(0, 2) }}
                    </span>

                    <span class="article-info">
                        <strong>{{ article.title }}</strong>
                        <em>{{ article.summary }}</em>
                        <small>
                            <el-icon>
                                <View />
                            </el-icon>
                            {{ article.views }} 浏览
                        </small>
                    </span>
                </button>
            </div>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">糖尿病类型</h2>

                <span class="section-link">全部</span>
            </div>

            <div class="type-grid">
                <button
                    v-for="item in diabetesTypes"
                    :key="item.code"
                    class="type-card surface-card"
                    @click="openType(item.code)"
                >
                    <span class="type-image" :class="item.color">
                        {{ item.name.slice(0, 1) }}
                    </span>

                    <strong>{{ item.name }}</strong>
                    <p>{{ item.subtitle }}</p>
                </button>
            </div>
        </section>

        <button class="assistant-floating" @click="go('/assistant')">
            <el-icon>
                <ChatDotRound />
            </el-icon>
            问 AI 助手
        </button>
    </div>
</template>

<style scoped>
.home-page {
    padding-top: 14px;
}

.home-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.brand-lockup {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
    padding: 0;
    color: var(--primary-blue);
    font-size: 14px;
    font-weight: 900;
    background: transparent;
}

.brand-mark {
    width: 31px;
    height: 31px;
    flex: 0 0 31px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: var(--shadow-soft);
}

.brand-mark svg {
    width: 18px;
    height: 18px;
}

.topbar-actions {
    display: flex;
    gap: 8px;
}

.notify {
    position: relative;
}

.notify i {
    position: absolute;
    top: 8px;
    right: 9px;
    width: 7px;
    height: 7px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    background: #ff5e63;
}

.hero-panel {
    min-height: 220px;
    position: relative;
    display: flex;
    overflow: hidden;
    margin-top: 16px;
    padding: 22px;
    border-radius: 24px;
    color: #ffffff;
    background:
        linear-gradient(135deg, rgba(13, 47, 88, 0.88), rgba(33, 103, 243, 0.78)),
        linear-gradient(160deg, #d9efff 0%, #bfe8ff 38%, #c9f4dc 100%);
    box-shadow: 0 18px 34px rgba(35, 86, 134, 0.2);
}

.hero-panel::after {
    content: "";
    position: absolute;
    right: -44px;
    bottom: -56px;
    width: 180px;
    height: 180px;
    border: 1px solid rgba(255, 255, 255, 0.26);
    border-radius: 50%;
}

.hero-copy {
    position: relative;
    z-index: 1;
    max-width: 248px;
}

.hero-copy h1 {
    margin: 14px 0 0;
    font-size: 26px;
    line-height: 1.22;
    font-weight: 900;
}

.hero-copy p {
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.84);
    font-size: 12px;
    line-height: 1.65;
}

.hero-actions {
    display: flex;
    gap: 9px;
    margin-top: 16px;
}

.hero-actions button {
    min-height: 36px;
    padding: 0 12px;
    border-radius: 11px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 850;
    background: rgba(255, 255, 255, 0.16);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.hero-actions button:first-child {
    color: var(--primary-blue);
    background: #ffffff;
}

.hero-visual {
    position: absolute;
    right: 17px;
    bottom: 18px;
    width: 120px;
    height: 135px;
}

.screen-card {
    position: absolute;
    right: 0;
    top: 0;
    width: 92px;
    height: 76px;
    padding: 12px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(8px);
}

.screen-card span {
    display: block;
    height: 8px;
    margin-bottom: 9px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.68);
}

.screen-card span:nth-child(2) {
    width: 58%;
}

.screen-card span:nth-child(3) {
    width: 78%;
}

.pulse-ring {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 68px;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 8px solid rgba(255, 255, 255, 0.28);
    border-top-color: #7ff2c2;
    border-radius: 50%;
    color: #ffffff;
    font-size: 17px;
    font-weight: 900;
}

.stats-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 12px;
}

.stats-strip article {
    min-height: 92px;
    padding: 12px 10px;
    border: 1px solid rgba(228, 237, 245, 0.9);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: var(--shadow-soft);
}

.stats-strip span,
.stats-strip em {
    display: block;
    color: var(--ink-500);
    font-size: 10px;
    font-style: normal;
}

.stats-strip strong {
    display: block;
    margin: 7px 0 5px;
    color: var(--ink-900);
    font-size: 24px;
    line-height: 1;
}

.stats-strip small {
    margin-left: 2px;
    font-size: 11px;
}

.risk-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    padding: 14px;
}

.risk-icon {
    width: 46px;
    height: 46px;
    flex: 0 0 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    color: var(--primary-blue);
    font-size: 22px;
    background: var(--blue-soft);
}

.risk-entry div {
    flex: 1;
    min-width: 0;
}

.risk-entry span:not(.risk-icon) {
    color: var(--ink-500);
    font-size: 11px;
}

.risk-entry strong {
    display: block;
    margin-top: 4px;
    color: var(--ink-900);
    font-size: 14px;
    line-height: 1.35;
}

.risk-entry p {
    margin: 5px 0 0;
    color: var(--ink-500);
    font-size: 11px;
    line-height: 1.45;
}

.risk-entry button {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: var(--primary-blue);
    background: var(--blue-soft);
}

.doctor-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    margin: 0 -16px;
    padding: 2px 16px 8px;
    scrollbar-width: none;
}

.doctor-scroll::-webkit-scrollbar {
    display: none;
}

.doctor-card {
    width: 128px;
    flex: 0 0 128px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 12px;
    text-align: center;
}

.doctor-avatar {
    width: 58px;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    border: 3px solid #ffffff;
    border-radius: 50%;
    color: #ffffff;
    font-size: 18px;
    font-weight: 900;
    box-shadow: 0 8px 14px rgba(36, 74, 113, 0.14);
}

.doctor-avatar.blue {
    background: linear-gradient(135deg, #2167f3, #67b7ff);
}

.doctor-avatar.green {
    background: linear-gradient(135deg, #18b981, #78dcae);
}

.doctor-avatar.amber {
    background: linear-gradient(135deg, #f09a2a, #f7c767);
}

.doctor-card strong {
    margin-top: 9px;
    color: var(--ink-900);
    font-size: 14px;
}

.doctor-card p {
    margin: 6px 0 12px;
    color: var(--ink-500);
    font-size: 11px;
}

.doctor-card button {
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid #9bc5ff;
    border-radius: 10px;
    color: var(--primary-blue);
    font-size: 11px;
    font-weight: 850;
    background: #ffffff;
}

.article-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.article-row {
    width: 100%;
    min-height: 96px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    text-align: left;
}

.article-thumb {
    width: 78px;
    height: 72px;
    flex: 0 0 78px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 900;
}

.article-thumb.blue {
    background: linear-gradient(135deg, #2167f3, #75b8ff);
}

.article-thumb.green {
    background: linear-gradient(135deg, #18b981, #7bd8aa);
}

.article-thumb.amber {
    background: linear-gradient(135deg, #f09a2a, #f7c767);
}

.article-info {
    min-width: 0;
}

.article-info strong {
    display: block;
    overflow: hidden;
    color: var(--ink-900);
    font-size: 14px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.article-info em {
    display: -webkit-box;
    overflow: hidden;
    margin-top: 5px;
    color: var(--ink-500);
    font-size: 11px;
    font-style: normal;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.article-info small {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-top: 7px;
    color: var(--ink-400);
    font-size: 10px;
}

.type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.type-card {
    min-height: 168px;
    padding: 13px;
    text-align: left;
}

.type-image {
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    color: #ffffff;
    font-size: 30px;
    font-weight: 900;
}

.type-image.blue {
    background: linear-gradient(135deg, #2167f3, #8cc8ff);
}

.type-image.green {
    background: linear-gradient(135deg, #18b981, #7bd8aa);
}

.type-image.amber {
    background: linear-gradient(135deg, #f09a2a, #ffd077);
}

.type-image.coral {
    background: linear-gradient(135deg, #ed7667, #ffa28c);
}

.type-card strong {
    display: block;
    margin-top: 12px;
    color: var(--ink-900);
    font-size: 14px;
}

.type-card p {
    margin: 6px 0 0;
    color: var(--ink-500);
    font-size: 11px;
    line-height: 1.45;
}

.assistant-floating {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 22px;
    border-radius: 16px;
    color: #ffffff;
    font-size: 14px;
    font-weight: 900;
    background: var(--main-gradient);
    box-shadow: 0 12px 22px rgba(28, 122, 209, 0.22);
}
</style>
