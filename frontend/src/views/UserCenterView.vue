<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
    ArrowRight,
    Document,
    Calendar,
    Star,
    ChatDotRound,
    Setting,
    InfoFilled,
    User
} from '@element-plus/icons-vue'

const router = useRouter()

const showProfileEditor = ref(false)

const profile = reactive({
    name: '康同学',
    motto: '记录健康，守护每一天',
    archiveProgress: 80,
    healthScore: 82,
    riskLevel: '低风险'
})

const profileDraft = reactive({
    name: '',
    motto: ''
})

function openProfileEditor() {
    profileDraft.name = profile.name
    profileDraft.motto = profile.motto
    showProfileEditor.value = true
}

function closeProfileEditor() {
    showProfileEditor.value = false
}

function saveProfile() {
    const name = profileDraft.name.trim()
    const motto = profileDraft.motto.trim()

    if (!name) {
        ElMessage.warning('请输入昵称')
        return
    }

    profile.name = name
    profile.motto = motto || '记录健康，守护每一天'

    showProfileEditor.value = false
    ElMessage.success('个人资料已更新')
}

function goHealthArchive() {
    router.push('/health-archive')
}

function goPlan() {
    router.push('/plan')
}

function goRiskPredict() {
    router.push('/risk-predict')
}

function goNews() {
    router.push('/news')
}

function goAssistant() {
    router.push('/assistant')
}

function showComingSoon(text) {
    ElMessage.info(`${text}当前为前端演示功能`)
}

function showReviewReminder() {
    ElMessage.success('复查提醒：建议于 7 月 15 日前完成空腹血糖复查')
}

async function goLogin() {
    try {
        await ElMessageBox.confirm(
            '退出后将返回登录页面，是否继续？',
            '退出登录',
            {
                confirmButtonText: '退出登录',
                cancelButtonText: '暂不退出',
                type: 'warning'
            }
        )

        router.push('/login')
    } catch (error) {
        return
    }
}
</script>

