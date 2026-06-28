const MOCK_STORAGE_KEY = 'diabetesMockDatabaseV1'

class MockApiError extends Error {
    constructor(message, status = 400, code = 40000) {
        super(message)

        this.name = 'MockApiError'
        this.status = status
        this.code = code
    }
}

function wait(ms = 280) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

function createTraceId() {
    return `mock_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
}

function clone(data) {
    return JSON.parse(JSON.stringify(data))
}

function now() {
    return new Date().toISOString()
}

function createDefaultDatabase() {
    return {
        version: 1,
        lastUserId: 1,
        lastAssessmentId: 1,
        lastPlanId: 1,
        lastCheckinId: 1,
        lastConversationId: 1,

        users: [
            {
                id: 1,
                username: 'demo',
                password: '123456',
                nickname: '测试同学',
                created_at: now(),
            },
        ],

        profiles: {},

        assessments: [],

        plans: [],

        checkins: [],

        conversations: [],

        messages: [
            {
                id: 1,
                type: 'archive',
                group: 'service',
                tag: '档案',
                tone: 'blue',
                title: '健康档案待完善',
                content: '腰围、血压和家族史会影响风险判断，补齐后可以做正式评估。',
                route: 'healthArchive',
                status: 'unread',
                created_at: now(),
            },
            {
                id: 2,
                type: 'reminder',
                group: 'reminder',
                tag: '复查',
                tone: 'orange',
                title: '复查提醒已生成',
                content: '建议关注空腹血糖、餐后 2 小时血糖和 HbA1c，复查前先记录近期状态。',
                route: 'plan',
                status: 'unread',
                created_at: now(),
            },
            {
                id: 3,
                type: 'assistant',
                group: 'assistant',
                tag: '助手',
                tone: 'purple',
                title: '健康助手可以继续上次对话',
                content: '已经保留最近一次咨询记录，可以直接接着问饮食、风险解释或报告怎么看。',
                route: 'assistant',
                status: 'read',
                created_at: now(),
            },
        ],

        idempotency: {},

        articles: [
            {
                id: 1,
                category: '控糖饮食',
                title: '早餐怎么吃，才能让上午血糖更平稳？',
                summary: '主食、蛋白质和蔬菜搭配顺序很重要。',
                read_time: '3 分钟阅读',
            },
            {
                id: 2,
                category: '科学运动',
                title: '饭后散步 20 分钟，对血糖有什么帮助？',
                summary: '规律运动，比一次剧烈运动更重要。',
                read_time: '4 分钟阅读',
            },
            {
                id: 3,
                category: '健康筛查',
                title: '除了血糖，这些指标也值得提前关注',
                summary: '腰围、体重、血压和家族史同样重要。',
                read_time: '5 分钟阅读',
            },
        ],
    }
}

function loadDatabase() {
    try {
        const raw = localStorage.getItem(MOCK_STORAGE_KEY)

        if (!raw) {
            const database = createDefaultDatabase()
            localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(database))
            return database
        }

        const database = JSON.parse(raw)

        return {
            ...createDefaultDatabase(),
            ...database,
        }
    } catch {
        const database = createDefaultDatabase()
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(database))
        return database
    }
}

function saveDatabase(database) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(database))
}

function getPublicUser(user) {
    return {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
    }
}

function createMockToken(userId) {
    return `mock-token.${userId}.${Date.now()}`
}

function getUserFromToken(database, token) {
    if (!token) {
        throw new MockApiError('请先登录后再继续操作。', 401, 40101)
    }

    const result = /^mock-token\.(\d+)\./.exec(token)

    if (!result) {
        throw new MockApiError('登录状态已失效，请重新登录。', 401, 40101)
    }

    const userId = Number(result[1])
    const user = database.users.find((item) => item.id === userId)

    if (!user) {
        throw new MockApiError('登录状态已失效，请重新登录。', 401, 40101)
    }

    return user
}

function getHeader(headers, key) {
    const target = key.toLowerCase()

    const entry = Object.entries(headers || {}).find(([headerKey]) => {
        return headerKey.toLowerCase() === target
    })

    return entry ? entry[1] : ''
}

function getTokenFromRequest(options) {
    if (options.token) {
        return options.token
    }

    const authorization = getHeader(options.headers, 'Authorization')

    if (!authorization) {
        return ''
    }

    return authorization.replace(/^Bearer\s+/i, '').trim()
}

function getProfile(database, userId) {
    return database.profiles[userId] || {
        user_id: userId,
        nickname: null,
        birth_date: null,
        age: null,
        gender: null,
        hometown: null,
        city: null,
        occupation: null,
        diagnosed_diabetes: null,
        diabetes_type: null,
        height_cm: null,
        weight_kg: null,
        waist_cm: null,
        sbp_mm_hg: null,
        systolic_bp: null,
        family_history: null,
        family_history_diabetes: null,
        fasting_glucose: null,
        postprandial_glucose: null,
        hba1c: null,
        medication_status: null,
        past_history: [],
        lifestyle: {},
        updated_at: null,
    }
}

function hasProfileValue(value) {
    return value !== null && value !== undefined && value !== ''
}

function getProfileCompletionRate(profile) {
    const healthFields = [
        profile.diagnosed_diabetes,
        profile.family_history_diabetes ?? profile.family_history,
        profile.height_cm,
        profile.weight_kg,
        profile.waist_cm,
        profile.sbp_mm_hg ?? profile.systolic_bp,
        profile.fasting_glucose,
        profile.postprandial_glucose,
        profile.hba1c,
    ]

    const completedCount = healthFields.filter(hasProfileValue).length

    return Math.round((completedCount / healthFields.length) * 100)
}

function getLatestAssessment(database, userId) {
    return database.assessments
        .filter((item) => item.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null
}

function getTodayMeasurements(database, userId) {
    const today = new Date().toISOString().slice(0, 10)

    const records = database.checkins.filter((item) => {
        return item.user_id === userId && item.recorded_at.slice(0, 10) === today
    })

    const findValue = (type) => {
        const record = [...records]
            .reverse()
            .find((item) => item.type === type)

        return record ? record.value : null
    }

    return {
        fasting_glucose: findValue('fasting_glucose'),
        postprandial_glucose: findValue('postprandial_glucose'),
        weight_kg: findValue('weight_kg'),
    }
}

function getIdempotentResult(database, userId, path, headers) {
    const idempotencyKey = getHeader(headers, 'Idempotency-Key')

    if (!idempotencyKey) {
        return null
    }

    return database.idempotency[`${userId}:${path}:${idempotencyKey}`] || null
}

function saveIdempotentResult(database, userId, path, headers, data) {
    const idempotencyKey = getHeader(headers, 'Idempotency-Key')

    if (!idempotencyKey) {
        return
    }

    database.idempotency[`${userId}:${path}:${idempotencyKey}`] = clone(data)
}

function buildSuccess(data, message = 'ok') {
    return {
        code: 0,
        message,
        data,
        traceId: createTraceId(),
    }
}

function buildFailure(error) {
    return {
        code: error.code || 50000,
        message: error.message || '模拟接口发生异常。',
        data: null,
        traceId: createTraceId(),
    }
}

function calculateAgeFromBirthDate(value) {
    if (!value) return null

    const birth = new Date(value)
    if (Number.isNaN(birth.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age -= 1
    }

    return age > 0 && age < 130 ? age : null
}

function toNumberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

function getRiskMockResult(input = {}) {
    if (input.mock_score_status) {
        const statusList = [
            'complete',
            'incomplete',
            'not_applicable',
            'diagnosed',
        ]

        if (!statusList.includes(input.mock_score_status)) {
            throw new MockApiError('mock_score_status 参数不合法。')
        }
    }

    if (input.diagnosed_diabetes === true || input.mock_score_status === 'diagnosed') {
        return {
            score_status: 'diagnosed',
            score: null,
            risk_level: null,
            is_high_risk: null,
            missing_fields: [],
            suggestion: '已确诊糖尿病，请进入疾病管理流程，重点关注复查、饮食、运动和用药沟通。',
        }
    }

    const age = toNumberOrNull(input.age) || calculateAgeFromBirthDate(input.birth_date)
    const gender = input.gender || null
    const height = toNumberOrNull(input.height_cm)
    const weight = toNumberOrNull(input.weight_kg)
    const waist = toNumberOrNull(input.waist_cm)
    const sbp = toNumberOrNull(input.sbp_mm_hg || input.systolic_bp)
    const familyHistory = input.family_history_diabetes ?? input.family_history
    const missingFields = []

    if (!age) missingFields.push('birth_date')
    if (!gender || gender === 'unknown') missingFields.push('gender')
    if (input.diagnosed_diabetes !== false) missingFields.push('diagnosed_diabetes')
    if (!height) missingFields.push('height_cm')
    if (!weight) missingFields.push('weight_kg')
    if (familyHistory === null || familyHistory === undefined || familyHistory === '') {
        missingFields.push('family_history_diabetes')
    }
    if (!waist) missingFields.push('waist_cm')
    if (!sbp) missingFields.push('sbp_mm_hg')

    if (missingFields.length > 0 || input.mock_score_status === 'incomplete') {
        return {
            score_status: 'incomplete',
            score: null,
            risk_level: null,
            is_high_risk: null,
            missing_fields: missingFields,
            suggestion: '当前资料不完整，无法输出正式风险评分。请补充个人信息和健康档案中的关键字段。',
        }
    }

    if (age < 20 || age > 74 || input.mock_score_status === 'not_applicable') {
        return {
            score_status: 'not_applicable',
            score: null,
            risk_level: null,
            is_high_risk: null,
            missing_fields: [],
            suggestion: '当前年龄不在中国糖尿病风险评分表适用范围内，可继续做一般健康管理。',
        }
    }

    const bmi = weight / ((height / 100) ** 2)
    let score = 0

    if (age >= 65) score += 12
    else if (age >= 55) score += 9
    else if (age >= 45) score += 6
    else if (age >= 35) score += 3

    if (gender === 'male') score += 2
    if (bmi >= 28) score += 4
    else if (bmi >= 24) score += 2

    if ((gender === 'male' && waist >= 90) || (gender === 'female' && waist >= 85)) score += 6
    else if ((gender === 'male' && waist >= 85) || (gender === 'female' && waist >= 80)) score += 3

    if (sbp >= 140) score += 6
    else if (sbp >= 130) score += 3
    if (familyHistory === true) score += 6

    const fastingGlucose = toNumberOrNull(input.fasting_glucose)
    const postprandialGlucose = toNumberOrNull(input.postprandial_glucose)

    if (fastingGlucose !== null && fastingGlucose >= 6.1) score += 4
    if (postprandialGlucose !== null && postprandialGlucose >= 7.8) score += 4

    const isHighRisk = score >= 25

    return {
        score_status: 'complete',
        score,
        risk_level: isHighRisk ? 'high' : 'low',
        is_high_risk: isHighRisk,
        missing_fields: [],
        score_detail: {
            age,
            gender,
            bmi: Number(bmi.toFixed(1)),
            waist_cm: waist,
            sbp_mm_hg: sbp,
            family_history_diabetes: Boolean(familyHistory),
        },
        suggestion: isHighRisk
            ? '筛查提示风险偏高，建议尽快查看解释，补充血糖检查，并生成生活管理方案。'
            : '筛查结果相对平稳，建议继续规律记录，定期复查关键指标。',
    }
}

function parseRequestUrl(path) {
    return new URL(path, 'http://mock.local')
}

function parseBody(body) {
    if (!body) {
        return {}
    }

    if (typeof body === 'string') {
        try {
            return JSON.parse(body)
        } catch {
            return {}
        }
    }

    return body
}

function handleRoute(database, path, options) {
    const requestUrl = parseRequestUrl(path)
    const pathname = requestUrl.pathname
    const method = String(options.method || 'GET').toUpperCase()
    const data = options.data || {}

    if (pathname === '/api/auth/register' && method === 'POST') {
        const username = String(data.username || '').trim()
        const password = String(data.password || '')
        const nickname = String(data.nickname || username).trim() || username

        if (!username) {
            throw new MockApiError('请输入用户名。')
        }

        if (password.length < 6) {
            throw new MockApiError('密码至少需要 6 位。')
        }

        const exists = database.users.some((item) => {
            return item.username === username
        })

        if (exists) {
            throw new MockApiError('该账号已存在，请直接登录。', 409, 40901)
        }

        const user = {
            id: ++database.lastUserId,
            username,
            password,
            nickname,
            created_at: now(),
        }

        database.users.push(user)
        saveDatabase(database)

        return {
            token: createMockToken(user.id),
            user: getPublicUser(user),
        }
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
        const account = String(data.account || data.username || '').trim()
        const password = String(data.password || '')

        const user = database.users.find((item) => {
            return item.username === account && item.password === password
        })

        if (!user) {
            throw new MockApiError('账号或密码错误。', 401, 40102)
        }

        return {
            token: createMockToken(user.id),
            user: getPublicUser(user),
        }
    }

    const token = getTokenFromRequest(options)
    const user = getUserFromToken(database, token)

    if (pathname === '/api/home/summary' && method === 'GET') {
        const profile = getProfile(database, user.id)
        const latestRisk = getLatestAssessment(database, user.id)

        return {
            user: getPublicUser(user),
            profile: {
                completed: getProfileCompletionRate(profile) === 100,
                completion_rate: getProfileCompletionRate(profile),
            },
            latest_risk: latestRisk
                ? {
                    score_status: latestRisk.score_status,
                    score: latestRisk.score,
                    risk_level: latestRisk.risk_level,
                    is_high_risk: latestRisk.is_high_risk,
                }
                : null,
            today_measurements: getTodayMeasurements(database, user.id),
            today_tasks: [
                {
                    id: 'archive',
                    title: '完善健康档案',
                    completed: getProfileCompletionRate(profile) === 100,
                },
                {
                    id: 'record',
                    title: '记录一次健康数据',
                    completed: false,
                },
            ],
            hot_articles: database.articles.slice(0, 3),
            unread_message_count: 0,
            is_mock: true,
        }
    }

    if (pathname === '/api/profile' && method === 'GET') {
        const profile = getProfile(database, user.id)

        return {
            ...profile,
            completion_rate: getProfileCompletionRate(profile),
            is_mock: true,
        }
    }

    if (pathname === '/api/profile' && method === 'PUT') {
        const profile = {
            ...getProfile(database, user.id),
            ...data,
            user_id: user.id,
            updated_at: now(),
        }

        database.profiles[user.id] = profile
        saveDatabase(database)

        return {
            ...profile,
            completion_rate: getProfileCompletionRate(profile),
            is_mock: true,
        }
    }

    if (pathname === '/api/risk-assessments' && method === 'POST') {
        const cachedData = getIdempotentResult(
            database,
            user.id,
            pathname,
            options.headers,
        )

        if (cachedData) {
            return cachedData
        }

        const result = getRiskMockResult(data)

        const assessment = {
            assessment_id: ++database.lastAssessmentId,
            user_id: user.id,
            ...result,
            created_at: now(),
            is_mock: true,
        }

        database.assessments.push(assessment)
        saveIdempotentResult(
            database,
            user.id,
            pathname,
            options.headers,
            assessment,
        )
        saveDatabase(database)

        return assessment
    }

    if (pathname === '/api/risk-assessments/latest' && method === 'GET') {
        return getLatestAssessment(database, user.id)
    }

    if (pathname === '/api/plans/generate' && method === 'POST') {
        const cachedData = getIdempotentResult(
            database,
            user.id,
            pathname,
            options.headers,
        )

        if (cachedData) {
            return cachedData
        }

        const plan = {
            plan_id: ++database.lastPlanId,
            user_id: user.id,
            status: 'active',
            title: '基础健康预治计划',
            tasks: [
                '完善健康档案',
                '记录一次关键健康数据',
                '阅读一篇控糖知识资讯',
            ],
            generated_at: now(),
            is_mock: true,
        }

        database.plans.push(plan)
        saveIdempotentResult(
            database,
            user.id,
            pathname,
            options.headers,
            plan,
        )
        saveDatabase(database)

        return plan
    }

    if (pathname === '/api/plans/active' && method === 'GET') {
        return (
            database.plans
                .filter((item) => item.user_id === user.id && item.status === 'active')
                .sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at))[0] ||
            null
        )
    }

    if (pathname === '/api/checkins' && method === 'POST') {
        const cachedData = getIdempotentResult(
            database,
            user.id,
            pathname,
            options.headers,
        )

        if (cachedData) {
            return cachedData
        }

        const record = {
            checkin_id: ++database.lastCheckinId,
            user_id: user.id,
            type: String(data.type || 'unknown'),
            value: data.value ?? null,
            unit: String(data.unit || ''),
            recorded_at: data.recorded_at || now(),
            created_at: now(),
            is_mock: true,
        }

        database.checkins.push(record)
        saveIdempotentResult(
            database,
            user.id,
            pathname,
            options.headers,
            record,
        )
        saveDatabase(database)

        return record
    }

    if (pathname === '/api/articles' && method === 'GET') {
        const category = requestUrl.searchParams.get('category')

        const articles = category
            ? database.articles.filter((item) => item.category === category)
            : database.articles

        return {
            list: articles,
            total: articles.length,
            is_mock: true,
        }
    }

    if (pathname === '/api/messages' && method === 'GET') {
        return {
            list: database.messages || [],
            total: (database.messages || []).length,
            unread_count: (database.messages || []).filter((item) => item.status !== 'read').length,
            is_mock: true,
        }
    }

    if (pathname === '/api/messages/read-all' && method === 'POST') {
        database.messages = (database.messages || []).map((item) => ({
            ...item,
            status: 'read',
        }))
        saveDatabase(database)

        return {
            unread_count: 0,
            is_mock: true,
        }
    }

    if (pathname === '/api/assistant/chat' && method === 'POST') {
        const message = String(data.message || '').trim()

        if (!message) {
            throw new MockApiError('请输入想咨询的问题。')
        }

        const conversationId =
            data.conversation_id || ++database.lastConversationId

        database.conversations.push({
            conversation_id: conversationId,
            user_id: user.id,
            role: 'user',
            content: message,
            created_at: now(),
        })

        database.conversations.push({
            conversation_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: '这是本地模拟回复，后续会接入真实糖尿病助手。',
            created_at: now(),
        })

        saveDatabase(database)

        return {
            conversation_id: conversationId,
            reply: '这是本地模拟回复，后续会接入真实糖尿病助手。',
            is_mock: true,
        }
    }

    throw new MockApiError(`Mock 暂未支持接口：${method} ${pathname}`, 404, 40400)
}

export async function mockApiRequest(path, options = {}) {
    await wait()

    try {
        const database = loadDatabase()
        const data = handleRoute(database, path, options)

        return {
            status: 200,
            payload: buildSuccess(data),
        }
    } catch (error) {
        const finalError =
            error instanceof MockApiError
                ? error
                : new MockApiError('模拟接口发生异常。', 500, 50000)

        return {
            status: finalError.status,
            payload: buildFailure(finalError),
        }
    }
}

export async function mockAuthorizedFetch(path, options = {}) {
    const requestUrl = parseRequestUrl(path)
    const pathname = requestUrl.pathname
    const method = String(options.method || 'GET').toUpperCase()

    if (pathname === '/api/assistant/chat' && method === 'POST') {
        const body = parseBody(options.body)
        const normalResult = await mockApiRequest(path, {
            method,
            data: body,
            headers: options.headers,
            token: options.token,
        })

        if (normalResult.status !== 200) {
            return new Response(JSON.stringify(normalResult.payload), {
                status: normalResult.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const conversationId = normalResult.payload.data.conversation_id
        const message = String(body.message || '').trim()

        const events = [
            {
                event: 'message',
                data: {
                    content: '这是本地模拟助手回复：',
                },
            },
            {
                event: 'message',
                data: {
                    content: `我已经收到你的问题“${message}”。`,
                },
            },
            {
                event: 'message',
                data: {
                    content: '接入真实助手服务后，这里会返回流式回答。',
                },
            },
            {
                event: 'message_end',
                data: {
                    conversation_id: conversationId,
                    is_mock: true,
                },
            },
        ]

        const encoder = new TextEncoder()
        let index = 0

        const stream = new ReadableStream({
            start(controller) {
                const pushEvent = () => {
                    if (index >= events.length) {
                        controller.close()
                        return
                    }

                    const current = events[index]
                    const text = `event: ${current.event}\ndata: ${JSON.stringify(current.data)}\n\n`

                    controller.enqueue(encoder.encode(text))
                    index += 1

                    window.setTimeout(pushEvent, 240)
                }

                pushEvent()
            },
        })

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache',
            },
        })
    }

    const result = await mockApiRequest(path, {
        method,
        data: parseBody(options.body),
        headers: options.headers,
        token: options.token,
    })

    return new Response(JSON.stringify(result.payload), {
        status: result.status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
    })
}

export function resetMockDatabase() {
    localStorage.removeItem(MOCK_STORAGE_KEY)
}
