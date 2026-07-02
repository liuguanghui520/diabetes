import { describe, expect, it, vi } from 'vitest'
import { createDb } from '../../src/db/index.js'

describe('db/index', () => {
  describe('createDb — memory store path', () => {
    it('returns memory store when useMemory is true', async () => {
      const config = {
        db: { useMemory: true },
      }
      const db = await createDb(config)
      expect(db.pool).toBeNull()
      expect(db.tunnel).toBeNull()
      expect(db.store).toBeDefined()
      expect(typeof db.close).toBe('function')
      await db.close()
    })
  })
})
