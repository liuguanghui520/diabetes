<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
    ArrowLeft,
    Clock,
    User,
    DataAnalysis,
    InfoFilled
} from '@element-plus/icons-vue'

const router = useRouter()

const form = reactive({
    age: '',
    gender: '',
    height: '',
    weight: '',
    familyHistory: '',
    fastingGlucose: '',
    postprandialGlucose: '',
    hba1c: '',
    bloodPressure: '',
    diet: '',
    exercise: '',
    sleep: ''
})

const result = ref(null)

const bmi = computed(() => {
    const height = Number(form.height)
    const weight = Number(form.weight)

    if (!height || !weight) {
        return '--'
    }

    return (weight / ((height / 100) * (height / 100))).toFixed(1)
})

function goBack() {
    router.push('/health')
}

function choose(field, value) {
    form[field] = value
}

function getRiskLevel(score) {
    if (score <= 20) {
        return {
            name: '低风险',
            className: 'low',
            suggestion: [
                '当前整体风险较低，请继续保持规律饮食和适量运动。',
                '建议每年进行一次空腹血糖和糖化血红蛋白检查。',
                '保持正常体重，避免长期高糖、高油饮食。'
            ]
        }
    }

    if (score <= 45) {
        return {
            name: '中风险',
            className: 'medium',
            suggestion: [
                '建议优先调整饮食结构，减少含糖饮料和精制碳水摄入。',
                '每周至少进行 3 次中等强度运动，每次不少于 30 分钟。',
                '建议在 3 个月内复查空腹血糖和糖化血红蛋白。'
            ]
        }
    }

    if (score <= 70) {
        return {
            name: '高风险',
            className: 'high',
            suggestion: [
                '建议尽快完善健康档案，并持续记录血糖、饮食和运动情况。',
                '建议尽早前往医院或通过在线咨询获取专业健康指导。',
                '应控制体重、规律作息，并避免高糖高油饮食。'
            ]
        }
    }

    return {
        name: '极高风险',
        className: 'very-high',
        suggestion: [
            '当前风险较高，建议尽快前往正规医疗机构进行进一步检查。',
            '请及时完成空腹血糖、餐后血糖和糖化血红蛋白复查。',
            '本结果仅用于健康风险管理参考，不能替代医生诊断。'
        ]
    }
}

function saveRiskRecord(data) {
    try {
        const oldRecords = JSON.parse(
            localStorage.getItem('diabetesRiskRecords') || '[]'
        )

        oldRecords.unshift({
            ...data,
            createdAt: new Date().toLocaleString('zh-CN')
        })

        localStorage.setItem(
            'diabetesRiskRecords',
            JSON.stringify(oldRecords.slice(0, 20))
        )
    } catch (error) {
        localStorage.setItem(
            'diabetesRiskRecords',
            JSON.stringify([
                {
                    ...data,
                    createdAt: new Date().toLocaleString('zh-CN')
                }
            ])
        )
    }
}

function evaluateRisk() {
    const requiredFields = [
        form.age,
        form.gender,
        form.height,
        form.weight,
        form.familyHistory,
        form.fastingGlucose,
        form.postprandialGlucose,
        form.hba1c,
        form.diet,
        form.exercise,
        form.sleep
    ]

    if (requiredFields.some((item) => item === '' || item === null)) {
        ElMessage.warning('请先完整填写健康信息')
        return
    }

    const age = Number(form.age)
    const height = Number(form.height)
    const weight = Number(form.weight)
    const fastingGlucose = Number(form.fastingGlucose)
    const postprandialGlucose = Number(form.postprandialGlucose)
    const hba1c = Number(form.hba1c)
    const bmiValue = weight / ((height / 100) * (height / 100))

    let score = 0
    const factors = []

    if (age >= 45) {
        score += 10
        factors.push('年龄超过45岁')
    }

    if (bmiValue >= 28) {
        score += 15
        factors.push('BMI偏高')
    } else if (bmiValue >= 24) {
        score += 8
        factors.push('体重超重')
    }

    if (form.familyHistory === '有') {
        score += 15
        factors.push('存在糖尿病家族史')
    }

    if (form.familyHistory === '不确定') {
        score += 6
        factors.push('家族史情况不明确')
    }

    if (fastingGlucose >= 7) {
        score += 25
        factors.push('空腹血糖偏高')
    } else if (fastingGlucose >= 6.1) {
        score += 15
        factors.push('空腹血糖处于偏高范围')
    }

    if (postprandialGlucose >= 11.1) {
        score += 25
        factors.push('餐后2小时血糖偏高')
    } else if (postprandialGlucose >= 7.8) {
        score += 15
        factors.push('餐后2小时血糖处于偏高范围')
    }

    if (hba1c >= 6.5) {
        score += 25
        factors.push('糖化血红蛋白偏高')
    } else if (hba1c >= 5.7) {
        score += 15
        factors.push('糖化血红蛋白处于偏高范围')
    }

    if (form.diet === '高糖高油') {
        score += 8
        factors.push('饮食习惯偏高糖高油')
    } else if (form.diet === '普通饮食') {
        score += 3
    }

    if (form.exercise === '几乎不运动') {
        score += 8
        factors.push('运动频率不足')
    } else if (form.exercise === '每周1至2次') {
        score += 4
    }

    if (form.sleep === '不足6小时') {
        score += 5
        factors.push('睡眠时间不足')
    } else if (form.sleep === '超过8小时') {
        score += 2
    }

    score = Math.min(score, 100)

    const riskLevel = getRiskLevel(score)

    if (factors.length === 0) {
        factors.push('当前未发现明显高风险因素')
    }

    result.value = {
        score,
        bmi: bmiValue.toFixed(1),
        factors,
        level: riskLevel.name,
        className: riskLevel.className,
        suggestion: riskLevel.suggestion
    }

    saveRiskRecord({
        score,
        bmi: bmiValue.toFixed(1),
        level: riskLevel.name,
        factors
    })

    ElMessage.success('风险评估完成，结果已保存到本地记录')
}
</script>

