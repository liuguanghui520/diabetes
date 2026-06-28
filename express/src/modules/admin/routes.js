import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { errors } from '../../http/errors.js'
import { adminMiddleware } from '../auth/auth.js'

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  keyword: z.string().optional()
})

const articleSchema = z.object({
  category_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  content: z.string().optional(),
  content_md: z.string().optional(),
  content_html: z.string().optional(),
  cover_url: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().max(64).optional(),
  audit_status: z.enum(['pending_review', 'approved', 'rejected']).default('approved'),
  status: z.enum(['draft', 'published', 'offline']).default('draft'),
  recommend_weight: z.coerce.number().int().default(0)
})

const categorySchema = z.object({
  name: z.string().min(1).max(64),
  code: z.string().max(64).optional(),
  sort_order: z.coerce.number().int().default(0),
  status: z.enum(['published', 'hidden']).default('published')
})

const doctorSchema = z.object({
  user_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
  name: z.string().min(1).max(64),
  title: z.string().max(64).optional(),
  department: z.string().max(64).optional(),
  specialty: z.string().max(255).optional(),
  intro: z.string().optional(),
  avatar_url: z.string().max(500).optional(),
  license_no: z.string().max(128).optional(),
  profile_md: z.string().optional(),
  online_status: z.enum(['online', 'offline']).default('online'),
  consult_status: z.enum(['online', 'offline', 'paused']).default('online'),
  display_status: z.enum(['published', 'hidden']).default('published'),
  audit_status: z.enum(['pending_review', 'approved', 'rejected']).default('approved'),
  sort_order: z.coerce.number().int().default(0)
})

const userStatusSchema = z.object({
  status: z.enum(['active', 'disabled', 'locked'])
})

const homeConfigSchema = z.object({
  slots: z.array(z.object({
    slot_code: z.enum(['home_banner', 'hot_articles', 'recommended_doctors']),
    target_type: z.enum(['article', 'doctor', 'diabetes_type']),
    target_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
    title: z.string().max(128).optional(),
    sort_order: z.coerce.number().int().default(0),
    status: z.enum(['active', 'hidden']).default('active')
  })).default([])
})

function adminAuth(deps) {
  return adminMiddleware(deps)
}

async function logAdmin(req, deps, action, targetType, targetId, beforeJson, afterJson) {
  await deps.store.auditLog?.({
    admin_user_id: req.user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    before_json: beforeJson,
    after_json: afterJson,
    ip_address: req.ip || req.socket?.remoteAddress || '',
    user_agent: req.header('User-Agent') || ''
  })
}

function unwrapChange(change) {
  return change?.after !== undefined ? change.after : change
}

