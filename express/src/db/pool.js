import pg from 'pg'
import { createSshTunnel } from './sshTunnel.js'

const { Pool } = pg

export function createPool(config, overrides = {}) {
  const host = overrides.host ?? config.db.host
  const port = overrides.port ?? config.db.port

  return new Pool({
    host,
    port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false
  })
}

/**
 * 如果配置了 SSH 隧道，先建立隧道，再创建连接池。
 * 返回 { pool, tunnel }，tunnel 需要在应用关闭时调用 tunnel.close()。
 */
export async function createPoolWithSsh(config) {
  const ssh = config.db.ssh

  if (!ssh || !ssh.enabled) {
    return { pool: createPool(config), tunnel: null }
  }

  console.log(`[ssh] connecting to ${ssh.host}:${ssh.port} ...`)
  const tunnel = await createSshTunnel({
    sshHost: ssh.host,
    sshPort: ssh.port,
    sshUser: ssh.user,
    sshPassword: ssh.password,
    remoteHost: ssh.remoteDbHost,
    remotePort: ssh.remoteDbPort,
    localPort: ssh.localPort
  })
  console.log(`[ssh] tunnel ready: 127.0.0.1:${tunnel.localPort} -> ${ssh.remoteDbHost}:${ssh.remoteDbPort}`)

  const pool = createPool(config, {
    host: '127.0.0.1',
    port: tunnel.localPort
  })

  return { pool, tunnel }
}

export async function checkDatabase(pool) {
  const result = await pool.query('select version() as version')

  return {
    ok: true,
    version: result.rows[0]?.version || '',
    checked_at: new Date().toISOString()
  }
}
