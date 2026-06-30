import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { authMiddleware } from '../auth/auth.js'
import { errors } from '../../http/errors.js'
import {
  canGenerateHealthReminders,
  isScopeAuthorized,
} from '../privacy/authorization.js'

const articleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
})

const articleCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parent_id: z.union([z.number().int(), z.string(), z.null()]).optional()
})

const checkinSchema = z.object({
  type: z.enum(['diet', 'exercise', 'water', 'sleep', 'glucose', 'review']).default('review'),
  value: z.union([z.number(), z.string()]).optional(),
  unit: z.string().max(32).optional(),
  recorded_at: z.string().optional(),
  detail_text: z.string().max(500).optional()
})

function calculateProfileCompletion(profile) {
  if (!profile) {
    return 0
  }

  const fields = [
    'gender',
    'age_snapshot',
    'height_cm',
    'weight_kg',
    'waist_cm',
    'sbp_mm_hg',
    'family_history_diabetes'
  ]
  const completed = fields.filter((field) => (
    profile[field] !== null &&
    profile[field] !== undefined &&
    profile[field] !== ''
  )).length

  return Math.round((completed / fields.length) * 100)
}

function normalizeArticle(article) {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary || article.content || '',
    content: article.content || article.content_md || '',
    category: article.category_name || article.category || article.tag || '健康资讯',
    read_time: article.read_time || '3 分钟阅读',
    published_at: article.published_at || article.created_at || null,
    cover_url: article.cover_url || '',
    view_count: article.view_count || article.views || 0,
    like_count: article.like_count || article.likes || 0,
    favorite_count: article.favorite_count || article.saves || 0,
    favorited: Boolean(article.favorited)
  }
}

function buildGeneratedMessages({ profile, latestRisk, plan }) {
  const now = new Date().toISOString()
  const messages = []
  const completionRate = calculateProfileCompletion(profile)

  if (completionRate < 100) {
    messages.push({
      message_key: 'profile-completion',
      id: 'profile-completion',
      type: 'archive',
      group: 'service',
      title: '健康档案待完善',
      content: '补齐腰围、血压和家族史后，可以得到更准确的风险评估。',
      tag: '档案',
      route: 'healthArchive',
      time: now,
      read: false
    })
  }

  if (latestRisk) {
    messages.push({
      message_key: `risk-${latestRisk.id}`,
      id: `risk-${latestRisk.id}`,
      type: 'risk',
      group: 'service',
      title: latestRisk.risk_level === 'high' ? '风险评估提示：高风险' : '风险评估已完成',
      content: latestRisk.advice_summary || '可以查看最近一次风险评估结果和生活建议。',
      tag: '评估',
      route: 'health',
      time: latestRisk.created_at || now,
      read: true
    })
  }

  messages.push({
    message_key: 'daily-plan',
    id: 'daily-plan',
    type: 'plan',
    group: 'reminder',
    title: plan ? '今日生活方案待打卡' : '可以生成你的生活方案',
    content: plan
      ? '完成饮食、运动、睡眠等任务后，后续建议会更贴近你的真实节奏。'
      : '完善档案并完成风险评估后，可以开始每日生活管理。',
    tag: '方案',
    route: 'plan',
    time: now,
    read: false
  })

  messages.push({
    message_key: 'assistant-ready',
    id: 'assistant-ready',
    type: 'assistant',
    group: 'assistant',
    title: '糖尿病助手已接入',
    content: '可以继续咨询饮食、风险解释、复查清单和报告解读。',
    tag: '助手',
    route: 'assistant',
    time: now,
    read: true
  })

  return messages
}

function buildGenericMessages() {
  const now = new Date().toISOString()

  return [{
    message_key: 'assistant-ready-generic',
    id: 'assistant-ready-generic',
    type: 'assistant',
    group: 'assistant',
    title: '通用健康助手仍可使用',
    content: '你可以继续咨询通用问题；若需个性化建议，可在授权设置中重新开启对应范围。',
    tag: '助手',
    route: 'assistant',
    time: now,
    read: true,
  }]
}

