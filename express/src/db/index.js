import { createPoolWithSsh } from './pool.js'
import { createMemoryStore } from './memoryStore.js'
import { createSqlStore } from './sqlStore.js'

export async function createDb(config) {
  if (config.db.useMemory) {
    return {
      pool: null,
      tunnel: null,
      store: createMemoryStore(),
      async close() {}
    }
  }

  const { pool, tunnel } = await createPoolWithSsh(config)

  // 预热连接池：提前建立 2 个连接，避免首个请求等待
  try {
    await Promise.all([pool.connect(), pool.connect()].map(c => c.then(client => client.release())))
    console.log('[db] pool prewarmed (2 connections)')
  } catch (err) {
    console.warn('[db] prewarm failed:', err.message)
  }

  return {
    pool,
    tunnel,
    store: createSqlStore(pool),
    async close() {
      await pool.end()
      if (tunnel) {
        await tunnel.close()
        console.log('[ssh] tunnel closed')
      }
    }
  }
}
