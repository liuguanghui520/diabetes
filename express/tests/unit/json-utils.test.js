import { describe, expect, it } from 'vitest'
import { safeJson, maskSensitive } from '../../src/utils/json.js'

describe('safeJson', () => {
  it('returns parsed object from valid JSON string', () => {
    expect(safeJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('returns fallback for invalid JSON string', () => {
    expect(safeJson('not-json', { fallback: true })).toEqual({ fallback: true })
  })

  it('returns fallback for invalid JSON with default null', () => {
    expect(safeJson('invalid')).toBe(null)
  })

  it('returns value as-is if already an object', () => {
    const obj = { x: 1 }
    expect(safeJson(obj)).toBe(obj)
  })

  it('returns fallback for null', () => {
    expect(safeJson(null, 'fallback')).toBe('fallback')
  })

  it('returns fallback for undefined', () => {
    expect(safeJson(undefined, 'fallback')).toBe('fallback')
  })

  it('returns number as-is', () => {
    expect(safeJson(42)).toBe(42)
  })

  it('returns array as-is', () => {
    const arr = [1, 2, 3]
    expect(safeJson(arr)).toBe(arr)
  })

  it('returns empty array string as parsed array', () => {
    expect(safeJson('[]')).toEqual([])
  })

  it('handles nested JSON string', () => {
    expect(safeJson('{"nested":{"deep":true}}')).toEqual({ nested: { deep: true } })
  })
})

describe('maskSensitive', () => {
  it('masks phone number in object', () => {
    const result = maskSensitive({ phone: '13812345678' })
    expect(result.phone).toBe('138****5678')
  })

  it('masks phone number starting with 139', () => {
    const result = maskSensitive({ phone: '13900139000' })
    expect(result.phone).toBe('139****9000')
  })

  it('masks email address', () => {
    const result = maskSensitive({ email: 'user@example.com' })
    expect(result.email).toBe('[masked-email]')
  })

  it('masks complex email', () => {
    const result = maskSensitive({ email: 'test.user_123@sub.domain.co.uk' })
    expect(result.email).toBe('[masked-email]')
  })

  it('handles null/undefined input', () => {
    const result = maskSensitive(null)
    expect(result).toEqual({})
  })

  it('handles undefined input', () => {
    const result = maskSensitive(undefined)
    expect(result).toEqual({})
  })

  it('does not modify harmless strings', () => {
    const result = maskSensitive({ name: '张三', age: '30' })
    expect(result.name).toBe('张三')
    expect(result.age).toBe('30')
  })

  it('masks multiple phone numbers', () => {
    const result = maskSensitive({ phones: ['13800001111', '15900002222'] })
    expect(result.phones[0]).toBe('138****1111')
    expect(result.phones[1]).toBe('159****2222')
  })

  it('does not mask 12-digit number (not a phone)', () => {
    const result = maskSensitive({ id: '123456789012' })
    expect(result.id).toBe('123456789012')
  })

  it('does not mask phone numbers starting with 120 (invalid prefix)', () => {
    const result = maskSensitive({ phone: '12012345678' })
    expect(result.phone).toBe('12012345678')
  })
})
