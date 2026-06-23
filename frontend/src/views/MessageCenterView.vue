<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
    ArrowLeft,
    ArrowRight,
    BellFilled,
    DataAnalysis,
    Calendar,
    Document,
    Reading,
    InfoFilled,
    Check,
    CircleCheckFilled
} from '@element-plus/icons-vue'

const router = useRouter()

const activeTab = ref('all')
const selectedMessage = ref(null)

const messageList = ref([
    {
        id: 1,
        type: 'risk',
        category: 'health',
        title: '风险预测结果已生成',
        content: '本次糖尿病风险预测结果为低风险，建议继续保持规律饮食、适量运动和良好睡眠习惯。',
        time: '今天 09:20',
        date: '今天',
        unread: true,
        path: '/risk-predict',
        actionText: '查看预测结果'
    },
    {
        id: 2,
        type: 'plan',
        category: 'health',
        title: '今日健康打卡提醒',
        content: '今天还有运动和睡眠两项健康目标未完成，建议根据实际情况填写完成量。',
        time: '今天 08:00',
        date: '今天',
        unread: true,
        path: '/plan',
        actionText: '去健康打卡'
    },
    {
        id: 3,
        type: 'archive',
        category: 'health',
        title: '健康档案已更新',
        content: '您的基础健康信息已保存。持续完善血糖、血压和生活习惯数据，可获得更完整的健康分析。',
        time: '昨天 18:35',
        date: '昨天',
        unread: false,
        path: '/health-archive',
        actionText: '查看健康档案'
    },
    {
        id: 4,
        type: 'review',
        category: 'health',
        title: '复查提醒',
        content: '建议于 7 月 15 日前完成一次空腹血糖复查，并根据实际情况记录测量结果。',
        time: '昨天 10:10',
        date: '昨天',
        unread: true,
        path: '/health',
        actionText: '查看健康管理'
    },
    {
        id: 5,
        type: 'news',
        category: 'system',
        title: '为你推荐健康资讯',
        content: '已为你推荐“适合控糖人群的日常运动方式”，可前往健康资讯页面阅读。',
        time: '6月22日 16:30',
        date: '更早',
        unread: false,
        path: '/news',
        actionText: '阅读资讯'
    },
    {
        id: 6,
        type: 'system',
        category: 'system',
        title: '欢迎使用糖尿病预治智能助手',
        content: '你可以在健康档案、风险预测、健康方案和健康资讯模块中完成日常健康管理。',
        time: '6月22日 09:00',
        date: '更早',
        unread: false,
        path: '/home',
        actionText: '返回首页'
    }
])

const tabs = computed(() => {
    const unreadCount = messageList.value.filter((item) => item.unread).length

    return [
        {
            value: 'all',
            label: '全部',
            count: messageList.value.length
        },
        {
            value: 'health',
            label: '健康提醒',
            count: messageList.value.filter((item) => item.category === 'health').length
        },
        {
            value: 'system',
            label: '系统通知',
            count: messageList.value.filter((item) => item.category === 'system').length
        },
        {
            value: 'unread',
            label: '未读',
            count: unreadCount
        }
    ]
})

const unreadCount = computed(() => {
    return messageList.value.filter((item) => item.unread).length
})

const filteredMessages = computed(() => {
    if (activeTab.value === 'all') {
        return messageList.value
    }

    if (activeTab.value === 'unread') {
        return messageList.value.filter((item) => item.unread)
    }

    return messageList.value.filter((item) => {
        return item.category === activeTab.value
    })
})

const groupedMessages = computed(() => {
    const groups = []

    filteredMessages.value.forEach((message) => {
        let currentGroup = groups.find((item) => item.date === message.date)

        if (!currentGroup) {
            currentGroup = {
                date: message.date,
                list: []
            }

            groups.push(currentGroup)
        }

        currentGroup.list.push(message)
    })

    return groups
})

function goBack() {
    router.push('/home')
}

function setTab(value) {
    activeTab.value = value
}

function getTypeName(type) {
    const names = {
        risk: '风险预测',
        plan: '健康打卡',
        archive: '健康档案',
        review: '复查提醒',
        news: '健康资讯',
        system: '系统通知'
    }

    return names[type] || '健康消息'
}

function openMessage(message) {
    message.unread = false
    selectedMessage.value = message
}

