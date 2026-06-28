import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]

    if (!item.startsWith('--')) {
      continue
    }

    const [rawKey, inlineValue] = item.slice(2).split('=')
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    const nextValue = argv[index + 1]
    const value = inlineValue ?? (nextValue && !nextValue.startsWith('--') ? nextValue : 'true')
    args[key] = value

    if (inlineValue === undefined && nextValue && !nextValue.startsWith('--')) {
      index += 1
    }
  }

  return args
}

export function loadEnv(cliArgs = parseCliArgs()) {
  const envFile = cliArgs.envFile || process.env.ENV_FILE
  const envPath = envFile
    ? path.resolve(process.cwd(), envFile)
    : path.join(projectRoot, '.env')

  dotenv.config({ path: envPath, quiet: true })

  const readBool = (value, fallback = false) => {
    if (value === undefined || value === null) {
      return fallback
    }

    return String(value) === 'true'
  }

  return {
    env: process.env.NODE_ENV || 'development',
    host: cliArgs.host || process.env.HOST || '127.0.0.1',
    port: Number(cliArgs.port || process.env.PORT || 3001),
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-only-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    db: {
      host: cliArgs.kingbaseHost || process.env.KINGBASE_HOST || '127.0.0.1',
      port: Number(cliArgs.kingbasePort || process.env.KINGBASE_PORT || 54321),
      database: cliArgs.kingbaseDatabase || process.env.KINGBASE_DATABASE || 'diabetes_assistant',
      user: cliArgs.kingbaseUser || process.env.KINGBASE_USER || 'system',
      password: cliArgs.kingbasePassword || process.env.KINGBASE_PASSWORD || '',
      ssl: readBool(cliArgs.kingbaseSsl, process.env.KINGBASE_SSL === 'true'),
      connectOnStart: readBool(cliArgs.dbConnectOnStart, process.env.DB_CONNECT_ON_START === 'true'),
      useMemory: readBool(cliArgs.useInMemoryDb, process.env.USE_IN_MEMORY_DB === 'true') || process.env.NODE_ENV === 'test',
      ssh: {
        enabled: readBool(cliArgs.sshEnabled, process.env.SSH_ENABLED === 'true'),
        host: cliArgs.sshHost || process.env.SSH_HOST || '',
        port: Number(cliArgs.sshPort || process.env.SSH_PORT || 22),
        user: cliArgs.sshUser || process.env.SSH_USER || '',
        password: cliArgs.sshPassword || process.env.SSH_PASSWORD || '',
        remoteDbHost: cliArgs.sshRemoteDbHost || process.env.SSH_REMOTE_DB_HOST || '127.0.0.1',
        remoteDbPort: Number(cliArgs.sshRemoteDbPort || process.env.SSH_REMOTE_DB_PORT || 54321),
        localPort: Number(cliArgs.sshLocalPort || process.env.SSH_LOCAL_PORT || 15432)
      }
    },
    dify: {
      baseUrl: (process.env.DIFY_BASE_URL || 'http://127.0.0.1').replace(/\/$/, ''),
      timeoutMs: Number(process.env.DIFY_TIMEOUT_MS || 120000),
      apiKeys: {
        risk: process.env.DIFY_RISK_API_KEY || '',
        plan: process.env.DIFY_PLAN_API_KEY || '',
        checkin: process.env.DIFY_CHECKIN_API_KEY || '',
        report: process.env.DIFY_REPORT_API_KEY || '',
        assistant: process.env.DIFY_ASSISTANT_API_KEY || '',
        doctor: process.env.DIFY_DOCTOR_API_KEY || '',
        admin: process.env.DIFY_ADMIN_API_KEY || ''
      }
    },
    internalDifyToken: process.env.INTERNAL_DIFY_TOKEN || 'change-me'
  }
}
