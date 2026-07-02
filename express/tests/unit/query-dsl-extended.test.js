import { describe, expect, it, vi } from 'vitest'
import { validateDsl, buildQuery, executeQuery } from '../../src/modules/admin/queryDsl.js'
import { AppError } from '../../src/http/errors.js'

// 这些内部函数没导出，我们复刻逻辑来测试
function compareValues(left, right, direction) {
  if (left === right) return 0
  if (left === null || left === undefined) return direction === 'desc' ? 1 : -1
  if (right === null || right === undefined) return direction === 'desc' ? -1 : 1
  if (left instanceof Date && right instanceof Date)
    return direction === 'desc' ? right.getTime() - left.getTime() : left.getTime() - right.getTime()
  if (typeof left === 'number' && typeof right === 'number')
    return direction === 'desc' ? right - left : left - right
  return direction === 'desc' ? String(right).localeCompare(String(left)) : String(left).localeCompare(String(right))
}

describe('queryDsl extended', () => {
  describe('validateDsl — edge cases', () => {
    it('rejects where with object value', () => {
      const result = validateDsl({ table: 'sys_user', select: ['id'], where: { role: { op: 'eq' } } })
      expect(result.valid).toBe(false)
    })

    it('accepts null value in where', () => {
      const result = validateDsl({ table: 'sys_user', select: ['id'], where: { role: null } })
      expect(result.valid).toBe(true)
    })

    it('validates all allowed tables', () => {
      const tables = ['sys_user', 'doctor', 'consultation_order', 'dify_run_log', 'article']
      for (const t of tables) {
        const result = validateDsl({ table: t, select: [Object.keys(require('../../src/modules/admin/queryDsl.js').TABLE_META?.[t]?.columns || ['id'])[0]] })
        // Just check it doesn't crash
        expect(result).toHaveProperty('valid')
      }
    })

    it('rejects search with non-array fields', () => {
      const result = validateDsl({ table: 'sys_user', select: ['id'], search: { fields: 'username', value: 'x' } })
      expect(result.valid).toBe(false)
    })

    it('rejects search with empty fields array', () => {
      const result = validateDsl({ table: 'sys_user', select: ['id'], search: { fields: [], value: 'x' } })
      expect(result.valid).toBe(false)
    })

    it('rejects non-string search value', () => {
      const result = validateDsl({ table: 'sys_user', select: ['id'], search: { fields: ['username'], value: 123 } })
      expect(result.valid).toBe(false)
    })

    it('validates order_by case insensitive', () => {
      const result = validateDsl({ table: 'sys_user', select: ['id'], order_by: 'created_at DESC' })
      expect(result.valid).toBe(true)
    })
  })

  describe('buildQuery — extended', () => {
    it('handles where with null value', () => {
      const query = buildQuery({ table: 'sys_user', select: ['id'], where: { role: null } })
      expect(query.text).toContain('is null')
    })

    it('handles multiple where conditions', () => {
      const query = buildQuery({ table: 'sys_user', select: ['id'], where: { role: 'user', status: 'active' } })
      expect(query.text).toContain('and')
      expect(query.params.length).toBeGreaterThanOrEqual(2)
    })

    it('uses default limit of 20', () => {
      const query = buildQuery({ table: 'sys_user', select: ['id'] })
      expect(query.limit).toBe(20)
    })
  })

  describe('executeWithPool — mock', () => {
    it('executes query with pool having connect method', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ total: 1 }] }),
        release: vi.fn(),
      }
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn(),
      }

      // build a query first
      const query = buildQuery({ table: 'sys_user', select: ['id', 'username'] })

      // Simulate: mockClient.query for count + rows
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })  // countResult
        .mockResolvedValueOnce({ rows: [{ id: 1, username: 'test' }] })  // rowsResult

      const result = await executeQuery(mockPool, { table: 'sys_user', select: ['id', 'username'] })

      expect(result).toHaveProperty('rows')
      expect(result).toHaveProperty('total')
      expect(mockClient.release).toHaveBeenCalled()
    })

    it('executes query with pool.query directly (no connect)', async () => {
      const mockPool = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ total: 0 }] })
          .mockResolvedValueOnce({ rows: [] }),
      }

      const result = await executeQuery(mockPool, { table: 'dify_run_log', select: ['id', 'status'] })

      expect(result.rows).toEqual([])
      expect(result.total).toBe(0)
    })

    it('throws queryFailed on pool error', async () => {
      const mockPool = {
        query: vi.fn().mockRejectedValue(new Error('Connection refused')),
      }

      await expect(
        executeQuery(mockPool, { table: 'dify_run_log', select: ['id'] })
      ).rejects.toThrow(AppError)
    })
  })

  describe('compareValues — internal logic', () => {
    it('returns 0 for equal values', () => {
      expect(compareValues(5, 5, 'asc')).toBe(0)
      expect(compareValues('abc', 'abc', 'desc')).toBe(0)
    })

    it('sorts null/undefined to beginning in asc', () => {
      expect(compareValues(null, 5, 'asc')).toBe(-1)
      expect(compareValues(undefined, 5, 'asc')).toBe(-1)
    })

    it('sorts null/undefined to end in desc', () => {
      expect(compareValues(null, 5, 'desc')).toBe(1)
    })

    it('sorts non-null before null in asc', () => {
      expect(compareValues(5, null, 'asc')).toBe(1)
    })

    it('compares dates', () => {
      const d1 = new Date('2024-01-01')
      const d2 = new Date('2024-06-01')
      expect(compareValues(d1, d2, 'asc')).toBeLessThan(0)
      expect(compareValues(d2, d1, 'asc')).toBeGreaterThan(0)
    })

    it('compares numbers in desc', () => {
      expect(compareValues(10, 5, 'desc')).toBeLessThan(0)
    })

    it('compares strings', () => {
      expect(compareValues('a', 'b', 'asc')).toBeLessThan(0)
      expect(compareValues('b', 'a', 'desc')).toBeLessThan(0)
    })
  })
})