function closeMessage() {
    selectedMessage.value = null
}

function markAllRead() {
    if (unreadCount.value === 0) {
        ElMessage.info('当前没有未读消息')
        return
    }

    messageList.value.forEach((message) => {
        message.unread = false
    })

    ElMessage.success('全部消息已标记为已读')
}

function goMessagePage() {
    if (!selectedMessage.value) {
        return
    }

    const path = selectedMessage.value.path

    selectedMessage.value = null
    router.push(path)
}
</script>

<template>
    <div class="page message-page">
        <header class="message-header">
            <button class="back-button" @click="goBack">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <div class="header-title">
                <h1>消息中心</h1>
                <p>
                    {{
                        unreadCount > 0
                            ? `你有 ${unreadCount} 条未读健康提醒`
                            : '暂无未读消息'
                    }}
                </p>
            </div>

            <button class="read-all-button" @click="markAllRead">
                全部已读
            </button>
        </header>

        <section class="message-summary">
            <div class="summary-icon">
                <el-icon>
                    <BellFilled />
                </el-icon>
            </div>

            <div>
                <span>健康提醒中心</span>
                <strong>
                    {{
                        unreadCount > 0
                            ? `有 ${unreadCount} 条待查看消息`
                            : '所有消息均已查看'
                    }}
                </strong>
                <p>及时查看健康提醒，持续完成每日健康管理计划。</p>
            </div>
        </section>

        <div class="message-tabs">
            <button
                v-for="tab in tabs"
                :key="tab.value"
                :class="{ active: activeTab === tab.value }"
                @click="setTab(tab.value)"
            >
                <span>{{ tab.label }}</span>

                <small v-if="tab.count > 0">
                    {{ tab.count }}
                </small>
            </button>
        </div>

        <section v-if="groupedMessages.length > 0" class="message-list">
            <div
                v-for="group in groupedMessages"
                :key="group.date"
                class="message-group"
            >
                <h2>{{ group.date }}</h2>

                <button
                    v-for="message in group.list"
                    :key="message.id"
                    class="message-item"
                    :class="{ unread: message.unread }"
                    @click="openMessage(message)"
                >
                    <span class="message-icon" :class="message.type">
                        <el-icon v-if="message.type === 'risk'">
                            <DataAnalysis />
                        </el-icon>

                        <el-icon v-else-if="message.type === 'plan'">
                            <Calendar />
                        </el-icon>

                        <el-icon v-else-if="message.type === 'archive'">
                            <Document />
                        </el-icon>

                        <el-icon v-else-if="message.type === 'review'">
                            <BellFilled />
                        </el-icon>

                        <el-icon v-else-if="message.type === 'news'">
                            <Reading />
                        </el-icon>

                        <el-icon v-else>
                            <InfoFilled />
                        </el-icon>
                    </span>

                    <div class="message-content">
                        <div class="message-title-row">
                            <strong>{{ message.title }}</strong>

                            <span v-if="message.unread" class="unread-dot"></span>
                        </div>

                        <p>{{ message.content }}</p>

                        <span class="message-time">
                            {{ message.time }}
                        </span>
                    </div>

                    <el-icon class="message-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>
        </section>

        <section v-else class="empty-message">
            <span class="empty-icon">
                <el-icon>
                    <CircleCheckFilled />
                </el-icon>
            </span>

            <strong>暂无相关消息</strong>

            <p>当前分类下没有需要查看的健康提醒。</p>

            <button @click="setTab('all')">
                查看全部消息
            </button>
        </section>

        <section class="message-tip">
            <span>
                <el-icon>
                    <InfoFilled />
                </el-icon>
            </span>

            <p>
                消息中心当前为纯前端演示模块，健康提醒内容仅用于项目功能展示和健康管理参考。
            </p>
        </section>

        <div
            v-if="selectedMessage"
            class="message-mask"
            @click.self="closeMessage"
        >
            <section class="message-dialog">
                <div class="dialog-top">
                    <span class="dialog-type" :class="selectedMessage.type">
                        {{ getTypeName(selectedMessage.type) }}
                    </span>

                    <button @click="closeMessage">×</button>
                </div>

                <span class="dialog-icon" :class="selectedMessage.type">
                    <el-icon v-if="selectedMessage.type === 'risk'">
                        <DataAnalysis />
                    </el-icon>

                    <el-icon v-else-if="selectedMessage.type === 'plan'">
                        <Calendar />
                    </el-icon>

                    <el-icon v-else-if="selectedMessage.type === 'archive'">
                        <Document />
                    </el-icon>

                    <el-icon v-else-if="selectedMessage.type === 'review'">
                        <BellFilled />
                    </el-icon>

                    <el-icon v-else-if="selectedMessage.type === 'news'">
                        <Reading />
                    </el-icon>

                    <el-icon v-else>
                        <InfoFilled />
                    </el-icon>
                </span>

                <h2>{{ selectedMessage.title }}</h2>

                <span class="dialog-time">
                    {{ selectedMessage.time }}
                </span>

                <p class="dialog-content">
                    {{ selectedMessage.content }}
                </p>

                <div class="dialog-actions">
                    <button class="dialog-close" @click="closeMessage">
                        知道了
                    </button>

                    <button class="dialog-go" @click="goMessagePage">
                        {{ selectedMessage.actionText }}

                        <el-icon>
                            <ArrowRight />
                        </el-icon>
                    </button>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.message-page {
    padding-top: 16px;
    padding-bottom: 24px;
}

