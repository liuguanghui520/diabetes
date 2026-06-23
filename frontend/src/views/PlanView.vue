<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
    RefreshRight,
    Check,
    CircleCheckFilled,
    InfoFilled,
    EditPen,
    Minus,
    Plus
} from '@element-plus/icons-vue'

const router = useRouter()
const selectedFocus = ref('stableSugar')
const showGoalEditor = ref(false)

const planGoals = ref({
    water: 1500,
    exercise: 30,
    sleep: 7.5,
    diet: 3
})

const todayRecord = ref({
    water: 800,
    exercise: 20,
    sleep: 7,
    diet: 2
})

const goalDraft = ref({
    water: 1500,
    exercise: 30,
    sleep: 7.5,
    diet: 3
})

const focusOptions = [
    {
        value: 'stableSugar',
        label: '稳定血糖'
    },
    {
        value: 'weightControl',
        label: '控制体重'
    },
    {
        value: 'improveSleep',
        label: '改善睡眠'
    },
    {
        value: 'gentleStart',
        label: '轻量起步'
    }
]

const fieldSettings = {
    water: {
        step: 100,
        min: 0
    },
    exercise: {
        step: 5,
        min: 0
    },
    sleep: {
        step: 0.5,
        min: 0
    },
    diet: {
        step: 1,
        min: 0
    }
}

const planTemplates = {
    stableSugar: {
        title: '基础控糖方案',
        description: '以规律饮食、饭后运动和稳定作息为核心，帮助建立基础健康习惯。',
        goals: {
            water: 1500,
            exercise: 30,
            sleep: 7.5,
            diet: 3
        }
    },
    weightControl: {
        title: '体重管理方案',
        description: '适当提高运动与饮水目标，帮助逐步控制体重并改善生活节律。',
        goals: {
            water: 1800,
            exercise: 45,
            sleep: 7.5,
            diet: 3
        }
    },
    improveSleep: {
        title: '睡眠改善方案',
        description: '优先保障充足睡眠，结合轻量运动和规律饮食改善整体状态。',
        goals: {
            water: 1500,
            exercise: 20,
            sleep: 8,
            diet: 3
        }
    },
    gentleStart: {
        title: '轻量健康方案',
        description: '从较容易完成的小目标开始，逐步建立长期健康管理习惯。',
        goals: {
            water: 1200,
            exercise: 15,
            sleep: 7,
            diet: 3
        }
    }
}

function toNumber(value) {
    const result = Number(value)

    if (!Number.isFinite(result) || result < 0) {
        return 0
    }

    return result
}

function normalizeValue(key, value, min = 0) {
    let result = Math.max(min, toNumber(value))

    if (key === 'sleep') {
        result = Math.round(result * 2) / 2
    } else {
        result = Math.round(result)
    }

    return result
}

function getProgress(key) {
    const goal = toNumber(planGoals.value[key])
    const actual = toNumber(todayRecord.value[key])

    if (goal <= 0) {
        return 0
    }

    return Math.min(100, Math.round((actual / goal) * 100))
}

function getStatus(progress) {
    if (progress >= 100) {
        return {
            text: '已达标',
            type: 'completed'
        }
    }

    if (progress >= 70) {
        return {
            text: '接近目标',
            type: 'nearly'
        }
    }

    return {
        text: '继续加油',
        type: 'pending'
    }
}

function formatGoal(value) {
    const number = toNumber(value)

    if (Number.isInteger(number)) {
        return number
    }

    return number.toFixed(1)
}

function changeRecord(key, direction) {
    const setting = fieldSettings[key]

    todayRecord.value[key] = normalizeValue(
        key,
        toNumber(todayRecord.value[key]) + setting.step * direction,
        setting.min
    )
}

function changeGoal(key, direction) {
    const setting = fieldSettings[key]

    goalDraft.value[key] = normalizeValue(
        key,
        toNumber(goalDraft.value[key]) + setting.step * direction,
        1
    )
}

function normalizeRecordInput(key) {
    todayRecord.value[key] = normalizeValue(
        key,
        todayRecord.value[key],
        0
    )
}

function normalizeGoalInput(key) {
    goalDraft.value[key] = normalizeValue(
        key,
        goalDraft.value[key],
        1
    )
}

const currentTemplate = computed(() => {
    return planTemplates[selectedFocus.value]
})

