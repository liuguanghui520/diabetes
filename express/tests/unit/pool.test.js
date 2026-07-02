import { describe, expect, it, vi } from 'vitest'
import { createPool, checkDatabase } from '../../src/db/pool.js'

// Mock pg module
vi.mock('pg', () => {
  const mockPool = vi.fn()
  mockPool.prototype.query = vi.fn()
  mockPool.prototype.connect = vi.fn()
  mockPool.prototype.end = vi.fn()
  return {
    default: {
      Pool: mockPool,
    },
  }
})

describe('pool.js', () => {
  describe('createPool', () => {
    it('creates a pool with config', () => {
      const config = {
        db: {
          host: '127.0.0.1',
          port: 5432,
          database: 'testdb',
          user: 'testuser',
          password: 'testpass',
          ssl: false,
        },
      }
      const pool = createPool(config)
      expect(pool).toBeDefined()
      expect(typeof pool.query).toBe('function')
      expect(typeof pool.connect).toBe('function')
    })

    it('creates pool with SSL', () => {
      const config = {
        db: {
          host: '127.0.0.1',
          port: 5432,
          database: 'testdb',
          user: 'testuser',
          password: 'testpass',
          ssl: true,
        },
      }
      const pool = createPool(config)
      expect(pool).toBeDefined()
    })

    it('uses overrides for host and port', () => {
      const config = {
        db: {
          host: 'original',
          port: 5432,
          database: 'testdb',
          user: 'testuser',
          password: 'testpass',
          ssl: false,
        },
      }
      const pool = createPool(config, { host: 'overridden', port: 9999 })
      expect(pool).toBeDefined()
    })
  })

  describe('checkDatabase', () => {
    it('checks database and returns version', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ version: 'PostgreSQL 16.0' }],
        }),
      }
      const result = await checkDatabase(mockPool)
      expect(result.ok).toBe(true)
      expect(result.version).toBe('PostgreSQL 16.0')
      expect(result).toHaveProperty('checked_at')
    })
  })
})
