import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { errors } from '../../http/errors.js'
import { createPasswordAttemptLimiter } from '../../http/security.js'

const registerSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(6).max(128),
  phone: z.string().max(32).optional(),
  email: z.string().email().max(128).optional(),
  nickname: z.string().max(64).optional()
})

const loginSchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1)
})

const changePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(1).max(128),
})

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    phone: user.phone || null,
    email: user.email || null,
    token_version: Number(user.token_version || 0),
  }
}

export function signToken(user, config) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      token_version: Number(user.token_version || 0),
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
}

export function authMiddleware({ store, config }) {
  return asyncHandler(async (req, _res, next) => {
    const header = req.header('Authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''

    if (!token) {
      throw errors.unauthorized()
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret)
      const user = await store.findUserById(payload.sub)

      if (!user || user.status !== 'active') {
        throw errors.unauthorized()
      }

      if (Number(payload.token_version || 0) !== Number(user.token_version || 0)) {
        throw errors.unauthorized('登录状态已失效，请重新登录。')
      }

      req.user = user
      next()
    } catch (error) {
      if (error.code) {
        throw error
      }
      throw errors.unauthorized()
    }
  })
}

export function adminMiddleware(deps) {
  const auth = authMiddleware(deps)

  return [
    auth,
    asyncHandler(async (req, _res, next) => {
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        throw errors.forbidden('需要管理员权限')
      }

      next()
    })
  ]
}

export function registerAuthRoutes(router, deps, options = {}) {
  const { store, config } = deps
  const sensitiveLimiter = options.sensitiveLimiter || ((_req, _res, next) => next())
  const passwordAttemptLimiter = createPasswordAttemptLimiter(config)

  router.post('/auth/register', sensitiveLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
    const passwordHash = await bcrypt.hash(req.body.password, 10)
    const user = await store.createUser({
      username: req.body.username,
      phone: req.body.phone,
      email: req.body.email,
      nickname: req.body.nickname,
      password_hash: passwordHash,
      role: 'user'
    })

    sendOk(res, {
      user: publicUser(user),
      token: signToken(user, config)
    })
  }))

  router.post('/auth/login', sensitiveLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
    const user = await store.findUserByAccount(req.body.account)

    if (!user || user.status !== 'active') {
      throw errors.unauthorized('账号或密码错误')
    }

    const matched = await bcrypt.compare(req.body.password, user.password_hash)

    if (!matched) {
      throw errors.unauthorized('账号或密码错误')
    }

    await store.updateLastLogin?.(user.id, {
      last_login_ip: req.ip || req.socket?.remoteAddress || ''
    })

    sendOk(res, {
      user: publicUser(user),
      token: signToken(user, config)
    })
  }))

  router.get('/auth/me', authMiddleware(deps), asyncHandler(async (req, res) => {
    const profile = await store.getProfile(req.user.id)

    sendOk(res, {
      user: publicUser(req.user),
      profile_completed: Boolean(profile),
      archive_progress: profile ? 70 : 20
    })
  }))

  router.put('/auth/password', authMiddleware(deps), passwordAttemptLimiter, validate(changePasswordSchema), asyncHandler(async (req, res) => {
    const oldPassword = req.body.old_password
    const newPassword = req.body.new_password

    if (newPassword.length < 6) {
      return res.status(400).json({
        code: 40032,
        message: '新密码至少需要 6 位。',
        details: [],
        traceId: req.traceId,
      })
    }

    const matched = await bcrypt.compare(oldPassword, req.user.password_hash)

    if (!matched) {
      return res.status(400).json({
        code: 40031,
        message: '当前密码不正确。',
        details: [],
        traceId: req.traceId,
      })
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, req.user.password_hash)

    if (sameAsCurrent) {
      return res.status(400).json({
        code: 40033,
        message: '新密码不能与当前密码相同。',
        details: [],
        traceId: req.traceId,
      })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await store.updatePassword(req.user.id, passwordHash, {
      ip_address: req.ip || req.socket?.remoteAddress || '',
      user_agent: req.header('user-agent') || '',
    })

    sendOk(res, {
      changed_at: new Date().toISOString(),
      re_login_required: true,
    }, '密码修改成功，请重新登录')
  }))
}
