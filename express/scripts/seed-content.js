import { createPoolWithSsh } from '../src/db/pool.js'
import { loadEnv, parseCliArgs } from '../src/config/env.js'

const doctorSeeds = [
  {
    name: '林知远',
    title: '主任医师',
    department: '内分泌科',
    specialty: '糖尿病风险筛查、血糖波动、复查指标解读',
    intro: '擅长糖尿病风险评估、血糖波动分析和长期慢病管理。',
    license_no: 'ENDO-2026-001',
    profile_md: '三甲内分泌中心',
    avatar_url: '',
    online_status: 'online',
    consult_status: 'online',
    display_status: 'published',
    audit_status: 'approved',
    sort_order: 10,
  },
  {
    name: '周亦然',
    title: '营养师',
    department: '临床营养科',
    specialty: '控糖饮食、体重管理、餐盘结构调整',
    intro: '聚焦控糖饮食、体重管理与可持续营养方案。',
    license_no: 'NUTR-2026-002',
    profile_md: '健康营养门诊',
    avatar_url: '',
    online_status: 'online',
    consult_status: 'online',
    display_status: 'published',
    audit_status: 'approved',
    sort_order: 20,
  },
  {
    name: '许安宁',
    title: '全科医生',
    department: '全科医学',
    specialty: '慢病随访、血压血糖联合管理、复查清单',
    intro: '擅长慢病随访与多指标联合管理。',
    license_no: 'GEN-2026-003',
    profile_md: '慢病管理中心',
    avatar_url: '',
    online_status: 'online',
    consult_status: 'online',
    display_status: 'published',
    audit_status: 'approved',
    sort_order: 30,
  },
  {
    name: '沈嘉言',
    title: '运动康复师',
    department: '运动医学',
    specialty: '餐后运动、减脂计划、生活方式干预',
    intro: '帮助用户把运动建议拆成可执行的日常计划。',
    license_no: 'SPORT-2026-004',
    profile_md: '生活方式门诊',
    avatar_url: '',
    online_status: 'online',
    consult_status: 'online',
    display_status: 'published',
    audit_status: 'approved',
    sort_order: 40,
  },
]

const categorySeeds = [
  { code: 'diet', name: '饮食', sort_order: 10 },
  { code: 'exercise', name: '运动', sort_order: 20 },
  { code: 'screening', name: '筛查', sort_order: 30 },
  { code: 'management', name: '管理', sort_order: 40 },
]

const articleSeeds = [
  {
    category_code: 'diet',
    title: '早餐怎么吃，上午血糖更平稳？',
    summary: '主食、蛋白质和蔬菜的搭配顺序，会影响上午血糖曲线。',
    content: '早餐建议优先保证蛋白质和蔬菜，再根据个人情况安排主食量，并持续观察餐后 2 小时血糖变化。',
    author: '健康编辑部',
    recommend_weight: 100,
    status: 'published',
    audit_status: 'approved',
  },
  {
    category_code: 'exercise',
    title: '饭后轻走 20 分钟，对血糖有什么帮助？',
    summary: '低强度、可持续的活动更适合日常控糖管理。',
    content: '饭后 15 到 20 分钟的轻走可以帮助改善餐后波动，关键在于持续执行而不是偶尔高强度运动。',
    author: '健康编辑部',
    recommend_weight: 90,
    status: 'published',
    audit_status: 'approved',
  },
  {
    category_code: 'screening',
    title: '除了血糖，这些指标也值得提前关注',
    summary: '腰围、体重、血压和家族史同样影响筛查结果。',
    content: '当腰围、体重、血压和家族史等信息补齐后，风险评估会更接近真实状态，也更利于后续生成生活方案。',
    author: '健康编辑部',
    recommend_weight: 80,
    status: 'published',
    audit_status: 'approved',
  },
]

const diabetesTypeSeeds = [
  {
    type_code: 'type1',
    name: '1 型糖尿病',
    cover_url: '',
    pathogenesis: '通常与自身免疫相关的胰岛功能受损有关。',
    clinical_features: '起病相对较早，需要长期监测和胰岛素管理。',
    treatment: '胰岛素治疗、营养管理、规律监测和随访。',
    sort_order: 10,
    status: 'published',
  },
  {
    type_code: 'type2',
    name: '2 型糖尿病',
    cover_url: '',
    pathogenesis: '常见于胰岛素抵抗与分泌不足并存的状态。',
    clinical_features: '与体重、腰围、血压、家族史等代谢因素密切相关。',
    treatment: '生活方式干预、药物管理和定期复查。',
    sort_order: 20,
    status: 'published',
  },
  {
    type_code: 'gestational',
    name: '妊娠期糖尿病',
    cover_url: '',
    pathogenesis: '妊娠期间糖代谢异常导致的血糖升高。',
    clinical_features: '需要结合孕周、饮食和血糖监测动态评估。',
    treatment: '饮食运动管理、产检随访和必要的药物干预。',
    sort_order: 30,
    status: 'published',
  },
  {
    type_code: 'special',
    name: '特殊类型糖尿病',
    cover_url: '',
    pathogenesis: '可能与遗传、药物或其他疾病因素相关。',
    clinical_features: '病因差异较大，需要结合具体背景判断。',
    treatment: '以明确病因和个体化治疗方案为主。',
    sort_order: 40,
    status: 'published',
  },
]