.message-header {
    display: flex;
    align-items: center;
    gap: 11px;
}

.back-button {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    color: #345677;
    font-size: 20px;
    background: #ffffff;
    box-shadow: 0 8px 18px rgba(40, 99, 174, 0.1);
}

.header-title {
    flex: 1;
    min-width: 0;
}

.header-title h1 {
    margin: 0;
    color: #29476f;
    font-size: 20px;
    font-weight: 800;
}

.header-title p {
    overflow: hidden;
    margin: 5px 0 0;
    color: #91a4bc;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.read-all-button {
    padding: 9px 11px;
    border-radius: 11px;
    color: #1687ff;
    font-size: 11px;
    font-weight: 800;
    background: #e6f4ff;
}

.message-summary {
    display: flex;
    align-items: center;
    gap: 13px;
    margin-top: 19px;
    padding: 18px;
    border-radius: 21px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 16px 28px rgba(13, 143, 220, 0.16);
}

.summary-icon {
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    font-size: 23px;
    background: rgba(255, 255, 255, 0.16);
}

.message-summary > div:last-child {
    min-width: 0;
}

.message-summary span {
    display: block;
    color: rgba(255, 255, 255, 0.8);
    font-size: 11px;
}

.message-summary strong {
    display: block;
    overflow: hidden;
    margin-top: 4px;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.message-summary p {
    margin: 6px 0 0;
    color: rgba(255, 255, 255, 0.85);
    font-size: 11px;
    line-height: 1.55;
}

.message-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    margin: 18px -18px 0;
    padding: 0 18px 4px;
    scrollbar-width: none;
}

.message-tabs::-webkit-scrollbar {
    display: none;
}

.message-tabs button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 11px;
    border-radius: 12px;
    color: #748aa5;
    font-size: 11px;
    font-weight: 700;
    background: #edf3fa;
}

.message-tabs button.active {
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 7px 14px rgba(22, 135, 255, 0.16);
}

.message-tabs small {
    min-width: 15px;
    height: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    border-radius: 8px;
    color: inherit;
    font-size: 9px;
    background: rgba(255, 255, 255, 0.18);
}

.message-group {
    margin-top: 23px;
}

.message-group h2 {
    margin: 0 0 10px;
    color: #5e7796;
    font-size: 12px;
    font-weight: 800;
}

.message-list {
    padding-bottom: 2px;
}

.message-item {
    width: 100%;
    min-height: 91px;
    display: flex;
    align-items: center;
    gap: 11px;
    margin-top: 10px;
    padding: 13px;
    border-radius: 19px;
    color: #29476f;
    text-align: left;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.message-item.unread {
    box-shadow: inset 0 0 0 1px #d8edff, var(--shadow-light);
}

.message-icon {
    width: 43px;
    height: 43px;
    flex: 0 0 43px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    font-size: 20px;
}

.message-icon.risk {
    color: #1687ff;
    background: #e6f4ff;
}

.message-icon.plan {
    color: #00b982;
    background: #e3fbf1;
}

.message-icon.archive {
    color: #7569f4;
    background: #efedff;
}

.message-icon.review {
    color: #ff8916;
    background: #fff0de;
}

.message-icon.news {
    color: #00a6dc;
    background: #e4f8ff;
}

.message-icon.system {
    color: #6f839e;
    background: #edf2f7;
}

.message-content {
    flex: 1;
    min-width: 0;
}

.message-title-row {
    display: flex;
    align-items: center;
    gap: 7px;
}

.message-title-row strong {
    overflow: hidden;
    color: #2f4c73;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.message-item.unread .message-title-row strong {
    color: #174a84;
    font-weight: 800;
}

.unread-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: 50%;
    background: #ff5b65;
}

