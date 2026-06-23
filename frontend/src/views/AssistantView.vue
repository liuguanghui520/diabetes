<script setup>
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
    ArrowLeft,
    ArrowRight,
    ChatDotRound,
    Delete,
    InfoFilled,
    CircleCheckFilled
} from '@element-plus/icons-vue'
import { sendAssistantMessage } from '../api/assistant'

const router = useRouter()

const chatBoardRef = ref(null)
const inputText = ref('')
const loading = ref(false)

const quickQuestions = [
    '我今天可以吃水果吗？',
    '空腹血糖偏高怎么办？',
    '饭后适合做什么运动？',
    '睡眠不足会影响血糖吗？'
]

const messages = ref([
    {
        id: 1,
        role: 'assistant',
        content: '你好，我是糖尿病健康智能助手。你可以向我咨询饮食、运动、睡眠、血糖记录和健康管理相关问题。',
        tips: [
            '饮食：控糖饮食怎么安排？',
            '运动：饭后适合做什么运动？',
            '睡眠：如何建立规律作息？'
        ],
        time: '现在'
    }
])

function goBack() {
    router.push('/home')
}

function getTimeText() {
    return new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}

async function scrollToBottom() {
    await nextTick()

    if (!chatBoardRef.value) {
        return
    }

    chatBoardRef.value.scrollTo({
        top: chatBoardRef.value.scrollHeight,
        behavior: 'smooth'
    })
}

function clearChat() {
    messages.value = [
        {
            id: Date.now(),
            role: 'assistant',
            content: '聊天记录已清空。你可以继续向我咨询饮食、运动、睡眠和血糖管理问题。',
            tips: [
                '我今天可以吃水果吗？',
                '如何安排饭后运动？',
                '睡眠不足怎么办？'
            ],
            time: getTimeText()
        }
    ]

    ElMessage.success('聊天记录已清空')
}

async function sendMessage() {
    const content = inputText.value.trim()

    if (!content || loading.value) {
        return
    }

    messages.value.push({
        id: Date.now(),
        role: 'user',
        content: content,
        tips: [],
        time: getTimeText()
    })

    inputText.value = ''
    loading.value = true

    await scrollToBottom()

    try {
        const response = await sendAssistantMessage({
            content: content,
            history: messages.value
        })

        messages.value.push(response)
    } catch (error) {
        messages.value.push({
            id: Date.now(),
            role: 'assistant',
            content: '当前智能助手暂时无法回复，请稍后再试。',
            tips: [],
            time: getTimeText()
        })
    } finally {
        loading.value = false
        await scrollToBottom()
    }
}

function askQuickQuestion(question) {
    inputText.value = question
    sendMessage()
}
</script>

<template>
    <div class="page assistant-page">
        <header class="assistant-header">
            <button class="back-button" aria-label="返回首页" @click="goBack">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <div class="assistant-title">
                <h1>智能健康助手</h1>
                <p>饮食、运动、睡眠与血糖管理问答</p>
            </div>

            <button class="clear-button" aria-label="清空聊天记录" @click="clearChat">
                <el-icon>
                    <Delete />
                </el-icon>
            </button>
        </header>

        <section class="assistant-hero">
            <span class="assistant-logo">
                <el-icon>
                    <ChatDotRound />
                </el-icon>
            </span>

            <div>
                <span>糖尿病健康智能助手</span>
                <strong>为你提供日常健康管理参考</strong>
                <p>已预留 Dify Chatflow 流式接口，当前可使用本地健康问答后备回复。</p>
            </div>
        </section>

        <section class="quick-section">
            <div class="quick-header">
                <h2>你可以这样问我</h2>
                <span>快捷提问</span>
            </div>

            <div class="quick-list">
                <button
                    v-for="question in quickQuestions"
                    :key="question"
                    @click="askQuickQuestion(question)"
                >
                    {{ question }}
                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>
        </section>

        <section ref="chatBoardRef" class="chat-board">
            <article
                v-for="message in messages"
                :key="message.id"
                class="chat-message"
                :class="message.role"
            >
                <span
                    v-if="message.role === 'assistant'"
                    class="chat-avatar assistant-avatar"
                >
                    AI
                </span>

                <div class="message-wrap">
                    <div class="message-bubble">
                        {{ message.content }}
                    </div>

                    <div
                        v-if="message.role === 'assistant' && message.tips.length > 0"
                        class="message-tips"
                    >
                        <span
                            v-for="tip in message.tips"
                            :key="tip"
                        >
                            <el-icon>
                                <CircleCheckFilled />
                            </el-icon>

                            {{ tip }}
                        </span>
                    </div>

                    <small>{{ message.time }}</small>
                </div>

                <span
                    v-if="message.role === 'user'"
                    class="chat-avatar user-avatar"
                >
                    康
                </span>
            </article>

            <article v-if="loading" class="chat-message assistant">
                <span class="chat-avatar assistant-avatar">
                    AI
                </span>

                <div class="message-wrap">
                    <div class="typing-bubble">
                        <i></i>
                        <i></i>
                        <i></i>
                    </div>
                </div>
            </article>
        </section>

        <section class="assistant-notice">
            <el-icon>
                <InfoFilled />
            </el-icon>

            <p>
                智能助手回答仅用于健康管理参考，不代替医生诊断、处方或专业医疗建议。
            </p>
        </section>

        <section class="input-panel">
            <textarea
                v-model="inputText"
                rows="1"
                maxlength="200"
                placeholder="请输入你的健康问题..."
                @keydown.enter.exact.prevent="sendMessage"
            ></textarea>

            <button
                :class="{ disabled: !inputText.trim() || loading }"
                @click="sendMessage"
            >
                <el-icon>
                    <ArrowRight />
                </el-icon>
            </button>
        </section>

        <p class="input-tip">
            按 Enter 发送，Shift + Enter 换行
        </p>
    </div>
