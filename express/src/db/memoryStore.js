import { errors } from '../http/errors.js'

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function now() {
  return new Date().toISOString()
}

export function createMemoryStore() {
  const state = {
    users: [],
    profiles: [],
    risks: [],
    conversations: [],
    messages: [],
    difyLogs: [],
    doctors: [],
    articles: [],
    diabetesTypes: []
  }

  const counters = {
    users: 1,
    profiles: 1,
    risks: 1,
    conversations: 1,
    messages: 1,
    difyLogs: 1
  }

  return {
    state,

    async findUserByAccount(account) {
      return clone(state.users.find((user) => (
        user.username === account || user.phone === account || user.email === account
      )))
    },

    async findUserById(id) {
      return clone(state.users.find((user) => user.id === Number(id)))
    },

    async createUser(input) {
      const duplicate = state.users.find((user) => (
        user.username === input.username ||
        (input.phone && user.phone === input.phone) ||
        (input.email && user.email === input.email)
      ))

      if (duplicate) {
        throw errors.conflict('用户名、手机号或邮箱已存在')
      }

      const user = {
        id: counters.users,
        username: input.username,
        phone: input.phone || null,
        email: input.email || null,
        password_hash: input.password_hash,
        role: input.role || 'user',
        status: 'active',
        nickname: input.nickname || input.username,
        avatar_url: null,
        created_at: now(),
        updated_at: now()
      }

      counters.users += 1
      state.users.push(user)
      return clone(user)
    },

    async getProfile(userId) {
      return clone(state.profiles.find((profile) => profile.user_id === Number(userId)) || null)
    },

    async upsertProfile(userId, input) {
      const existing = state.profiles.find((profile) => profile.user_id === Number(userId))
      const payload = {
        ...input,
        user_id: Number(userId),
        updated_at: now()
      }

      if (existing) {
        Object.assign(existing, payload)
        return clone(existing)
      }

      const profile = {
        id: counters.profiles,
        ...payload,
        created_at: now()
      }

      counters.profiles += 1
      state.profiles.push(profile)
      return clone(profile)
    },

    async findRiskByIdempotency(userId, idempotencyKey) {
      return clone(state.risks.find((risk) => (
        risk.user_id === Number(userId) && risk.idempotency_key === idempotencyKey
      )) || null)
    },

    async createRiskAssessment(input) {
      const risk = {
        id: counters.risks,
        ...input,
        created_at: now()
      }

      counters.risks += 1
      state.risks.push(risk)
      return clone(risk)
    },

    async updateRiskAssessment(id, patch) {
      const risk = state.risks.find((item) => item.id === Number(id))

      if (!risk) {
        throw errors.notFound('风险评估不存在')
      }

      Object.assign(risk, patch)
      return clone(risk)
    },

    async getLatestRisk(userId) {
      return clone(state.risks
        .filter((risk) => risk.user_id === Number(userId))
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0] || null)
    },

    async listRisks(userId, { page = 1, pageSize = 10 } = {}) {
      const items = state.risks
        .filter((risk) => risk.user_id === Number(userId))
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
      const start = (page - 1) * pageSize

      return {
        items: clone(items.slice(start, start + pageSize)),
        total: items.length,
        page,
        pageSize
      }
    },

    async findConversation(userId, id) {
      return clone(state.conversations.find((conversation) => (
        conversation.id === Number(id) && conversation.user_id === Number(userId)
      )) || null)
    },

    async createConversation(input) {
      const conversation = {
        id: counters.conversations,
        ...input,
        status: 'active',
        created_at: now(),
        updated_at: now()
      }

      counters.conversations += 1
      state.conversations.push(conversation)
      return clone(conversation)
    },

    async updateConversation(id, patch) {
      const conversation = state.conversations.find((item) => item.id === Number(id))

      if (!conversation) {
        throw errors.notFound('会话不存在')
      }

      Object.assign(conversation, patch, { updated_at: now() })
      return clone(conversation)
    },

    async createMessage(input) {
      const message = {
        id: counters.messages,
        ...input,
        created_at: now()
      }

      counters.messages += 1
      state.messages.push(message)
      return clone(message)
    },

    async listConversations(userId, appType = 'assistant') {
      return clone(state.conversations
        .filter((conversation) => (
          conversation.user_id === Number(userId) && conversation.app_type === appType
        ))
        .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at)))
    },

    async listMessages(userId, conversationId) {
      const conversation = state.conversations.find((item) => (
        item.id === Number(conversationId) && item.user_id === Number(userId)
      ))

      if (!conversation) {
        throw errors.notFound('会话不存在')
      }

      return clone(state.messages
        .filter((message) => message.conversation_id === Number(conversationId))
        .sort((left, right) => new Date(left.created_at) - new Date(right.created_at)))
    },

    async createDifyLog(input) {
      const log = {
        id: counters.difyLogs,
        ...input,
        created_at: now()
      }

      counters.difyLogs += 1
      state.difyLogs.push(log)
      return clone(log)
    },

    async getUserContext(userId) {
      return {
        profile: await this.getProfile(userId),
        latest_risk: await this.getLatestRisk(userId),
        latest_plan: null
      }
    },

    async getHomeSummary() {
      return {
        doctors: clone(state.doctors),
        articles: clone(state.articles),
        diabetesTypes: clone(state.diabetesTypes)
      }
    },

    async getCheckinSummary() {
      return {
        period: null,
        completion_rate: null,
        items: []
      }
    },

    async getArticleRecommendations({ page = 1, pageSize = 20 } = {}) {
      const seededArticles = state.articles.length > 0
        ? state.articles
        : [
            {
              id: 'food-breakfast',
              title: '早餐怎么吃，上午血糖更平稳？',
              summary: '主食、蛋白质和蔬菜搭配顺序，会影响餐后血糖曲线。',
              category: '控糖饮食',
              read_time: '3 分钟阅读',
              published_at: now()
            },
            {
              id: 'walk-after-meal',
              title: '饭后轻走 20 分钟有什么帮助？',
              summary: '低强度、可持续的活动更适合日常控糖管理。',
              category: '科学运动',
              read_time: '4 分钟阅读',
              published_at: now()
            },
            {
              id: 'screening-fields',
              title: '风险筛查为什么要看腰围和血压？',
              summary: '腰围、血压、BMI 和家族史能共同提示代谢风险。',
              category: '健康筛查',
              read_time: '5 分钟阅读',
              published_at: now()
            }
          ]
      const start = (Number(page) - 1) * Number(pageSize)

      return {
        items: clone(seededArticles.slice(start, start + Number(pageSize))),
        total: seededArticles.length,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    },

    async getDoctorById(id) {
      return clone(state.doctors.find((doctor) => doctor.id === Number(id)) || null)
    },

    async getActivePlan(userId) {
      const latestRisk = await this.getLatestRisk(userId)

      return {
        id: 'default-active-plan',
        title: '基础生活管理方案',
        goal_summary: latestRisk?.risk_level === 'high'
          ? '优先稳定餐后活动、饮食结构和复查节奏。'
          : '保持记录习惯，逐步形成可持续的生活节奏。',
        status: 'active',
        tasks: [
          {
            id: 'plan-diet',
            task_type: 'diet',
            title: '记录三餐主食和蛋白质',
            description: '先观察饮食结构，不急着大幅调整。',
            target: '3次',
            time: '早中晚'
          },
          {
            id: 'plan-walk',
            task_type: 'exercise',
            title: '饭后轻走 20 分钟',
            description: '选择最容易坚持的一餐开始。',
            target: '20分',
            time: '餐后'
          }
        ]
      }
    },

    async createCheckin(userId, input) {
      return {
        id: `checkin-${Date.now()}`,
        user_id: Number(userId),
        ...input,
        created_at: now()
      }
    }
  }
}
