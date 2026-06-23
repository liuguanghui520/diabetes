<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ChatDotRound } from '@element-plus/icons-vue'
import { diabetesTypes } from '../data/appData'

const route = useRoute()
const router = useRouter()

const typeInfo = computed(() => {
    return diabetesTypes.find((item) => item.code === route.params.code) || diabetesTypes[0]
})

const sections = computed(() => {
    return [
        {
            title: '发病机制',
            content: typeInfo.value.mechanism
        },
        {
            title: '临床表现',
            content: typeInfo.value.symptoms
        },
        {
            title: '治疗方法',
            content: typeInfo.value.treatment
        }
    ]
})
</script>

<template>
    <div class="page type-detail-page">
        <header class="detail-header">
            <button class="icon-button" aria-label="返回" @click="router.back()">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <h1>{{ typeInfo.name }}</h1>

            <span></span>
        </header>

        <section class="type-hero" :class="typeInfo.color">
            <span>{{ typeInfo.name.slice(0, 1) }}</span>
            <h2>{{ typeInfo.name }}</h2>
            <p>{{ typeInfo.subtitle }}</p>
        </section>

        <section
            v-for="section in sections"
            :key="section.title"
            class="type-section surface-card"
        >
            <h3>{{ section.title }}</h3>
            <p>{{ section.content }}</p>
        </section>

        <button class="gradient-button ask-button" @click="router.push('/assistant')">
            <el-icon>
                <ChatDotRound />
            </el-icon>
            继续向 AI 助手咨询
        </button>
    </div>
</template>

<style scoped>
.type-detail-page {
    padding-top: 14px;
}

.detail-header {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 40px;
    align-items: center;
    gap: 10px;
}

.detail-header h1 {
    overflow: hidden;
    margin: 0;
    color: var(--ink-900);
    font-size: 18px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.type-hero {
    min-height: 230px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-top: 16px;
    border-radius: 24px;
    color: #ffffff;
    text-align: center;
    box-shadow: var(--shadow-card);
}

.type-hero.blue {
    background: linear-gradient(135deg, #2167f3, #86c7ff);
}

.type-hero.green {
    background: linear-gradient(135deg, #18b981, #7bd8aa);
}

.type-hero.amber {
    background: linear-gradient(135deg, #f09a2a, #ffd077);
}

.type-hero.coral {
    background: linear-gradient(135deg, #ed7667, #ffa28c);
}

.type-hero span {
    width: 84px;
    height: 84px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid rgba(255, 255, 255, 0.52);
    border-radius: 28px;
    font-size: 36px;
    font-weight: 900;
    background: rgba(255, 255, 255, 0.16);
}

.type-hero h2 {
    margin: 18px 0 0;
    font-size: 24px;
}

.type-hero p {
    margin: 8px 0 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: 14px;
}

.type-section {
    margin-top: 14px;
    padding: 18px;
}

.type-section h3 {
    margin: 0;
    color: var(--ink-900);
    font-size: 18px;
}

.type-section h3::after {
    content: "";
    display: block;
    width: 100%;
    height: 1px;
    margin-top: 12px;
    background: var(--line);
}

.type-section p {
    margin: 13px 0 0;
    color: #4f6a85;
    font-size: 14px;
    line-height: 1.85;
}

.ask-button {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 18px;
}
</style>
