<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Delete, Promotion } from '@element-plus/icons-vue'
import { doctors } from '../data/appData'

const route = useRoute()
const router = useRouter()
const boardRef = ref(null)
const inputText = ref('')
const loading = ref(false)

const doctor = computed(() => {
    return doctors.find((item) => item.id === Number(route.params.id)) || doctors[0]
})

const messages = ref([
    {
        id: 1,
        role: 'assistant',
        content: '你好，我会以 AI 专家风格为你提供饮食、运动、血糖监测和复查方面的健康管理参考。',
        time: '现在'
    }
])

function goBack() {
    router.push('/home')
}

function clearChat() {
    messages.value = [
        {
            id: Date.now(),
            role: 'assistant',
            content: '咨询记录已清空。你可以继续描述近期血糖、饮食、运动或身体不适情况。',
            time: getTimeText()
        }
    ]
}

function getTimeText() {
    return new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}

async function scrollBottom() {
    await nextTick()

    if (!boardRef.value) {
        return
    }

    boardRef.value.scrollTo({
        top: boardRef.value.scrollHeight,
        behavior: 'smooth'
    })
}

async function sendMessage() {
    const content = inputText.value.trim()

    if (!content || loading.value) {
        return
    }

    messages.value.push({
        id: Date.now(),
        role: 'user',
        content,
        time: getTimeText()
    })

    inputText.value = ''
    loading.value = true
    await scrollBottom()

    window.setTimeout(async () => {
        messages.value.push({
            id: Date.now() + 1,
            role: 'assistant',
            content: `结合你描述的情况，建议先记录最近 3 天饮食、运动、睡眠和血糖变化。若血糖持续异常或伴随明显不适，请尽快线下就医。日常可以优先从规律三餐、饭后轻量活动和复查计划开始调整。`,
            time: getTimeText()
        })
        loading.value = false
        await scrollBottom()
    }, 650)
}
</script>

<template>
    <div class="consult-page">
        <header class="consult-header">
            <button aria-label="返回首页" @click="goBack">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <div>
                <h1>专家风格问答</h1>
                <p>{{ doctor.name }} · {{ doctor.department }}</p>
            </div>

            <button aria-label="清空问答记录" @click="clearChat">
                <el-icon>
                    <Delete />
                </el-icon>
            </button>
        </header>

        <section class="doctor-profile surface-card">
            <span class="doctor-avatar" :class="doctor.accent">
                {{ doctor.avatar }}
            </span>

            <div>
                <div class="profile-title">
                    <strong>{{ doctor.name }}</strong>
                    <span>{{ doctor.status }}</span>
                </div>

                <p>{{ doctor.department }} · {{ doctor.title }}</p>
                <small>{{ doctor.intro }}</small>
            </div>
        </section>

        <main ref="boardRef" class="chat-board">
            <article
                v-for="message in messages"
                :key="message.id"
                class="message"
                :class="message.role"
            >
                <span v-if="message.role === 'assistant'" class="avatar doctor-mini">
                    {{ doctor.avatar }}
                </span>

                <div class="bubble-wrap">
                    <div class="bubble">{{ message.content }}</div>
                    <small>{{ message.time }}</small>
                </div>

                <span v-if="message.role === 'user'" class="avatar user-mini">
                    我
                </span>
            </article>

            <article v-if="loading" class="message assistant">
                <span class="avatar doctor-mini">
                    {{ doctor.avatar }}
                </span>
                <div class="typing">
                    <i></i>
                    <i></i>
                    <i></i>
                </div>
            </article>
        </main>

        <section class="consult-notice">
            当前为 AI 医学咨询参考，不代表真实医生服务、远程问诊或处方建议。
        </section>

        <footer class="chat-input">
            <input
                v-model="inputText"
                type="text"
                placeholder="描述你的健康问题..."
                @keydown.enter.prevent="sendMessage"
            >

            <button
                :disabled="!inputText.trim() || loading"
                @click="sendMessage"
            >
                <el-icon>
                    <Promotion />
                </el-icon>
            </button>
        </footer>
    </div>
