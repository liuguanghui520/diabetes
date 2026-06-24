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

  return {
    env: process.env.NODE_ENV || 'development',
    host: cliArgs.host || process.env.HOST || '127.0.0.1',
    port: Number(cliArgs.port || process.env.PORT || 3001),
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-only-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    db: {
      host: process.env.KINGBASE_HOST || '127.0.0.1',
      port: Number(process.env.KINGBASE_PORT || 54321),
      database: process.env.KINGBASE_DATABASE || 'diabetes_assistant',
      user: process.env.KINGBASE_USER || 'system',
      password: process.env.KINGBASE_PASSWORD || '',
      ssl: process.env.KINGBASE_SSL === 'true',
      connectOnStart: process.env.DB_CONNECT_ON_START === 'true',
      useMemory: process.env.USE_IN_MEMORY_DB === 'true' || process.env.NODE_ENV === 'test'
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
        doctor: process.env.DIFY_DOCTOR_API_KEY || ''
      }
    },
    internalDifyToken: process.env.INTERNAL_DIFY_TOKEN || 'change-me'
  }
}

export const appConfig = loadEnv()