export function registerAdminRoutes(router, deps) {
  const auth = adminAuth(deps)

  router.get('/admin/dashboard', auth, asyncHandler(async (_req, res) => {
    const [users, articles, doctors, consultations, logs] = await Promise.all([
      deps.store.listAdminUsers?.({ page: 1, pageSize: 1 }),
      deps.store.listAdminArticles?.({ page: 1, pageSize: 1 }),
      deps.store.listAdminDoctors?.({ page: 1, pageSize: 1 }),
      deps.store.listConsultations?.({}),
      deps.store.listDifyLogs?.({ page: 1, pageSize: 5 })
    ])

    sendOk(res, {
      users: users?.total || 0,
      articles: articles?.total || 0,
      doctors: doctors?.total || 0,
      consultations: consultations?.length || 0,
      latest_logs: logs?.items || []
    })
  }))

  router.get('/admin/articles', auth, validate(pageQuerySchema, 'query'), asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.listAdminArticles(req.validatedQuery))
  }))

  router.post('/admin/articles', auth, validate(articleSchema), asyncHandler(async (req, res) => {
    const article = await deps.store.createAdminArticle({
      ...req.body,
      author_user_id: req.user.id
    })
    await logAdmin(req, deps, 'article.create', 'article', article.id, null, article)
    sendOk(res, article)
  }))

  router.get('/admin/articles/:id', auth, asyncHandler(async (req, res) => {
    const article = await deps.store.getAdminArticle(req.params.id)
    if (!article) throw errors.notFound('文章不存在')
    sendOk(res, article)
  }))

  router.put('/admin/articles/:id', auth, validate(articleSchema), asyncHandler(async (req, res) => {
    const change = await deps.store.updateAdminArticle(req.params.id, req.body)
    await logAdmin(req, deps, 'article.update', 'article', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.delete('/admin/articles/:id', auth, asyncHandler(async (req, res) => {
    const change = await deps.store.deleteAdminArticle(req.params.id)
    await logAdmin(req, deps, 'article.delete', 'article', req.params.id, change.before, change.after)
    sendOk(res, { deleted: true })
  }))

  router.post('/admin/articles/:id/publish', auth, asyncHandler(async (req, res) => {
    const change = await deps.store.setArticleStatus(req.params.id, 'published')
    await logAdmin(req, deps, 'article.publish', 'article', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.post('/admin/articles/:id/unpublish', auth, asyncHandler(async (req, res) => {
    const change = await deps.store.setArticleStatus(req.params.id, 'offline')
    await logAdmin(req, deps, 'article.unpublish', 'article', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.get('/admin/article-categories', auth, asyncHandler(async (_req, res) => {
    sendOk(res, { items: await deps.store.listArticleCategories() })
  }))

  router.post('/admin/article-categories', auth, validate(categorySchema), asyncHandler(async (req, res) => {
    const category = await deps.store.createArticleCategory(req.body)
    await logAdmin(req, deps, 'article_category.create', 'article_category', category.id, null, category)
    sendOk(res, category)
  }))

  router.put('/admin/article-categories/:id', auth, validate(categorySchema), asyncHandler(async (req, res) => {
    const change = await deps.store.updateArticleCategory(req.params.id, req.body)
    await logAdmin(req, deps, 'article_category.update', 'article_category', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.delete('/admin/article-categories/:id', auth, asyncHandler(async (req, res) => {
    const change = await deps.store.deleteArticleCategory(req.params.id)
    await logAdmin(req, deps, 'article_category.delete', 'article_category', req.params.id, change.before, change.after)
    sendOk(res, { deleted: true })
  }))

  router.get('/admin/doctors', auth, validate(pageQuerySchema, 'query'), asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.listAdminDoctors(req.validatedQuery))
  }))

  router.post('/admin/doctors', auth, validate(doctorSchema), asyncHandler(async (req, res) => {
    const doctor = await deps.store.createAdminDoctor(req.body)
    await logAdmin(req, deps, 'doctor.create', 'doctor', doctor.id, null, doctor)
    sendOk(res, doctor)
  }))

  router.get('/admin/doctors/:id', auth, asyncHandler(async (req, res) => {
    const doctor = await deps.store.getDoctorById(req.params.id)
    if (!doctor) throw errors.notFound('医生不存在')
    sendOk(res, doctor)
  }))

  router.put('/admin/doctors/:id', auth, validate(doctorSchema), asyncHandler(async (req, res) => {
    const change = await deps.store.updateAdminDoctor(req.params.id, req.body)
    await logAdmin(req, deps, 'doctor.update', 'doctor', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.delete('/admin/doctors/:id', auth, asyncHandler(async (req, res) => {
    const change = await deps.store.deleteAdminDoctor(req.params.id)
    await logAdmin(req, deps, 'doctor.delete', 'doctor', req.params.id, change.before, change.after)
    sendOk(res, { deleted: true })
  }))

  router.post('/admin/doctors/:id/publish', auth, asyncHandler(async (req, res) => {
    const change = await deps.store.updateAdminDoctor(req.params.id, { display_status: 'published' })
    await logAdmin(req, deps, 'doctor.publish', 'doctor', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.post('/admin/doctors/:id/unpublish', auth, asyncHandler(async (req, res) => {
    const change = await deps.store.updateAdminDoctor(req.params.id, { display_status: 'hidden' })
    await logAdmin(req, deps, 'doctor.unpublish', 'doctor', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.get('/admin/users', auth, validate(pageQuerySchema, 'query'), asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.listAdminUsers(req.validatedQuery))
  }))

  router.put('/admin/users/:id/status', auth, validate(userStatusSchema), asyncHandler(async (req, res) => {
    const change = await deps.store.updateUserStatus(req.params.id, req.body.status)
    await logAdmin(req, deps, 'user.status', 'sys_user', req.params.id, change.before, change.after)
    sendOk(res, unwrapChange(change))
  }))

  router.get('/admin/consultations', auth, asyncHandler(async (req, res) => {
    sendOk(res, {
      items: await deps.store.listConsultations({
        status: req.query.status || null
      })
    })
  }))

  router.get('/admin/dify-run-logs', auth, validate(pageQuerySchema, 'query'), asyncHandler(async (req, res) => {
    sendOk(res, await deps.store.listDifyLogs(req.validatedQuery))
  }))

  router.get('/admin/home-config', auth, asyncHandler(async (_req, res) => {
    sendOk(res, {
      slots: await deps.store.listHomeConfig?.() || []
    })
  }))

  router.put('/admin/home-config', auth, validate(homeConfigSchema), asyncHandler(async (req, res) => {
    const before = await deps.store.listHomeConfig?.() || []
    const slots = await deps.store.replaceHomeConfig?.(req.body.slots, req.user.id) || req.body.slots
    await logAdmin(req, deps, 'home_config.update', 'home_operation_config', null, before, slots)
    sendOk(res, { slots })
  }))
}
