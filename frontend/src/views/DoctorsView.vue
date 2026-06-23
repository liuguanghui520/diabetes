<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Search, ArrowRight, ChatDotRound } from '@element-plus/icons-vue'
import { doctors } from '../data/appData'

const router = useRouter()
const keyword = ref('')

const filteredDoctors = computed(() => {
    const text = keyword.value.trim().toLowerCase()

    if (!text) {
        return doctors
    }

    return doctors.filter((doctor) => {
        return [doctor.name, doctor.title, doctor.department, doctor.specialty]
            .join(' ')
            .toLowerCase()
            .includes(text)
    })
})

function goBack() {
    router.push('/home')
}

function openDoctor(id) {
    router.push(`/doctor-consult/${id}`)
}
</script>

<template>
    <div class="page doctors-page">
        <header class="page-header">
            <button class="icon-button" aria-label="返回" @click="goBack">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <div class="header-copy">
                <h1 class="page-title">专家风格问答</h1>
                <p class="page-subtitle">选择 AI 专家风格进入健康管理问答界面</p>
            </div>
        </header>

        <label class="search-field">
            <el-icon>
                <Search />
            </el-icon>

            <input
                v-model="keyword"
                type="text"
                placeholder="搜索医生、科室或擅长方向"
            >
        </label>

        <section class="doctor-list">
            <article
                v-for="doctor in filteredDoctors"
                :key="doctor.id"
                class="doctor-row surface-card"
            >
                <span class="doctor-avatar" :class="doctor.accent">
                    {{ doctor.avatar }}
                </span>

                <div class="doctor-info">
                    <div class="doctor-title">
                        <strong>{{ doctor.name }}</strong>
                        <span class="app-chip" :class="doctor.accent">
                            {{ doctor.status }}
                        </span>
                    </div>

                    <p>{{ doctor.department }} · {{ doctor.title }}</p>
                    <small>{{ doctor.specialty }}</small>

                    <div class="doctor-meta">
                        <span>{{ doctor.years }} 年经验</span>
                        <span>慢病管理</span>
                    </div>
                </div>

                <button class="consult-button" @click="openDoctor(doctor.id)">
                    <el-icon>
                        <ChatDotRound />
                    </el-icon>
                    问答
                </button>
            </article>
        </section>

        <section class="notice-card">
            <strong>使用说明</strong>
            <p>当前内容为 AI 医学咨询参考，不代表真实医生服务、远程问诊或处方服务。</p>
        </section>
    </div>
</template>

<style scoped>
.doctors-page {
    padding-top: 14px;
}

.page-header {
    justify-content: flex-start;
}

.header-copy {
    min-width: 0;
}

.search-field {
    height: 48px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border: 1px solid rgba(228, 237, 245, 0.95);
    border-radius: 16px;
    color: var(--primary-blue);
    background: #ffffff;
    box-shadow: var(--shadow-soft);
}

.search-field input {
    width: 100%;
    border: 0;
    outline: 3px solid transparent;
    color: var(--ink-800);
    background: transparent;
}

.search-field input::placeholder {
    color: var(--ink-400);
}

.doctor-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 18px;
}

.doctor-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
}

.doctor-avatar {
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #ffffff;
    border-radius: 20px;
    color: #ffffff;
    font-size: 18px;
    font-weight: 900;
    box-shadow: var(--shadow-soft);
}

.doctor-avatar.blue {
    background: linear-gradient(135deg, #2167f3, #6bb7ff);
}

.doctor-avatar.green {
    background: linear-gradient(135deg, #18b981, #77dcae);
}

.doctor-avatar.amber {
    background: linear-gradient(135deg, #f09a2a, #f7c767);
}

.doctor-info {
    flex: 1;
    min-width: 0;
}

.doctor-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.doctor-title strong {
    color: var(--ink-900);
    font-size: 16px;
}

.doctor-info p {
    margin: 5px 0 0;
    color: var(--ink-600);
    font-size: 12px;
}

.doctor-info small {
    display: -webkit-box;
    overflow: hidden;
    margin-top: 6px;
    color: var(--ink-500);
    font-size: 11px;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.doctor-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.doctor-meta span {
    padding: 4px 7px;
    border-radius: 8px;
    color: var(--ink-600);
    font-size: 10px;
    background: #eef5fb;
}

.consult-button {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 10px;
    border-radius: 12px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 850;
    background: var(--main-gradient);
}

.notice-card {
    margin-top: 18px;
    padding: 14px;
    border-radius: 18px;
    color: #5a7895;
    background: #eaf8ff;
}

.notice-card strong {
    color: var(--ink-800);
    font-size: 13px;
}

.notice-card p {
    margin: 6px 0 0;
    font-size: 11px;
    line-height: 1.65;
}
</style>
