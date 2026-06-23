<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Clock, DataAnalysis, InfoFilled, User } from '@element-plus/icons-vue'

const router = useRouter()
const consentAccepted = ref(false)

const form = reactive({
    diagnosed: '否',
    diabetesType: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    waist: '',
    sbp: '',
    familyHistory: '',
    fastingGlucose: '',
    postprandialGlucose: '',
    hba1c: ''
})

const result = ref(null)

const diabetesTypeOptions = [
    {
        label: '1 型糖尿病',
        value: 'type1'
    },
    {
        label: '2 型糖尿病',
        value: 'type2'
    },
    {
        label: '妊娠型',
        value: 'gestational'
    },
    {
        label: '特殊类型',
        value: 'special'
    },
    {
        label: '类型未知',
        value: 'unknown'
    }
]

const bmi = computed(() => {
    const height = Number(form.height)
    const weight = Number(form.weight)

    if (!height || !weight) {
        return '--'
    }

    return (weight / ((height / 100) * (height / 100))).toFixed(1)
})

function goBack() {
    router.push('/user')
}

function choose(field, value) {
    form[field] = value

    if (field === 'diagnosed' && value === '否') {
        form.diabetesType = ''
    }
}

function getDiabetesTypeLabel(value) {
    return diabetesTypeOptions.find((item) => item.value === value)?.label || '类型未知'
}

function scoreAge(age) {
    if (age >= 65) return 18
    if (age >= 60) return 16
    if (age >= 55) return 15
    if (age >= 50) return 13
    if (age >= 45) return 12
    if (age >= 40) return 11
    if (age >= 35) return 8
    if (age >= 25) return 4
    return 0
}

function scoreBmi(value) {
    if (value >= 30) return 5
    if (value >= 24) return 3
    if (value >= 22) return 1
    return 0
}

function scoreWaist(value, gender) {
    const waist = Number(value)
    const female = gender === '女'
    const thresholds = female
        ? [70, 75, 80, 85, 90]
        : [75, 80, 85, 90, 95]

    if (waist >= thresholds[4]) return 10
    if (waist >= thresholds[3]) return 8
    if (waist >= thresholds[2]) return 7
    if (waist >= thresholds[1]) return 5
    if (waist >= thresholds[0]) return 3
    return 0
}

function scoreSbp(value) {
    const sbp = Number(value)
    if (sbp >= 160) return 10
    if (sbp >= 150) return 8
    if (sbp >= 140) return 7
    if (sbp >= 130) return 6
    if (sbp >= 120) return 3
    if (sbp >= 110) return 1
    return 0
}

function getLabWarnings() {
    const warnings = []
    const fasting = Number(form.fastingGlucose)
    const post = Number(form.postprandialGlucose)
    const hba1c = Number(form.hba1c)

    if (fasting >= 7) warnings.push('空腹血糖达到糖尿病诊断关注范围，请尽快咨询医生')
    else if (fasting >= 6.1) warnings.push('空腹血糖偏高，建议复查并记录近期饮食')

    if (post >= 11.1) warnings.push('餐后 2 小时血糖明显偏高，建议就医评估')
    else if (post >= 7.8) warnings.push('餐后 2 小时血糖处于偏高范围')

    if (hba1c >= 6.5) warnings.push('糖化血红蛋白偏高，建议结合医生意见进一步检查')
    else if (hba1c >= 5.7) warnings.push('糖化血红蛋白提示需要关注糖代谢状态')

    return warnings
}

