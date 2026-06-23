<script setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
    DataAnalysis,
    User,
    TrendCharts,
    Clock,
    ArrowRight,
    WarningFilled,
    InfoFilled
} from '@element-plus/icons-vue'

const router = useRouter()

function goRiskPredict() {
    router.push('/risk-predict')
}

function goHealthArchive() {
    router.push('/health-archive')
}

function goCheckinAnalysis() {
    router.push('/checkin-analysis')
}

function scrollToSection(id) {
    const target = document.getElementById(id)

    if (!target) {
        return
    }

    target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    })
}

function showDemoMessage() {
    ElMessage.info('当前为本地示例数据，后续将由 Express 和 Dify 工作流生成建议')
}
</script>

<template>
    <div class="page health-page">
        <header class="page-header">
            <div>
                <h1 class="page-title">健康管理</h1>
                <p class="page-subtitle">关注健康数据，守护美好生活</p>
            </div>
        </header>

        <section class="health-summary">
            <div>
                <span>当前健康评分</span>
                <strong>82</strong>
                <p>整体健康状态较稳定，请继续保持规律饮食与适量运动。</p>
            </div>

            <div class="summary-badge">
                <b>低风险</b>
                <small>风险可控</small>
            </div>
        </section>

        <section class="quick-data-grid">
            <div class="quick-data-card">
                <span>BMI 指数</span>
                <strong>22.4</strong>
                <small>正常范围</small>
            </div>

            <div class="quick-data-card">
                <span>空腹血糖</span>
                <strong>5.6</strong>
                <small>mmol/L</small>
            </div>

            <div class="quick-data-card">
                <span>餐后血糖</span>
                <strong>7.2</strong>
                <small>mmol/L</small>
            </div>
        </section>

        <section class="predict-card">
            <div class="predict-icon">
                <el-icon>
                    <DataAnalysis />
                </el-icon>
            </div>

            <div>
                <span>糖尿病风险预测</span>
                <strong>当前预测结果：低风险</strong>
                <p>建议持续保持健康生活方式，并按需定期复查。</p>
            </div>

            <button @click="goRiskPredict">
                去预测
                <el-icon>
                    <ArrowRight />
                </el-icon>
            </button>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">健康服务</h2>
            </div>

            <div class="health-grid">
                <button @click="goRiskPredict">
                    <span class="blue-icon">
                        <el-icon>
                            <DataAnalysis />
                        </el-icon>
                    </span>

                    <div>
                        <strong>风险预测</strong>
                        <p>评估糖尿病风险</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>

                <button @click="goHealthArchive">
                    <span class="green-icon">
                        <el-icon>
                            <User />
                        </el-icon>
                    </span>

                    <div>
                        <strong>健康档案</strong>
                        <p>完善基础健康信息</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>

                <button @click="scrollToSection('health-analysis')">
                    <span class="purple-icon">
                        <el-icon>
                            <TrendCharts />
                        </el-icon>
                    </span>

                    <div>
                        <strong>健康分析</strong>
                        <p>查看健康数据与提醒</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>

                <button @click="goCheckinAnalysis">
                    <span class="orange-icon">
                        <el-icon>
                            <Clock />
                        </el-icon>
                    </span>

                    <div>
                        <strong>打卡分析</strong>
                        <p>查看 AI 生活状态评价</p>
                    </div>

                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </button>
            </div>
        </section>

        <section id="health-analysis">
            <div class="section-header">
                <div>
                    <h2 class="section-title">健康分析</h2>
                    <p class="section-desc">基于当前健康情况生成的参考建议</p>
                </div>

                <span class="risk-tag">低风险</span>
            </div>

            <div class="analysis-list">
                <article class="analysis-item">
                    <span class="analysis-dot good"></span>

                    <div>
                        <div class="analysis-title">
                            <strong>BMI 体重状态</strong>
                            <b>22.4</b>
                        </div>

                        <p>当前 BMI 处于正常参考范围，建议继续保持规律饮食和运动习惯。</p>
                    </div>

                    <span class="analysis-label good">正常</span>
                </article>

                <article class="analysis-item">
                    <span class="analysis-dot good"></span>

                    <div>
                        <div class="analysis-title">
                            <strong>空腹血糖</strong>
                            <b>5.6 mmol/L</b>
                        </div>

                        <p>当前空腹血糖数据较稳定，建议维持良好的睡眠和饮食节律。</p>
                    </div>

                    <span class="analysis-label good">稳定</span>
                </article>

                <article class="analysis-item">
                    <span class="analysis-dot warning"></span>

                    <div>
                        <div class="analysis-title">
                            <strong>餐后2小时血糖</strong>
                            <b>7.2 mmol/L</b>
                        </div>

                        <p>建议减少高糖、高油食物摄入，饭后可进行适量步行或运动。</p>
                    </div>

                    <span class="analysis-label warning">关注</span>
                </article>

                <article class="analysis-item">
                    <span class="analysis-dot good"></span>

                    <div>
                        <div class="analysis-title">
                            <strong>生活方式建议</strong>
                            <b>良好</b>
                        </div>

                        <p>建议每天保证适量运动，规律作息，并持续关注体重和血糖变化。</p>
                    </div>

                    <span class="analysis-label good">建议保持</span>
                </article>
            </div>
        </section>

        <section id="health-history">
            <div class="section-header">
                <div>
                    <h2 class="section-title">近期健康趋势</h2>
                    <p class="section-desc">近 7 天健康评分变化趋势</p>
                </div>

                <span class="section-link">近7天</span>
            </div>

            <div class="trend-card surface-card">
                <div class="trend-value">
                    <div>
                        <span>健康评分</span>
                        <strong>82</strong>
                    </div>

                    <b>↑ 12%</b>
                </div>

                <div class="chart-placeholder">
                    <div class="bar-wrap">
                        <span style="height: 52%"></span>
                    </div>

                    <div class="bar-wrap">
                        <span style="height: 61%"></span>
                    </div>

                    <div class="bar-wrap">
                        <span style="height: 57%"></span>
                    </div>

                    <div class="bar-wrap">
                        <span style="height: 67%"></span>
                    </div>

                    <div class="bar-wrap">
                        <span style="height: 71%"></span>
                    </div>

                    <div class="bar-wrap">
                        <span style="height: 76%"></span>
                    </div>

                    <div class="bar-wrap">
                        <span style="height: 82%"></span>
                    </div>
                </div>

                <div class="chart-days">
                    <span>一</span>
                    <span>二</span>
                    <span>三</span>
                    <span>四</span>
                    <span>五</span>
                    <span>六</span>
                    <span>日</span>
                </div>
            </div>
        </section>

        <section class="health-tips">
            <div class="tip-title">
                <span>
                    <el-icon>
                        <WarningFilled />
                    </el-icon>
                </span>

                <div>
                    <strong>今日健康提醒</strong>
                    <p>规律饮食、控制糖分、坚持运动，是预防糖尿病的重要方式。</p>
                </div>
            </div>

            <button @click="showDemoMessage">
                查看建议
            </button>
        </section>

        <section class="notice-card">
            <el-icon>
                <InfoFilled />
            </el-icon>

            <p>
                健康管理数据将由 Express 和 Dify 工作流提供，当前原型用于展示风险、档案和打卡分析的主要交互。
            </p>
        </section>
    </div>