const planItems = computed(() => {
    const items = [
        {
            key: 'water',
            icon: '水',
            title: '饮水',
            unit: 'ml',
            type: 'water',
            step: 100,
            description: '建议全天分次饮水，避免一次性大量饮水。'
        },
        {
            key: 'exercise',
            icon: '动',
            title: '运动',
            unit: '分钟',
            type: 'exercise',
            step: 5,
            description: '可选择快走、慢跑、骑行或舒缓拉伸。'
        },
        {
            key: 'sleep',
            icon: '眠',
            title: '睡眠',
            unit: '小时',
            type: 'sleep',
            step: 0.5,
            description: '建议保持规律作息，尽量在 23:00 前准备入睡。'
        },
        {
            key: 'diet',
            icon: '餐',
            title: '控糖饮食',
            unit: '餐',
            type: 'diet',
            step: 1,
            description: '记录今天完成低糖、均衡饮食的餐数。'
        }
    ]

    return items.map((item) => {
        const progress = getProgress(item.key)

        return {
            ...item,
            goal: toNumber(planGoals.value[item.key]),
            actual: toNumber(todayRecord.value[item.key]),
            progress,
            status: getStatus(progress)
        }
    })
})

const overallProgress = computed(() => {
    if (planItems.value.length === 0) {
        return 0
    }

    const total = planItems.value.reduce((sum, item) => {
        return sum + item.progress
    }, 0)

    return Math.round(total / planItems.value.length)
})

const completedCount = computed(() => {
    return planItems.value.filter((item) => item.progress >= 100).length
})

const completionText = computed(() => {
    if (completedCount.value === 4) {
        return '四项健康目标均已完成，继续保持！'
    }

    if (completedCount.value === 0) {
        return '填写今日实际完成量，开始健康打卡。'
    }

    return `已完成 ${completedCount.value} / 4 项健康目标。`
})

const adviceList = computed(() => {
    const focus = selectedFocus.value

    if (focus === 'weightControl') {
        return [
            {
                type: 'food',
                title: '饮食建议',
                content: '减少油炸、高糖和高热量零食，优先选择蔬菜、全谷物和优质蛋白。'
            },
            {
                type: 'move',
                title: '运动建议',
                content: '建议每天安排 30 至 45 分钟中等强度运动，避免久坐。'
            },
            {
                type: 'moon',
                title: '作息建议',
                content: '保证规律睡眠，避免熬夜后通过高糖饮料提神。'
            }
        ]
    }

    if (focus === 'improveSleep') {
        return [
            {
                type: 'moon',
                title: '睡眠建议',
                content: '建议睡前减少长时间看手机，尽量固定上床和起床时间。'
            },
            {
                type: 'move',
                title: '运动建议',
                content: '白天可进行轻量运动，避免在临睡前进行剧烈运动。'
            },
            {
                type: 'food',
                title: '饮食建议',
                content: '晚餐保持适量，避免睡前摄入过多高糖、高油食物。'
            }
        ]
    }

    if (focus === 'gentleStart') {
        return [
            {
                type: 'water',
                title: '饮水建议',
                content: '从分次饮水开始，上午、下午和晚间分别完成部分饮水目标。'
            },
            {
                type: 'move',
                title: '运动建议',
                content: '从饭后步行 10 至 15 分钟开始，逐步建立运动习惯。'
            },
            {
                type: 'moon',
                title: '睡眠建议',
                content: '先保持相对固定的睡眠时间，再逐渐提升睡眠质量。'
            }
        ]
    }

    return [
        {
            type: 'food',
            title: '饮食建议',
            content: '减少精制糖摄入，每餐适量增加蔬菜、全谷物和优质蛋白。'
        },
        {
            type: 'move',
            title: '运动建议',
            content: '建议饭后进行 20 至 30 分钟快走，减少久坐时间。'
        },
        {
            type: 'moon',
            title: '睡眠建议',
            content: '建议在 23:00 前准备入睡，尽量保持规律作息。'
        }
    ]
})

function smartGeneratePlan() {
    const template = planTemplates[selectedFocus.value]

    planGoals.value = {
        ...template.goals
    }

    goalDraft.value = {
        ...template.goals
    }

    ElMessage.success(`已生成${template.title}`)
}

function openGoalEditor() {
    goalDraft.value = {
        ...planGoals.value
    }

    showGoalEditor.value = true
}

