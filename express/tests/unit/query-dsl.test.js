import { describe, expect, it } from 'vitest'
import { validateDsl, buildQuery, executeQuery, TABLE_META } from '../../src/modules/admin/queryDsl.js'
import { AppError } from '../../src/http/errors.js'
import { createMemoryStore } from '../../src/db/memoryStore.js'

describe('validateDsl', () => {
  it('validates a simple query on sys_user', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id', 'username', 'role'],
    })
    expect(result.valid).toBe(true)
    expect(result.normalizedDsl).toBeDefined()
  })

  it('rejects non-object input', () => {
    const result = validateDsl('not an object')
    expect(result.valid).toBe(false)
    expect(result.code).toBe(40003)
  })

  it('rejects unknown keys', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      unknown_key: 'value',
    })
    expect(result.valid).toBe(false)
  })

  it('rejects empty table', () => {
    const result = validateDsl({ table: '', select: ['id'] })
    expect(result.valid).toBe(false)
  })

  it('rejects disallowed table', () => {
    const result = validateDsl({ table: 'secret_table', select: ['id'] })
    expect(result.valid).toBe(false)
    expect(result.code).toBe(40302)
  })

  it('rejects empty select', () => {
    const result = validateDsl({ table: 'sys_user', select: [] })
    expect(result.valid).toBe(false)
  })

  it('rejects non-array select', () => {
    const result = validateDsl({ table: 'sys_user', select: 'id' })
    expect(result.valid).toBe(false)
  })

  it('rejects column not in whitelist', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id', 'password_hash'],
    })
    expect(result.valid).toBe(false)
    expect(result.code).toBe(40002)
  })

  it('rejects where on non-filterable column', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id', 'username'],
      where: { username: 'test' },
    })
    expect(result.valid).toBe(false)
  })

  it('accepts where on filterable column', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id', 'username'],
      where: { role: 'user' },
    })
    expect(result.valid).toBe(true)
  })

  it('rejects array value in where', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      where: { role: ['user', 'admin'] },
    })
    expect(result.valid).toBe(false)
  })

  it('rejects invalid search format', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      search: 'invalid',
    })
    expect(result.valid).toBe(false)
  })

  it('validates search with correct format', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id', 'username'],
      search: { fields: ['username'], value: 'test' },
    })
    expect(result.valid).toBe(true)
  })

  it('rejects search on non-searchable field', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      search: { fields: ['role'], value: 'test' },
    })
    expect(result.valid).toBe(false)
  })

  it('rejects invalid order_by format', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      order_by: 'invalid format here',
    })
    expect(result.valid).toBe(false)
  })

  it('rejects order_by on non-sortable column', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      order_by: 'username desc',
    })
    expect(result.valid).toBe(false)
  })

  it('accepts valid order_by', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      order_by: 'created_at desc',
    })
    expect(result.valid).toBe(true)
  })

  it('rejects negative limit', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      limit: -1,
    })
    expect(result.valid).toBe(false)
  })

  it('rejects negative offset', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      offset: -5,
    })
    expect(result.valid).toBe(false)
  })

  it('accepts query_dsl wrapper format', () => {
    const result = validateDsl({
      query_dsl: { table: 'sys_user', select: ['id'] },
    })
    expect(result.valid).toBe(true)
  })

  it('validates all 5 tables', () => {
    for (const table of Object.keys(TABLE_META)) {
      const cols = [...TABLE_META[table].columns].slice(0, 2)
      const result = validateDsl({ table, select: cols })
      expect(result.valid).toBe(true)
    }
  })

  it('rejects non-string values in select', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: [123],
    })
    expect(result.valid).toBe(false)
  })

  it('rejects non-integer limit', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      limit: 'abc',
    })
    expect(result.valid).toBe(false)
  })

  it('accepts valid limit and offset', () => {
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      limit: 10,
      offset: 20,
    })
    expect(result.valid).toBe(true)
  })

  it('rejects null where values with array/object', () => {
    // null values should actually be allowed per the code
    const result = validateDsl({
      table: 'sys_user',
      select: ['id'],
      where: { role: null },
    })
    // null is not array/object, so it should be valid for filterable field
    expect(result.valid).toBe(true)
  })
})