</template>

<style scoped>
.health-page {
    padding-top: 14px;
}

.health-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 188px;
    margin-top: 18px;
    padding: 26px;
    overflow: hidden;
    border-radius: 27px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 18px 30px rgba(13, 143, 220, 0.19);
}

.health-summary span {
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
}

.health-summary strong {
    display: block;
    margin-top: 9px;
    font-size: 54px;
    line-height: 1;
}

.health-summary p {
    width: 205px;
    margin: 12px 0 0;
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    line-height: 1.6;
}

.summary-badge {
    min-width: 88px;
    padding: 14px 10px;
    border: 1px solid rgba(255, 255, 255, 0.38);
    border-radius: 19px;
    text-align: center;
    background: rgba(255, 255, 255, 0.16);
}

.summary-badge b {
    display: block;
    font-size: 16px;
}

.summary-badge small {
    display: block;
    margin-top: 7px;
    color: rgba(255, 255, 255, 0.84);
    font-size: 11px;
}

.quick-data-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 14px;
}

.quick-data-card {
    padding: 15px 8px;
    border-radius: 18px;
    text-align: center;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.quick-data-card span {
    display: block;
    color: #95a7bd;
    font-size: 10px;
}

.quick-data-card strong {
    display: block;
    margin-top: 8px;
    color: #28476f;
    font-size: 19px;
}

.quick-data-card small {
    display: block;
    margin-top: 5px;
    color: #7c98b7;
    font-size: 10px;
}

.predict-card {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-top: 16px;
    padding: 15px;
    border-radius: 21px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.predict-icon {
    width: 43px;
    height: 43px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    color: #1687ff;
    font-size: 22px;
    background: #e5f4ff;
}

.predict-card > div:nth-child(2) {
    flex: 1;
}

.predict-card span {
    display: block;
    color: #91a4bc;
    font-size: 11px;
}

.predict-card strong {
    display: block;
    margin-top: 5px;
    color: #315078;
    font-size: 13px;
}

.predict-card p {
    margin: 5px 0 0;
    color: #9caabd;
    font-size: 10px;
    line-height: 1.45;
}

.predict-card button {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 9px 10px;
    border-radius: 11px;
    color: #1687ff;
    font-size: 11px;
    font-weight: 800;
    background: #e7f4ff;
}

.health-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.health-grid button {
    width: 100%;
    min-height: 84px;
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 14px;
    border-radius: 20px;
    text-align: left;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.health-grid button > div {
    flex: 1;
}

.health-grid strong {
    color: #27436c;
    font-size: 15px;
}

.health-grid p {
    margin: 6px 0 0;
    color: #97a6bb;
    font-size: 12px;
}

.health-grid > button > .el-icon {
    color: #a6b5c9;
}

.blue-icon,
.green-icon,
.purple-icon,
.orange-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    font-size: 23px;
}

.blue-icon {
    color: #1687ff;
    background: #e7f4ff;
}

.green-icon {
    color: #00bd83;
    background: #e3fbf1;
}

.purple-icon {
    color: #8071f5;
    background: #eeecff;
}

.orange-icon {
    color: #ff8815;
    background: #fff0dd;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 26px;
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
    color: #6d91b8;
    font-size: 11px;
}

.risk-tag {
    padding: 7px 10px;
    border-radius: 10px;
    color: #00a979;
    font-size: 11px;
    font-weight: 800;
    background: #e4fbf1;
}

.analysis-list {
    display: flex;
    flex-direction: column;
    gap: 11px;
}

.analysis-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 15px 13px;
    border-radius: 19px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.analysis-dot {
    width: 10px;
    height: 10px;
    flex: 0 0 auto;
    border-radius: 50%;
}

.analysis-dot.good {
    background: #00bf83;
}

.analysis-dot.warning {
    background: #f6a326;
}

.analysis-item > div {
    flex: 1;
    min-width: 0;
}

.analysis-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.analysis-title strong {
    color: #35557e;
    font-size: 13px;
}

.analysis-title b {
    color: #24436c;
    font-size: 12px;
}

.analysis-item p {
    margin: 7px 0 0;
    color: #91a2b7;
    font-size: 10px;
    line-height: 1.55;
}

.analysis-label {
    flex: 0 0 auto;
    padding: 5px 7px;
    border-radius: 8px;
    font-size: 9px;
}

.analysis-label.good {
    color: #00a878;
    background: #e3fbf0;
}

.analysis-label.warning {
    color: #e88d17;
    background: #fff1dc;
}

.trend-card {
    padding: 20px;
}

.trend-value {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
}

.trend-value span {
    color: #94a4ba;
    font-size: 12px;
}

.trend-value strong {
    display: block;
    margin-top: 8px;
    color: #25436e;
    font-size: 30px;
}

.trend-value b {
    padding: 6px 10px;
    border-radius: 10px;
    color: #00b979;
    font-size: 12px;
    background: #e3fbf1;
}

.chart-placeholder {
    height: 118px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    margin-top: 20px;
}

.bar-wrap {
    height: 100%;
    flex: 1;
    display: flex;
    align-items: flex-end;
}

.bar-wrap span {
    width: 100%;
    border-radius: 10px 10px 4px 4px;
    background: linear-gradient(to top, #1687ff, #64c5ff);
}

.chart-days {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 9px;
    color: #9babc0;
    font-size: 10px;
}

.chart-days span {
    flex: 1;
    text-align: center;
}

.health-tips {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 22px;
    padding: 17px;
    border-radius: 21px;
    background: #edfaff;
}

.tip-title {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 9px;
}

.tip-title > span {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: #1687ff;
    font-size: 17px;
    background: #dff3ff;
}

.tip-title strong {
    color: #2e557f;
    font-size: 13px;
}

.tip-title p {
    margin: 5px 0 0;
    color: #7294b3;
    font-size: 10px;
    line-height: 1.55;
}

.health-tips button {
    padding: 9px 10px;
    border-radius: 11px;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    background: #1687ff;
}

.notice-card {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 18px;
    padding: 14px;
    border-radius: 18px;
    color: #5f89ad;
    background: #e7f7ff;
}

.notice-card .el-icon {
    margin-top: 1px;
    color: #1687ff;
    font-size: 17px;
}

.notice-card p {
    margin: 0;
    font-size: 11px;
    line-height: 1.65;
}
</style>