function closeGoalEditor() {
    showGoalEditor.value = false
}

function saveGoals() {
    const water = toNumber(goalDraft.value.water)
    const exercise = toNumber(goalDraft.value.exercise)
    const sleep = toNumber(goalDraft.value.sleep)
    const diet = toNumber(goalDraft.value.diet)

    if (!water || !exercise || !sleep || !diet) {
        ElMessage.warning('请完整填写四项健康目标')
        return
    }

    planGoals.value = {
        water,
        exercise,
        sleep,
        diet
    }

    showGoalEditor.value = false

    ElMessage.success('每日健康目标已更新')
}

function saveTodayRecord() {
    Object.keys(todayRecord.value).forEach((key) => {
        todayRecord.value[key] = normalizeValue(
            key,
            todayRecord.value[key],
            0
        )
    })

    ElMessage.success('今日打卡数据已更新')
}

function checkTodayPlan() {
    if (completedCount.value === 4) {
        ElMessage.success('今日四项健康目标均已达标，继续保持！')
    }

    router.push('/checkin-analysis')
}
</script>

<template>
    <div class="page plan-page">
        <header class="page-header">
            <div>
                <h1 class="page-title">健康方案</h1>
                <p class="page-subtitle">填写每日完成量，持续关注健康习惯</p>
            </div>

            <button class="refresh-button" @click="smartGeneratePlan">
                <el-icon>
                    <RefreshRight />
                </el-icon>
            </button>
        </header>

        <section class="plan-hero">
            <div>
                <span>今日专属健康方案</span>
                <h2>{{ currentTemplate.title }}</h2>
                <p>{{ currentTemplate.description }}</p>
            </div>

            <div class="hero-bottom">
                <div>
                    <span>今日总体完成率</span>
                    <strong>{{ overallProgress }}%</strong>
                </div>

                <button @click="openGoalEditor">
                    调整目标
                    <el-icon>
                        <EditPen />
                    </el-icon>
                </button>
            </div>
        </section>

        <section class="generate-card surface-card">
            <div class="generate-title">
                <div>
                    <strong>智能生成今日目标</strong>
                    <p>选择健康重点，生成四项基础目标</p>
                </div>

                <span>Dify 工作流</span>
            </div>

            <div class="focus-tabs">
                <button
                    v-for="item in focusOptions"
                    :key="item.value"
                    :class="{ active: selectedFocus === item.value }"
                    @click="selectedFocus = item.value"
                >
                    {{ item.label }}
                </button>
            </div>

            <button class="generate-button" @click="smartGeneratePlan">
                <el-icon>
                    <RefreshRight />
                </el-icon>

                智能生成方案
            </button>
        </section>

        <section>
            <div class="section-header">
                <div>
                    <h2 class="section-title">今日四项目标</h2>
                    <p class="section-desc">{{ completionText }}</p>
                </div>

                <span class="progress-text">{{ completedCount }} / 4</span>
            </div>

            <div class="today-progress">
                <span :style="{ width: `${overallProgress}%` }"></span>
            </div>

            <div class="target-grid">
                <article
                    v-for="item in planItems"
                    :key="item.key"
                    class="target-card surface-card"
                    :class="{ completed: item.progress >= 100 }"
                >
                    <span class="target-icon" :class="item.type">
                        {{ item.icon }}
                    </span>

                    <strong>{{ item.title }}</strong>

                    <p>
                        {{ formatGoal(item.goal) }} {{ item.unit }}
                    </p>

                    <div class="small-progress">
                        <span :style="{ width: `${item.progress}%` }"></span>
                    </div>

                    <small>{{ item.progress }}%</small>
                </article>
            </div>
        </section>

        <section>
            <div class="section-header">
                <div>
                    <h2 class="section-title">每日健康打卡</h2>
                    <p class="section-desc">直接填写今天实际完成了多少</p>
                </div>

                <span class="section-link">实时计算</span>
            </div>

            <div class="check-list">
                <article
                    v-for="item in planItems"
                    :key="`${item.key}-check`"
                    class="check-item"
                    :class="{ completed: item.progress >= 100 }"
                >
                    <span class="check-icon" :class="item.type">
                        {{ item.icon }}
                    </span>

                    <div class="check-content">
                        <div class="check-title">
                            <strong>{{ item.title }}</strong>

                            <span
                                class="status-tag"
                                :class="item.status.type"
                            >
                                {{ item.status.text }}
                            </span>
                        </div>

                        <p>
                            目标：{{ formatGoal(item.goal) }} {{ item.unit }}
                            · {{ item.description }}
                        </p>

                        <div class="check-progress">
                            <span :style="{ width: `${item.progress}%` }"></span>
                        </div>

                        <div class="amount-stepper">
                            <button
                                class="stepper-button"
                                @click="changeRecord(item.key, -1)"
                            >
                                <el-icon>
                                    <Minus />
                                </el-icon>
                            </button>

                            <label class="amount-value">
                                <input
                                    v-model.number="todayRecord[item.key]"
                                    type="number"
                                    min="0"
                                    :step="item.step"
                                    @change="normalizeRecordInput(item.key)"
                                >
                                <em>{{ item.unit }}</em>
                            </label>

                            <button
                                class="stepper-button add"
                                @click="changeRecord(item.key, 1)"
                            >
                                <el-icon>
                                    <Plus />
                                </el-icon>
                            </button>
                        </div>
                    </div>
                </article>
            </div>

            <button class="save-record-button" @click="saveTodayRecord">
                <el-icon>
                    <Check />
                </el-icon>

                保存今日打卡
            </button>
        </section>

        <section>
            <div class="section-header">
                <h2 class="section-title">今日重点建议</h2>
            </div>

            <div class="plan-list">
                <article
                    v-for="item in adviceList"
                    :key="item.title"
                    class="advice-item"
                >
                    <span class="advice-icon" :class="item.type">
                        {{ item.title.slice(0, 1) }}
                    </span>

                    <div>
                        <strong>{{ item.title }}</strong>
                        <p>{{ item.content }}</p>
                    </div>
                </article>
            </div>
        </section>

        <section class="plan-tip">
            <span>
                <el-icon>
                    <InfoFilled />
                </el-icon>
            </span>

            <p>
                方案定制将由 Dify 生活方案工作流生成，当前页面保留可交互原型，便于后续与 Express 接口联调。
            </p>
        </section>

        <button class="gradient-button plan-button" @click="checkTodayPlan">
            <el-icon>
                <CircleCheckFilled />
            </el-icon>

            查看 AI 打卡分析
        </button>

        <div
            v-if="showGoalEditor"
            class="goal-mask"
            @click.self="closeGoalEditor"
        >
            <section class="goal-dialog">
                <div class="dialog-header">
                    <div>
                        <h2>调整每日健康目标</h2>
                        <p>可根据自己的实际情况修改目标值</p>
                    </div>

                    <button @click="closeGoalEditor">×</button>
                </div>

                <label
                    v-for="item in planItems"
                    :key="`${item.key}-goal`"
                    class="goal-field"
                >
                    <span>每日{{ item.title }}目标</span>

                    <div class="goal-stepper">
                        <button
                            class="stepper-button"
                            @click="changeGoal(item.key, -1)"
                        >
                            <el-icon>
                                <Minus />
                            </el-icon>
                        </button>

                        <label class="goal-value">
                            <input
                                v-model.number="goalDraft[item.key]"
                                type="number"
                                min="1"
                                :step="item.step"
                                @change="normalizeGoalInput(item.key)"
                            >
                            <em>{{ item.unit }}</em>
                        </label>

                        <button
                            class="stepper-button add"
                            @click="changeGoal(item.key, 1)"
                        >
                            <el-icon>
                                <Plus />
                            </el-icon>
                        </button>
                    </div>
                </label>

                <div class="dialog-actions">
                    <button class="cancel-button" @click="closeGoalEditor">
                        取消
                    </button>

                    <button class="confirm-button" @click="saveGoals">
                        保存目标
                    </button>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.plan-page {
    padding-top: 14px;
    padding-bottom: 24px;
}

