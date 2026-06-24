import { z } from 'zod'
import { asyncHandler, sendOk, validate } from '../../http/response.js'
import { authMiddleware } from '../auth/auth.js'

const profileSchema = z.object({
  diagnosed_diabetes: z.boolean().default(false),
  diabetes_type: z.enum(['type1', 'type2', 'gestational', 'special', 'unknown']).nullable().optional(),
  age: z.number().int().min(0).max(120).optional(),
  gender: z.enum(['male', 'female']).optional(),
  birth_date: z.string().optional(),
  height_cm: z.number().min(80).max(250).optional(),
  weight_kg: z.number().min(20).max(300).optional(),
  waist_cm: z.number().min(30).max(200).nullable().optional(),
  sbp_mm_hg: z.number().int().min(60).max(260).nullable().optional(),
  dbp_mm_hg: z.number().int().min(30).max(180).nullable().optional(),
  family_history_diabetes: z.boolean().optional(),
  past_history: z.array(z.string()).default([]),
  allergy: z.string().max(500).optional(),
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

export function registerProfileRoutes(router, deps) {
  const auth = authMiddleware(deps)

  router.get('/profile', auth, asyncHandler(async (req, res) => {
    const [profile, latestRisk] = await Promise.all([
      deps.store.getProfile(req.user.id),
      deps.store.getLatestRisk(req.user.id)
    ])

    sendOk(res, {
      profile,
      latest_risk: latestRisk
    })
  }))

  router.put('/profile', auth, validate(profileSchema), asyncHandler(async (req, res) => {
    const bmi = calculateBmi(req.body.height_cm, req.body.weight_kg)
    const profile = await deps.store.upsertProfile(req.user.id, {
      ...req.body,
      age_snapshot: req.body.age ?? null,
      bmi
    })

    sendOk(res, {
      profile_id: profile.id,
      bmi,
      updated_at: profile.updated_at
    })
  }))
}
