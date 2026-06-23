<script setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
    Bell,
    DataAnalysis,
    Calendar,
    Reading,
    ChatDotRound,
    ArrowRight
} from '@element-plus/icons-vue'

const router = useRouter()

function go(path) {
    router.push(path)
}

function showComingSoon(text) {
    ElMessage.info(`${text}页面将在后续步骤继续完成`)
}
</script>

<template>
    <div class="page home-page">
        <header class="home-header">
            <div>
                <h1>糖尿病预治智能助手</h1>
                <p>你好，今天也要关注血糖健康</p>
            </div>

            <div class="header-actions">
                <button class="message-button" @click="showComingSoon('消息中心')">
                    <el-icon>
                        <Bell />
                    </el-icon>

                    <span></span>
                </button>

                <button class="avatar" @click="go('/user')">
                    康
                </button>
            </div>
        </header>

        <section class="risk-card">
            <div class="risk-content">
                <span class="risk-tag">
                    <i></i>
                    当前风险等级
                </span>

                <h2>低风险</h2>

                <div class="score-row">
                    <strong>18</strong>
                    <span>分</span>
                </div>

                <p>保持良好生活习惯，定期进行健康评估</p>
            </div>

            <div class="shield-icon">
                <span>✓</span>
            </div>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">健康服务</h2>
            </div>

            <div class="service-grid">
                <button class="service-card card-blue" @click="go('/health')">
                    <span class="service-icon">
                        <el-icon>
                            <DataAnalysis />
                        </el-icon>
                    </span>

                    <strong>风险预测</strong>
                    <small>AI智能评估</small>
                </button>

                <button class="service-card card-green" @click="go('/plan')">
                    <span class="service-icon">
                        <el-icon>
                            <Calendar />
                        </el-icon>
                    </span>

                    <strong>方案定制</strong>
                    <small>个性化管理</small>
                </button>

                <button class="service-card card-white" @click="go('/news')">
                    <span class="service-icon orange">
                        <el-icon>
                            <Reading />
                        </el-icon>
                    </span>

                    <strong>健康资讯</strong>
                    <small>专业科普</small>
                </button>

                <button
                    class="service-card card-white outlined"
                    @click="go('/assistant')"
                >
                    <span class="service-icon light-blue">
                        <el-icon>
                            <ChatDotRound />
                        </el-icon>
                    </span>

                    <strong>智能助手</strong>
                    <small>随时咨询</small>
                </button>
            </div>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">今日健康建议</h2>

                <button class="section-link" @click="go('/plan')">
                    查看计划
                </button>
            </div>

            <div class="suggestion-card surface-card">
                <div class="suggestion-item">
                    <span class="suggestion-icon food">☷</span>

                    <div>
                        <strong>饮食建议</strong>
                        <p>减少高糖饮品，增加蔬菜和优质蛋白摄入。</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </div>

                <div class="suggestion-item">
                    <span class="suggestion-icon sport">⌁</span>

                    <div>
                        <strong>运动建议</strong>
                        <p>建议完成30分钟中等强度运动。</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </div>

                <div class="suggestion-item">
                    <span class="suggestion-icon sleep">☾</span>

                    <div>
                        <strong>睡眠建议</strong>
                        <p>保持7至8小时充足睡眠，规律作息。</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </div>
            </div>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">今日打卡进度</h2>

                <button class="section-link" @click="go('/plan')">
                    去打卡
                </button>
            </div>

            <div class="checkin-card surface-card">
                <div class="checkin-top">
                    <div>
                        <strong>今日目标完成度</strong>
                        <p>已完成 2 / 4 项健康任务</p>
                    </div>

                    <b>50%</b>
                </div>

                <div class="progress-track">
                    <span></span>
                </div>

                <div class="checkin-tags">
                    <span class="done">饮水</span>
                    <span class="done">早餐记录</span>
                    <span>运动</span>
                    <span>睡眠</span>
                </div>
            </div>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">健康资讯</h2>

                <button class="section-link" @click="go('/news')">
                    更多资讯
                </button>
            </div>

            <div class="news-list">
                <button class="mini-news surface-card" @click="go('/news')">
                    <div class="news-cover green-cover">
                        控糖
                    </div>

                    <div class="news-info">
                        <strong>如何科学控制餐后血糖</strong>
                        <p>掌握合理饮食结构，让血糖管理更轻松。</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>

                <button class="mini-news surface-card" @click="go('/news')">
                    <div class="news-cover blue-cover">
                        运动
                    </div>

                    <div class="news-info">
                        <strong>适合控糖人群的日常运动方式</strong>
                        <p>从步行开始，建立长期可坚持的运动习惯。</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.home-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 8px 0 22px;
}

.home-header h1 {
    margin: 0;
    color: #263d64;
    font-size: 23px;
    font-weight: 800;
    letter-spacing: -0.7px;
}