.refresh-button {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    color: #1687ff;
    font-size: 19px;
    background: #ffffff;
    box-shadow: 0 8px 18px rgba(40, 99, 174, 0.1);
}

.plan-hero {
    min-height: 214px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin-top: 18px;
    padding: 25px;
    border-radius: 27px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 18px 30px rgba(13, 143, 220, 0.18);
}

.plan-hero > div:first-child {
    max-width: 286px;
}

.plan-hero span {
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
}

.plan-hero h2 {
    margin: 10px 0 0;
    font-size: 26px;
}

.plan-hero p {
    margin: 11px 0 0;
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    line-height: 1.65;
}

.hero-bottom {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
}

.hero-bottom span {
    display: block;
    color: rgba(255, 255, 255, 0.76);
    font-size: 11px;
}

.hero-bottom strong {
    display: block;
    margin-top: 5px;
    font-size: 22px;
}

.hero-bottom button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 10px 13px;
    border-radius: 12px;
    color: #1687ff;
    font-size: 12px;
    font-weight: 800;
    background: #ffffff;
}

.generate-card {
    margin-top: 16px;
    padding: 17px;
}

.generate-title {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.generate-title strong {
    color: #29476f;
    font-size: 15px;
}

.generate-title p {
    margin: 6px 0 0;
    color: #99a9bd;
    font-size: 11px;
}

.generate-title > span {
    padding: 5px 8px;
    border-radius: 9px;
    color: #6f879f;
    font-size: 10px;
    background: #f0f5fa;
}

.focus-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 9px;
    margin-top: 14px;
}