</template>

<style scoped>
.assistant-page {
    padding-top: 16px;
    padding-bottom: 24px;
}

.assistant-header {
    display: flex;
    align-items: center;
    gap: 11px;
}

.back-button,
.clear-button {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    font-size: 18px;
    background: #ffffff;
    box-shadow: 0 8px 18px rgba(40, 99, 174, 0.1);
}

.back-button {
    color: #345677;
}

.clear-button {
    color: #7d91aa;
}

.assistant-title {
    flex: 1;
    min-width: 0;
}

.assistant-title h1 {
    margin: 0;
    color: #29476f;
    font-size: 20px;
    font-weight: 800;
}

.assistant-title p {
    overflow: hidden;
    margin: 5px 0 0;
    color: #91a4bc;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.assistant-hero {
    display: flex;
    align-items: center;
    gap: 13px;
    margin-top: 18px;
    padding: 17px;
    border-radius: 21px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 16px 28px rgba(13, 143, 220, 0.16);
}

.assistant-logo {
    width: 47px;
    height: 47px;
    flex: 0 0 47px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    font-size: 23px;
    background: rgba(255, 255, 255, 0.16);
}

.assistant-hero > div {
    min-width: 0;
}

.assistant-hero > div > span {
    display: block;
    color: rgba(255, 255, 255, 0.78);
    font-size: 11px;
}

.assistant-hero strong {
    display: block;
    overflow: hidden;
    margin-top: 4px;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.assistant-hero p {
    margin: 5px 0 0;
    color: rgba(255, 255, 255, 0.84);
    font-size: 10px;
    line-height: 1.55;
}

.quick-section {
    margin-top: 20px;
}

.quick-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.quick-header h2 {
    margin: 0;
    color: #29476f;
    font-size: 16px;
}

.quick-header span {
    color: #91a4bc;
    font-size: 10px;
}

.quick-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 9px;
    margin-top: 11px;
}

.quick-list button {
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 9px 10px;
    border-radius: 14px;
    color: #52708f;
    font-size: 11px;
    font-weight: 700;
    text-align: left;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.quick-list button .el-icon {
    margin-left: auto;
    flex: 0 0 auto;
    color: #93abc4;
    font-size: 14px;
}

.chat-board {
    height: min(460px, calc(100vh - 360px));
    min-height: 300px;
    overflow-y: auto;
    margin-top: 20px;
    padding: 3px 2px 6px;
    scrollbar-width: thin;
}

.chat-message {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 14px;
}

.chat-message:first-child {
    margin-top: 0;
}

.chat-message.user {
    justify-content: flex-end;
}

.chat-avatar {
    width: 35px;
    height: 35px;
    flex: 0 0 35px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 800;
}

.assistant-avatar {
    color: #ffffff;
    background: var(--main-gradient);
}

.user-avatar {
    color: #ffffff;
    background: linear-gradient(135deg, #ffc5ae, #6b91cf);
}

.message-wrap {
    max-width: calc(100% - 47px);
}

.chat-message.user .message-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.message-bubble {
    padding: 11px 13px;
    border-radius: 16px;
    color: #46637f;
    font-size: 13px;
    line-height: 1.7;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.chat-message.user .message-bubble {
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 10px 18px rgba(22, 135, 255, 0.17);
}

.message-wrap small {
    display: block;
    margin-top: 5px;
    color: #a1afbf;
    font-size: 9px;
}

.chat-message.user .message-wrap small {
    text-align: right;
}

.message-tips {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 9px;
    padding: 11px 12px;
    border-radius: 14px;
    background: #edfaff;
}

.message-tips span {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    color: #5a7895;
    font-size: 10px;
    line-height: 1.5;
}

.message-tips .el-icon {
    margin-top: 1px;
    flex: 0 0 auto;
    color: #00b982;
    font-size: 12px;
}

.typing-bubble {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 14px 16px;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.typing-bubble i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #7ea2c5;
    animation: typing 1s infinite ease-in-out;
}

.typing-bubble i:nth-child(2) {
    animation-delay: 0.15s;
}

.typing-bubble i:nth-child(3) {
    animation-delay: 0.3s;
}

@keyframes typing {
    0%,
    100% {
        opacity: 0.35;
        transform: translateY(0);
    }

    50% {
        opacity: 1;
        transform: translateY(-4px);
    }
}

.assistant-notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 15px;
    padding: 12px;
    border-radius: 15px;
    color: #6a8cab;
    background: #eaf8ff;
}

.assistant-notice .el-icon {
    margin-top: 1px;
    flex: 0 0 auto;
    color: #1687ff;
    font-size: 15px;
}

.assistant-notice p {
    margin: 0;
    font-size: 10px;
    line-height: 1.6;
}

.input-panel {
    display: flex;
    align-items: flex-end;
    gap: 9px;
    margin-top: 14px;
    padding: 9px;
    border-radius: 17px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.input-panel textarea {
    min-height: 24px;
    max-height: 82px;
    flex: 1;
    resize: none;
    border: 0;
    outline: 3px solid transparent;
    color: #365879;
    font-size: 13px;
    line-height: 1.55;
    background: transparent;
}

.input-panel textarea::placeholder {
    color: #a4b2c3;
}

.input-panel button {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: #ffffff;
    font-size: 18px;
    background: var(--main-gradient);
    box-shadow: 0 7px 13px rgba(22, 135, 255, 0.18);
}

.input-panel button.disabled {
    color: #a5b5c7;
    background: #edf2f7;
    box-shadow: none;
}

.input-tip {
    margin: 8px 0 0;
    color: #a0afc0;
    font-size: 9px;
    text-align: center;
}
</style>
