<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
    ArrowLeft,
    Document,
    InfoFilled,
    UploadFilled,
    Delete
} from '@element-plus/icons-vue'

const router = useRouter()

const archive = reactive({
    nickname: '康同学',
    gender: '',
    birthday: '',
    height: '',
    weight: '',
    familyHistory: '',
    pastHistory: [],
    fastingGlucose: '',
    postprandialGlucose: '',
    bloodPressure: '',
    allergy: '',
    emergencyContact: '',
    emergencyPhone: ''
})

const reportList = ref([])

const pastHistoryOptions = [
    '高血压',
    '高血脂',
    '脂肪肝',
    '心血管疾病',
    '无明显既往史'
]

const bmi = computed(() => {
    const height = Number(archive.height)
    const weight = Number(archive.weight)

    if (!height || !weight) {
        return '--'
    }

    return (weight / ((height / 100) * (height / 100))).toFixed(1)
})

function goBack() {
    router.push('/health')
}

function chooseGender(value) {
    archive.gender = value
}

function chooseFamilyHistory(value) {
    archive.familyHistory = value
}

function togglePastHistory(value) {
    if (value === '无明显既往史') {
        archive.pastHistory = ['无明显既往史']
        return
    }

    archive.pastHistory = archive.pastHistory.filter(
        (item) => item !== '无明显既往史'
    )

    if (archive.pastHistory.includes(value)) {
        archive.pastHistory = archive.pastHistory.filter(
            (item) => item !== value
        )
    } else {
        archive.pastHistory.push(value)
    }
}

function handleUpload(event) {
    const file = event.target.files?.[0]

    if (!file) {
        return
    }

    const report = {
        id: Date.now(),
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        date: new Date().toLocaleDateString('zh-CN')
    }

    reportList.value.unshift(report)

    event.target.value = ''

    ElMessage.success('体检报告已添加到健康档案')
}

function removeReport(id) {
    reportList.value = reportList.value.filter((item) => item.id !== id)
    ElMessage.success('已删除该体检报告')
}

function getLocalDay() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function getShortDate() {
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()

    return `${month}/${day}`
}

function getHistoryList() {
    try {
        const history = JSON.parse(
            localStorage.getItem('diabetesHealthHistory') || '[]'
        )

        if (Array.isArray(history)) {
            return history
        }

        return []
    } catch (error) {
        console.warn('读取健康历史记录失败', error)
        return []
    }
}

function saveHealthHistory(savedArchive) {
    const now = new Date()
    const day = getLocalDay()

    const record = {
        id: Date.now(),
        day,
        date: getShortDate(),
        timestamp: now.getTime(),
        nickname: savedArchive.nickname,
        gender: savedArchive.gender,
        birthday: savedArchive.birthday,
        height: savedArchive.height,
        weight: savedArchive.weight,
        bmi: savedArchive.bmi,
        familyHistory: savedArchive.familyHistory,
        pastHistory: [...savedArchive.pastHistory],
        fastingGlucose: savedArchive.fastingGlucose,
        postprandialGlucose: savedArchive.postprandialGlucose,
        bloodPressure: savedArchive.bloodPressure
    }

    const history = getHistoryList()

    const sameDayIndex = history.findIndex((item) => item.day === day)

    if (sameDayIndex !== -1) {
        history[sameDayIndex] = {
            ...history[sameDayIndex],
            ...record,
            id: history[sameDayIndex].id
        }
    } else {
        history.unshift(record)
    }

    history.sort((a, b) => b.timestamp - a.timestamp)

    localStorage.setItem(
        'diabetesHealthHistory',
        JSON.stringify(history.slice(0, 60))
    )
}

function saveArchive() {
    if (!archive.gender || !archive.height || !archive.weight) {
        ElMessage.warning('请至少完善性别、身高和体重信息')
        return
    }

    const savedArchive = {
        ...archive,
        pastHistory: [...archive.pastHistory],
        bmi: bmi.value,
        reports: [...reportList.value],
        updatedAt: new Date().toLocaleString('zh-CN')
    }

    localStorage.setItem(
        'diabetesHealthArchive',
        JSON.stringify(savedArchive)
    )

    saveHealthHistory(savedArchive)

    ElMessage.success('健康档案保存成功')
}

function loadArchive() {
    try {
        const savedArchive = JSON.parse(
            localStorage.getItem('diabetesHealthArchive') || 'null'
        )

        if (!savedArchive) {
            return
        }

        Object.keys(archive).forEach((key) => {
            if (savedArchive[key] !== undefined) {
                archive[key] = savedArchive[key]
            }
        })

        if (Array.isArray(savedArchive.reports)) {
            reportList.value = savedArchive.reports
        }
    } catch (error) {
        console.warn('读取健康档案失败', error)
    }
}

