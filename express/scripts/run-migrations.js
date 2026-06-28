import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPoolWithSsh } from '../src/db/pool.js'
import { loadEnv } from '../src/config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(__dirname, '..', 'migrations', 'kingbase')

async function ensureMigrationTable(pool) {
  await pool.query(`
    create table if not exists schema_migration (
      version varchar(128) primary key,
      applied_at timestamp not null default current_timestamp
    )
  `)
}

async function appliedVersions(pool) {
  const result = await pool.query('select version from schema_migration')
  return new Set(result.rows.map((row) => row.version))
}

async function main() {
  const config = loadEnv()
  const { pool, tunnel } = await createPoolWithSsh(config)

  try {
    await ensureMigrationTable(pool)
    const applied = await appliedVersions(pool)
    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const version = file.replace(/\.sql$/, '')

      if (applied.has(version)) {
        console.log(`[migration] skip ${version}`)
        continue
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8')
      console.log(`[migration] apply ${version}`)
      await pool.query('begin')
      try {
        await pool.query(sql)
        await pool.query(
          `insert into schema_migration (version, applied_at)
           values ($1, current_timestamp)`,
          [version]
        )
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    }

    console.log('[migration] done')
  } finally {
    await pool.end()
    if (tunnel) {
      await tunnel.close()
    }
  }
}

main().catch((error) => {
  console.error('[migration] failed')
  console.error(error)
  process.exitCode = 1
})