function evaluateRisk() {
    if (!consentAccepted.value) {
        ElMessage.warning('请先勾选健康数据处理同意')
        return
    }

    const required = [form.diagnosed, form.age, form.gender, form.height, form.weight, form.familyHistory]

    if (required.some((item) => item === '' || item === null)) {
        ElMessage.warning('请先填写是否患病、年龄、性别、身高、体重和家族史')
        return
    }

    if (form.diagnosed === '是' && !form.diabetesType) {
        ElMessage.warning('请选择糖尿病类型')
        return
    }

    const age = Number(form.age)
    const bmiValue = Number(bmi.value)
    const labWarnings = getLabWarnings()

    if (form.diagnosed === '是') {
        result.value = {
            scoreStatus: 'diagnosed',
            score: null,
            bmi: bmi.value,
            level: '已患糖尿病',
            className: 'diagnosed',
            factors: [
                `糖尿病类型：${getDiabetesTypeLabel(form.diabetesType)}`,
                ...labWarnings
            ].filter(Boolean),
            suggestion: [
                '当前重点不是预测患病风险，而是进行连续血糖管理和并发症预防。',
                '建议完善血糖、血压、体重和用药记录，并定期复查 HbA1c。',
                '可进入生活方案模块生成饮食、运动和复查计划。'
            ],
            actionText: '生成疾病管理方案',
            actionPath: '/plan'
        }
        ElMessage.success('已生成糖尿病管理建议')
        return
    }

    if (age < 20 || age > 74) {
        result.value = {
            scoreStatus: 'not_applicable',
            score: null,
            bmi: bmi.value,
            level: '量表不适用',
            className: 'neutral',
            factors: [
                '中国糖尿病风险评分表适用于 20-74 岁普通人群',
                `当前填写年龄：${age} 岁`,
                ...labWarnings
            ],
            suggestion: [
                '当前年龄不在量表适用范围内，因此不输出正式总分或高低风险结论。',
                '仍建议保持规律饮食、适量运动和定期体检。',
                '如已有血糖异常、妊娠、儿童青少年或明显不适，请及时咨询专业医生。'
            ],
            actionText: '查看健康管理',
            actionPath: '/health'
        }
        ElMessage.info('当前年龄不适用该风险评分表')
        return
    }

    const missingFields = []

    if (!form.waist) {
        missingFields.push('腰围')
    }

    if (!form.sbp) {
        missingFields.push('收缩压')
    }

    if (missingFields.length > 0) {
        const knownDetail = {
            age: scoreAge(age),
            bmi: scoreBmi(bmiValue),
            family: form.familyHistory === '有' ? 6 : 0,
            gender: form.gender === '男' ? 2 : 0
        }

        const knownFactors = [
            `年龄项 ${knownDetail.age} 分`,
            `BMI 项 ${knownDetail.bmi} 分`,
            `家族史项 ${knownDetail.family} 分`,
            `性别项 ${knownDetail.gender} 分`,
            `缺失字段：${missingFields.join('、')}`,
            ...labWarnings
        ]

        result.value = {
            scoreStatus: 'incomplete',
            score: null,
            bmi: bmi.value,
            level: '资料待补充',
            className: 'incomplete',
            factors: knownFactors,
            suggestion: [
                '腰围和收缩压是中国糖尿病风险评分表的正式计分项，缺失时不输出正式风险总分。',
                `请补充${missingFields.join('、')}后再完成正式筛查。`,
                '当前可以先关注 BMI、家族史和血糖指标等已知风险因素，并保持规律生活方式。'
            ],
            actionText: '完善健康档案',
            actionPath: '/health-archive'
        }
        ElMessage.warning('资料不完整，暂不输出正式风险评分')
        return
    }

    const waistScore = scoreWaist(form.waist, form.gender)
    const sbpScore = scoreSbp(form.sbp)
    const detail = {
        age: scoreAge(age),
        bmi: scoreBmi(bmiValue),
        waist: waistScore,
        sbp: sbpScore,
        family: form.familyHistory === '有' ? 6 : 0,
        gender: form.gender === '男' ? 2 : 0
    }
    const score = Object.values(detail).reduce((sum, item) => sum + item, 0)
    const highRisk = score >= 25
    const factors = [
        `年龄 ${detail.age} 分`,
        `BMI ${detail.bmi} 分`,
        `腰围 ${detail.waist} 分`,
        `收缩压 ${detail.sbp} 分`,
        `家族史 ${detail.family} 分`,
        `性别 ${detail.gender} 分`,
        ...labWarnings
    ]

    result.value = {
        scoreStatus: 'complete',
        score,
        bmi: bmi.value,
        level: highRisk ? '高风险' : '低风险',
        className: highRisk ? 'high' : 'low',
        factors,
        suggestion: highRisk
            ? [
                '总分达到高风险阈值，建议尽快完善空腹血糖、餐后血糖和 HbA1c 检查。',
                '优先减少含糖饮料和精制主食，增加蔬菜、优质蛋白和规律运动。',
                '建议进入方案定制模块，生成连续 7 天生活干预计划。'
            ]
            : [
                '当前未达到高风险阈值，请继续保持规律饮食和适量运动。',
                '建议每年进行一次血糖相关检查，若体重或血压变化明显应提前复评。',
                '腰围和收缩压为选填项，补充真实数据可提升评估准确度。'
            ],
        actionText: '生成专属健康方案',
        actionPath: '/plan'
    }

    ElMessage.success('风险评估完成')
}
</script>

