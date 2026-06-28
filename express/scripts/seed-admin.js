import bcrypt from 'bcryptjs'
import { createPoolWithSsh } from '../src/db/pool.js'
import { loadEnv, parseCliArgs } from '../src/config/env.js'

async function main() {
  const args = parseCliArgs()
  const username = args.username || process.env.ADMIN_USERNAME
  const password = args.password || process.env.ADMIN_PASSWORD
  const role = args.role || 'admin'

  if (!username || !password) {
    throw new Error('Usage: npm run seed:admin -- --username admin --password <password>')
  }

  if (!['admin', 'super_admin'].includes(role)) {
    throw new Error('role must be admin or super_admin')
  }

  const config = loadEnv(args)
  const { pool, tunnel } = await createPoolWithSsh(config)

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `insert into sys_user
       (username, password_hash, role, status, nickname, created_at, updated_at)
       values ($1, $2, $3, 'active', $1, current_timestamp, current_timestamp)
       on conflict (username) do update set
         password_hash = excluded.password_hash,
         role = excluded.role,
         status = 'active',
         updated_at = current_timestamp
       returning id, username, role, status`,
      [username, passwordHash, role]
    )

    console.log('[seed:admin] ready')
    console.log(JSON.stringify(result.rows[0], null, 2))
  } finally {
    await pool.end()
    if (tunnel) {
      await tunnel.close()
    }
  }
}

main().catch((error) => {
  console.error('[seed:admin] failed')
  console.error(error)
  process.exitCode = 1
})