function normalizeSystemMessage(message) {
  const type = message.type || 'system'
  const group = type === 'assistant'
    ? 'assistant'
    : ['plan', 'consultation'].includes(type)
      ? 'reminder'
      : 'service'

  return {
    id: message.id,
    message_key: message.message_key || '',
    type,
    group,
    title: message.title,
    content: message.content || '',
    tag: group === 'assistant' ? '助手' : group === 'reminder' ? '提醒' : '服务',
    route: message.route_name || '',
    time: message.updated_at || message.created_at,
    read: Boolean(message.read_at),
    payload: message.payload || {}
  }
}

function normalizeArticleComment(comment) {
  return {
    id: comment.id,
    article_id: comment.article_id,
    parent_id: comment.parent_id || null,
    user: comment.nickname || comment.username || '用户',
    content: comment.content,
    like_count: Number(comment.like_count || 0),
    liked: Boolean(comment.liked),
    created_at: comment.created_at
  }
}

export function registerContentRoutes(router, deps) {
  const auth = authMiddleware(deps)

  router.get('/home/summary', auth, asyncHandler(async (req, res) => {
    const [user, privacySettings, profileResponse, latestRisk, summary, plan] = await Promise.all([
      deps.store.findUserById(req.user.id),
      deps.store.getPrivacySettings?.(req.user.id),
      deps.store.getProfile(req.user.id),
      deps.store.getLatestRisk(req.user.id),
      deps.store.getHomeSummary?.() || Promise.resolve({ doctors: [], articles: [], diabetesTypes: [] }),
      deps.store.getActivePlan(req.user.id),
    ])
    const profile = profileResponse || null
    const completionRate = calculateProfileCompletion(profile)

    sendOk(res, {
      user,
      profile: {
        ...profile,
        completed: completionRate === 100,
        completion_rate: completionRate
      },
      latest_risk: latestRisk,
      today_measurements: {
        fasting_glucose: profile?.fasting_glucose ?? profile?.lifestyle?.fasting_glucose ?? null,
        postprandial_glucose: profile?.postprandial_glucose ?? profile?.lifestyle?.postprandial_glucose ?? null,
        weight_kg: profile?.weight_kg ?? null
      },
      today_tasks: [
        {
          id: 'archive',
          title: completionRate === 100 ? '健康档案已完善' : '完善健康档案',
          desc: completionRate === 100 ? '基础资料已可用于评估。' : '补齐身高体重、腰围、血压和家族史。',
          tag: completionRate === 100 ? '已完成' : `完成 ${completionRate}%`,
          action_label: completionRate === 100 ? '查看' : '去完善',
          completed: completionRate === 100
        },
        {
          id: 'plan',
          title: plan ? '完成今日生活方案' : '生成生活方案',
          desc: plan ? '饮食、运动、睡眠任务等你打卡。' : '根据档案和风险评估生成每日任务。',
          tag: plan ? '待打卡' : '可选',
          action_label: plan ? '去打卡' : '去生成',
          completed: false
        }
      ],
      hot_articles: (summary?.articles || []).map(normalizeArticle),
      recommended_doctors: summary?.doctors || [],
      diabetes_types: summary?.diabetesTypes || [],
      health_reminder_enabled: canGenerateHealthReminders(privacySettings),
    })
  }))

  router.get('/diabetes-types', asyncHandler(async (_req, res) => {
    sendOk(res, {
      items: await deps.store.listDiabetesTypes?.({ publishedOnly: true }) || []
    })
  }))

  router.get('/articles', validate(articleQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query
    const authorization = req.user?.id
      ? await deps.store.getDataAuthorization?.(req.user.id)
      : null
    const result = await deps.store.getArticleRecommendations({
      ...query,
      userId: req.user?.id || null,
      personalized: isScopeAuthorized(authorization, 'news'),
    })
    const items = Array.isArray(result) ? result : result.items

    sendOk(res, {
      items: items.map(normalizeArticle),
      total: result.total ?? items.length,
      page: result.page ?? query.page,
      pageSize: result.pageSize ?? query.pageSize
    })
  }))

  router.get('/articles/favorites', auth, validate(articleQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query
    const result = await deps.store.getArticleRecommendations({
      ...query,
      userId: req.user.id,
      personalized: true,
    })
    const items = (Array.isArray(result) ? result : result.items).filter((item) => item.favorited)

    sendOk(res, {
      items: items.map(normalizeArticle),
      total: items.length,
      page: query.page,
      pageSize: query.pageSize
    })
  }))

  router.get('/articles/:id', asyncHandler(async (req, res) => {
    const article = await deps.store.getArticleById?.(req.params.id, {
      userId: req.user?.id || null,
      ipAddress: req.ip || req.socket?.remoteAddress || ''
    })

    if (!article) {
      throw errors.notFound('文章不存在')
    }

    sendOk(res, normalizeArticle(article))
  }))

  router.post('/articles/:id/favorite', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.toggleArticleFavorite(req.user.id, req.params.id))
  }))

  router.post('/articles/:id/like', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.toggleArticleLike?.(req.user.id, req.params.id))
  }))

  router.get('/articles/:id/comments', asyncHandler(async (req, res) => {
    const comments = await deps.store.listArticleComments?.(req.params.id, {
      userId: req.user?.id || null
    }) || []
    sendOk(res, { items: comments.map(normalizeArticleComment) })
  }))

  router.post('/articles/:id/comments', auth, validate(articleCommentSchema), asyncHandler(async (req, res) => {
    const created = await deps.store.createArticleComment?.(req.user.id, req.params.id, req.body)
    const comments = await deps.store.listArticleComments?.(req.params.id, {
      userId: req.user.id
    }) || []
    const target = comments.find((item) => Number(item.id) === Number(created?.id))
    sendOk(res, normalizeArticleComment(target || created))
  }))

  router.post('/articles/:id/comments/:commentId/like', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.toggleArticleCommentLike?.(req.user.id, req.params.commentId))
  }))

  router.get('/doctors', asyncHandler(async (_req, res) => {
    sendOk(res, {
      items: await deps.store.listDoctors?.({ publishedOnly: true }) || []
    })
  }))

  router.get('/doctors/:id', asyncHandler(async (req, res) => {
    const doctor = await deps.store.getDoctorById(req.params.id)

    if (!doctor) {
      throw errors.notFound('医生不存在')
    }

    sendOk(res, doctor)
  }))

  router.get('/plans/active', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.getActivePlan(req.user.id))
  }))

  router.post('/checkins', auth, validate(checkinSchema), asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.createCheckin(req.user.id, req.body))
  }))

  router.get('/checkins', auth, asyncHandler(async (req, res) => {
    sendOk(res, {
      items: await deps.store.getCheckinRecords?.(req.user.id, {
        days: Number(req.query.days || 7)
      }) || []
    })
  }))

  router.get('/checkins/analysis', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.getCheckinAnalysis(req.user.id))
  }))

  router.get('/consultations', auth, asyncHandler(async (req, res) => {
    sendOk(res, {
      items: await deps.store.listConsultations?.({ userId: req.user.id }) || []
    })
  }))

  router.get('/messages', auth, asyncHandler(async (req, res) => {
    const [privacySettings, profile, latestRisk, plan] = await Promise.all([
      deps.store.getPrivacySettings?.(req.user.id),
      deps.store.getProfile(req.user.id),
      deps.store.getLatestRisk(req.user.id),
      deps.store.getActivePlan(req.user.id),
    ])

    const generated = canGenerateHealthReminders(privacySettings)
      ? buildGeneratedMessages({
          profile,
          latestRisk,
          plan,
        })
      : buildGenericMessages()
    await Promise.all(generated.map((item) => (
      deps.store.upsertSystemMessage?.(req.user.id, {
        message_key: item.message_key,
        type: item.type,
        title: item.title,
        content: item.content,
        route_name: item.route,
        payload: {
          group: item.group,
          tag: item.tag
        }
      })
    )))
    const messages = await deps.store.listSystemMessages?.(req.user.id) || []

    sendOk(res, {
      list: messages.map(normalizeSystemMessage)
    })
  }))

  router.post('/messages/read-all', auth, asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.markAllSystemMessagesRead?.(req.user.id))
  }))
}