async function upsertDoctor(pool, doctor) {
  await pool.query(
    `insert into doctor
     (name, title, department, specialty, intro, avatar_url, license_no, profile_md,
      online_status, consult_status, display_status, audit_status, sort_order, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, current_timestamp, current_timestamp)
     on conflict do nothing`,
    [
      doctor.name,
      doctor.title,
      doctor.department,
      doctor.specialty,
      doctor.intro,
      doctor.avatar_url,
      doctor.license_no,
      doctor.profile_md,
      doctor.online_status,
      doctor.consult_status,
      doctor.display_status,
      doctor.audit_status,
      doctor.sort_order,
    ]
  )

  await pool.query(
    `update doctor
     set title = $2,
         department = $3,
         specialty = $4,
         intro = $5,
         avatar_url = $6,
         license_no = $7,
         profile_md = $8,
         online_status = $9,
         consult_status = $10,
         display_status = $11,
         audit_status = $12,
         sort_order = $13,
         updated_at = current_timestamp
     where name = $1 and deleted_at is null`,
    [
      doctor.name,
      doctor.title,
      doctor.department,
      doctor.specialty,
      doctor.intro,
      doctor.avatar_url,
      doctor.license_no,
      doctor.profile_md,
      doctor.online_status,
      doctor.consult_status,
      doctor.display_status,
      doctor.audit_status,
      doctor.sort_order,
    ]
  )
}

async function upsertCategory(pool, category) {
  await pool.query(
    `insert into article_category (name, code, sort_order, status)
     values ($1, $2, $3, 'published')
     on conflict (code) do update set
       name = excluded.name,
       sort_order = excluded.sort_order,
       status = 'published'`,
    [category.name, category.code, category.sort_order]
  )
}

async function upsertArticle(pool, article) {
  const categoryResult = await pool.query(
    `select id from article_category where code = $1 limit 1`,
    [article.category_code]
  )
  const categoryId = categoryResult.rows[0]?.id || null

  const existing = await pool.query(
    `select id from article where title = $1 and deleted_at is null limit 1`,
    [article.title]
  )

  if (existing.rows[0]?.id) {
    await pool.query(
      `update article
       set category_id = $2,
           summary = $3,
           content = $4,
           author = $5,
           audit_status = $6,
           status = $7::varchar,
           recommend_weight = $8,
           published_at = case when $7::varchar = 'published' then coalesce(published_at, current_timestamp) else published_at end,
           updated_at = current_timestamp
       where id = $1`,
      [
        existing.rows[0].id,
        categoryId,
        article.summary,
        article.content,
        article.author,
        article.audit_status,
        article.status,
        article.recommend_weight,
      ]
    )
    return
  }

  await pool.query(
    `insert into article
     (category_id, title, summary, content, author, audit_status, status, recommend_weight, published_at, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7::varchar, $8, case when $7::varchar = 'published' then current_timestamp else null end, current_timestamp, current_timestamp)`,
    [
      categoryId,
      article.title,
      article.summary,
      article.content,
      article.author,
      article.audit_status,
      article.status,
      article.recommend_weight,
    ]
  )
}

async function upsertDiabetesType(pool, item) {
  await pool.query(
    `insert into diabetes_type_info
     (type_code, name, cover_url, pathogenesis, clinical_features, treatment, sort_order, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (type_code) do update set
       name = excluded.name,
       cover_url = excluded.cover_url,
       pathogenesis = excluded.pathogenesis,
       clinical_features = excluded.clinical_features,
       treatment = excluded.treatment,
       sort_order = excluded.sort_order,
       status = excluded.status`,
    [
      item.type_code,
      item.name,
      item.cover_url,
      item.pathogenesis,
      item.clinical_features,
      item.treatment,
      item.sort_order,
      item.status,
    ]
  )
}

async function replaceHomeConfig(pool, adminUserId) {
  const articleRows = await pool.query(
    `select id, title
     from article
     where deleted_at is null and status = 'published'
     order by recommend_weight desc, published_at desc nulls last
     limit 3`
  )
  const doctorRows = await pool.query(
    `select id, name
     from doctor
     where deleted_at is null and display_status = 'published'
     order by sort_order asc, id asc
     limit 3`
  )

  await pool.query(`delete from home_operation_config`)

  for (const [index, row] of articleRows.rows.entries()) {
    await pool.query(
      `insert into home_operation_config
       (slot_code, target_type, target_id, title, sort_order, status, created_by, created_at)
       values ('hot_articles', 'article', $1, $2, $3, 'active', $4, current_timestamp)`,
      [row.id, row.title, index + 1, adminUserId || null]
    )
  }

  for (const [index, row] of doctorRows.rows.entries()) {
    await pool.query(
      `insert into home_operation_config
       (slot_code, target_type, target_id, title, sort_order, status, created_by, created_at)
       values ('recommended_doctors', 'doctor', $1, $2, $3, 'active', $4, current_timestamp)`,
      [row.id, row.name, index + 1, adminUserId || null]
    )
  }
}

async function main() {
  const args = parseCliArgs()
  const config = loadEnv(args)
  const { pool, tunnel } = await createPoolWithSsh(config)

  try {
    const adminResult = await pool.query(
      `select id from sys_user
       where role in ('admin', 'super_admin') and deleted_at is null
       order by id asc
       limit 1`
    )
    const adminUserId = adminResult.rows[0]?.id || null

    for (const doctor of doctorSeeds) {
      await upsertDoctor(pool, doctor)
    }

    for (const category of categorySeeds) {
      await upsertCategory(pool, category)
    }

    for (const article of articleSeeds) {
      await upsertArticle(pool, article)
    }

    for (const item of diabetesTypeSeeds) {
      await upsertDiabetesType(pool, item)
    }

    await replaceHomeConfig(pool, adminUserId)

    console.log('[seed:content] ready')
  } finally {
    await pool.end()
    if (tunnel) {
      await tunnel.close()
    }
  }
}

main().catch((error) => {
  console.error('[seed:content] failed')
  console.error(error)
  process.exitCode = 1
})
