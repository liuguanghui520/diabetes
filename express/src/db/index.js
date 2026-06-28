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
