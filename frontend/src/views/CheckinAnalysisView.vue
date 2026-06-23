<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeft, DataLine, TrendCharts } from '@element-plus/icons-vue'

const router = useRouter()

const metrics = [
    {
        label: '饮食达标',
        value: 5,
        unit: '天',
        color: 'green'
    },
    {
        label: '运动达标',
        value: 6,
        unit: '天',
        color: 'blue'
    },
    {
        label: '睡眠稳定',
        value: 4,
        unit: '天',
        color: 'amber'
    }
]

const suggestions = [
    '饮食和运动执行情况良好，尤其是运动完成率较高。',
    '晚间加餐和睡眠时间仍有波动，建议固定睡前流程。',
    '继续保持饭后轻量活动，避免过度疲劳。'
]
</script>

<template>
    <div class="page analysis-page">
        <header class="page-header">
            <button class="icon-button" aria-label="返回" @click="router.back()">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <div class="header-copy">
                <h1 class="page-title">AI 打卡分析</h1>
                <p class="page-subtitle">基于最近 7 天打卡生成生活状态评价</p>
            </div>
        </header>

        <section class="completion-card">
            <div class="ring">
                <span>78%</span>
            </div>

            <div>
                <span>计划完成状态</span>
                <strong>执行情况良好</strong>
                <p>上一周饮食打卡完成 5 天，运动打卡完成 6 天，整体完成率较高。</p>
            </div>
        </section>

        <section class="metric-grid">
            <article
                v-for="item in metrics"
                :key="item.label"
                class="surface-card"
            >
                <span class="app-chip" :class="item.color">
                    {{ item.label }}
                </span>
                <strong>{{ item.value }}<small>{{ item.unit }}</small></strong>
            </article>
        </section>

        <section class="surface-card chart-card">
            <div class="chart-title">
                <div>
                    <h2>近 7 天完成趋势</h2>
                    <p>打卡完成率按天汇总</p>
                </div>

                <el-icon>
                    <TrendCharts />
                </el-icon>
            </div>

            <div class="bars">
                <span style="height: 48%"></span>
                <span style="height: 68%"></span>
                <span style="height: 58%"></span>
                <span style="height: 76%"></span>
                <span style="height: 72%"></span>
                <span style="height: 88%"></span>
                <span style="height: 78%"></span>
            </div>

            <div class="days">
                <span>一</span>
                <span>二</span>
                <span>三</span>
                <span>四</span>
                <span>五</span>
                <span>六</span>
                <span>日</span>
            </div>
        </section>

        <section class="surface-card advice-card">
            <div class="advice-title">
                <span>
                    <el-icon>
                        <DataLine />
                    </el-icon>
                </span>
                <h2>改进建议</h2>
            </div>

            <p
                v-for="item in suggestions"
                :key="item"
            >
                {{ item }}
            </p>
        </section>
    </div>
</template>

<style scoped>
.analysis-page {
    padding-top: 14px;
}

.page-header {
    justify-content: flex-start;
}

.header-copy {
    min-width: 0;
}

.completion-card {
    min-height: 198px;
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 16px;
    padding: 22px;
    border-radius: 24px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: var(--shadow-card);
}

.ring {
    width: 102px;
    height: 102px;
    flex: 0 0 102px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 12px solid rgba(255, 255, 255, 0.28);
    border-top-color: #ffffff;
    border-right-color: #8af0c5;
    border-radius: 50%;
}

.ring span {
    font-size: 23px;
    font-weight: 900;
}

.completion-card > div:last-child span {
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
}

.completion-card strong {
    display: block;
    margin-top: 8px;
    font-size: 22px;
}

.completion-card p {
    margin: 9px 0 0;
    color: rgba(255, 255, 255, 0.85);
    font-size: 12px;
    line-height: 1.65;
}

.metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 14px;
}

.metric-grid article {
    padding: 14px 10px;
}

.metric-grid strong {
    display: block;
    margin-top: 12px;
    color: var(--ink-900);
    font-size: 24px;
}

.metric-grid small {
    margin-left: 2px;
    font-size: 11px;
}

.chart-card,
.advice-card {
    margin-top: 14px;
    padding: 18px;
}

.chart-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.chart-title h2,
.advice-title h2 {
    margin: 0;
    color: var(--ink-900);
    font-size: 18px;
}

.chart-title p {
    margin: 5px 0 0;
    color: var(--ink-500);
    font-size: 12px;
}

.chart-title .el-icon {
    color: var(--primary-blue);
    font-size: 24px;
}

.bars {
    height: 132px;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-top: 18px;
}

.bars span {
    flex: 1;
    border-radius: 10px 10px 5px 5px;
    background: var(--main-gradient);
}

.days {
    display: flex;
    gap: 8px;
    margin-top: 9px;
}

.days span {
    flex: 1;
    color: var(--ink-400);
    font-size: 10px;
    text-align: center;
}

.advice-title {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 14px;
}

.advice-title span {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    color: var(--primary-blue);
    font-size: 20px;
    background: var(--blue-soft);
}

.advice-card p {
    margin: 10px 0 0;
    padding: 12px;
    border-radius: 14px;
    color: #55708b;
    font-size: 13px;
    line-height: 1.65;
    background: #f1f7fc;
}
</style>