onMounted(() => {
    loadArchive()
})
</script>

<template>
    <div class="page archive-page">
        <header class="archive-header">
            <button class="back-button" @click="goBack">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>

            <h1>健康档案</h1>

            <button class="save-top-button" @click="saveArchive">
                保存
            </button>
        </header>

        <section class="archive-hero">
            <div>
                <span>个人健康档案</span>
                <h2>完善信息，获得更准确的健康分析</h2>
                <p>您的健康信息仅用于风险评估、方案定制与健康管理服务。</p>
            </div>

            <div class="hero-document">
                <el-icon>
                    <Document />
                </el-icon>
            </div>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon blue">人</span>

                <div>
                    <h2>基本资料</h2>
                    <p>用于建立个人基础健康档案</p>
                </div>
            </div>

            <label class="form-field">
                <span>昵称</span>

                <div class="input-box">
                    <input
                        v-model="archive.nickname"
                        type="text"
                        placeholder="请输入昵称"
                    >
                </div>
            </label>

            <div class="form-field">
                <span>性别</span>

                <div class="option-grid two">
                    <button
                        :class="{ selected: archive.gender === '男' }"
                        @click="chooseGender('男')"
                    >
                        男
                    </button>

                    <button
                        :class="{ selected: archive.gender === '女' }"
                        @click="chooseGender('女')"
                    >
                        女
                    </button>
                </div>
            </div>

            <label class="form-field">
                <span>出生日期</span>

                <div class="input-box">
                    <input
                        v-model="archive.birthday"
                        type="date"
                    >
                </div>
            </label>

            <div class="field-pair">
                <label class="form-field">
                    <span>身高</span>

                    <div class="input-box">
                        <input
                            v-model="archive.height"
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
                            v-model="archive.weight"
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
                <span>BMI 指数</span>
                <strong>{{ bmi }}</strong>
                <small>根据身高和体重自动计算</small>
            </div>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon orange">史</span>

                <div>
                    <h2>健康史</h2>
                    <p>帮助系统识别可能的健康风险因素</p>
                </div>
            </div>

            <div class="form-field">
                <span>糖尿病家族史</span>

                <div class="option-grid three">
                    <button
                        :class="{ selected: archive.familyHistory === '有' }"
                        @click="chooseFamilyHistory('有')"
                    >
                        有
                    </button>

                    <button
                        :class="{ selected: archive.familyHistory === '无' }"
                        @click="chooseFamilyHistory('无')"
                    >
                        无
                    </button>

                    <button
                        :class="{ selected: archive.familyHistory === '不确定' }"
                        @click="chooseFamilyHistory('不确定')"
                    >
                        不确定
                    </button>
                </div>
            </div>

            <div class="form-field">
                <span>既往病史</span>

                <div class="history-tags">
                    <button
                        v-for="item in pastHistoryOptions"
                        :key="item"
                        :class="{ selected: archive.pastHistory.includes(item) }"
                        @click="togglePastHistory(item)"
                    >
                        {{ item }}
                    </button>
                </div>
            </div>

            <label class="form-field">
                <span>药物或食物过敏史（选填）</span>

                <div class="input-box">
                    <input
                        v-model="archive.allergy"
                        type="text"
                        placeholder="如无可填写“无”"
                    >
                </div>
            </label>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon green">检</span>

                <div>
                    <h2>近期健康数据</h2>
                    <p>可填写最近一次测量或体检结果</p>
                </div>
            </div>

            <label class="form-field">
                <span>空腹血糖</span>

                <div class="input-box">
                    <input
                        v-model="archive.fastingGlucose"
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
                        v-model="archive.postprandialGlucose"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="例如 7.2"
                    >
                    <em>mmol/L</em>
                </div>
            </label>

            <label class="form-field">
                <span>血压</span>

                <div class="input-box">
                    <input
                        v-model="archive.bloodPressure"
                        type="text"
                        placeholder="例如 120/80"
                    >
                    <em>mmHg</em>
                </div>
            </label>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon purple">
                    <el-icon>
                        <UploadFilled />
                    </el-icon>
                </span>

                <div>
                    <h2>体检报告</h2>
                    <p>支持上传体检报告图片或 PDF 文件</p>
                </div>
            </div>

            <label class="upload-area">
                <input
                    type="file"
                    accept="image/*,.pdf"
                    @change="handleUpload"
                >

                <span class="upload-icon">
                    <el-icon>
                        <UploadFilled />
                    </el-icon>
                </span>

                <strong>上传体检报告</strong>
                <small>支持图片或 PDF，当前为前端本地记录演示</small>
            </label>

            <div v-if="reportList.length > 0" class="report-list">
                <div
                    v-for="report in reportList"
                    :key="report.id"
                    class="report-item"
                >
                    <span class="report-file-icon">
                        <el-icon>
                            <Document />
                        </el-icon>
                    </span>

                    <div>
                        <strong>{{ report.name }}</strong>
                        <p>{{ report.date }} · {{ report.size }}</p>
                    </div>

                    <button @click="removeReport(report.id)">
                        <el-icon>
                            <Delete />
                        </el-icon>
                    </button>
                </div>
            </div>

            <div v-else class="empty-report">
                暂未上传体检报告
            </div>
        </section>

        <section class="form-card">
            <div class="form-title">
                <span class="title-icon cyan">联</span>

                <div>
                    <h2>紧急联系人</h2>
                    <p>仅在必要时用于健康管理提醒</p>
                </div>
            </div>

            <label class="form-field">
                <span>联系人姓名</span>

                <div class="input-box">
                    <input
                        v-model="archive.emergencyContact"
                        type="text"
                        placeholder="请输入联系人姓名"
                    >
                </div>
            </label>

            <label class="form-field">
                <span>联系电话</span>

                <div class="input-box">
                    <input
                        v-model="archive.emergencyPhone"
                        type="tel"
                        placeholder="请输入联系电话"
                    >
                </div>
            </label>
        </section>

        <section class="notice-card">
            <el-icon>
                <InfoFilled />
            </el-icon>

            <p>
                健康档案仅用于糖尿病风险预测、生活方案定制与健康管理参考。
                当前纯前端阶段将数据保存于本浏览器本地存储中。
            </p>
        </section>

        <button class="gradient-button save-button" @click="saveArchive">
            保存健康档案
        </button>
    </div>