<template>
    <div class="page profile-page">
        <section class="profile-card" @click="openProfileEditor">
            <div class="avatar-wrap">
                <div class="user-avatar">
                    {{ profile.name.slice(0, 1) }}
                </div>

                <span class="online-dot"></span>
            </div>

            <div class="profile-main">
                <div class="profile-name-row">
                    <h1>{{ profile.name }}</h1>

                    <span class="profile-badge">
                        健康用户
                    </span>
                </div>

                <p>{{ profile.motto }}</p>

                <span class="profile-id">
                    健康档案完善度 {{ profile.archiveProgress }}%
                </span>
            </div>

            <div class="profile-action">
                <span>编辑</span>

                <el-icon>
                    <ArrowRight />
                </el-icon>
            </div>
        </section>

        <section class="health-status-card">
            <div class="status-left">
                <span class="status-icon">
                    <el-icon>
                        <User />
                    </el-icon>
                </span>

                <div>
                    <span>当前健康状态</span>
                    <strong>{{ profile.riskLevel }}</strong>
                </div>
            </div>

            <div class="status-right">
                <span>健康评分</span>
                <strong>{{ profile.healthScore }}</strong>
            </div>
        </section>

        <section class="record-section">
            <div class="section-header">
                <h2 class="section-title">健康记录</h2>
            </div>

            <div class="record-grid">
                <button @click="goRiskPredict">
                    <strong>06</strong>
                    <span>风险预测</span>
                </button>

                <button @click="goPlan">
                    <strong>12</strong>
                    <span>连续打卡</span>
                </button>

                <button @click="showComingSoon('健康评分报告')">
                    <strong>82</strong>
                    <span>健康评分</span>
                </button>

                <button @click="goPlan">
                    <strong>01</strong>
                    <span>执行方案</span>
                </button>
            </div>
        </section>

        <section class="service-section">
            <div class="section-header">
                <h2 class="section-title">健康管理</h2>
            </div>

            <div class="cell-group">
                <button class="cell-item" @click="goHealthArchive">
                    <span class="cell-icon blue">
                        <el-icon>
                            <Document />
                        </el-icon>
                    </span>

                    <span class="cell-label">我的健康档案</span>

                    <span class="cell-tag">已完善</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>

                <button class="cell-item" @click="goPlan">
                    <span class="cell-icon green">
                        <el-icon>
                            <Calendar />
                        </el-icon>
                    </span>

                    <span class="cell-label">我的健康方案</span>

                    <span class="cell-tag green-tag">进行中</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>

                <button class="cell-item" @click="goRiskPredict">
                    <span class="cell-icon purple">
                        <el-icon>
                            <InfoFilled />
                        </el-icon>
                    </span>

                    <span class="cell-label">风险预测记录</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>

                <button class="cell-item" @click="showReviewReminder">
                    <span class="cell-icon orange">
                        <el-icon>
                            <Calendar />
                        </el-icon>
                    </span>

                    <span class="cell-label">复查提醒</span>

                    <span class="cell-desc">7月15日前</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>
        </section>

        <section class="service-section">
            <div class="section-header">
                <h2 class="section-title">我的内容</h2>
            </div>

            <div class="cell-group">
                <button class="cell-item" @click="goNews">
                    <span class="cell-icon yellow">
                        <el-icon>
                            <Star />
                        </el-icon>
                    </span>

                    <span class="cell-label">我的收藏</span>

                    <span class="cell-desc">健康资讯</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>

                <button class="cell-item" @click="goAssistant">
                    <span class="cell-icon cyan">
                        <el-icon>
                            <ChatDotRound />
                        </el-icon>
                    </span>

                    <span class="cell-label">我的咨询</span>

                    <span class="cell-desc">智能健康助手</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>
        </section>

        <section class="service-section">
            <div class="section-header">
                <h2 class="section-title">设置</h2>
            </div>

            <div class="cell-group">
                <button
                    class="cell-item"
                    @click="showComingSoon('账号与安全')"
                >
                    <span class="cell-icon gray">
                        <el-icon>
                            <Setting />
                        </el-icon>
                    </span>

                    <span class="cell-label">账号与安全</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>

                <button
                    class="cell-item"
                    @click="showComingSoon('关于项目')"
                >
                    <span class="cell-icon blue">
                        <el-icon>
                            <InfoFilled />
                        </el-icon>
                    </span>

                    <span class="cell-label">关于糖尿病预治智能助手</span>

                    <el-icon class="cell-arrow">
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>
        </section>

        <button class="logout-button" @click="goLogin">
            退出登录
        </button>

        <p class="version-text">
            糖尿病预治智能助手 · 前端演示版
        </p>

        <div
            v-if="showProfileEditor"
            class="profile-mask"
            @click.self="closeProfileEditor"
        >
            <section class="profile-dialog">
                <div class="dialog-header">
                    <div>
                        <h2>编辑个人资料</h2>
                        <p>完善个人信息，让健康管理更贴近你的生活。</p>
                    </div>

                    <button @click="closeProfileEditor">×</button>
                </div>

                <label class="dialog-field">
                    <span>昵称</span>

                    <div class="dialog-input">
                        <input
                            v-model="profileDraft.name"
                            type="text"
                            maxlength="12"
                            placeholder="请输入昵称"
                        >
                    </div>
                </label>

                <label class="dialog-field">
                    <span>个人签名</span>

                    <div class="dialog-input">
                        <input
                            v-model="profileDraft.motto"
                            type="text"
                            maxlength="30"
                            placeholder="例如：记录健康，守护每一天"
                        >
                    </div>
                </label>

                <div class="dialog-actions">
                    <button class="cancel-button" @click="closeProfileEditor">
                        取消
                    </button>

                    <button class="confirm-button" @click="saveProfile">
                        保存资料
                    </button>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.profile-page {
    padding-top: 28px;
    padding-bottom: 26px;
}

.profile-card {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 20px 16px;
    border-radius: 18px;
    cursor: pointer;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.avatar-wrap {
    position: relative;
    flex: 0 0 auto;
}

.user-avatar {
    width: 62px;
    height: 62px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    color: #ffffff;
    font-size: 23px;
    font-weight: 800;
    background: var(--main-gradient);
    box-shadow: 0 9px 17px rgba(20, 148, 220, 0.18);
}

.online-dot {
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 14px;
    height: 14px;
    border: 3px solid #ffffff;
    border-radius: 50%;
    background: #00c98a;
}

.profile-main {
    flex: 1;
    min-width: 0;
}

.profile-name-row {
    display: flex;
    align-items: center;
    gap: 7px;
}

.profile-name-row h1 {
    overflow: hidden;
    margin: 0;
    color: #243f65;
    font-size: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.profile-badge {
    padding: 4px 6px;
    border-radius: 7px;
    color: #00a878;
    font-size: 9px;
    background: #e4fbf1;
}

.profile-main p {
    overflow: hidden;
    margin: 6px 0 0;
    color: #879bb4;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.profile-id {
    display: block;
    margin-top: 7px;
    color: #a2afc0;
    font-size: 10px;
}

.profile-action {
    display: flex;
    align-items: center;
    gap: 2px;
    color: #9aaabd;
    font-size: 11px;
}

.profile-action .el-icon {
    font-size: 15px;
}

.health-status-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 13px;
    padding: 15px 16px;
    border: 1px solid #d9f3e8;
    border-radius: 16px;
    background: #f2fffa;
}

.status-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.status-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: #00b981;
    font-size: 18px;
    background: #dcf9ec;
}

