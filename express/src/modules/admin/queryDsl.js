import { errors } from '../../http/errors.js'

function createMeta(config) {
  return {
    ...config,
    columns: new Set(config.columns),
    filterable: new Set(config.filterable || []),
    searchable: new Set(config.searchable || []),
    sortable: new Set(config.sortable || []),
    baseWhere: config.baseWhere || [],
    valueAliases: config.valueAliases || {},
    outputAliases: config.outputAliases || {},
  }
}

export const TABLE_META = {
  sys_user: createMeta({
    columns: ['id', 'username', 'nickname', 'role', 'status', 'last_login_at', 'created_at'],
    filterable: ['role', 'status'],
    searchable: ['username', 'nickname'],
    sortable: ['id', 'last_login_at', 'created_at'],
    baseWhere: ['deleted_at is null'],
  }),
  doctor: createMeta({
    columns: ['id', 'name', 'title', 'department', 'specialty', 'online_status', 'display_status', 'sort_order', 'created_at'],
    filterable: ['department', 'online_status', 'display_status'],
    searchable: ['name', 'title', 'department', 'specialty'],
    sortable: ['id', 'sort_order', 'created_at'],
    baseWhere: ['deleted_at is null'],
    valueAliases: {
      display_status: {
        unpublished: 'hidden',
      },
    },
    outputAliases: {
      display_status: {
        hidden: 'unpublished',
      },
    },
  }),
  consultation_order: createMeta({
    columns: ['id', 'user_id', 'doctor_id', 'status', 'created_at', 'updated_at'],
    filterable: ['status'],
    searchable: [],
    sortable: ['id', 'created_at', 'updated_at'],
    valueAliases: {
      status: {
        pending: 'open',
        accepted: 'waiting_admin',
        completed: 'answered',
        cancelled: 'closed',
      },
    },
    outputAliases: {
      status: {
        open: 'pending',
        waiting_admin: 'accepted',
        answered: 'completed',
        closed: 'cancelled',
      },
    },
  }),
  dify_run_log: createMeta({
    columns: ['id', 'app_type', 'status', 'created_at'],
    filterable: ['app_type', 'status'],
    searchable: [],
    sortable: ['id', 'created_at'],
  }),
  article: createMeta({
    columns: ['id', 'title', 'author', 'status', 'view_count', 'published_at', 'created_at'],
    filterable: ['status'],
    searchable: ['title', 'author'],
    sortable: ['id', 'view_count', 'published_at', 'created_at'],
    baseWhere: ['deleted_at is null'],
    valueAliases: {
      status: {
        unpublished: 'offline',
      },
    },
    outputAliases: {
      status: {
        offline: 'unpublished',
      },
    },
  }),
}