<template>
    <div class="page risk-page">
        <header class="risk-header">
            <button class="icon-button" aria-label="返回个人中心" @click="goBack">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <h1>糖尿病风险预测</h1>

            <button class="icon-button" aria-label="查看评估记录" @click="router.push('/user')">
                <el-icon>
                    <Clock />
                </el-icon>
            </button>
        </header>

        <section class="risk-hero">
            <div>
                <span>中国糖尿病风险评分表</span>
                <h2>先判断风险，再生成生活方案</h2>
                <p>腰围和收缩压可选填；补齐后才输出正式风险评分。</p>
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
                    <h2>个人信息</h2>
                    <p>带 * 为必填项</p>
                </div>
            </div>

            <div class="form-field">
                <span>是否已患糖尿病 *</span>
                <div class="option-grid two">
                    <button :class="{ selected: form.diagnosed === '否' }" @click="choose('diagnosed', '否')">
                        未患病
                    </button>
                    <button :class="{ selected: form.diagnosed === '是' }" @click="choose('diagnosed', '是')">
                        已患病
                    </button>
                </div>
            </div>

            <div v-if="form.diagnosed === '是'" class="form-field">
                <span>糖尿病类型 *</span>
                <div class="option-grid two">
                    <button
                        v-for="item in diabetesTypeOptions"
                        :key="item.value"
                        :class="{ selected: form.diabetesType === item.value }"
                        @click="choose('diabetesType', item.value)"
                    >
                        {{ item.label }}
                    </button>
                </div>
            </div>

            <label class="form-field">
                <span>年龄 *</span>
                <div class="input-box">
                    <input v-model="form.age" type="number" min="20" max="74" placeholder="20-74">
                    <em>岁</em>
                </div>
            </label>

            <div class="form-field">
                <span>性别 *</span>
                <div class="option-grid two">
                    <button :class="{ selected: form.gender === '男' }" @click="choose('gender', '男')">男</button>
                    <button :class="{ selected: form.gender === '女' }" @click="choose('gender', '女')">女</button>
                </div>
            </div>

            <div class="field-pair">
                <label class="form-field">
                    <span>身高 *</span>
                    <div class="input-box">
                        <input v-model="form.height" type="number" min="80" max="250" placeholder="170">
                        <em>cm</em>
                    </div>
                </label>

                <label class="form-field">
                    <span>体重 *</span>
                    <div class="input-box">
                        <input v-model="form.weight" type="number" min="20" max="300" step="0.1" placeholder="65">
                        <em>kg</em>
                    </div>
                </label>
            </div>

            <div class="bmi-tip">
                <span>BMI</span>
                <strong>{{ bmi }}</strong>
                <small>由身高和体重自动计算</small>
            </div>

            <div class="form-field">
                <span>糖尿病家族史 *</span>
                <div class="option-grid two">
                    <button :class="{ selected: form.familyHistory === '无' }" @click="choose('familyHistory', '无')">无</button>
                    <button :class="{ selected: form.familyHistory === '有' }" @click="choose('familyHistory', '有')">有</button>
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
                    <h2>选填指标</h2>
                    <p>补充腰围和收缩压后可完成正式筛查</p>
                </div>
            </div>

            <div class="field-pair">
                <label class="form-field">
                    <span>腰围</span>
                    <div class="input-box">
                        <input v-model="form.waist" type="number" min="40" max="180" placeholder="例如 85">
                        <em>cm</em>
                    </div>
                </label>

                <label class="form-field">
                    <span>收缩压</span>
                    <div class="input-box">
                        <input v-model="form.sbp" type="number" min="70" max="240" placeholder="例如 120">
                        <em>mmHg</em>
                    </div>
                </label>
            </div>

            <label class="form-field">
                <span>空腹血糖</span>
                <div class="input-box">
                    <input v-model="form.fastingGlucose" type="number" min="0" step="0.1" placeholder="例如 5.6">
                    <em>mmol/L</em>
                </div>
            </label>

            <label class="form-field">
                <span>餐后 2 小时血糖</span>
                <div class="input-box">
                    <input v-model="form.postprandialGlucose" type="number" min="0" step="0.1" placeholder="例如 7.2">
                    <em>mmol/L</em>
                </div>
            </label>

            <label class="form-field">
                <span>糖化血红蛋白</span>
                <div class="input-box">
                    <input v-model="form.hba1c" type="number" min="0" step="0.1" placeholder="例如 5.4">
                    <em>%</em>
                </div>
            </label>
        </section>

        <section class="notice-card">
            <el-icon>
                <InfoFilled />
            </el-icon>

            <div class="notice-copy">
                <p>评估结果仅供健康管理参考，不作为医学诊断依据。若指标异常，请及时咨询医生。</p>

                <label class="consent-row">
                    <input v-model="consentAccepted" type="checkbox">
                    <span>我已阅读并同意为本次健康评估处理相关健康数据</span>
                </label>
            </div>
        </section>

        <section
            v-if="result"
            class="result-card"
            :class="result.className"
        >
            <span class="result-label">本次评估结果</span>

            <div class="result-main">
                <div>
                    <h2>{{ result.level }}</h2>
                    <p>{{ result.score === null ? '疾病管理建议' : '风险评分' }}</p>
                </div>

                <strong v-if="result.score !== null">{{ result.score }}<small>分</small></strong>
            </div>

            <div class="result-bmi">
                <span>BMI 指数</span>
                <b>{{ result.bmi }}</b>
            </div>

            <div class="factor-block">
                <h3>关键依据</h3>
                <div class="factor-list">
                    <span v-for="factor in result.factors" :key="factor">
                        {{ factor }}
                    </span>
                </div>
            </div>

            <div class="suggestion-block">
                <h3>健康建议</h3>
                <ul>
                    <li v-for="item in result.suggestion" :key="item">
                        {{ item }}
                    </li>
                </ul>
            </div>

            <button class="result-plan-button" @click="router.push(result.actionPath)">
                {{ result.actionText }}
            </button>
        </section>

        <button class="gradient-button evaluate-button" @click="evaluateRisk">
            开始评估
        </button>
    </div>
