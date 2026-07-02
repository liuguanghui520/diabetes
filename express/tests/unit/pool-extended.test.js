import { describe, expect, it, vi } from 'vitest'
import { createPoolWithSsh } from '../../src/db/pool.js'

vi.mock('pg', () => {
  const mockPool = vi.fn()
  mockPool.prototype.query = vi.fn()
  mockPool.prototype.connect = vi.fn()
  mockPool.prototype.end = vi.fn()
  return { default: { Pool: mockPool } }
})

vi.mock('../../src/db/sshTunnel.js', () => ({
  createSshTunnel: vi.fn().mockResolvedValue({
    localPort: 15432,
    close: vi.fn(),
  }),
}))

describe('pool.js extended', () => {
  describe('createPoolWithSsh', () => {
    it('returns pool without tunnel when SSH disabled', async () => {
      const config = {
        db: {
          host: '127.0.0.1', port: 5432, database: 'db', user: 'u', password: 'p', ssl: false,
          ssh: { enabled: false },
        },
      }
      const { pool, tunnel } = await createPoolWithSsh(config)
      expect(pool).toBeDefined()
      expect(tunnel).toBeNull()
    })

    it('returns pool with tunnel when SSH enabled', async () => {
      const config = {
        db: {
          host: '127.0.0.1', port: 5432, database: 'db', user: 'u', password: 'p', ssl: false,
          ssh: {
            enabled: true,
            host: 'ssh.example.com', port: 22, user: 'sshuser', password: 'pass',
            remoteDbHost: 'db.internal', remoteDbPort: 5432, localPort: 15432,
          },
        },
      }
      const { pool, tunnel } = await createPoolWithSsh(config)
      expect(pool).toBeDefined()
      expect(tunnel).toBeDefined()
      expect(tunnel.localPort).toBe(15432)
    })
  })
})