</template>

<style scoped>
.consult-page {
    min-height: calc(100dvh - 82px);
    display: flex;
    flex-direction: column;
    padding: 14px 16px 12px;
}

.consult-header {
    display: flex;
    align-items: center;
    gap: 12px;
}

.consult-header button {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: 13px;
    color: var(--ink-700);
    background: #ffffff;
    box-shadow: var(--shadow-soft);
}

.consult-header div {
    flex: 1;
    min-width: 0;
    text-align: center;
}

.consult-header h1 {
    margin: 0;
    color: var(--ink-900);
    font-size: 18px;
}

.consult-header p {
    overflow: hidden;
    margin: 4px 0 0;
    color: var(--ink-500);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.doctor-profile {
    display: flex;
    gap: 12px;
    margin-top: 14px;
    padding: 14px;
}

.doctor-avatar {
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
    color: #ffffff;
    font-size: 18px;
    font-weight: 900;
}

.doctor-avatar.blue,
.doctor-mini {
    background: linear-gradient(135deg, #2167f3, #6bb7ff);
}

.doctor-avatar.green {
    background: linear-gradient(135deg, #18b981, #77dcae);
}

.doctor-avatar.amber {
    background: linear-gradient(135deg, #f09a2a, #f7c767);
}

.profile-title {
    display: flex;
    align-items: center;
    gap: 7px;
}

.profile-title strong {
    color: var(--ink-900);
    font-size: 15px;
}

.profile-title span {
    padding: 3px 7px;
    border-radius: 7px;
    color: var(--primary-green);
    font-size: 10px;
    background: var(--green-soft);
}

.doctor-profile p {
    margin: 5px 0;
    color: var(--ink-600);
    font-size: 12px;
}

.doctor-profile small {
    color: var(--ink-500);
    font-size: 11px;
    line-height: 1.5;
}

.chat-board {
    flex: 1;
    overflow-y: auto;
    margin: 16px -4px 0;
    padding: 0 4px 12px;
}

.consult-notice {
    margin-bottom: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    color: #5e7f9d;
    font-size: 11px;
    line-height: 1.6;
    background: #eaf8ff;
}

.message {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 14px;
}

.message.user {
    justify-content: flex-end;
}

.avatar {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 900;
}

.user-mini {
    background: linear-gradient(135deg, #ed9f7d, #778ec7);
}

.bubble-wrap {
    max-width: calc(100% - 48px);
}

.message.user .bubble-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.bubble {
    padding: 12px 13px;
    border-radius: 17px;
    color: var(--ink-700);
    font-size: 13px;
    line-height: 1.75;
    background: #ffffff;
    box-shadow: var(--shadow-soft);
}

.message.user .bubble {
    color: #ffffff;
    background: var(--main-gradient);
}

.bubble-wrap small {
    display: block;
    margin-top: 5px;
    color: var(--ink-400);
    font-size: 9px;
}

.typing {
    display: flex;
    gap: 5px;
    padding: 14px 16px;
    border-radius: 17px;
    background: #ffffff;
    box-shadow: var(--shadow-soft);
}

.typing i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink-500);
    animation: typing 1s infinite ease-in-out;
}

.typing i:nth-child(2) {
    animation-delay: 0.16s;
}

.typing i:nth-child(3) {
    animation-delay: 0.32s;
}

@keyframes typing {
    50% {
        opacity: 0.35;
        transform: translateY(-4px);
    }
}

.chat-input {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: var(--shadow-card);
}

.chat-input input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 3px solid transparent;
    color: var(--ink-800);
    background: transparent;
}

.chat-input input::placeholder {
    color: var(--ink-400);
}

.chat-input button {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 13px;
    color: #ffffff;
    background: var(--main-gradient);
}

.chat-input button:disabled {
    color: var(--ink-400);
    background: #edf3f8;
}
</style>