.home-header p {
    margin: 12px 0 0;
    color: #7285a7;
    font-size: 15px;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.message-button,
.avatar {
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 8px 20px rgba(47, 104, 180, 0.1);
}

.message-button {
    width: 42px;
    height: 42px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1a3359;
    font-size: 20px;
}

.message-button span {
    width: 8px;
    height: 8px;
    position: absolute;
    top: 8px;
    right: 9px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    background: #ff4f55;
}

.avatar {
    width: 42px;
    height: 42px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    background: linear-gradient(135deg, #ffc8b2, #6c93cf);
}

.risk-card {
    min-height: 285px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    padding: 28px;
    border-radius: 28px;
    color: #ffffff;
    background: linear-gradient(132deg, #1687ff 0%, #09bdeb 45%, #00ce85 100%);
    box-shadow: 0 20px 34px rgba(17, 135, 235, 0.2);
}

.risk-card::before,
.risk-card::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
}

.risk-card::before {
    width: 230px;
    height: 230px;
    right: -88px;
    top: -72px;
}

.risk-card::after {
    width: 180px;
    height: 180px;
    left: -95px;
    bottom: -98px;
}

.risk-content,
.shield-icon {
    position: relative;
    z-index: 1;
}

.risk-tag {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 13px;
    border-radius: 18px;
    color: rgba(255, 255, 255, 0.95);
    font-size: 13px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.17);
}

.risk-tag i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #69ffd0;
}

.risk-card h2 {
    margin: 20px 0 0;
    color: #ffffff;
    font-size: 42px;
    line-height: 1;
    font-weight: 900;
}

.score-row {
    display: flex;
    align-items: flex-end;
    gap: 7px;
    margin-top: 14px;
}

.score-row strong {
    font-size: 70px;
    line-height: 0.85;
    font-weight: 900;
}

.score-row span {
    padding-bottom: 6px;
    font-size: 20px;
    font-weight: 700;
}

.risk-card p {
    width: 205px;
    margin: 22px 0 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    line-height: 1.65;
}

.shield-icon {
    width: 92px;
    height: 108px;
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 2px;
    border: 4px solid rgba(255, 255, 255, 0.75);
    border-radius: 46px 46px 54px 54px;
    transform: rotate(45deg);
}

.shield-icon span {
    font-size: 48px;
    font-weight: 900;
    transform: rotate(-45deg);
}

.service-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

.service-card {
    min-height: 170px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 19px;
    border-radius: 23px;
    text-align: left;
    transition: transform 0.2s ease;
}

.service-card:active {
    transform: scale(0.98);
}

.service-card strong {
    margin-top: 16px;
    font-size: 18px;
    font-weight: 800;
}

.service-card small {
    margin-top: 7px;
    font-size: 13px;
}

.service-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 17px;
    font-size: 27px;
}

.card-blue,
.card-green {
    color: #ffffff;
}

.card-blue {
    background: linear-gradient(145deg, #1687ff, #0c6eec);
    box-shadow: 0 13px 24px rgba(23, 120, 239, 0.18);
}

.card-green {
    background: linear-gradient(145deg, #11d96d, #00bc8e);
    box-shadow: 0 13px 24px rgba(0, 191, 137, 0.18);
}

.card-blue .service-icon,
.card-green .service-icon {
    background: rgba(255, 255, 255, 0.17);
}

.card-white {
    color: #203961;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.card-white.outlined {
    border: 2px solid #9bd4ff;
}

.card-white .service-icon {
    color: #ff7d12;
    background: #fff1df;
}

.card-white .service-icon.light-blue {
    color: #1687ff;
    background: #e8f5ff;
}

.card-white small {
    color: #96a5bd;
}

.suggestion-card {
    overflow: hidden;
    padding: 2px 17px;
}

.suggestion-item {
    min-height: 79px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid #edf2f8;
    text-align: left;
}

.suggestion-item:last-child {
    border-bottom: 0;
}

.suggestion-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 19px;
    font-weight: 800;
}

.suggestion-icon.food {
    color: #ff8a16;
    background: #fff1df;
}

.suggestion-icon.sport {
    color: #00bc8e;
    background: #e1fbf0;
}

.suggestion-icon.sleep {
    color: #6b8bff;
    background: #eaf0ff;
}

.suggestion-item div {
    flex: 1;
}

.suggestion-item strong {
    color: #27436c;
    font-size: 14px;
}

.suggestion-item p {
    margin: 5px 0 0;
    color: #93a1b7;
    font-size: 12px;
    line-height: 1.45;
}

.suggestion-item .el-icon {
    color: #a8b7cc;
}

.checkin-card {
    padding: 19px;
}

.checkin-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
}

.checkin-top strong {
    color: #27436c;
    font-size: 16px;
}

.checkin-top p {
    margin: 7px 0 0;
    color: #97a5ba;
    font-size: 12px;
}

.checkin-top b {
    color: #1687ff;
    font-size: 21px;
}

.progress-track {
    height: 9px;
    overflow: hidden;
    margin: 18px 0 15px;
    border-radius: 99px;
    background: #eaf1fb;
}

.progress-track span {
    width: 50%;
    height: 100%;
    display: block;
    border-radius: inherit;
    background: var(--main-gradient);
}

.checkin-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.checkin-tags span {
    padding: 6px 10px;
    border-radius: 10px;
    color: #91a0b7;
    font-size: 11px;
    background: #f2f6fb;
}

.checkin-tags span.done {
    color: #1687ff;
    background: #e7f4ff;
}

.news-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.mini-news {
    width: 100%;
    min-height: 89px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    text-align: left;
}

.news-cover {
    width: 63px;
    height: 63px;
    flex: 0 0 63px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 17px;
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
}

.green-cover {
    background: linear-gradient(135deg, #00ce85, #66d7a6);
}

.blue-cover {
    background: linear-gradient(135deg, #1687ff, #66b8ff);
}

.news-info {
    flex: 1;
}

.news-info strong {
    color: #27436c;
    font-size: 14px;
    line-height: 1.4;
}

.news-info p {
    margin: 5px 0 0;
    color: #95a4ba;
    font-size: 12px;
    line-height: 1.5;
}

.mini-news .el-icon {
    color: #a4b4c9;
}
</style>