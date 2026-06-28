import { errors } from '../http/errors.js'

function one(result) {
  return result.rows[0] || null
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

    async getUserContext(userId) {
      return {
        profile: await this.getProfile(userId),
        latest_risk: await this.getLatestRisk(userId),
        latest_plan: null
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

    async getCheckinSummary() {
      return {
        period: null,
        completion_rate: null,
        items: []
      }
    },

    async getArticleRecommendations({ page = 1, pageSize = 20 } = {}) {
      const limit = Number(pageSize)
      const offset = (Number(page) - 1) * limit
      const [items, count] = await Promise.all([
        pool.query(
        `select * from article
         where deleted_at is null and status = 'published'
         order by recommend_weight desc, published_at desc nulls last
         limit $1 offset $2`,
          [limit, offset]
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

    async getDoctorById(id) {
      const result = await pool.query(
        `select * from doctor where id = $1 and deleted_at is null limit 1`,
        [id]
      )
      return one(result)
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
          target: [task.target_value, task.unit].filter(Boolean).join('') || task.unit || '1次'
        }))
      }
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
    }
  }
}
