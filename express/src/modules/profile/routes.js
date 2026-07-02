import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { authMiddleware } from '../auth/auth.js'

const profileSchema = z.object({
  nickname: z.string().max(16).optional(),
  avatar_url: z.string().max(500).optional(),
  diagnosed_diabetes: z.boolean().nullable().optional(),
  diabetes_type: z.enum(['type1', 'type2', 'gestational', 'special', 'unknown']).nullable().optional(),
  age: z.number().int().min(0).max(120).optional(),
  gender: z.enum(['male', 'female', 'unknown']).nullable().optional(),
  birth_date: z.string().nullable().optional(),
  height_cm: z.number().min(80).max(250).nullable().optional(),
  weight_kg: z.number().min(20).max(300).nullable().optional(),
  waist_cm: z.number().min(30).max(200).nullable().optional(),
  sbp_mm_hg: z.number().int().min(60).max(260).nullable().optional(),
  dbp_mm_hg: z.number().int().min(30).max(180).nullable().optional(),
  fasting_glucose: z.number().min(0).max(50).nullable().optional(),
  postprandial_glucose: z.number().min(0).max(50).nullable().optional(),
  hba1c: z.number().min(0).max(30).nullable().optional(),
  family_history_diabetes: z.boolean().nullable().optional(),
  past_history: z.array(z.string()).default([]),
  allergy: z.string().max(500).optional(),
  hometown: z.string().max(24).nullable().optional(),
  city: z.string().max(24).nullable().optional(),
  occupation: z.string().max(24).nullable().optional(),
  medication_status: z.string().max(128).nullable().optional(),
  lifestyle: z.record(z.string(), z.unknown()).default({}),
  emergency_contact: z.string().max(64).optional(),
  emergency_phone: z.string().max(32).optional()
})

function calculateBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) {
    return null
  }

  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 100) / 100
}

function calculateAge(birthDate) {
  if (!birthDate) return null

  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }

  return age >= 0 && age <= 120 ? age : null
}

function calculateCompletionRate(profile) {
  if (!profile) return 0
  const fields = ['gender', 'age_snapshot', 'height_cm', 'weight_kg', 'waist_cm', 'sbp_mm_hg', 'family_history_diabetes']
  const completed = fields.filter((f) => profile[f] !== null && profile[f] !== undefined && profile[f] !== '')
  return Math.round((completed.length / fields.length) * 100)
}

export function registerProfileRoutes(router, deps) {
  const auth = authMiddleware(deps)

  router.get('/profile', auth, asyncHandler(async (req, res) => {
    const [profile, latestRisk, user] = await Promise.all([
      deps.store.getProfile(req.user.id),
      deps.store.getLatestRisk(req.user.id),
      deps.store.findUserById(req.user.id),
    ])

    sendOk(res, {
      profile: {
        ...(profile || {}),
        nickname: profile?.nickname || user?.nickname || null,
        completion_rate: calculateCompletionRate(profile),
        fasting_glucose: profile?.fasting_glucose || null,
        postprandial_glucose: profile?.postprandial_glucose || null,
        hba1c: profile?.hba1c || null,
      },
      user: user
        ? {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatar_url: user.avatar_url || null,
            role: user.role,
            phone: user.phone || null,
            email: user.email || null,
          }
        : null,
      latest_risk: latestRisk
    })
  }))

  router.put('/profile', auth, validate(profileSchema), asyncHandler(async (req, res) => {
    const existing = await deps.store.getProfile(req.user.id)
    const next = {
      ...(existing || {}),
      ...req.body,
      gender: ['male', 'female'].includes(req.body.gender) ? req.body.gender : req.body.gender === undefined ? existing?.gender : null,
      birth_date: req.body.birth_date === undefined ? existing?.birth_date : req.body.birth_date || null
    }
    const bmi = calculateBmi(next.height_cm, next.weight_kg)
    const ageSnapshot = req.body.age
      ?? (req.body.birth_date !== undefined ? calculateAge(req.body.birth_date || null) : null)
      ?? next.age_snapshot
      ?? calculateAge(next.birth_date)
    const profile = await deps.store.upsertProfile(req.user.id, {
      ...next,
      age_snapshot: ageSnapshot,
      bmi
    })

    sendOk(res, {
      profile_id: profile.id,
      bmi,
      updated_at: profile.updated_at,
      profile,
    })
  }))
}