<template>
    <div class="page risk-page">
        <header class="risk-header">
            <button class="back-button" @click="goBack">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <h1>糖尿病风险预测</h1>

            <button class="history-button" @click="router.push('/user')">
                <el-icon>
                    <Clock />
                </el-icon>
            </button>
        </header>

        <section class="risk-hero">
            <div>
                <h2>开始健康风险评估</h2>
                <p>填写您的健康信息，获取个性化风险分析与健康建议。</p>
            </div>

            <div class="hero-shield">
                <span>⌁</span>
            </div>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon blue">
                    <el-icon>
                        <User />
                    </el-icon>
                </span>
                <div>
                    <h2>基本信息</h2>
                    <p>请填写真实的基础健康资料</p>
                </div>
            </div>

            <label class="form-field">
                <span>年龄</span>
                <div class="input-box">
                    <input
                        v-model="form.age"
                        type="number"
                        min="1"
                        max="120"
                        placeholder="请输入年龄"
                    >
                    <em>岁</em>
                </div>
            </label>

            <div class="form-field">
                <span>性别</span>
                <div class="option-grid two">
                    <button
                        :class="{ selected: form.gender === '男' }"
                        @click="choose('gender', '男')"
                    >
                        男
                    </button>
                    <button
                        :class="{ selected: form.gender === '女' }"
                        @click="choose('gender', '女')"
                    >
                        女
                    </button>
                </div>
            </div>

            <div class="field-pair">
                <label class="form-field">
                    <span>身高</span>
                    <div class="input-box">
                        <input
                            v-model="form.height"
                            type="number"
                            min="80"
                            max="250"
                            placeholder="175"
                        >
                        <em>cm</em>
                    </div>
                </label>

                <label class="form-field">
                    <span>体重</span>
                    <div class="input-box">
                        <input
                            v-model="form.weight"
                            type="number"
                            min="20"
                            max="300"
                            step="0.1"
                            placeholder="65"
                        >
                        <em>kg</em>
                    </div>
                </label>
            </div>

            <div class="bmi-tip">
                <span>BMI</span>
                <strong>{{ bmi }}</strong>
                <small>根据身高和体重自动计算</small>
            </div>

            <div class="form-field">
                <span>糖尿病家族史</span>
                <div class="option-grid three">
                    <button
                        :class="{ selected: form.familyHistory === '有' }"
                        @click="choose('familyHistory', '有')"
                    >
                        有
                    </button>
                    <button
                        :class="{ selected: form.familyHistory === '无' }"
                        @click="choose('familyHistory', '无')"
                    >
                        无
                    </button>
                    <button
                        :class="{ selected: form.familyHistory === '不确定' }"
                        @click="choose('familyHistory', '不确定')"
                    >
                        不确定
                    </button>
                </div>
            </div>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon green">
                    <el-icon>
                        <DataAnalysis />
                    </el-icon>
                </span>
                <div>
                    <h2>血糖健康信息</h2>
                    <p>建议填写最近一次体检或检测数据</p>
                </div>
            </div>

            <label class="form-field">
                <span>空腹血糖</span>
                <div class="input-box">
                    <input
                        v-model="form.fastingGlucose"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="例如 5.6"
                    >
                    <em>mmol/L</em>
                </div>
            </label>

            <label class="form-field">
                <span>餐后2小时血糖</span>
                <div class="input-box">
                    <input
                        v-model="form.postprandialGlucose"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="例如 7.2"
                    >
                    <em>mmol/L</em>
                </div>
            </label>

            <label class="form-field">
                <span>糖化血红蛋白</span>
                <div class="input-box">
                    <input
                        v-model="form.hba1c"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="例如 5.4"
                    >
                    <em>%</em>
                </div>
            </label>

            <label class="form-field">
                <span>血压（选填）</span>
                <div class="input-box">
                    <input
                        v-model="form.bloodPressure"
                        type="text"
                        placeholder="例如 120/80"
                    >
                    <em>mmHg</em>
                </div>
            </label>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon cyan">⌁</span>
                <div>
                    <h2>生活习惯</h2>
                    <p>用于生成更贴近您的健康建议</p>
                </div>
            </div>

            <div class="form-field">
                <span>饮食习惯</span>
                <div class="option-grid three">
                    <button
                        :class="{ selected: form.diet === '清淡饮食' }"
                        @click="choose('diet', '清淡饮食')"
                    >
                        清淡饮食
                    </button>
                    <button
                        :class="{ selected: form.diet === '普通饮食' }"
                        @click="choose('diet', '普通饮食')"
                    >
                        普通饮食
                    </button>
                    <button
                        :class="{ selected: form.diet === '高糖高油' }"
                        @click="choose('diet', '高糖高油')"
                    >
                        高糖高油
                    </button>
                </div>
            </div>

            <div class="form-field">
                <span>每周运动频率</span>
                <div class="option-grid three">
                    <button
                        :class="{ selected: form.exercise === '几乎不运动' }"
                        @click="choose('exercise', '几乎不运动')"
                    >
                        几乎不运动
                    </button>
                    <button
                        :class="{ selected: form.exercise === '每周1至2次' }"
                        @click="choose('exercise', '每周1至2次')"
                    >
                        每周1至2次
                    </button>
                    <button
                        :class="{ selected: form.exercise === '每周3次及以上' }"
                        @click="choose('exercise', '每周3次及以上')"
                    >
                        每周3次及以上
                    </button>
                </div>
            </div>

            <div class="form-field">
                <span>平均睡眠时长</span>
                <div class="option-grid three">
                    <button
                        :class="{ selected: form.sleep === '不足6小时' }"
                        @click="choose('sleep', '不足6小时')"
                    >
                        不足6小时
                    </button>
                    <button
                        :class="{ selected: form.sleep === '6至8小时' }"
                        @click="choose('sleep', '6至8小时')"
                    >
                        6至8小时
                    </button>
                    <button
                        :class="{ selected: form.sleep === '超过8小时' }"
                        @click="choose('sleep', '超过8小时')"
                    >
                        超过8小时
                    </button>
                </div>
            </div>
        </section>

        <section class="notice-card">
            <el-icon>
                <InfoFilled />
            </el-icon>
            <p>评估结果仅供健康管理参考，不作为医学诊断依据。若指标异常，请及时咨询医生。</p>
        </section>

        <section
            v-if="result"
            class="result-card"
            :class="result.className"
        >
            <span class="result-label">本次风险评估结果</span>

            <div class="result-main">
                <div>
                    <h2>{{ result.level }}</h2>
                    <p>风险评分</p>
                </div>

                <strong>{{ result.score }}<small>分</small></strong>
            </div>

            <div class="result-bmi">
                <span>BMI 指数</span>
                <b>{{ result.bmi }}</b>
            </div>

            <div class="factor-block">
                <h3>主要影响因素</h3>
                <div class="factor-list">
                    <span
                        v-for="factor in result.factors"
                        :key="factor"
                    >
                        {{ factor }}
                    </span>
                </div>
            </div>

            <div class="suggestion-block">
                <h3>健康建议</h3>
                <ul>
                    <li
                        v-for="item in result.suggestion"
                        :key="item"
                    >
                        {{ item }}
                    </li>
                </ul>
            </div>

            <button
                class="result-plan-button"
                @click="router.push('/plan')"
            >
                生成专属健康方案
            </button>
        </section>

        <button class="gradient-button evaluate-button" @click="evaluateRisk">
            开始风险评估
        </button>
    </div>
