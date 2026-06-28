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
    diabetesTypes: [],
    articleFavorites: [],
    consultations: [],
    auditLogs: [],
    categories: [],
    homeConfigs: []
  }

  const counters = {
    users: 1,
    profiles: 1,
    risks: 1,
    conversations: 1,
    messages: 1,
    difyLogs: 1,
    doctors: 1,
    articles: 1,
    consultations: 1,
    auditLogs: 1,
    categories: 1,
    homeConfigs: 1
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

    async updateLastLogin(userId, input = {}) {
      const user = state.users.find((item) => item.id === Number(userId))
      if (!user) return null
      user.last_login_at = now()
      user.last_login_ip = input.last_login_ip || null
      user.updated_at = now()
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

    async getArticleById(id, { userId = null } = {}) {
      const recommendations = await this.getArticleRecommendations({ page: 1, pageSize: 100 })
      const article = recommendations.items.find((item) => String(item.id) === String(id))

      if (!article) {
        return null
      }

      article.view_count = Number(article.view_count || article.views || 0) + 1
      article.favorited = state.articleFavorites.some((item) => (
        item.user_id === Number(userId) && String(item.article_id) === String(id)
      ))
      return clone(article)
    },

    async toggleArticleFavorite(userId, articleId) {
      const index = state.articleFavorites.findIndex((item) => (
        item.user_id === Number(userId) && String(item.article_id) === String(articleId)
      ))

      if (index >= 0) {
        state.articleFavorites.splice(index, 1)
        return { favorited: false }
      }

      state.articleFavorites.push({
        id: state.articleFavorites.length + 1,
        user_id: Number(userId),
        article_id: articleId,
        created_at: now()
      })
      return { favorited: true }
    },

    async getDoctorById(id) {
      return clone(state.doctors.find((doctor) => doctor.id === Number(id)) || null)
    },

    async listDoctors() {
      const seededDoctors = state.doctors.length > 0
        ? state.doctors
        : [
            {
              id: 1,
              name: '赵晓峰',
              title: '主任医师',
              department: '内分泌科',
              specialty: '糖尿病综合管理',
              intro: '擅长糖尿病风险评估、用药随访和生活方式干预。',
              online_status: 'online',
              consult_status: 'online',
              display_status: 'published',
              sort_order: 1
            },
            {
              id: 2,
              name: '孙雅琴',
              title: '副主任医师',
              department: '内分泌科',
              specialty: '妊娠糖尿病与饮食管理',
              intro: '关注女性代谢健康和个体化饮食建议。',
              online_status: 'online',
              consult_status: 'online',
              display_status: 'published',
              sort_order: 2
            }
          ]

      return clone(seededDoctors)
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
    },

    async getCheckinRecords() {
      return []
    },

    async getCheckinAnalysis() {
      return {
        period_days: 7,
        completion_rate: 78,
        completed_count: 11,
        expected_count: 14,
        evaluation: '您的饮食和运动打卡完成情况良好，尤其是在运动方面表现突出。',
        advice: '继续保持良好的饮食和运动习惯，注意饮食多样性和运动适度。'
      }
    },

    async createConsultationOrder(input) {
      const order = {
        id: counters.consultations,
        ...input,
        status: 'waiting_admin',
        priority: input.priority || 'normal',
        created_at: now(),
        updated_at: now()
      }
      counters.consultations += 1
      state.consultations.push(order)
      return clone(order)
    },

    async listConsultations({ userId = null, status = null } = {}) {
      return clone(state.consultations.filter((item) => (
        (userId === null || item.user_id === Number(userId)) &&
        (status === null || item.status === status)
      )))
    },

    async auditLog(input) {
      const item = {
        id: counters.auditLogs,
        ...input,
        created_at: now()
      }
      counters.auditLogs += 1
      state.auditLogs.push(item)
      return clone(item)
    },

    async listAdminUsers() {
      return {
        items: clone(state.users.map((user) => ({
          id: user.id,
          username: user.username,
          phone: user.phone,
          email: user.email,
          role: user.role,
          status: user.status,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          last_login_at: user.last_login_at || null,
          created_at: user.created_at,
          updated_at: user.updated_at
        }))),
        total: state.users.length,
        page: 1,
        pageSize: 20
      }
    },

    async updateUserStatus(id, status) {
      const user = state.users.find((item) => item.id === Number(id))
      const before = clone(user)
      if (user) {
        user.status = status
        user.updated_at = now()
      }
      return { before, after: clone(user) }
    },

    async listAdminArticles({ page = 1, pageSize = 20 } = {}) {
      const recommendations = await this.getArticleRecommendations({ page, pageSize })
      return recommendations
    },

    async getAdminArticle(id) {
      const article = state.articles.find((item) => String(item.id) === String(id))
      return clone(article || null)
    },

    async createAdminArticle(input) {
      const item = {
        id: counters.articles,
        category_id: input.category_id || null,
        title: input.title,
        summary: input.summary || '',
        content: input.content || input.content_md || '',
        cover_url: input.cover_url || '',
        tags: input.tags || [],
        author: input.author || '',
        status: input.status || 'draft',
        audit_status: input.audit_status || 'approved',
        recommend_weight: input.recommend_weight || 0,
        view_count: 0,
        like_count: 0,
        favorite_count: 0,
        created_at: now(),
        updated_at: now()
      }
      counters.articles += 1
      state.articles.push(item)
      return clone(item)
    },

    async updateAdminArticle(id, input) {
      const item = state.articles.find((article) => String(article.id) === String(id))
      const before = clone(item)
      if (!item) {
        throw errors.notFound('文章不存在')
      }
      Object.assign(item, input, { updated_at: now() })
      return { before, after: clone(item) }
    },

    async deleteAdminArticle(id) {
      const index = state.articles.findIndex((article) => String(article.id) === String(id))
      const before = index >= 0 ? clone(state.articles[index]) : null
      if (index >= 0) {
        state.articles.splice(index, 1)
      }
      return { before, after: null }
    },

    async setArticleStatus(id, status) {
      return this.updateAdminArticle(id, { status })
    },

    async listArticleCategories() {
      return clone(state.categories)
    },

    async createArticleCategory(input) {
      const item = {
        id: counters.categories,
        name: input.name,
        code: input.code || null,
        sort_order: input.sort_order || 0,
        status: input.status || 'published'
      }
      counters.categories += 1
      state.categories.push(item)
      return clone(item)
    },

    async updateArticleCategory(id, input) {
      const item = state.categories.find((category) => category.id === Number(id))
      const before = clone(item)
      if (item) Object.assign(item, input)
      return { before, after: clone(item) }
    },

    async deleteArticleCategory(id) {
      const index = state.categories.findIndex((category) => category.id === Number(id))
      const before = index >= 0 ? clone(state.categories[index]) : null
      if (index >= 0) state.categories.splice(index, 1)
      return { before, after: null }
    },

    async listAdminDoctors() {
      const items = await this.listDoctors()
      return { items, total: items.length, page: 1, pageSize: 20 }
    },

    async createAdminDoctor(input) {
      const item = {
        id: counters.doctors,
        name: input.name,
        title: input.title || '',
        department: input.department || '',
        specialty: input.specialty || '',
        intro: input.intro || '',
        avatar_url: input.avatar_url || '',
        license_no: input.license_no || '',
        online_status: input.online_status || 'online',
        consult_status: input.consult_status || 'online',
        display_status: input.display_status || 'published',
        audit_status: input.audit_status || 'approved',
        sort_order: input.sort_order || 0,
        created_at: now(),
        updated_at: now()
      }
      counters.doctors += 1
      state.doctors.push(item)
      return clone(item)
    },

    async updateAdminDoctor(id, input) {
      const item = state.doctors.find((doctor) => doctor.id === Number(id))
      const before = clone(item)
      if (!item) throw errors.notFound('医生不存在')
      Object.assign(item, input, { updated_at: now() })
      return { before, after: clone(item) }
    },

    async deleteAdminDoctor(id) {
      const index = state.doctors.findIndex((doctor) => doctor.id === Number(id))
      const before = index >= 0 ? clone(state.doctors[index]) : null
      if (index >= 0) state.doctors.splice(index, 1)
      return { before, after: null }
    },

    async listDifyLogs() {
      return { items: clone(state.difyLogs), total: state.difyLogs.length, page: 1, pageSize: 20 }
    },

    async listHomeConfig() {
      return clone([...state.homeConfigs].sort((a, b) => {
        if (a.slot_code === b.slot_code) return a.sort_order - b.sort_order || a.id - b.id
        return a.slot_code.localeCompare(b.slot_code)
      }))
    },

    async replaceHomeConfig(slots = [], adminUserId = null) {
      state.homeConfigs = slots.map((slot) => ({
        id: counters.homeConfigs++,
        slot_code: slot.slot_code,
        target_type: slot.target_type,
        target_id: slot.target_id || null,
        title: slot.title || null,
        sort_order: slot.sort_order || 0,
        status: slot.status || 'active',
        created_by: adminUserId || null,
        created_at: now(),
        updated_at: now()
      }))
      return this.listHomeConfig()
    }
  }
}