.focus-tabs button {
    min-height: 39px;
    padding: 8px 10px;
    border: 1px solid #e4edf6;
    border-radius: 12px;
    color: #627f9f;
    font-size: 12px;
    font-weight: 700;
    background: #f6f9fd;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.focus-tabs button.active {
    border-color: transparent;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 8px 15px rgba(22, 135, 255, 0.18);
}

.generate-button {
    width: 100%;
    min-height: 43px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 11px;
    border-radius: 13px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 800;
    background: #1687ff;
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

.progress-text {
    color: #1687ff;
    font-size: 13px;
    font-weight: 800;
}

.today-progress {
    height: 8px;
    overflow: hidden;
    border-radius: 99px;
    background: #e8f0f7;
}

.today-progress span {
    height: 100%;
    display: block;
    border-radius: inherit;
    background: var(--main-gradient);
    transition: width 0.3s ease;
}

.target-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 9px;
    margin-top: 14px;
}

.target-card {
    min-height: 148px;
    padding: 12px 9px;
}

.target-card.completed {
    box-shadow: inset 0 0 0 1.5px #36d5a1, var(--shadow-light);
}

.target-icon {
    width: 33px;
    height: 33px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    font-size: 13px;
    font-weight: 800;
}

.target-icon.water {
    color: #1687ff;
    background: #e7f4ff;
}

.target-icon.exercise {
    color: #00bd83;
    background: #e4fbf1;
}

.target-icon.sleep {
    color: #7569f4;
    background: #efedff;
}

.target-icon.diet {
    color: #ff8916;
    background: #fff0de;
}

.target-card strong {
    display: block;
    margin-top: 10px;
    color: #29466e;
    font-size: 13px;
}

.target-card p {
    min-height: 29px;
    margin: 5px 0 8px;
    color: #95a5bc;
    font-size: 10px;
    line-height: 1.45;
}

.small-progress {
    height: 5px;
    overflow: hidden;
    border-radius: 99px;
    background: #eaf1f7;
}

.small-progress span {
    height: 100%;
    display: block;
    border-radius: inherit;
    background: var(--main-gradient);
}

.target-card small {
    display: block;
    margin-top: 7px;
    color: #6e91b7;
    font-size: 10px;
}

.check-list {
    display: flex;
    flex-direction: column;
    gap: 11px;
}

.check-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.check-item.completed {
    background: #f2fffa;
    box-shadow: inset 0 0 0 1px #b5edd7;
}

.check-icon {
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 800;
}

.check-icon.water {
    color: #1687ff;
    background: #e7f4ff;
}

.check-icon.exercise {
    color: #00bd83;
    background: #e4fbf1;
}

.check-icon.sleep {
    color: #7569f4;
    background: #efedff;
}

.check-icon.diet {
    color: #ff8916;
    background: #fff0de;
}

.check-content {
    min-width: 0;
    flex: 1;
}

.check-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.check-title strong {
    color: #29466e;
    font-size: 13px;
}

.status-tag {
    padding: 4px 6px;
    border-radius: 7px;
    font-size: 9px;
    white-space: nowrap;
}

.status-tag.completed {
    color: #00a878;
    background: #e1fbef;
}

.status-tag.nearly {
    color: #df901a;
    background: #fff1dc;
}

