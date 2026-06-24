export const SCORE_RULE_VERSION = 'cdrs_2024_v1'

function isNil(value) {
  return value === null || value === undefined || value === ''
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function ageScore(age) {
  if (age <= 24) return 0
  if (age <= 34) return 4
  if (age <= 39) return 8
  if (age <= 44) return 11
  if (age <= 49) return 12
  if (age <= 54) return 13
  if (age <= 59) return 15
  if (age <= 64) return 16
  return 18
}

function bmiScore(bmi) {
  if (bmi < 22) return 0
  if (bmi < 24) return 1
  if (bmi < 30) return 3
  return 5
}

function waistScore(gender, waistCm) {
  const thresholds = gender === 'male'
    ? [75, 80, 85, 90, 95]
    : [70, 75, 80, 85, 90]

  if (waistCm < thresholds[0]) return 0
  if (waistCm < thresholds[1]) return 3
  if (waistCm < thresholds[2]) return 5
  if (waistCm < thresholds[3]) return 7
  if (waistCm < thresholds[4]) return 8
  return 10
}

function sbpScore(sbp) {
  if (sbp < 110) return 0
  if (sbp < 120) return 1
  if (sbp < 130) return 3
  if (sbp < 140) return 6
  if (sbp < 150) return 7
  if (sbp < 160) return 8
  return 10
}

export function validateRiskInput(input) {
  const issues = []

  if (typeof input.diagnosed_diabetes !== 'boolean') {
    issues.push('diagnosed_diabetes 必须为 boolean')
  }

  if (!Number.isFinite(input.age) || input.age < 0 || input.age > 120) {
    issues.push('age 必须在 0-120 岁之间')
  }

  if (!['male', 'female'].includes(input.gender)) {
    issues.push('gender 必须为 male 或 female')
  }

  if (!Number.isFinite(input.height_cm) || input.height_cm < 80 || input.height_cm > 250) {
    issues.push('height_cm 必须在 80-250 cm 之间')
  }

  if (!Number.isFinite(input.weight_kg) || input.weight_kg < 20 || input.weight_kg > 300) {
    issues.push('weight_kg 必须在 20-300 kg 之间')
  }

  if (typeof input.family_history_diabetes !== 'boolean') {
    issues.push('family_history_diabetes 必须为 boolean')
  }

  if (input.diagnosed_diabetes && !['type1', 'type2', 'gestational', 'special', 'unknown'].includes(input.diabetes_type)) {
    issues.push('已确诊用户必须提供 diabetes_type')
  }

  return issues
}

export function calculateChinaDiabetesRisk(input) {
  const bmi = round2(input.weight_kg / ((input.height_cm / 100) ** 2))

  if (input.diagnosed_diabetes) {
    return {
      score_status: 'diagnosed',
      score_rule_version: SCORE_RULE_VERSION,
      bmi,
      score: null,
      risk_level: 'diagnosed',
      is_high_risk: null,
      score_detail: {},
      missing_fields: []
    }
  }

  if (input.age < 20 || input.age > 74) {
    return {
      score_status: 'not_applicable',
      score_rule_version: SCORE_RULE_VERSION,
      bmi,
      score: null,
      risk_level: null,
      is_high_risk: null,
      score_detail: {
        bmi: bmiScore(bmi),
        family_history: input.family_history_diabetes ? 6 : 0,
        gender: input.gender === 'male' ? 2 : 0
      },
      missing_fields: []
    }
  }

  const missingFields = []

  if (isNil(input.waist_cm)) {
    missingFields.push('waist_cm')
  }

  if (isNil(input.sbp_mm_hg)) {
    missingFields.push('sbp_mm_hg')
  }

  const partialDetail = {
    age: ageScore(input.age),
    bmi: bmiScore(bmi),
    family_history: input.family_history_diabetes ? 6 : 0,
    gender: input.gender === 'male' ? 2 : 0
  }

  if (missingFields.length > 0) {
    return {
      score_status: 'incomplete',
      score_rule_version: SCORE_RULE_VERSION,
      bmi,
      score: null,
      risk_level: null,
      is_high_risk: null,
      score_detail: partialDetail,
      missing_fields: missingFields
    }
  }

  const scoreDetail = {
    ...partialDetail,
    waist: waistScore(input.gender, Number(input.waist_cm)),
    sbp: sbpScore(Number(input.sbp_mm_hg))
  }

  const score = Object.values(scoreDetail).reduce((sum, value) => sum + value, 0)
  const isHighRisk = score >= 25

  return {
    score_status: 'complete',
    score_rule_version: SCORE_RULE_VERSION,
    bmi,
    score,
    risk_level: isHighRisk ? 'high' : 'low',
    is_high_risk: isHighRisk,
    score_detail: scoreDetail,
    missing_fields: []
  }
}