</template>

<style scoped>
.risk-page {
    padding-top: 14px;
}

.risk-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.risk-header h1 {
    margin: 0;
    color: #1d355d;
    font-size: 20px;
    font-weight: 800;
}

.back-button,
.history-button {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 13px;
    color: #315681;
    font-size: 20px;
    background: #ffffff;
    box-shadow: 0 8px 18px rgba(40, 99, 174, 0.1);
}

.risk-hero {
    min-height: 174px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 23px;
    overflow: hidden;
    border-radius: 26px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 18px 30px rgba(13, 143, 220, 0.19);
}

.risk-hero h2 {
    width: 210px;
    margin: 0;
    font-size: 25px;
    line-height: 1.35;
}

.risk-hero p {
    width: 214px;
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.87);
    font-size: 13px;
    line-height: 1.65;
}

.hero-shield {
    width: 70px;
    height: 82px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    border: 3px solid rgba(255, 255, 255, 0.78);
    border-radius: 35px 35px 42px 42px;
    transform: rotate(45deg);
}

.hero-shield span {
    color: #ffffff;
    font-size: 38px;
    font-weight: 800;
    transform: rotate(-45deg);
}

.form-card {
    margin-top: 18px;
    padding: 20px;
    border-radius: 24px;
    background: #ffffff;
    box-shadow: var(--shadow-light);
}