.status-left span:not(.status-icon),
.status-right span {
    display: block;
    color: #6d9c8b;
    font-size: 10px;
}

.status-left strong {
    display: block;
    margin-top: 4px;
    color: #1f8060;
    font-size: 15px;
}

.status-right {
    padding-left: 15px;
    border-left: 1px solid #d6eee4;
    text-align: right;
}

.status-right strong {
    display: block;
    margin-top: 4px;
    color: #1687ff;
    font-size: 20px;
}

.section-header {
    margin-top: 25px;
    margin-bottom: 11px;
}

.section-title {
    margin: 0;
    color: #29476f;
    font-size: 16px;
}

.record-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    overflow: hidden;
    border-radius: 17px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.record-grid button {
    min-height: 88px;
    padding: 13px 5px;
    border-right: 1px solid #edf2f7;
    text-align: center;
    background: #ffffff;
}

.record-grid button:last-child {
    border-right: 0;
}

.record-grid strong {
    display: block;
    color: #1687ff;
    font-size: 21px;
}

.record-grid span {
    display: block;
    margin-top: 7px;
    color: #7d91ab;
    font-size: 10px;
}

.service-section {
    margin-top: 3px;
}

.cell-group {
    overflow: hidden;
    border-radius: 17px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.cell-item {
    width: 100%;
    min-height: 62px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 14px;
    border-bottom: 1px solid #edf2f7;
    color: #314d73;
    text-align: left;
    background: #ffffff;
}

.cell-item:last-child {
    border-bottom: 0;
}

.cell-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    font-size: 17px;
}

.cell-icon.blue {
    color: #1687ff;
    background: #e6f4ff;
}

.cell-icon.green {
    color: #00b982;
    background: #e3fbf1;
}

.cell-icon.purple {
    color: #7569f4;
    background: #efedff;
}

.cell-icon.orange {
    color: #ff8916;
    background: #fff0de;
}

.cell-icon.yellow {
    color: #ec9b18;
    background: #fff3dc;
}

.cell-icon.cyan {
    color: #00a5dc;
    background: #e4f8ff;
}

.cell-icon.gray {
    color: #70839f;
    background: #edf2f7;
}

.cell-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: #314b70;
    font-size: 14px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cell-tag {
    padding: 4px 7px;
    border-radius: 7px;
    color: #1687ff;
    font-size: 9px;
    background: #e6f4ff;
}

.cell-tag.green-tag {
    color: #00a878;
    background: #e3fbf0;
}

.cell-desc {
    color: #9aabbd;
    font-size: 10px;
}

.cell-arrow {
    flex: 0 0 auto;
    color: #aab8c9;
    font-size: 16px;
}

.logout-button {
    width: 100%;
    min-height: 47px;
    margin-top: 25px;
    border-radius: 15px;
    color: #ed5e66;
    font-size: 14px;
    font-weight: 800;
    background: #fff1f2;
}

.version-text {
    margin: 14px 0 0;
    color: #a5b2c2;
    font-size: 10px;
    text-align: center;
}

.profile-mask {
    position: fixed;
    z-index: 60;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(20, 45, 76, 0.38);
}

.profile-dialog {
    width: 100%;
    max-width: 520px;
    padding: 22px 20px 25px;
    border-radius: 26px 26px 0 0;
    background: #ffffff;
}

.dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
}

.dialog-header h2 {
    margin: 0;
    color: #29476f;
    font-size: 19px;
}

.dialog-header p {
    margin: 6px 0 0;
    color: #9aaabe;
    font-size: 11px;
    line-height: 1.5;
}

.dialog-header button {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    color: #70839e;
    font-size: 22px;
    line-height: 1;
    background: #eff4f9;
}

.dialog-field {
    display: block;
    margin-top: 17px;
}

.dialog-field > span {
    display: block;
    margin-bottom: 8px;
    color: #36567e;
    font-size: 13px;
    font-weight: 800;
}

.dialog-input {
    height: 46px;
    display: flex;
    align-items: center;
    padding: 0 13px;
    border-radius: 13px;
    background: #f2f6fb;
}

.dialog-input input {
    width: 100%;
    border: 0;
    outline: 0;
    color: #34577f;
    font-size: 13px;
    background: transparent;
}

.dialog-input input::placeholder {
    color: #aab8c9;
}

.dialog-actions {
    display: grid;
    grid-template-columns: 1fr 1.3fr;
    gap: 10px;
    margin-top: 22px;
}

.dialog-actions button {
    height: 46px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 800;
}

.cancel-button {
    color: #7186a1;
    background: #edf3f8;
}

.confirm-button {
    color: #ffffff;
    background: var(--main-gradient);
}
</style>