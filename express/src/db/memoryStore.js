import { errors } from '../http/errors.js'

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function now() {
  return new Date().toISOString()
}

function todayOnly() {
  return now().slice(0, 10)
}

export function createMemoryStore() {
  const state = {
    users: [],
    profiles: [],
    risks: [],
    conversations: [],
    messages: [],
    difyLogs: [],
    plans: [],
    planTasks: [],
    checkinRecords: [],
    checkinItems: [],
    analysisReports: [],
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
    plans: 1,
    planTasks: 1,
    checkinRecords: 1,
    checkinItems: 1,
    analysisReports: 1,
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

    async updateDifyLog(id, patch = {}) {
      const log = state.difyLogs.find((item) => item.id === Number(id))

      if (!log) {
        throw errors.notFound('Dify 运行日志不存在')
      }

      Object.assign(log, patch)
      return clone(log)
    },

    async getDifyLogByRequestId(userId, requestId) {
      return clone(state.difyLogs
        .filter((log) => (
          log.request_id === requestId &&
          (!userId || log.user_id === Number(userId))
        ))
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0] || null)
    },

    async getUserContext(userId) {
      return {
        profile: await this.getProfile(userId),
        latest_risk: await this.getLatestRisk(userId),
        latest_plan: await this.getActivePlan(userId)
      }
    },

    async getHomeSummary() {
      return {
        doctors: clone(state.doctors),
        articles: clone(state.articles),
        diabetesTypes: clone(state.diabetesTypes)
      }
    },

    async getCheckinSummary(userId, { days = 7 } = {}) {
      const finalDays = Math.max(1, Math.min(Number(days || 7), 31))
      const records = await this.getCheckinRecords(userId, { days: finalDays })
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - (finalDays - 1))
      const items = records.flatMap((record) => (record.items || []).map((item) => ({
        ...item,
        checkin_date: record.checkin_date
      })))
      const byType = items.reduce((acc, item) => {
        const key = item.task_type || item.type || 'review'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})
      const completionTotal = records.reduce((total, record) => (
        total + Number(record.completion_rate || 0)
      ), 0)

      return {
        period: {
          start: startDate.toISOString().slice(0, 10),
          end: today.toISOString().slice(0, 10),
          days: finalDays
        },
        completion_rate: Math.round(completionTotal / finalDays),
        record_count: records.length,
        completed_count: items.length,
        by_type: byType,
        items: clone(items)
      }
    },

    async getArticleRecommendations({ page = 1, pageSize = 20 } = {}) {
      const start = (Number(page) - 1) * Number(pageSize)
      const items = clone(state.articles.slice(start, start + Number(pageSize)))

      return {
        items,
        total: state.articles.length,
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

    async toggleArticleLike(userId, articleId) {
      const article = state.articles.find((item) => String(item.id) === String(articleId))

      if (!article) {
        throw errors.notFound('文章不存在')
      }

      state.articleLikes = state.articleLikes || []
      const index = state.articleLikes.findIndex((item) => (
        item.user_id === Number(userId) && String(item.article_id) === String(articleId)
      ))

      if (index >= 0) {
        state.articleLikes.splice(index, 1)
        article.like_count = Math.max(Number(article.like_count || 0) - 1, 0)
        return { liked: false }
      }

      state.articleLikes.push({
        id: state.articleLikes.length + 1,
        user_id: Number(userId),
        article_id: articleId,
        created_at: now()
      })
      article.like_count = Number(article.like_count || 0) + 1
      return { liked: true }
    },

    async listArticleComments(articleId, { userId = null } = {}) {
      state.articleComments = state.articleComments || []
      state.articleCommentLikes = state.articleCommentLikes || []

      return clone(state.articleComments
        .filter((comment) => String(comment.article_id) === String(articleId) && !comment.deleted_at)
        .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
        .map((comment) => {
          const user = state.users.find((item) => item.id === Number(comment.user_id)) || {}
          return {
            ...comment,
            username: user.username || '',
            nickname: user.nickname || '',
            liked: state.articleCommentLikes.some((item) => (
              item.user_id === Number(userId) && item.comment_id === comment.id
            ))
          }
        }))
    },

    async createArticleComment(userId, articleId, input) {
      state.articleComments = state.articleComments || []
      counters.articleComments = counters.articleComments || 1
      const comment = {
        id: counters.articleComments,
        article_id: Number(articleId),
        user_id: Number(userId),
        parent_id: input.parent_id ? Number(input.parent_id) : null,
        content: input.content,
        like_count: 0,
        created_at: now(),
        updated_at: now(),
        deleted_at: null
      }
      counters.articleComments += 1
      state.articleComments.push(comment)
      return clone(comment)
    },

    async toggleArticleCommentLike(userId, commentId) {
      state.articleCommentLikes = state.articleCommentLikes || []
      const comment = (state.articleComments || []).find((item) => item.id === Number(commentId) && !item.deleted_at)

      if (!comment) {
        throw errors.notFound('评论不存在')
      }

      const index = state.articleCommentLikes.findIndex((item) => (
        item.user_id === Number(userId) && item.comment_id === Number(commentId)
      ))

      if (index >= 0) {
        state.articleCommentLikes.splice(index, 1)
        comment.like_count = Math.max(Number(comment.like_count || 0) - 1, 0)
        comment.updated_at = now()
        return { liked: false }
      }

      state.articleCommentLikes.push({
        id: state.articleCommentLikes.length + 1,
        user_id: Number(userId),
        comment_id: Number(commentId),
        created_at: now()
      })
      comment.like_count = Number(comment.like_count || 0) + 1
      comment.updated_at = now()
      return { liked: true }
    },

    async getDoctorById(id) {
      return clone(state.doctors.find((doctor) => doctor.id === Number(id)) || null)
    },

    async listDoctors({ publishedOnly = true } = {}) {
      const items = publishedOnly
        ? state.doctors.filter((d) => d.display_status === 'published')
        : [...state.doctors]
      return clone(items)
    },

    async listDiabetesTypes() {
      return clone(state.diabetesTypes)
    },

    async getActivePlan(userId) {
      const plan = state.plans
        .filter((item) => item.user_id === Number(userId) && item.status === 'active')
        .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at))[0]

      if (plan) {
        const tasks = state.planTasks
          .filter((task) => task.plan_id === plan.id)
          .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
        return clone({
          ...plan,
          tasks: tasks.map((task) => ({
            ...task,
            category: task.task_type,
            target: [task.target_value, task.unit].filter(Boolean).join('') || task.unit || '1次',
            desc: task.description,
            time: task.target_time
          }))
        })
      }

      return null
    },

    async createPlan(input) {
      if ((input.status || 'active') === 'active') {
        state.plans
          .filter((plan) => plan.user_id === Number(input.user_id) && plan.status === 'active')
          .forEach((plan) => {
            plan.status = 'archived'
            plan.updated_at = now()
          })
      }

      const plan = {
        id: counters.plans,
        user_id: Number(input.user_id),
        risk_assessment_id: input.risk_assessment_id || null,
        title: input.title || '个性化生活方案',
        goal_summary: input.goal_summary || input.summary || '',
        status: input.status || 'active',
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        preferences: input.preferences || {},
        plan_json: input.plan_json || input,
        dify_workflow_run_id: input.dify_workflow_run_id || null,
        created_at: now(),
        updated_at: now()
      }
      counters.plans += 1
      state.plans.push(plan)

      const tasks = (input.tasks || []).map((task, index) => {
        const item = {
          id: counters.planTasks,
          plan_id: plan.id,
          task_type: task.task_type || task.category || 'review',
          title: task.title || '健康管理任务',
          description: task.description || task.desc || task.content || '',
          target_value: task.target_value ?? task.value ?? null,
          unit: task.unit || null,
          target_time: task.target_time || task.time || null,
          weekdays: task.weekdays || null,
          sort_order: task.sort_order ?? index,
          metadata: task.metadata || {},
          created_at: now()
        }
        counters.planTasks += 1
        state.planTasks.push(item)
        return item
      })

      return clone({
        ...plan,
        tasks
      })
    },

    async createCheckin(userId, input) {
      const date = input.recorded_at
        ? new Date(input.recorded_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
      let record = state.checkinRecords.find((item) => (
        item.user_id === Number(userId) && item.checkin_date === date
      ))

      if (!record) {
        record = {
          id: counters.checkinRecords,
          user_id: Number(userId),
          plan_id: input.plan_id || null,
          checkin_date: date,
          completion_rate: 0,
          created_at: now(),
          updated_at: now()
        }
        counters.checkinRecords += 1
        state.checkinRecords.push(record)
      }

      const item = {
        id: counters.checkinItems,
        checkin_record_id: record.id,
        plan_task_id: input.plan_task_id || null,
        task_type: input.type || input.task_type || 'review',
        actual_value: input.value === undefined ? 1 : Number.parseFloat(input.value) || 1,
        unit: input.unit || null,
        status: 'done',
        detail_text: input.detail_text || null,
        metadata: {
          recorded_at: input.recorded_at || null
        },
        created_at: now()
      }
      counters.checkinItems += 1
      state.checkinItems.push(item)
      record.completion_rate = Math.min(100, Math.max(Number(record.completion_rate || 0), 100))
      record.updated_at = now()

      return {
        record: clone(record),
        item: clone(item)
      }
    },

    async savePlanTask(userId, input) {
      let plan = state.plans
        .filter((item) => item.user_id === Number(userId) && item.status === 'active')
        .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at))[0]

      if (!plan) {
        plan = {
          id: counters.plans,
          user_id: Number(userId),
          risk_assessment_id: null,
          title: '我的生活任务',
          goal_summary: '手动维护的日常管理任务',
          status: 'active',
          start_date: todayOnly(),
          end_date: todayOnly(),
          preferences: {},
          plan_json: { source: 'manual' },
          dify_workflow_run_id: null,
          created_at: now(),
          updated_at: now()
        }
        counters.plans += 1
        state.plans.push(plan)
      }

      if (input.id) {
        const task = state.planTasks.find((item) => item.id === Number(input.id) && item.plan_id === plan.id)
        if (!task) {
          throw errors.notFound('任务不存在')
        }
        Object.assign(task, {
          task_type: input.task_type || input.category || task.task_type,
          title: input.title || task.title,
          description: input.description || input.desc || input.content || '',
          target_value: input.target_value ?? input.value ?? task.target_value ?? null,
          unit: input.unit || task.unit || null,
          target_time: input.target_time || input.time || null,
          weekdays: input.weekdays || null,
          metadata: input.metadata || task.metadata || {}
        })
        plan.updated_at = now()
        return clone(task)
      }

      const sortOrder = state.planTasks
        .filter((item) => item.plan_id === plan.id)
        .reduce((max, item) => Math.max(max, Number(item.sort_order || 0)), -1) + 1
      const task = {
        id: counters.planTasks,
        plan_id: plan.id,
        task_type: input.task_type || input.category || 'review',
        title: input.title || '健康管理任务',
        description: input.description || input.desc || input.content || '',
        target_value: input.target_value ?? input.value ?? null,
        unit: input.unit || null,
        target_time: input.target_time || input.time || null,
        weekdays: input.weekdays || null,
        sort_order: input.sort_order ?? sortOrder,
        metadata: input.metadata || {},
        created_at: now()
      }
      counters.planTasks += 1
      state.planTasks.push(task)
      plan.updated_at = now()
      return clone(task)
    },

    async deletePlanTask(userId, taskId) {
      const plan = state.plans.find((item) => item.user_id === Number(userId) && item.status === 'active')
      if (!plan) {
        throw errors.notFound('任务不存在')
      }
      const index = state.planTasks.findIndex((item) => item.id === Number(taskId) && item.plan_id === plan.id)
      if (index < 0) {
        throw errors.notFound('任务不存在')
      }
      state.planTasks.splice(index, 1)
      state.checkinItems = state.checkinItems.filter((item) => item.plan_task_id !== Number(taskId))
      return { deleted: true }
    },

    async listPlanTasks(userId) {
      const plan = state.plans
        .filter((item) => item.user_id === Number(userId) && item.status === 'active')
        .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at))[0]
      if (!plan) {
        return []
      }

      return clone(state.planTasks
        .filter((item) => item.plan_id === plan.id)
        .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id))
    },

    async setPlanTaskCompletion(userId, taskId, completed, input = {}) {
      const plan = state.plans
        .filter((item) => item.user_id === Number(userId) && item.status === 'active')
        .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at))[0]
      const task = state.planTasks.find((item) => item.id === Number(taskId) && item.plan_id === plan?.id)

      if (!task) {
        throw errors.notFound('任务不存在')
      }

      const date = input.checkin_date || todayOnly()
      let record = state.checkinRecords.find((item) => (
        item.user_id === Number(userId) && item.checkin_date === date
      ))

      if (!record) {
        record = {
          id: counters.checkinRecords,
          user_id: Number(userId),
          plan_id: plan.id,
          checkin_date: date,
          completion_rate: 0,
          created_at: now(),
          updated_at: now()
        }
        counters.checkinRecords += 1
        state.checkinRecords.push(record)
      }

      const existingIndex = state.checkinItems.findIndex((item) => (
        item.checkin_record_id === record.id && item.plan_task_id === Number(taskId)
      ))

      if (completed) {
        const item = {
          id: existingIndex >= 0 ? state.checkinItems[existingIndex].id : counters.checkinItems,
          checkin_record_id: record.id,
          plan_task_id: Number(taskId),
          task_type: task.task_type,
          actual_value: input.value === undefined ? 1 : Number.parseFloat(input.value) || 1,
          unit: input.unit || task.unit || null,
          status: 'done',
          detail_text: input.detail_text || task.title,
          metadata: {
            source: input.source || 'plan_task_toggle',
            recorded_at: input.recorded_at || null
          },
          created_at: existingIndex >= 0 ? state.checkinItems[existingIndex].created_at : now()
        }
        if (existingIndex >= 0) {
          state.checkinItems.splice(existingIndex, 1, item)
        } else {
          counters.checkinItems += 1
          state.checkinItems.push(item)
        }
      } else if (existingIndex >= 0) {
        state.checkinItems.splice(existingIndex, 1)
      }

      const total = state.planTasks.filter((item) => item.plan_id === plan.id).length
      const done = state.checkinItems.filter((item) => item.checkin_record_id === record.id && item.status === 'done').length
      record.completion_rate = total > 0 ? Math.round((done / total) * 100) : 0
      record.updated_at = now()

      return {
        task_id: Number(taskId),
        completed,
        checkin_record: clone(record)
      }
    },

    async getCheckinRecords(userId, { days = 7 } = {}) {
      const threshold = new Date()
      threshold.setDate(threshold.getDate() - (Math.max(1, Number(days || 7)) - 1))
      const thresholdText = threshold.toISOString().slice(0, 10)

      return clone(state.checkinRecords
        .filter((record) => (
          record.user_id === Number(userId) && record.checkin_date >= thresholdText
        ))
        .sort((left, right) => right.checkin_date.localeCompare(left.checkin_date))
        .map((record) => ({
          ...record,
          items: state.checkinItems
            .filter((item) => item.checkin_record_id === record.id)
            .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
        })))
    },

    async getCheckinAnalysis(userId) {
      const records = await this.getCheckinRecords(userId, { days: 7 })
      const done = records.reduce((total, record) => total + (record.items?.length || 0), 0)
      const expected = Math.max(done, records.length * 2) || 1
      const completionRate = Math.min(100, Math.round((done / expected) * 100))

      return {
        period_days: 7,
        completion_rate: completionRate,
        completed_count: done,
        expected_count: expected,
        evaluation: `近 7 天完成 ${done} 次打卡。`,
        advice: '请继续按时完成每日打卡任务。'
      }
    },

    async createHealthAnalysisReport(input) {
      const report = {
        id: counters.analysisReports,
        ...input,
        created_at: now()
      }
      counters.analysisReports += 1
      state.analysisReports.push(report)
      return clone(report)
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

    async listSystemMessages(userId) {
      state.systemMessages = state.systemMessages || []
      return clone(state.systemMessages
        .filter((item) => item.user_id === Number(userId))
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at) || right.id - left.id))
    },

    async upsertSystemMessage(userId, input = {}) {
      state.systemMessages = state.systemMessages || []
      counters.systemMessages = counters.systemMessages || 1
      const index = state.systemMessages.findIndex((item) => (
        item.user_id === Number(userId) && item.message_key === (input.message_key || null)
      ))
      const existing = index >= 0 ? state.systemMessages[index] : null
      const item = {
        id: existing?.id || counters.systemMessages,
        user_id: Number(userId),
        message_key: input.message_key || null,
        type: input.type,
        title: input.title,
        content: input.content || null,
        route_name: input.route_name || null,
        payload: input.payload || {},
        read_at: existing?.read_at || input.read_at || null,
        created_at: existing?.created_at || now(),
        updated_at: now()
      }
      if (existing) {
        state.systemMessages.splice(index, 1, item)
      } else {
        counters.systemMessages += 1
        state.systemMessages.push(item)
      }
      return clone(item)
    },

    async markAllSystemMessagesRead(userId) {
      state.systemMessages = state.systemMessages || []
      let updated = 0
      state.systemMessages.forEach((item) => {
        if (item.user_id === Number(userId) && !item.read_at) {
          item.read_at = now()
          item.updated_at = now()
          updated += 1
        }
      })
      return { updated }
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
