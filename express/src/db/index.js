import { createPool } from './pool.js'
import { createMemoryStore } from './memoryStore.js'
import { createSqlStore } from './sqlStore.js'

export function createDb(config) {
  if (config.db.useMemory) {
    return {
      pool: null,
      store: createMemoryStore(),
      async close() {}
    }
  }

  const pool = createPool(config)

  return {
    pool,
    store: createSqlStore(pool),
    async close() {
      await pool.end()
    }
  }
}