</template>

<style scoped>
.risk-page {
    padding-top: 14px;
}

.risk-header {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 40px;
    align-items: center;
    gap: 10px;
}

.risk-header h1 {
    margin: 0;
    color: var(--ink-900);
    font-size: 18px;
    text-align: center;
}

.risk-hero {
    min-height: 168px;
    display: flex;
    align-items: center;
    margin-top: 16px;
    padding: 22px;
    border-radius: 24px;
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: var(--shadow-card);
}

.risk-hero span {
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
}

.risk-hero h2 {
    max-width: 270px;
    margin: 9px 0 0;
    font-size: 25px;
    line-height: 1.28;
}

.risk-hero p {
    max-width: 280px;
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: 12px;
    line-height: 1.65;
}

.form-card {
    margin-top: 16px;
    padding: 18px;
    border: 1px solid rgba(228, 237, 245, 0.9);
    border-radius: 20px;
    background: #ffffff;
    box-shadow: var(--shadow-card);
}

.form-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 17px;
}

.title-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    font-size: 20px;
}

.title-icon.blue {
    color: var(--primary-blue);
    background: var(--blue-soft);
}

.title-icon.green {
    color: var(--primary-green);
    background: var(--green-soft);
}

.form-title h2 {
    margin: 0;
    color: var(--ink-900);
    font-size: 17px;
}

.form-title p {
    margin: 4px 0 0;
    color: var(--ink-500);
    font-size: 11px;
}

.form-field {
    display: block;
    margin-top: 14px;
}

.form-field > span {
    display: block;
    margin-bottom: 8px;
    color: var(--ink-700);
    font-size: 13px;
    font-weight: 800;
}

.field-pair {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
}

