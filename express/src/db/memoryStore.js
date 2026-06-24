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

    async getArticleRecommendations() {
      return clone(state.articles)
    },

    async getDoctorById(id) {
      return clone(state.doctors.find((doctor) => doctor.id === Number(id)) || null)
    }
  }
}