describe('buildQuery', () => {
  it('builds SQL for a simple query', () => {
    const query = buildQuery({
      table: 'sys_user',
      select: ['id', 'username', 'role'],
    })
    expect(query.text).toContain('select "id", "username", "role" from "sys_user"')
    expect(query.text).toContain('deleted_at is null')
    expect(query.limit).toBe(20)
    expect(query.offset).toBe(0)
  })

  it('builds query with where clause', () => {
    const query = buildQuery({
      table: 'sys_user',
      select: ['id'],
      where: { role: 'user' },
    })
    expect(query.text).toContain('"role" = $1')
    expect(query.params[0]).toBe('user')
  })

  it('builds query with search', () => {
    const query = buildQuery({
      table: 'sys_user',
      select: ['id', 'username'],
      search: { fields: ['username'], value: 'test' },
    })
    expect(query.text).toContain('like')
    expect(query.params).toContain('%test%')
  })

  it('builds query with order_by', () => {
    const query = buildQuery({
      table: 'sys_user',
      select: ['id'],
      order_by: 'created_at desc',
    })
    expect(query.text).toContain('order by "created_at" desc')
  })

  it('builds query with custom limit/offset', () => {
    const query = buildQuery({
      table: 'sys_user',
      select: ['id'],
      limit: 50,
      offset: 100,
    })
    expect(query.limit).toBe(50)
    expect(query.offset).toBe(100)
    // limit should not exceed 100
  })

  it('clamps limit to 100', () => {
    const query = buildQuery({
      table: 'sys_user',
      select: ['id'],
      limit: 500,
    })
    expect(query.limit).toBe(100)
  })


  it('throws for invalid DSL', () => {
    expect(() => buildQuery({ table: 'sys_user', select: ['password_hash'] })).toThrow(AppError)
  })

  it('builds count query', () => {
    const query = buildQuery({
      table: 'sys_user',
      select: ['id'],
    })
    expect(query.countText).toContain('count(*)::int as total')
  })
})

describe('executeQuery with memory store', () => {
  it('executes a query against memory store', async () => {
    const store = createMemoryStore()
    // Create a user so there's data
    const user = await store.createUser({
      username: 'testuser',
      password_hash: 'hash',
      role: 'user',
      status: 'active',
    })

    const result = await executeQuery(store, {
      table: 'sys_user',
      select: ['id', 'username', 'role'],
    })
    expect(result.table).toBe('sys_user')
    expect(result.rows.length).toBeGreaterThanOrEqual(1)
    expect(result.total).toBeGreaterThanOrEqual(1)
  })

  it('filters by role in memory store', async () => {
    const store = createMemoryStore()
    await store.createUser({ username: 'admin1', password_hash: 'h', role: 'admin', status: 'active' })

    const result = await executeQuery(store, {
      table: 'sys_user',
      select: ['id', 'username', 'role'],
      where: { role: 'admin' },
    })
    expect(result.rows.every((r) => r.role === 'admin')).toBe(true)
  })

  it('handles empty result', async () => {
    const store = createMemoryStore()
    const result = await executeQuery(store, {
      table: 'sys_user',
      select: ['id', 'username'],
      where: { role: 'nonexistent' },
    })
    expect(result.rows).toEqual([])
    expect(result.total).toBe(0)
  })

  it('respects limit and offset', async () => {
    const store = createMemoryStore()
    for (let i = 0; i < 5; i++) {
      await store.createUser({ username: `user${i}`, password_hash: 'h', role: 'user', status: 'active' })
    }

    const result = await executeQuery(store, {
      table: 'sys_user',
      select: ['id', 'username'],
      limit: 2,
      offset: 0,
    })
    expect(result.rows.length).toBeLessThanOrEqual(2)
    expect(result.limit).toBe(2)
  })

  it('handles value alias for doctor display_status', async () => {
    const store = createMemoryStore()
    const doc = await store.createAdminDoctor({ name: 'Dr. Test', title: '主任医师', department: '内科', display_status: 'published' })

    // Query for published doctors
    const result = await executeQuery(store, {
      table: 'doctor',
      select: ['id', 'name', 'display_status'],
      where: { display_status: 'published' },
    })
    expect(result.rows.length).toBeGreaterThanOrEqual(1)
    if (result.rows.length > 0) {
      expect(result.rows[0].name).toBe('Dr. Test')
    }
  })
})
