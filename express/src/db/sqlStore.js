import { errors } from '../http/errors.js'
import { normalizePlanTask } from '../utils/planTask.js'

function one(result) {
  return result.rows[0] || null
}

async function transaction(pool, handler) {
  const client = await pool.connect()

  try {
    await client.query('begin')
    const result = await handler(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

function todayOnly() {
  return toDateOnly(new Date())
}

async function getOwnedPlanTaskRow(executor, userId, taskId) {
  const result = await executor.query(
    `select pt.*, lp.user_id, lp.status as plan_status
     from plan_task pt
     join lifestyle_plan lp on lp.id = pt.plan_id
     where pt.id = $1 and lp.user_id = $2
     limit 1`,
    [taskId, userId]
  )

  return one(result)
}

async function ensureActivePlanRow(executor, userId) {
  const existing = await executor.query(
    `select * from lifestyle_plan
     where user_id = $1 and status = 'active'
     order by updated_at desc
     limit 1`,
    [userId]
  )
  const plan = one(existing)

  if (plan) {
    return plan
  }

  const result = await executor.query(
    `insert into lifestyle_plan
     (user_id, risk_assessment_id, title, goal_summary, status, start_date,
      end_date, preferences, plan_json, dify_workflow_run_id, created_at, updated_at)
     values
     ($1, null, '我的生活任务', '手动维护的日常管理任务', 'active', current_date,
      current_date + 13, '{}'::jsonb, '{"source":"manual"}'::jsonb, null, current_timestamp, current_timestamp)
     returning *`,
    [userId]
  )

  return one(result)
}

async function refreshCheckinCompletion(executor, recordId, planId) {
  const totalResult = await executor.query(
    `select count(*)::int as total from plan_task where plan_id = $1`,
    [planId]
  )
  const doneResult = await executor.query(
    `select count(*)::int as total
     from checkin_item
     where checkin_record_id = $1 and status = 'done'`,
    [recordId]
  )
  const total = totalResult.rows[0]?.total || 0
  const done = doneResult.rows[0]?.total || 0
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0
  const updated = await executor.query(
    `update checkin_record
     set completion_rate = $2,
         updated_at = current_timestamp
     where id = $1
     returning *`,
    [recordId, completionRate]
  )

  return one(updated)
}

export function createSqlStore(pool) {
  return {
    async findUserByAccount(account) {
      const result = await pool.query(
        `select * from sys_user
         where deleted_at is null and (username = $1 or phone = $1 or email = $1)
         limit 1`,
        [account]
      )
      return one(result)
    },

    async findUserById(id) {
      const result = await pool.query(
        `select * from sys_user where deleted_at is null and id = $1 limit 1`,
        [id]
      )
      return one(result)
    },

    async createUser(input) {
      try {
        const result = await pool.query(
          `insert into sys_user
           (username, phone, email, password_hash, role, status, nickname, created_at, updated_at)
           values ($1, $2, $3, $4, $5, 'active', $6, current_timestamp, current_timestamp)
           returning *`,
          [
            input.username,
            input.phone || null,
            input.email || null,
            input.password_hash,
            input.role || 'user',
            input.nickname || input.username
          ]
        )
        return one(result)
      } catch (error) {
        if (error.code === '23505') {
          throw errors.conflict('用户名、手机号或邮箱已存在')
        }
        throw error
      }
    },

    async updateLastLogin(userId, input = {}) {
      const result = await pool.query(
        `update sys_user
         set last_login_at = current_timestamp,
             last_login_ip = $2,
             updated_at = current_timestamp
         where id = $1
         returning *`,
        [userId, input.last_login_ip || null]
      )
      return one(result)
    },

    async getProfile(userId) {
      const result = await pool.query(
        `select * from user_profile where user_id = $1 limit 1`,
        [userId]
      )
      return one(result)
    },

    async upsertProfile(userId, input) {
      const result = await pool.query(
        `insert into user_profile
         (user_id, gender, birth_date, age_snapshot, height_cm, weight_kg, bmi, waist_cm,
          sbp_mm_hg, dbp_mm_hg, family_history_diabetes, diagnosed_diabetes, diabetes_type,
          past_history, allergy, lifestyle, emergency_contact, emergency_phone, created_at, updated_at)
         values
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14::jsonb, $15, $16::jsonb, $17, $18, current_timestamp, current_timestamp)
         on conflict (user_id) do update set
          gender = excluded.gender,
          birth_date = excluded.birth_date,
          age_snapshot = excluded.age_snapshot,
          height_cm = excluded.height_cm,
          weight_kg = excluded.weight_kg,
          bmi = excluded.bmi,
          waist_cm = excluded.waist_cm,
          sbp_mm_hg = excluded.sbp_mm_hg,
          dbp_mm_hg = excluded.dbp_mm_hg,
          family_history_diabetes = excluded.family_history_diabetes,
          diagnosed_diabetes = excluded.diagnosed_diabetes,
          diabetes_type = excluded.diabetes_type,
          past_history = excluded.past_history,
          allergy = excluded.allergy,
          lifestyle = excluded.lifestyle,
          emergency_contact = excluded.emergency_contact,
          emergency_phone = excluded.emergency_phone,
          updated_at = current_timestamp
         returning *`,
        [
          userId,
          input.gender || null,
          input.birth_date || null,
          input.age_snapshot ?? input.age ?? null,
          input.height_cm ?? null,
          input.weight_kg ?? null,
          input.bmi ?? null,
          input.waist_cm ?? null,
          input.sbp_mm_hg ?? null,
          input.dbp_mm_hg ?? null,
          input.family_history_diabetes ?? null,
          input.diagnosed_diabetes ?? false,
          input.diabetes_type || null,
          JSON.stringify(input.past_history || []),
          input.allergy || null,
          JSON.stringify(input.lifestyle || {}),
          input.emergency_contact || null,
          input.emergency_phone || null
        ]
      )
      return one(result)
    },

    async findRiskByIdempotency(userId, idempotencyKey) {
      const result = await pool.query(
        `select * from risk_assessment where user_id = $1 and idempotency_key = $2 limit 1`,
        [userId, idempotencyKey]
      )
      return one(result)
    },

    async createRiskAssessment(input) {
      const result = await pool.query(
        `insert into risk_assessment
         (user_id, profile_snapshot, diagnosed_diabetes, diabetes_type, score, score_status,
          score_rule_version, missing_fields, risk_level, is_high_risk, score_detail,
          abnormal_indicators, advice_summary, advice_json, status, request_id,
          idempotency_key, dify_workflow_run_id, error_message, created_at)
         values
         ($1, $2::jsonb, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb,
          $12::jsonb, $13, $14::jsonb, $15, $16, $17, $18, $19, current_timestamp)
         returning *`,
        [
          input.user_id,
          JSON.stringify(input.profile_snapshot),
          input.diagnosed_diabetes,
          input.diabetes_type || null,
          input.score ?? null,
          input.score_status,
          input.score_rule_version,
          JSON.stringify(input.missing_fields || []),
          input.risk_level || null,
          input.is_high_risk ?? null,
          JSON.stringify(input.score_detail || {}),
          JSON.stringify(input.abnormal_indicators || []),
          input.advice_summary || null,
          JSON.stringify(input.advice_json || {}),
          input.status,
          input.request_id,
          input.idempotency_key,
          input.dify_workflow_run_id || null,
          input.error_message || null
        ]
      )
      return one(result)
    },

    async updateRiskAssessment(id, patch) {
      const existing = await pool.query(`select * from risk_assessment where id = $1`, [id])
      const risk = one(existing)

      if (!risk) {
        throw errors.notFound('风险评估不存在')
      }

      const next = { ...risk, ...patch }
      const result = await pool.query(
        `update risk_assessment set
          advice_summary = $2,
          advice_json = $3::jsonb,
          status = $4,
          dify_workflow_run_id = $5,
          error_message = $6
         where id = $1
         returning *`,
        [
          id,
          next.advice_summary || null,
          JSON.stringify(next.advice_json || {}),
          next.status,
          next.dify_workflow_run_id || null,
          next.error_message || null
        ]
      )
      return one(result)
    },

    async getLatestRisk(userId) {
      const result = await pool.query(
        `select * from risk_assessment
         where user_id = $1
         order by created_at desc
         limit 1`,
        [userId]
      )
      return one(result)
    },

    async listRisks(userId, { page = 1, pageSize = 10 } = {}) {
      const offset = (page - 1) * pageSize
      const [items, count] = await Promise.all([
        pool.query(
          `select * from risk_assessment
           where user_id = $1
           order by created_at desc
           limit $2 offset $3`,
          [userId, pageSize, offset]
        ),
        pool.query(`select count(*)::int as total from risk_assessment where user_id = $1`, [userId])
      ])

      return {
        items: items.rows,
        total: count.rows[0]?.total || 0,
        page,
        pageSize
      }
    },

    async findConversation(userId, id) {
      const result = await pool.query(
        `select * from ai_conversation
         where id = $1 and user_id = $2 and status = 'active'
         limit 1`,
        [id, userId]
      )
      return one(result)
    },

    async createConversation(input) {
      const result = await pool.query(
        `insert into ai_conversation
         (user_id, app_type, doctor_id, dify_conversation_id, title, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'active', current_timestamp, current_timestamp)
         returning *`,
        [
          input.user_id,
          input.app_type,
          input.doctor_id || null,
          input.dify_conversation_id || null,
          input.title || null
        ]
      )
      return one(result)
    },

    async updateConversation(id, patch) {
      const result = await pool.query(
        `update ai_conversation
         set dify_conversation_id = coalesce($2, dify_conversation_id),
             title = coalesce($3, title),
             updated_at = current_timestamp
         where id = $1
         returning *`,
        [id, patch.dify_conversation_id || null, patch.title || null]
      )
      return one(result)
    },

    async createMessage(input) {
      const result = await pool.query(
        `insert into ai_message
         (conversation_id, role, content, dify_message_id, metadata, created_at)
         values ($1, $2, $3, $4, $5::jsonb, current_timestamp)
         returning *`,
        [
          input.conversation_id,
          input.role,
          input.content,
          input.dify_message_id || null,
          JSON.stringify(input.metadata || {})
        ]
      )
      return one(result)
    },

    async listConversations(userId, appType = 'assistant') {
      const result = await pool.query(
        `select * from ai_conversation
         where user_id = $1 and app_type = $2
         order by updated_at desc`,
        [userId, appType]
      )
      return result.rows
    },

    async listMessages(userId, conversationId) {
      const conversation = await this.findConversation(userId, conversationId)

      if (!conversation) {
        throw errors.notFound('会话不存在')
      }

      const result = await pool.query(
        `select * from ai_message
         where conversation_id = $1
         order by created_at asc`,
        [conversationId]
      )
      return result.rows
    },

    async createDifyLog(input) {
      const result = await pool.query(
        `insert into dify_run_log
         (user_id, app_code, app_type, request_id, workflow_run_id, task_id,
          conversation_id, inputs, outputs, status, elapsed_time, total_tokens,
          error_message, created_at)
         values
         ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, current_timestamp)
         returning *`,
        [
          input.user_id || null,
          input.app_code,
          input.app_type,
          input.request_id || null,
          input.workflow_run_id || null,
          input.task_id || null,
          input.conversation_id || null,
          JSON.stringify(input.inputs || {}),
          JSON.stringify(input.outputs || {}),
          input.status,
          input.elapsed_time || null,
          input.total_tokens || null,
          input.error_message || null
        ]
      )
      return one(result)
    },

    async updateDifyLog(id, patch = {}) {
      const existing = await pool.query(`select * from dify_run_log where id = $1`, [id])
      const log = one(existing)

      if (!log) {
        throw errors.notFound('Dify 运行日志不存在')
      }

      const next = { ...log, ...patch }
      const result = await pool.query(
        `update dify_run_log set
          workflow_run_id = $2,
          task_id = $3,
          conversation_id = $4,
          outputs = $5::jsonb,
          status = $6,
          elapsed_time = $7,
          total_tokens = $8,
          error_message = $9
         where id = $1
         returning *`,
        [
          id,
          next.workflow_run_id || null,
          next.task_id || null,
          next.conversation_id || null,
          JSON.stringify(next.outputs || {}),
          next.status,
          next.elapsed_time || null,
          next.total_tokens || null,
          next.error_message || null
        ]
      )
      return one(result)
    },

    async getDifyLogByRequestId(userId, requestId) {
      const result = await pool.query(
        `select * from dify_run_log
         where request_id = $1 and ($2::bigint is null or user_id = $2)
         order by created_at desc
         limit 1`,
        [requestId, userId || null]
      )
      return one(result)
    },

    async getUserContext(userId) {
      return {
        profile: await this.getProfile(userId),
        latest_risk: await this.getLatestRisk(userId),
        latest_plan: await this.getActivePlan(userId)
      }
    },

    async getHomeSummary() {
      const [doctors, articles, diabetesTypes] = await Promise.all([
        pool.query(`select * from doctor where deleted_at is null and display_status = 'published' order by sort_order asc, id asc limit 10`),
        pool.query(`select * from article where deleted_at is null and status = 'published' order by recommend_weight desc, published_at desc nulls last limit 10`),
        pool.query(`select * from diabetes_type_info where status = 'published' order by sort_order asc, id asc`)
      ])

      return {
        doctors: doctors.rows,
        articles: articles.rows,
        diabetesTypes: diabetesTypes.rows
      }
    },

    async getCheckinSummary(userId, query = {}) {
      const days = Math.max(1, Math.min(Number(query.days || 7), 31))
      const records = await this.getCheckinRecords(userId, { days })
      const today = new Date()
      const start = toDateOnly(addDays(today, -(days - 1)))
      const end = toDateOnly(today)
      const completionTotal = records.reduce((total, record) => (
        total + Number(record.completion_rate || 0)
      ), 0)
      const items = records.flatMap((record) => (record.items || []).map((item) => ({
        ...item,
        checkin_date: record.checkin_date
      })))
      const byType = items.reduce((acc, item) => {
        const key = item.task_type || 'review'
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})

      return {
        period: {
          start,
          end,
          days
        },
        completion_rate: Math.round(completionTotal / days),
        record_count: records.length,
        completed_count: items.length,
        by_type: byType,
        items
      }
    },

    async getArticleRecommendations({ page = 1, pageSize = 20, userId = null } = {}) {
      const limit = Number(pageSize)
      const offset = (Number(page) - 1) * limit
      const [items, count] = await Promise.all([
        pool.query(
        `select
           a.*,
           c.name as category_name,
           exists(
             select 1 from article_favorite af
             where af.article_id = a.id and af.user_id = $3
           ) as favorited
         from article a
         left join article_category c on c.id = a.category_id
         where a.deleted_at is null and a.status = 'published'
         order by recommend_weight desc, published_at desc nulls last
         limit $1 offset $2`,
          [limit, offset, userId]
        ),
        pool.query(`select count(*)::int as total from article where deleted_at is null and status = 'published'`)
      ])

      return {
        items: items.rows,
        total: count.rows[0]?.total || 0,
        page: Number(page),
        pageSize: limit
      }
    },

    async getArticleById(id, { userId = null, ipAddress = '' } = {}) {
      const result = await pool.query(
        `select
           a.*,
           c.name as category_name,
           exists(
             select 1 from article_favorite af
             where af.article_id = a.id and af.user_id = $2
           ) as favorited
         from article a
         left join article_category c on c.id = a.category_id
         where a.id = $1 and a.deleted_at is null and a.status = 'published'
         limit 1`,
        [id, userId]
      )
      const article = one(result)

      if (!article) {
        return null
      }

      await pool.query(
        `insert into article_read_log (user_id, article_id, ip_address, created_at)
         values ($1, $2, $3, current_timestamp)`,
        [userId, id, ipAddress || null]
      )
      await pool.query(
        `update article set view_count = view_count + 1 where id = $1`,
        [id]
      )

      return article
    },

    async toggleArticleFavorite(userId, articleId) {
      const existing = await pool.query(
        `select id from article_favorite where user_id = $1 and article_id = $2 limit 1`,
        [userId, articleId]
      )

      if (one(existing)) {
        await pool.query(
          `delete from article_favorite where user_id = $1 and article_id = $2`,
          [userId, articleId]
        )
        await pool.query(
          `update article
           set favorite_count = greatest(favorite_count - 1, 0)
           where id = $1`,
          [articleId]
        )
        return { favorited: false }
      }

      await pool.query(
        `insert into article_favorite (user_id, article_id, created_at)
         values ($1, $2, current_timestamp)
         on conflict (user_id, article_id) do nothing`,
        [userId, articleId]
      )
      await pool.query(
        `update article set favorite_count = favorite_count + 1 where id = $1`,
        [articleId]
      )
      return { favorited: true }
    },

    async toggleArticleLike(userId, articleId) {
      const existing = await pool.query(
        `select id from article_like where user_id = $1 and article_id = $2 limit 1`,
        [userId, articleId]
      )

      if (one(existing)) {
        await pool.query(
          `delete from article_like where user_id = $1 and article_id = $2`,
          [userId, articleId]
        )
        await pool.query(
          `update article
           set like_count = greatest(like_count - 1, 0)
           where id = $1`,
          [articleId]
        )
        return { liked: false }
      }

      await pool.query(
        `insert into article_like (user_id, article_id, created_at)
         values ($1, $2, current_timestamp)
         on conflict (user_id, article_id) do nothing`,
        [userId, articleId]
      )
      await pool.query(
        `update article set like_count = like_count + 1 where id = $1`,
        [articleId]
      )
      return { liked: true }
    },

    async listArticleComments(articleId, { userId = null } = {}) {
      const result = await pool.query(
        `select
           c.id,
           c.article_id,
           c.user_id,
           c.parent_id,
           c.content,
           c.like_count,
           c.created_at,
           u.nickname,
           u.username,
           exists(
             select 1 from article_comment_like acl
             where acl.comment_id = c.id and acl.user_id = $2
           ) as liked
         from article_comment c
         join sys_user u on u.id = c.user_id
         where c.article_id = $1 and c.deleted_at is null
         order by c.created_at asc`,
        [articleId, userId]
      )
      return result.rows
    },

    async createArticleComment(userId, articleId, input) {
      const result = await pool.query(
        `insert into article_comment
         (article_id, user_id, parent_id, content, created_at, updated_at)
         values ($1, $2, $3, $4, current_timestamp, current_timestamp)
         returning *`,
        [
          articleId,
          userId,
          input.parent_id || null,
          input.content
        ]
      )
      return one(result)
    },

    async toggleArticleCommentLike(userId, commentId) {
      const existing = await pool.query(
        `select id from article_comment_like where user_id = $1 and comment_id = $2 limit 1`,
        [userId, commentId]
      )

      if (one(existing)) {
        await pool.query(
          `delete from article_comment_like where user_id = $1 and comment_id = $2`,
          [userId, commentId]
        )
        await pool.query(
          `update article_comment
           set like_count = greatest(like_count - 1, 0),
               updated_at = current_timestamp
           where id = $1`,
          [commentId]
        )
        return { liked: false }
      }

      await pool.query(
        `insert into article_comment_like (user_id, comment_id, created_at)
         values ($1, $2, current_timestamp)
         on conflict (user_id, comment_id) do nothing`,
        [userId, commentId]
      )
      await pool.query(
        `update article_comment
         set like_count = like_count + 1,
             updated_at = current_timestamp
         where id = $1`,
        [commentId]
      )
      return { liked: true }
    },

    async getDoctorById(id) {
      const result = await pool.query(
        `select * from doctor where id = $1 and deleted_at is null limit 1`,
        [id]
      )
      return one(result)
    },

    async listDoctors({ publishedOnly = true } = {}) {
      const result = await pool.query(
        `select * from doctor
         where deleted_at is null
           and ($1 = false or display_status = 'published')
         order by sort_order asc, id asc`,
        [publishedOnly]
      )
      return result.rows
    },

    async listDiabetesTypes({ publishedOnly = true } = {}) {
      const result = await pool.query(
        `select * from diabetes_type_info
         where ($1 = false or status = 'published')
         order by sort_order asc, id asc`,
        [publishedOnly]
      )
      return result.rows
    },

    async getActivePlan(userId) {
      const planResult = await pool.query(
        `select * from lifestyle_plan
         where user_id = $1 and status = 'active'
         order by updated_at desc
         limit 1`,
        [userId]
      )
      const plan = one(planResult)

      if (!plan) {
        return null
      }

      const taskResult = await pool.query(
        `select
          id,
          task_type,
          title,
          description as desc,
          target_value,
          unit,
          target_time as time,
          weekdays,
          metadata
         from plan_task
         where plan_id = $1
         order by sort_order asc, id asc`,
        [plan.id]
      )

      return {
        ...plan,
        tasks: taskResult.rows.map((task) => ({
          ...task,
          category: task.task_type,
          target: [task.target_value, task.unit].filter(Boolean).join('') || task.unit || '1次',
          completed: false
        }))
      }
    },

    async createPlan(input) {
      const tasks = Array.isArray(input.tasks) ? input.tasks : []

      return transaction(pool, async (client) => {
        if (input.status === 'active') {
          await client.query(
            `update lifestyle_plan
             set status = 'archived', updated_at = current_timestamp
             where user_id = $1 and status = 'active'`,
            [input.user_id]
          )
        }

        const planResult = await client.query(
          `insert into lifestyle_plan
           (user_id, risk_assessment_id, title, goal_summary, status, start_date,
            end_date, preferences, plan_json, dify_workflow_run_id, created_at, updated_at)
           values
           ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, current_timestamp, current_timestamp)
           returning *`,
          [
            input.user_id,
            input.risk_assessment_id || null,
            input.title || '个性化生活方案',
            input.goal_summary || input.summary || null,
            input.status || 'active',
            input.start_date || null,
            input.end_date || null,
            JSON.stringify(input.preferences || {}),
            JSON.stringify(input.plan_json || input),
            input.dify_workflow_run_id || null
          ]
        )
        const plan = one(planResult)
        const insertedTasks = []

        for (const [index, task] of tasks.entries()) {
          const normalized = normalizePlanTask(task, index)
          const taskResult = await client.query(
            `insert into plan_task
             (plan_id, task_type, title, description, target_value, unit, target_time,
              weekdays, sort_order, metadata, created_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, current_timestamp)
             returning *`,
            [
              plan.id,
              normalized.task_type,
              normalized.title,
              normalized.description,
              normalized.target_value,
              normalized.unit,
              normalized.target_time,
              normalized.weekdays,
              normalized.sort_order,
              JSON.stringify(normalized.metadata || {})
            ]
          )
          insertedTasks.push(one(taskResult))
        }

        return {
          ...plan,
          tasks: insertedTasks
        }
      })
    },

    async createCheckin(userId, input) {
      const date = input.recorded_at
        ? new Date(input.recorded_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)

      const record = await pool.query(
        `insert into checkin_record
         (user_id, checkin_date, completion_rate, created_at, updated_at)
         values ($1, $2, 100, current_timestamp, current_timestamp)
         on conflict (user_id, checkin_date) do update set
          completion_rate = greatest(checkin_record.completion_rate, excluded.completion_rate),
          updated_at = current_timestamp
         returning *`,
        [userId, date]
      )
      const checkinRecord = one(record)
      const item = await pool.query(
        `insert into checkin_item
         (checkin_record_id, task_type, actual_value, unit, status, detail_text, metadata, created_at)
         values ($1, $2, $3, $4, 'done', $5, $6::jsonb, current_timestamp)
         returning *`,
        [
          checkinRecord.id,
          input.type,
          input.value === undefined ? 1 : Number.parseFloat(input.value) || 1,
          input.unit || null,
          input.detail_text || null,
          JSON.stringify({
            recorded_at: input.recorded_at || null
          })
        ]
      )

      return {
        record: checkinRecord,
        item: one(item)
      }
    },

    async savePlanTask(userId, input) {
      return transaction(pool, async (client) => {
        const plan = await ensureActivePlanRow(client, userId)

        if (input.id) {
          const owned = await getOwnedPlanTaskRow(client, userId, input.id)

          if (!owned) {
            throw errors.notFound('任务不存在')
          }

          const normalized = normalizePlanTask(input, owned.sort_order || 0, { emptyTimeFallback: '' })
          const result = await client.query(
            `update plan_task set
              task_type = $2,
              title = $3,
              description = $4,
              target_value = $5,
              unit = $6,
              target_time = $7,
              weekdays = $8,
              metadata = $9::jsonb
             where id = $1
             returning *`,
            [
              input.id,
              normalized.task_type,
              normalized.title,
              normalized.description,
              normalized.target_value,
              normalized.unit,
              normalized.target_time,
              normalized.weekdays,
              JSON.stringify(normalized.metadata || {})
            ]
          )
          return one(result)
        }

        const maxSort = await client.query(
          `select coalesce(max(sort_order), -1) as value
           from plan_task
           where plan_id = $1`,
          [plan.id]
        )
        const normalized = normalizePlanTask(input, Number(maxSort.rows[0]?.value || -1) + 1, { emptyTimeFallback: '' })
        const result = await client.query(
          `insert into plan_task
           (plan_id, task_type, title, description, target_value, unit, target_time,
            weekdays, sort_order, metadata, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, current_timestamp)
           returning *`,
          [
            plan.id,
            normalized.task_type,
            normalized.title,
            normalized.description,
            normalized.target_value,
            normalized.unit,
            normalized.target_time,
            normalized.weekdays,
            normalized.sort_order,
            JSON.stringify(normalized.metadata || {})
          ]
        )

        return one(result)
      })
    },

    async deletePlanTask(userId, taskId) {
      return transaction(pool, async (client) => {
        const owned = await getOwnedPlanTaskRow(client, userId, taskId)

        if (!owned) {
          throw errors.notFound('任务不存在')
        }

        await client.query(`delete from plan_task where id = $1`, [taskId])
        await client.query(
          `delete from checkin_item
           where plan_task_id = $1`,
          [taskId]
        )

        return { deleted: true }
      })
    },

    async listPlanTasks(userId) {
      const result = await pool.query(
        `select
           pt.*,
           lp.status as plan_status
         from plan_task pt
         join lifestyle_plan lp on lp.id = pt.plan_id
         where lp.user_id = $1 and lp.status = 'active'
         order by pt.sort_order asc, pt.id asc`,
        [userId]
      )

      return result.rows
    },

    async setPlanTaskCompletion(userId, taskId, completed, input = {}) {
      return transaction(pool, async (client) => {
        const task = await getOwnedPlanTaskRow(client, userId, taskId)

        if (!task) {
          throw errors.notFound('任务不存在')
        }

        const date = input.checkin_date || todayOnly()
        let record = one(await client.query(
          `select * from checkin_record
           where user_id = $1 and checkin_date = $2
           limit 1`,
          [userId, date]
        ))

        if (!record) {
          const inserted = await client.query(
            `insert into checkin_record
             (user_id, plan_id, checkin_date, completion_rate, created_at, updated_at)
             values ($1, $2, $3, 0, current_timestamp, current_timestamp)
             returning *`,
            [userId, task.plan_id, date]
          )
          record = one(inserted)
        }

        if (completed) {
          await client.query(
            `insert into checkin_item
             (checkin_record_id, plan_task_id, task_type, actual_value, unit, status, detail_text, metadata, created_at)
             values ($1, $2, $3, $4, $5, 'done', $6, $7::jsonb, current_timestamp)
             on conflict (checkin_record_id, plan_task_id) do update set
               status = 'done',
               actual_value = excluded.actual_value,
               unit = excluded.unit,
               detail_text = excluded.detail_text,
               metadata = excluded.metadata`,
            [
              record.id,
              task.id,
              task.task_type,
              input.value === undefined ? 1 : Number.parseFloat(input.value) || 1,
              input.unit || task.unit || null,
              input.detail_text || task.title,
              JSON.stringify({
                source: input.source || 'plan_task_toggle',
                recorded_at: input.recorded_at || null
              })
            ]
          )
        } else {
          await client.query(
            `delete from checkin_item
             where checkin_record_id = $1 and plan_task_id = $2`,
            [record.id, task.id]
          )
        }

        const updatedRecord = await refreshCheckinCompletion(client, record.id, task.plan_id)
        const completion = completed

        return {
          task_id: Number(task.id),
          completed: completion,
          checkin_record: updatedRecord
        }
      })
    },

    async getCheckinRecords(userId, { days = 7 } = {}) {
      const result = await pool.query(
        `select cr.*,
          coalesce(
            json_agg(ci order by ci.created_at asc) filter (where ci.id is not null),
            '[]'::json
          ) as items
         from checkin_record cr
         left join checkin_item ci on ci.checkin_record_id = cr.id
         where cr.user_id = $1
           and cr.checkin_date >= current_date - ($2::int - 1)
         group by cr.id
         order by cr.checkin_date desc`,
        [userId, days]
      )
      return result.rows
    },

    async getCheckinAnalysis(userId) {
      const records = await this.getCheckinRecords(userId, { days: 7 })
      const expected = 14
      const done = records.reduce((total, record) => total + (record.items?.length || 0), 0)
      const completionRate = Math.min(100, Math.round((done / expected) * 100))
      const strong = completionRate >= 60

      return {
        period_days: 7,
        completion_rate: completionRate,
        completed_count: done,
        expected_count: expected,
        evaluation: strong
          ? '您的饮食和运动打卡完成情况良好，说明生活管理节奏已经开始稳定。'
          : '饮食执行存在缺口，运动计划完成不足，建议先把每天 2 次关键打卡固定下来。',
        advice: strong
          ? '继续保持饮食多样性和运动适度，避免过度疲劳，并定期复查血糖。'
          : '设置手机提醒，优先落实早餐和晚餐记录；运动从饭后 15-20 分钟轻走开始。'
      }
    },

    async createHealthAnalysisReport(input) {
      const result = await pool.query(
        `insert into health_analysis_report
         (user_id, period_start, period_end, completion_rate, summary, advice,
          analysis_json, dify_workflow_run_id, created_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, current_timestamp)
         returning *`,
        [
          input.user_id,
          input.period_start,
          input.period_end,
          input.completion_rate ?? null,
          input.summary || input.evaluation || null,
          input.advice || null,
          JSON.stringify(input.analysis_json || input),
          input.dify_workflow_run_id || null
        ]
      )
      return one(result)
    },

    async createConsultationOrder(input) {
      const result = await pool.query(
        `insert into consultation_order
         (user_id, doctor_id, conversation_id, status, title, priority, created_at, updated_at)
         values ($1, $2, $3, 'waiting_admin', $4, $5, current_timestamp, current_timestamp)
         returning *`,
        [
          input.user_id,
          input.doctor_id,
          input.conversation_id || null,
          input.title || null,
          input.priority || 'normal'
        ]
      )
      return one(result)
    },

    async listConsultations({ userId = null, status = null } = {}) {
      const result = await pool.query(
        `select co.*, d.name as doctor_name, u.username
         from consultation_order co
         left join doctor d on d.id = co.doctor_id
         left join sys_user u on u.id = co.user_id
         where ($1::bigint is null or co.user_id = $1)
           and ($2::varchar is null or co.status = $2)
         order by co.updated_at desc`,
        [userId, status]
      )
      return result.rows
    },

    async auditLog(input) {
      const result = await pool.query(
        `insert into admin_audit_log
         (admin_user_id, action, target_type, target_id, before_json, after_json,
          ip_address, user_agent, created_at)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, current_timestamp)
         returning *`,
        [
          input.admin_user_id || null,
          input.action,
          input.target_type,
          input.target_id || null,
          JSON.stringify(input.before_json || null),
          JSON.stringify(input.after_json || null),
          input.ip_address || null,
          input.user_agent || null
        ]
      )
      return one(result)
    },

    async listAdminUsers({ page = 1, pageSize = 20 } = {}) {
      const limit = Number(pageSize)
      const offset = (Number(page) - 1) * limit
      const [items, count] = await Promise.all([
        pool.query(
          `select id, username, phone, email, role, status, nickname, avatar_url,
                  last_login_at, last_login_ip, created_at, updated_at
           from sys_user
           where deleted_at is null
           order by created_at desc
           limit $1 offset $2`,
          [limit, offset]
        ),
        pool.query(`select count(*)::int as total from sys_user where deleted_at is null`)
      ])

      return { items: items.rows, total: count.rows[0]?.total || 0, page: Number(page), pageSize: limit }
    },

    async updateUserStatus(id, status) {
      const before = await this.findUserById(id)
      const result = await pool.query(
        `update sys_user
         set status = $2, updated_at = current_timestamp
         where id = $1 and deleted_at is null
         returning id, username, role, status, updated_at`,
        [id, status]
      )
      return { before, after: one(result) }
    },

    async listAdminArticles({ page = 1, pageSize = 20, status = null, keyword = '' } = {}) {
      const limit = Number(pageSize)
      const offset = (Number(page) - 1) * limit
      const kw = `%${keyword || ''}%`
      const [items, count] = await Promise.all([
        pool.query(
          `select a.*, c.name as category_name
           from article a
           left join article_category c on c.id = a.category_id
           where a.deleted_at is null
             and ($1::varchar is null or a.status = $1)
             and ($2 = '%%' or a.title like $2 or coalesce(a.summary, '') like $2)
           order by a.updated_at desc
           limit $3 offset $4`,
          [status, kw, limit, offset]
        ),
        pool.query(
          `select count(*)::int as total
           from article
           where deleted_at is null
             and ($1::varchar is null or status = $1)
             and ($2 = '%%' or title like $2 or coalesce(summary, '') like $2)`,
          [status, kw]
        )
      ])

      return { items: items.rows, total: count.rows[0]?.total || 0, page: Number(page), pageSize: limit }
    },

    async getAdminArticle(id) {
      const result = await pool.query(
        `select * from article where id = $1 and deleted_at is null limit 1`,
        [id]
      )
      return one(result)
    },

    async createAdminArticle(input) {
      const result = await pool.query(
        `insert into article
         (category_id, title, summary, content, cover_url, tags, author, author_user_id,
          content_md, content_html, audit_status, status, recommend_weight,
          published_at, created_at, updated_at)
         values
         ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13,
          case when $12 = 'published' then current_timestamp else null end,
          current_timestamp, current_timestamp)
         returning *`,
        [
          input.category_id || null,
          input.title,
          input.summary || null,
          input.content || input.content_md || '',
          input.cover_url || null,
          JSON.stringify(input.tags || []),
          input.author || null,
          input.author_user_id || null,
          input.content_md || null,
          input.content_html || null,
          input.audit_status || 'approved',
          input.status || 'draft',
          input.recommend_weight ?? 0
        ]
      )
      return one(result)
    },

    async updateAdminArticle(id, input) {
      const before = await this.getAdminArticle(id)
      if (!before) {
        throw errors.notFound('文章不存在')
      }

      const next = { ...before, ...input }
      const result = await pool.query(
        `update article set
          category_id = $2,
          title = $3,
          summary = $4,
          content = $5,
          cover_url = $6,
          tags = $7::jsonb,
          author = $8,
          content_md = $9,
          content_html = $10,
          audit_status = $11,
          status = $12,
          recommend_weight = $13,
          published_at = case
            when $12 = 'published' and published_at is null then current_timestamp
            when $12 <> 'published' then null
            else published_at
          end,
          updated_at = current_timestamp
         where id = $1
         returning *`,
        [
          id,
          next.category_id || null,
          next.title,
          next.summary || null,
          next.content || next.content_md || '',
          next.cover_url || null,
          JSON.stringify(next.tags || []),
          next.author || null,
          next.content_md || null,
          next.content_html || null,
          next.audit_status || 'approved',
          next.status || 'draft',
          next.recommend_weight ?? 0
        ]
      )
      return { before, after: one(result) }
    },

    async deleteAdminArticle(id) {
      const before = await this.getAdminArticle(id)
      const result = await pool.query(
        `update article set deleted_at = current_timestamp, updated_at = current_timestamp
         where id = $1 and deleted_at is null
         returning *`,
        [id]
      )
      return { before, after: one(result) }
    },

    async setArticleStatus(id, status) {
      return this.updateAdminArticle(id, { status })
    },

    async listArticleCategories() {
      const result = await pool.query(
        `select * from article_category order by sort_order asc, id asc`
      )
      return result.rows
    },

    async createArticleCategory(input) {
      const result = await pool.query(
        `insert into article_category (name, code, sort_order, status)
         values ($1, $2, $3, $4)
         returning *`,
        [input.name, input.code || null, input.sort_order ?? 0, input.status || 'published']
      )
      return one(result)
    },

    async updateArticleCategory(id, input) {
      const before = one(await pool.query(`select * from article_category where id = $1`, [id]))
      const next = { ...before, ...input }
      const result = await pool.query(
        `update article_category
         set name = $2, code = $3, sort_order = $4, status = $5
         where id = $1
         returning *`,
        [id, next.name, next.code || null, next.sort_order ?? 0, next.status || 'published']
      )
      return { before, after: one(result) }
    },

    async deleteArticleCategory(id) {
      const before = one(await pool.query(`select * from article_category where id = $1`, [id]))
      await pool.query(`delete from article_category where id = $1`, [id])
      return { before, after: null }
    },

    async listAdminDoctors({ page = 1, pageSize = 20, keyword = '' } = {}) {
      const limit = Number(pageSize)
      const offset = (Number(page) - 1) * limit
      const kw = `%${keyword || ''}%`
      const [items, count] = await Promise.all([
        pool.query(
          `select * from doctor
           where deleted_at is null
             and ($1 = '%%' or name like $1 or coalesce(department, '') like $1)
           order by sort_order asc, id desc
           limit $2 offset $3`,
          [kw, limit, offset]
        ),
        pool.query(
          `select count(*)::int as total from doctor
           where deleted_at is null
             and ($1 = '%%' or name like $1 or coalesce(department, '') like $1)`,
          [kw]
        )
      ])
      return { items: items.rows, total: count.rows[0]?.total || 0, page: Number(page), pageSize: limit }
    },

    async createAdminDoctor(input) {
      const result = await pool.query(
        `insert into doctor
         (user_id, name, title, department, specialty, intro, avatar_url, license_no,
          profile_md, online_status, consult_status, display_status, audit_status,
          sort_order, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          current_timestamp, current_timestamp)
         returning *`,
        [
          input.user_id || null,
          input.name,
          input.title || null,
          input.department || null,
          input.specialty || null,
          input.intro || null,
          input.avatar_url || null,
          input.license_no || null,
          input.profile_md || null,
          input.online_status || 'online',
          input.consult_status || 'online',
          input.display_status || 'published',
          input.audit_status || 'approved',
          input.sort_order ?? 0
        ]
      )
      return one(result)
    },

    async updateAdminDoctor(id, input) {
      const before = await this.getDoctorById(id)
      if (!before) {
        throw errors.notFound('医生不存在')
      }
      const next = { ...before, ...input }
      const result = await pool.query(
        `update doctor set
          user_id = $2,
          name = $3,
          title = $4,
          department = $5,
          specialty = $6,
          intro = $7,
          avatar_url = $8,
          license_no = $9,
          profile_md = $10,
          online_status = $11,
          consult_status = $12,
          display_status = $13,
          audit_status = $14,
          sort_order = $15,
          updated_at = current_timestamp
         where id = $1
         returning *`,
        [
          id,
          next.user_id || null,
          next.name,
          next.title || null,
          next.department || null,
          next.specialty || null,
          next.intro || null,
          next.avatar_url || null,
          next.license_no || null,
          next.profile_md || null,
          next.online_status || 'online',
          next.consult_status || 'online',
          next.display_status || 'published',
          next.audit_status || 'approved',
          next.sort_order ?? 0
        ]
      )
      return { before, after: one(result) }
    },

    async deleteAdminDoctor(id) {
      const before = await this.getDoctorById(id)
      const result = await pool.query(
        `update doctor set deleted_at = current_timestamp, updated_at = current_timestamp
         where id = $1 and deleted_at is null
         returning *`,
        [id]
      )
      return { before, after: one(result) }
    },

    async listDifyLogs({ page = 1, pageSize = 20 } = {}) {
      const limit = Number(pageSize)
      const offset = (Number(page) - 1) * limit
      const [items, count] = await Promise.all([
        pool.query(
          `select * from dify_run_log order by created_at desc limit $1 offset $2`,
          [limit, offset]
        ),
        pool.query(`select count(*)::int as total from dify_run_log`)
      ])
      return { items: items.rows, total: count.rows[0]?.total || 0, page: Number(page), pageSize: limit }
    },

    async listHomeConfig() {
      const result = await pool.query(
        `select *
         from home_operation_config
         order by slot_code asc, sort_order asc, id asc`
      )
      return result.rows
    },

    async replaceHomeConfig(slots = [], adminUserId = null) {
      return transaction(pool, async (client) => {
        await client.query(`delete from home_operation_config`)

        const rows = []
        for (const slot of slots) {
          const result = await client.query(
            `insert into home_operation_config
             (slot_code, target_type, target_id, title, sort_order, status, created_by, created_at, updated_at)
             values ($1, $2, $3, $4, $5, $6, $7, current_timestamp, current_timestamp)
             returning *`,
            [
              slot.slot_code,
              slot.target_type,
              slot.target_id || null,
              slot.title || null,
              slot.sort_order ?? 0,
              slot.status || 'active',
              adminUserId || null
            ]
          )
          rows.push(one(result))
        }

        return rows
      })
    },

    async listSystemMessages(userId) {
      const result = await pool.query(
        `select *
         from system_message
         where user_id = $1
         order by created_at desc, id desc`,
        [userId]
      )
      return result.rows
    },

    async upsertSystemMessage(userId, input = {}) {
      const result = await pool.query(
        `insert into system_message
         (user_id, message_key, type, title, content, route_name, payload, read_at, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, current_timestamp, current_timestamp)
         on conflict (user_id, message_key) do update set
           type = excluded.type,
           title = excluded.title,
           content = excluded.content,
           route_name = excluded.route_name,
           payload = excluded.payload,
           updated_at = current_timestamp
         returning *`,
        [
          userId,
          input.message_key || null,
          input.type,
          input.title,
          input.content || null,
          input.route_name || null,
          JSON.stringify(input.payload || {}),
          input.read_at || null
        ]
      )
      return one(result)
    },

    async markAllSystemMessagesRead(userId) {
      const result = await pool.query(
        `update system_message
         set read_at = current_timestamp,
             updated_at = current_timestamp
         where user_id = $1 and read_at is null`,
        [userId]
      )
      return { updated: result.rowCount || 0 }
    }
  }
}