const ALLOWED_TABLES = Object.keys(TABLE_META)
const DSL_KEYS = new Set(['table', 'select', 'where', 'search', 'order_by', 'limit', 'offset'])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`
}

function mapFilterValue(meta, key, value) {
  const aliasMap = meta.valueAliases?.[key] || null

  if (!aliasMap || value === null || value === undefined) {
    return value
  }

  return aliasMap[value] ?? value
}

function mapOutputRow(meta, row) {
  const next = { ...row }

  for (const [column, aliasMap] of Object.entries(meta.outputAliases || {})) {
    if (Object.prototype.hasOwnProperty.call(next, column)) {
      next[column] = aliasMap[next[column]] ?? next[column]
    }
  }

  return next
}

function normalizeDsl(input) {
  if (isPlainObject(input?.query_dsl)) {
    return input.query_dsl
  }

  return input
}

function createResult(valid, extras = {}) {
  return {
    valid,
    errors: [],
    normalizedDsl: null,
    code: null,
    status: null,
    ...extras,
  }
}

function invalidResult(kind, details) {
  if (kind === 'table') {
    return createResult(false, {
      code: 40302,
      status: 403,
      errors: details,
    })
  }

  if (kind === 'column') {
    return createResult(false, {
      code: 40002,
      status: 400,
      errors: details,
    })
  }

  return createResult(false, {
    code: 40003,
    status: 400,
    errors: details,
  })
}

export function validateDsl(input) {
  const dsl = normalizeDsl(input)

  if (!isPlainObject(dsl)) {
    return invalidResult('format', [{
      path: '',
      message: '请求体必须是 DSL 对象',
    }])
  }

  const unknownKeys = Object.keys(dsl).filter((key) => !DSL_KEYS.has(key))
  if (unknownKeys.length) {
    return invalidResult('format', unknownKeys.map((key) => ({
      path: key,
      message: '存在未定义字段',
    })))
  }

  if (typeof dsl.table !== 'string' || !dsl.table.trim()) {
    return invalidResult('format', [{
      path: 'table',
      message: 'table 必须是非空字符串',
    }])
  }

  const table = dsl.table.trim()
  if (!ALLOWED_TABLES.includes(table)) {
    return invalidResult('table', [{
      path: 'table',
      message: `仅允许查询以下表：${ALLOWED_TABLES.join(', ')}`,
    }])
  }

  const meta = TABLE_META[table]

  if (!Array.isArray(dsl.select) || dsl.select.length === 0) {
    return invalidResult('format', [{
      path: 'select',
      message: 'select 必须是非空数组',
    }])
  }

  const invalidSelects = dsl.select.filter((column) => (
    typeof column !== 'string' || !meta.columns.has(column)
  ))
  if (invalidSelects.length) {
    return invalidResult('column', invalidSelects.map((column) => ({
      path: 'select',
      message: `列 ${String(column)} 不在 ${table} 白名单内`,
    })))
  }

  if (dsl.where !== undefined) {
    if (!isPlainObject(dsl.where)) {
      return invalidResult('format', [{
        path: 'where',
        message: 'where 必须是对象',
      }])
    }

    for (const [key, value] of Object.entries(dsl.where)) {
      if (!meta.filterable.has(key)) {
        return invalidResult('column', [{
          path: `where.${key}`,
          message: `列 ${key} 不允许用于筛选`,
        }])
      }

      if (Array.isArray(value) || (isPlainObject(value) && value !== null)) {
        return invalidResult('format', [{
          path: `where.${key}`,
          message: 'where 仅支持等值筛选',
        }])
      }
    }
  }

  if (dsl.search !== undefined) {
    if (!isPlainObject(dsl.search)) {
      return invalidResult('format', [{
        path: 'search',
        message: 'search 必须是对象',
      }])
    }

    if (!Array.isArray(dsl.search.fields) || dsl.search.fields.length === 0) {
      return invalidResult('format', [{
        path: 'search.fields',
        message: 'search.fields 必须是非空数组',
      }])
    }

    if (typeof dsl.search.value !== 'string') {
      return invalidResult('format', [{
        path: 'search.value',
        message: 'search.value 必须是字符串',
      }])
    }

    const invalidSearchFields = dsl.search.fields.filter((field) => (
      typeof field !== 'string' || !meta.searchable.has(field)
    ))

    if (invalidSearchFields.length) {
      return invalidResult('column', invalidSearchFields.map((field) => ({
        path: 'search.fields',
        message: `列 ${String(field)} 不允许用于模糊搜索`,
      })))
    }
  }

  if (dsl.order_by !== undefined) {
    if (typeof dsl.order_by !== 'string' || !dsl.order_by.trim()) {
      return invalidResult('format', [{
        path: 'order_by',
        message: 'order_by 必须是字符串',
      }])
    }

    const matched = dsl.order_by.trim().match(/^([a-z_]+)\s+(asc|desc)$/i)
    if (!matched) {
      return invalidResult('format', [{
        path: 'order_by',
        message: 'order_by 格式必须为 "列名 asc|desc"',
      }])
    }

    if (!meta.sortable.has(matched[1])) {
      return invalidResult('column', [{
        path: 'order_by',
        message: `列 ${matched[1]} 不允许用于排序`,
      }])
    }
  }

  if (dsl.limit !== undefined) {
    const limit = Number(dsl.limit)
    if (!Number.isInteger(limit) || limit < 0) {
      return invalidResult('format', [{
        path: 'limit',
        message: 'limit 必须是非负整数',
      }])
    }
  }

  if (dsl.offset !== undefined) {
    const offset = Number(dsl.offset)
    if (!Number.isInteger(offset) || offset < 0) {
      return invalidResult('format', [{
        path: 'offset',
        message: 'offset 必须是非负整数',
      }])
    }
  }

  return createResult(true, { normalizedDsl: dsl })
}

function getLimitOffset(dsl) {
  const limit = Math.min(Math.max(Number(dsl.limit ?? 20), 0), 100)
  const offset = Math.max(Number(dsl.offset ?? 0), 0)
  return { limit, offset }
}

export function buildQuery(input) {
  const result = validateDsl(input)

  if (!result.valid) {
    if (result.code === 40302) {
      throw errors.forbiddenDslTable('表不在允许查询范围内', result.errors)
    }

    if (result.code === 40002) {
      throw errors.invalidDslColumn('请求列不在该表白名单内', result.errors)
    }

    throw errors.invalidDsl('查询 DSL 不合法', result.errors)
  }

  const dsl = result.normalizedDsl
  const meta = TABLE_META[dsl.table]
  const { limit, offset } = getLimitOffset(dsl)
  const selectClause = dsl.select.map((column) => quoteIdentifier(column)).join(', ')
  const conditions = [...meta.baseWhere]
  const params = []
  let paramIndex = 1

  for (const [key, value] of Object.entries(dsl.where || {})) {
    const normalizedValue = mapFilterValue(meta, key, value)

    if (value === null) {
      conditions.push(`${quoteIdentifier(key)} is null`)
      continue
    }

    conditions.push(`${quoteIdentifier(key)} = $${paramIndex}`)
    params.push(normalizedValue)
    paramIndex += 1
  }

  if (dsl.search?.value?.trim()) {
    const likeValue = `%${dsl.search.value.trim()}%`
    const searchParts = dsl.search.fields.map((field) => (
      `${quoteIdentifier(field)} like $${paramIndex}`
    ))
    params.push(likeValue)
    conditions.push(`(${searchParts.join(' or ')})`)
    paramIndex += 1
  }

  const whereClause = conditions.length
    ? ` where ${conditions.join(' and ')}`
    : ''

  let orderClause = ''
  if (dsl.order_by) {
    const [column, direction] = dsl.order_by.trim().split(/\s+/)
    orderClause = ` order by ${quoteIdentifier(column)} ${direction.toLowerCase()}`
  }

  const baseFrom = ` from ${quoteIdentifier(dsl.table)}`
  const dataParams = [...params, limit, offset]

  return {
    table: dsl.table,
    limit,
    offset,
    text: `select ${selectClause}${baseFrom}${whereClause}${orderClause} limit $${paramIndex} offset $${paramIndex + 1}`,
    params: dataParams,
    countText: `select count(*)::int as total${baseFrom}${whereClause}`,
    countParams: params,
    select: dsl.select,
    normalizedDsl: dsl,
  }
}

function compareValues(left, right, direction) {
  if (left === right) {
    return 0
  }

  if (left === null || left === undefined) {
    return direction === 'desc' ? 1 : -1
  }

  if (right === null || right === undefined) {
    return direction === 'desc' ? -1 : 1
  }

  if (left instanceof Date && right instanceof Date) {
    return direction === 'desc'
      ? right.getTime() - left.getTime()
      : left.getTime() - right.getTime()
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return direction === 'desc' ? right - left : left - right
  }

  return direction === 'desc'
    ? String(right).localeCompare(String(left))
    : String(left).localeCompare(String(right))
}

async function getStoreRows(store, table) {
  if (table === 'sys_user') {
    return (await store.listAdminUsers?.({ page: 1, pageSize: 1000 }))?.items || []
  }

  if (table === 'doctor') {
    return (await store.listAdminDoctors?.({ page: 1, pageSize: 1000 }))?.items || []
  }

  if (table === 'consultation_order') {
    return await store.listConsultations?.({}) || []
  }

  if (table === 'dify_run_log') {
    return (await store.listDifyLogs?.({ page: 1, pageSize: 1000 }))?.items || []
  }

  if (table === 'article') {
    return (await store.listAdminArticles?.({ page: 1, pageSize: 1000 }))?.items || []
  }

  return []
}

async function executeWithStore(store, query) {
  const rows = await getStoreRows(store, query.table)
  const meta = TABLE_META[query.table]
  const dsl = query.normalizedDsl
  let filtered = rows.filter((row) => {
    for (const baseCondition of meta.baseWhere) {
      if (baseCondition === 'deleted_at is null' && row.deleted_at) {
        return false
      }
    }

    for (const [key, value] of Object.entries(dsl.where || {})) {
      if ((row[key] ?? null) !== mapFilterValue(meta, key, value)) {
        return false
      }
    }

    if (dsl.search?.value?.trim()) {
      const keyword = dsl.search.value.trim().toLowerCase()
      const matched = dsl.search.fields.some((field) => (
        String(row[field] ?? '').toLowerCase().includes(keyword)
      ))

      if (!matched) {
        return false
      }
    }

    return true
  })

  if (dsl.order_by) {
    const [column, direction] = dsl.order_by.trim().split(/\s+/)
    filtered = [...filtered].sort((left, right) => (
      compareValues(left[column], right[column], direction.toLowerCase())
    ))
  }

  const total = filtered.length
  const pagedRows = filtered
    .slice(query.offset, query.offset + query.limit)
    .map((row) => mapOutputRow(meta, Object.fromEntries(
      query.select.map((column) => [column, row[column] ?? null])
    )))

  return {
    table: query.table,
    rows: pagedRows,
    total,
    limit: query.limit,
    offset: query.offset,
  }
}

async function executeWithPool(pool, query) {
  const fallbackTimeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(errors.queryFailed('查询超时或数据库错误'))
    }, 5000)
  })

  const runner = async () => {
    if (typeof pool.connect === 'function') {
      const client = await pool.connect()

      try {
        await client.query(`set statement_timeout = '5s'`)
        const countResult = await client.query(query.countText, query.countParams)
        const rowsResult = await client.query(query.text, query.params)

        return {
          table: query.table,
          rows: rowsResult.rows.map((row) => mapOutputRow(TABLE_META[query.table], row)),
          total: countResult.rows[0]?.total || 0,
          limit: query.limit,
          offset: query.offset,
        }
      } finally {
        try {
          await client.query('reset statement_timeout')
        } catch {
          // ignore reset failures
        }
        client.release()
      }
    }

    const [countResult, rowsResult] = await Promise.all([
      pool.query(query.countText, query.countParams),
      pool.query(query.text, query.params),
    ])

    return {
      table: query.table,
      rows: rowsResult.rows.map((row) => mapOutputRow(TABLE_META[query.table], row)),
      total: countResult.rows[0]?.total || 0,
      limit: query.limit,
      offset: query.offset,
    }
  }

  try {
    return await Promise.race([runner(), fallbackTimeout])
  } catch (error) {
    if (error?.code === 50002) {
      throw error
    }

    throw errors.queryFailed(error?.message || '查询超时或数据库错误')
  }
}

export async function executeQuery(target, input) {
  const query = buildQuery(input)

  if (target?.query) {
    return executeWithPool(target, query)
  }

  return executeWithStore(target, query)
}