.form-title {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 20px;
}

.title-icon {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    font-size: 21px;
}

.title-icon.blue {
    color: #1687ff;
    background: #e4f3ff;
}

.title-icon.green {
    color: #00b982;
    background: #e3fbf1;
}

.title-icon.cyan {
    color: #00a6dd;
    background: #e4f8ff;
    font-size: 24px;
    font-weight: 800;
}

.form-title h2 {
    margin: 0;
    color: #26436d;
    font-size: 18px;
}

.form-title p {
    margin: 5px 0 0;
    color: #9aa9bd;
    font-size: 11px;
}

.form-field {
    display: block;
    margin-top: 16px;
}

.form-field > span {
    display: block;
    margin-bottom: 9px;
    color: #365887;
    font-size: 14px;
    font-weight: 700;
}

.input-box {
    height: 49px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-radius: 15px;
    background: #f3f7fc;
}

.input-box input {
    width: 100%;
    border: 0;
    outline: 0;
    color: #35557f;
    font-size: 14px;
    background: transparent;
}

.input-box input::placeholder {
    color: #adbad0;
}

.input-box em {
    flex: 0 0 auto;
    color: #7e9bc1;
    font-size: 13px;
    font-style: normal;
}

.field-pair {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.bmi-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 13px;
    padding: 10px 12px;
    border-radius: 13px;
    background: #ecf8ff;
}

.bmi-tip span {
    color: #5b8eb9;
    font-size: 12px;
}

.bmi-tip strong {
    color: #1687ff;
    font-size: 17px;
}

.bmi-tip small {
    margin-left: auto;
    color: #8ca5bf;
    font-size: 10px;
}

.option-grid {
    display: grid;
    gap: 9px;
}

.option-grid.two {
    grid-template-columns: repeat(2, 1fr);
}

.option-grid.three {
    grid-template-columns: repeat(3, 1fr);
}

.option-grid button {
    min-height: 43px;
    padding: 6px 4px;
    border-radius: 13px;
    color: #6880a1;
    font-size: 12px;
    font-weight: 700;
    background: #f3f7fc;
}

.option-grid button.selected {
    color: #ffffff;
    background: #1687ff;
    box-shadow: 0 8px 16px rgba(22, 135, 255, 0.22);
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
    font-size: 12px;
    line-height: 1.65;
}

.evaluate-button {
    width: 100%;
    margin-top: 20px;
}

.result-card {
    margin-top: 20px;
    padding: 22px;
    border-radius: 25px;
    color: #ffffff;
    box-shadow: 0 18px 30px rgba(25, 114, 194, 0.18);
}

.result-card.low {
    background: linear-gradient(135deg, #1687ff, #00cf85);
}

.result-card.medium {
    background: linear-gradient(135deg, #ffad24, #ff7d26);
}

.result-card.high {
    background: linear-gradient(135deg, #ff7a30, #f05056);
}

.result-card.very-high {
    background: linear-gradient(135deg, #df4059, #8f2d6c);
}

.result-label {
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
}

.result-main {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: 12px;
}

.result-main h2 {
    margin: 0;
    font-size: 30px;
}

.result-main p {
    margin: 7px 0 0;
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
}

.result-main > strong {
    font-size: 48px;
    line-height: 1;
}

.result-main > strong small {
    margin-left: 4px;
    font-size: 16px;
}

.result-bmi {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 18px;
    padding: 11px 13px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.16);
}

.result-bmi span {
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
}

.result-bmi b {
    font-size: 17px;
}

.factor-block,
.suggestion-block {
    margin-top: 17px;
}

.factor-block h3,
.suggestion-block h3 {
    margin: 0 0 9px;
    font-size: 14px;
}

.factor-list {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
}

.factor-list span {
    padding: 6px 9px;
    border-radius: 9px;
    color: rgba(255, 255, 255, 0.94);
    font-size: 11px;
    background: rgba(255, 255, 255, 0.16);
}

.suggestion-block ul {
    margin: 0;
    padding-left: 17px;
}

.suggestion-block li {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.91);
    font-size: 12px;
    line-height: 1.55;
}

.result-plan-button {
    width: 100%;
    min-height: 44px;
    margin-top: 20px;
    border-radius: 14px;
    color: #1687ff;
    font-size: 14px;
    font-weight: 800;
    background: #ffffff;
}
</style>