.input-box {
    height: 47px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-radius: 14px;
    background: #f3f8fc;
}

.input-box input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 3px solid transparent;
    color: var(--ink-800);
    background: transparent;
}

.input-box input::placeholder {
    color: var(--ink-400);
}

.input-box em {
    flex: 0 0 auto;
    color: var(--ink-500);
    font-size: 12px;
    font-style: normal;
}

.option-grid {
    display: grid;
    gap: 9px;
}

.option-grid.two {
    grid-template-columns: repeat(2, 1fr);
}

.option-grid button {
    min-height: 42px;
    padding: 6px;
    border-radius: 13px;
    color: var(--ink-600);
    font-size: 12px;
    font-weight: 850;
    background: #f1f6fb;
}

.option-grid button.selected {
    color: #ffffff;
    background: var(--main-gradient);
    box-shadow: 0 8px 14px rgba(33, 103, 243, 0.18);
}

.bmi-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 13px;
    background: #edf8ff;
}

.bmi-tip span,
.bmi-tip small {
    color: var(--ink-500);
    font-size: 11px;
}

.bmi-tip strong {
    color: var(--primary-blue);
    font-size: 18px;
}

.bmi-tip small {
    margin-left: auto;
}

.notice-card {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 16px;
    padding: 14px;
    border-radius: 16px;
    color: #5d7d99;
    background: #eaf8ff;
}

.notice-card .el-icon {
    margin-top: 1px;
    color: var(--primary-blue);
}

.notice-card p {
    margin: 0;
    font-size: 12px;
    line-height: 1.65;
}

.notice-copy {
    flex: 1;
    min-width: 0;
}

.consent-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
    color: #5d7d99;
    font-size: 11px;
    line-height: 1.45;
}

.consent-row input {
    margin-top: 2px;
    flex: 0 0 auto;
}

.result-card {
    margin-top: 16px;
    padding: 20px;
    border-radius: 22px;
    color: #ffffff;
    box-shadow: var(--shadow-card);
}

.result-card.low {
    background: linear-gradient(135deg, #2167f3, #18b981);
}

.result-card.high,
.result-card.diagnosed {
    background: linear-gradient(135deg, #f0852d, #e85e61);
}

.result-card.incomplete,
.result-card.neutral {
    color: var(--ink-900);
    background: linear-gradient(135deg, #ffffff, #eef7ff);
}

.result-card.incomplete .result-label,
.result-card.neutral .result-label,
.result-card.incomplete .result-main p,
.result-card.neutral .result-main p,
.result-card.incomplete .suggestion-block li,
.result-card.neutral .suggestion-block li,
.result-card.incomplete .factor-list span,
.result-card.neutral .factor-list span {
    color: var(--ink-600);
}

.result-card.incomplete .result-bmi,
.result-card.neutral .result-bmi,
.result-card.incomplete .factor-list span,
.result-card.neutral .factor-list span {
    background: rgba(33, 103, 243, 0.08);
}

.result-label {
    color: rgba(255, 255, 255, 0.78);
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
    margin: 6px 0 0;
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
}

.result-main strong {
    font-size: 46px;
    line-height: 1;
}

.result-main small {
    margin-left: 3px;
    font-size: 15px;
}

.result-bmi {
    display: flex;
    justify-content: space-between;
    margin-top: 16px;
    padding: 11px 12px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.16);
}

.factor-block,
.suggestion-block {
    margin-top: 16px;
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
    padding: 6px 8px;
    border-radius: 9px;
    color: rgba(255, 255, 255, 0.94);
    font-size: 11px;
    background: rgba(255, 255, 255, 0.15);
}

.suggestion-block ul {
    margin: 0;
    padding-left: 17px;
}

.suggestion-block li {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    line-height: 1.6;
}

.result-plan-button {
    width: 100%;
    min-height: 44px;
    margin-top: 18px;
    border-radius: 13px;
    color: var(--primary-blue);
    font-size: 14px;
    font-weight: 850;
    background: #ffffff;
}

.result-card.incomplete .result-plan-button,
.result-card.neutral .result-plan-button {
    color: #ffffff;
    background: var(--main-gradient);
}

.evaluate-button {
    width: 100%;
    margin-top: 18px;
}
</style>