.message-content p {
    display: -webkit-box;
    overflow: hidden;
    margin: 5px 0;
    color: #96a6ba;
    font-size: 10px;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.message-time {
    color: #a2afbf;
    font-size: 9px;
}

.message-arrow {
    flex: 0 0 auto;
    color: #a8b8ca;
    font-size: 16px;
}

.empty-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 25px;
    padding: 30px 22px;
    border-radius: 21px;
    text-align: center;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.empty-icon {
    width: 55px;
    height: 55px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 19px;
    color: #00b982;
    font-size: 27px;
    background: #e3fbf1;
}

.empty-message strong {
    margin-top: 14px;
    color: #35567d;
    font-size: 14px;
}

.empty-message p {
    margin: 8px 0 16px;
    color: #98a7ba;
    font-size: 11px;
}

.empty-message button {
    padding: 9px 12px;
    border-radius: 11px;
    color: #1687ff;
    font-size: 11px;
    font-weight: 800;
    background: #e6f4ff;
}

.message-tip {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 21px;
    padding: 14px;
    border-radius: 18px;
    color: #5f89ad;
    background: #e7f7ff;
}

.message-tip > span {
    margin-top: 1px;
    color: #1687ff;
    font-size: 17px;
}

.message-tip p {
    margin: 0;
    font-size: 11px;
    line-height: 1.65;
}

.message-mask {
    position: fixed;
    z-index: 70;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(19, 46, 78, 0.4);
}

.message-dialog {
    width: 100%;
    max-width: 520px;
    padding: 22px 20px 24px;
    border-radius: 27px 27px 0 0;
    background: #ffffff;
}

.dialog-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.dialog-type {
    padding: 6px 9px;
    border-radius: 9px;
    color: #6c829e;
    font-size: 10px;
    font-weight: 800;
    background: #eef3f8;
}

.dialog-type.risk {
    color: #1687ff;
    background: #e6f4ff;
}

.dialog-type.plan {
    color: #00a878;
    background: #e3fbf1;
}

.dialog-type.archive {
    color: #7569f4;
    background: #efedff;
}

.dialog-type.review {
    color: #e98417;
    background: #fff0de;
}

.dialog-type.news {
    color: #009bd1;
    background: #e4f8ff;
}

.dialog-top button {
    width: 31px;
    height: 31px;
    border-radius: 10px;
    color: #70849f;
    font-size: 21px;
    line-height: 1;
    background: #eef3f8;
}

.dialog-icon {
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 20px;
    border-radius: 17px;
    color: #6f839e;
    font-size: 24px;
    background: #edf2f7;
}

.dialog-icon.risk {
    color: #1687ff;
    background: #e6f4ff;
}

.dialog-icon.plan {
    color: #00b982;
    background: #e3fbf1;
}

.dialog-icon.archive {
    color: #7569f4;
    background: #efedff;
}

.dialog-icon.review {
    color: #ff8916;
    background: #fff0de;
}

.dialog-icon.news {
    color: #00a6dc;
    background: #e4f8ff;
}

.message-dialog h2 {
    margin: 15px 0 0;
    color: #29476f;
    font-size: 20px;
    line-height: 1.4;
}

.dialog-time {
    display: block;
    margin-top: 8px;
    color: #9baabd;
    font-size: 11px;
}

.dialog-content {
    margin: 17px 0 0;
    color: #5e7590;
    font-size: 14px;
    line-height: 1.8;
}

.dialog-actions {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 10px;
    margin-top: 23px;
}

.dialog-actions button {
    min-height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 800;
}

.dialog-close {
    color: #6e84a0;
    background: #edf3f8;
}

.dialog-go {
    color: #ffffff;
    background: var(--main-gradient);
}
</style>