.status-tag.pending {
    color: #7189a4;
    background: #eef3f8;
}

.check-content > p {
    overflow: hidden;
    margin: 5px 0 7px;
    color: #96a5b8;
    font-size: 10px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.check-progress {
    height: 5px;
    overflow: hidden;
    border-radius: 99px;
    background: #e8f0f7;
}

.check-progress span {
    height: 100%;
    display: block;
    border-radius: inherit;
    background: var(--main-gradient);
}

.amount-stepper,
.goal-stepper {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) 32px;
    gap: 6px;
    align-items: center;
    margin-top: 11px;
}

.stepper-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    color: #6683a3;
    font-size: 14px;
    background: #edf3f9;
}

.stepper-button.add {
    color: #ffffff;
    background: #1687ff;
    box-shadow: 0 5px 10px rgba(22, 135, 255, 0.18);
}

.amount-value,
.goal-value {
    height: 32px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px;
    border-radius: 10px;
    background: #f3f7fc;
}

.amount-value input,
.goal-value input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 3px solid transparent;
    color: #34577f;
    font-size: 13px;
    font-weight: 800;
    background: transparent;
}

.amount-value em,
.goal-value em {
    color: #7993ae;
    font-size: 10px;
    font-style: normal;
    white-space: nowrap;
}

.amount-value input::-webkit-outer-spin-button,
.amount-value input::-webkit-inner-spin-button,
.goal-value input::-webkit-outer-spin-button,
.goal-value input::-webkit-inner-spin-button {
    margin: 0;
    -webkit-appearance: none;
}

.amount-value input[type='number'],
.goal-value input[type='number'] {
    -moz-appearance: textfield;
}

.save-record-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 14px;
    padding: 13px;
    border-radius: 15px;
    color: #1687ff;
    font-size: 13px;
    font-weight: 800;
    background: #e7f4ff;
}

.plan-list {
    display: flex;
    flex-direction: column;
    gap: 11px;
}

.advice-item {
    min-height: 78px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.advice-icon {
    width: 43px;
    height: 43px;
    flex: 0 0 43px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    font-size: 14px;
    font-weight: 800;
}

.advice-icon.food {
    color: #ff8916;
    background: #fff0de;
}

.advice-icon.move {
    color: #00bd83;
    background: #e3fbf0;
}

.advice-icon.moon {
    color: #7569f4;
    background: #efedff;
}

.advice-icon.water {
    color: #1687ff;
    background: #e7f4ff;
}

.advice-item strong {
    color: #29466e;
    font-size: 14px;
}

.advice-item p {
    margin: 6px 0 0;
    color: #95a5bc;
    font-size: 11px;
    line-height: 1.5;
}

.plan-tip {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 19px;
    padding: 14px;
    border-radius: 18px;
    color: #5f89ad;
    background: #e7f7ff;
}

.plan-tip > span {
    margin-top: 1px;
    color: #1687ff;
    font-size: 17px;
}

.plan-tip p {
    margin: 0;
    font-size: 11px;
    line-height: 1.65;
}

.plan-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 19px;
}

.goal-mask {
    position: fixed;
    z-index: 50;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    background: rgba(19, 47, 80, 0.36);
}

.goal-dialog {
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
    gap: 16px;
}

.dialog-header h2 {
    margin: 0;
    color: #29466e;
    font-size: 19px;
}

.dialog-header p {
    margin: 6px 0 0;
    color: #97a7bd;
    font-size: 11px;
}

.dialog-header button {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    color: #6d87a4;
    font-size: 22px;
    line-height: 1;
    background: #eef4f9;
}

.goal-field {
    display: block;
    margin-top: 16px;
}

.goal-field > span {
    display: block;
    margin-bottom: 8px;
    color: #36567f;
    font-size: 13px;
    font-weight: 800;
}

.goal-stepper {
    height: 45px;
    grid-template-columns: 38px minmax(0, 1fr) 38px;
    margin-top: 0;
    padding: 5px;
    border-radius: 14px;
    background: #f2f6fb;
}

.goal-stepper .stepper-button {
    width: 34px;
    height: 34px;
    justify-self: center;
    border-radius: 10px;
}

.goal-value {
    height: 34px;
    background: #ffffff;
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
    color: #6d87a2;
    background: #edf3f8;
}

.confirm-button {
    color: #ffffff;
    background: var(--main-gradient);
}
</style>
