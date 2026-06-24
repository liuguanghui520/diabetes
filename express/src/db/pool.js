import pg from 'pg'

const { Pool } = pg

export function createPool(config) {
  return new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  })
}

export async function checkDatabase(pool) {
  const result = await pool.query('select version() as version')

  return {
    ok: true,
    version: result.rows[0]?.version || '',
    checked_at: new Date().toISOString()
  }
}