</template>

<style scoped>
.archive-page {
    padding-top: 14px;
}

.archive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.archive-header h1 {
    margin: 0;
    color: #1d355d;
    font-size: 20px;
    font-weight: 800;
}

.back-button {
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

.save-top-button {
    padding: 9px 13px;
    border-radius: 12px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    background: #1687ff;
    box-shadow: 0 7px 14px rgba(22, 135, 255, 0.2);
}

.archive-hero {
    min-height: 184px;
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

.archive-hero div:first-child {
    width: 230px;
}

.archive-hero span {
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
}

.archive-hero h2 {
    margin: 10px 0 0;
    font-size: 23px;
    line-height: 1.35;
}

.archive-hero p {
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.87);
    font-size: 12px;
    line-height: 1.65;
}

.hero-document {
    width: 64px;
    height: 76px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid rgba(255, 255, 255, 0.75);
    border-radius: 18px;
    font-size: 33px;
    transform: rotate(8deg);
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
    font-size: 16px;
    font-weight: 800;
}

.title-icon.blue {
    color: #1687ff;
    background: #e4f3ff;
}

.title-icon.orange {
    color: #ff8815;
    background: #fff0dd;
}

.title-icon.green {
    color: #00b982;
    background: #e3fbf1;
}

.title-icon.purple {
    color: #7b6df4;
    background: #efedff;
    font-size: 21px;
}

.title-icon.cyan {
    color: #00a6dd;
    background: #e4f8ff;
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

.history-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
}

.history-tags button {
    padding: 9px 12px;
    border-radius: 12px;
    color: #6980a0;
    font-size: 12px;
    font-weight: 700;
    background: #f3f7fc;
}

.history-tags button.selected {
    color: #1687ff;
    background: #e7f4ff;
    box-shadow: inset 0 0 0 1px #90caff;
}

.upload-area {
    min-height: 132px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 17px;
    border: 1.5px dashed #a7d6ff;
    border-radius: 19px;
    text-align: center;
    background: #f4fbff;
    cursor: pointer;
}

.upload-area input {
    display: none;
}

.upload-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    color: #1687ff;
    font-size: 22px;
    background: #e1f3ff;
}

.upload-area strong {
    margin-top: 11px;
    color: #2b527c;
    font-size: 14px;
}

.upload-area small {
    margin-top: 6px;
    color: #91a7c0;
    font-size: 11px;
}

.report-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
}

.report-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px;
    border-radius: 15px;
    background: #f6f9fd;
}

.report-file-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: #1687ff;
    font-size: 19px;
    background: #e5f3ff;
}

.report-item div {
    flex: 1;
    overflow: hidden;
}

.report-item strong {
    display: block;
    overflow: hidden;
    color: #385779;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.report-item p {
    margin: 5px 0 0;
    color: #97a8bf;
    font-size: 10px;
}

.report-item button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    color: #f16168;
    background: #fff0f1;
}

.empty-report {
    margin-top: 13px;
    padding: 13px;
    border-radius: 13px;
    color: #9aaabe;
    font-size: 12px;
    text-align: center;
    background: #f6f9fd;
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

.save-button {
    width: 100%;
    margin-top: 20px;
}
</style>