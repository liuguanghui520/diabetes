import { describe, expect, it } from 'vitest'
import { calculateChinaDiabetesRisk } from '../../src/modules/risk/scoring.js'

const base = {
  diagnosed_diabetes: false,
  diabetes_type: null,
  age: 40,
  gender: 'female',
  height_cm: 170,
  weight_kg: 60,
  waist_cm: 70,
  sbp_mm_hg: 110,
  family_history_diabetes: false
}

describe('calculateChinaDiabetesRisk', () => {
  it('matches the documented 37-point example', () => {
    const result = calculateChinaDiabetesRisk({
      diagnosed_diabetes: false,
      diabetes_type: null,
      age: 65,
      gender: 'male',
      height_cm: 170,
      weight_kg: 85,
      waist_cm: 85,
      sbp_mm_hg: 110,
      family_history_diabetes: true
    })

    expect(result.bmi).toBe(29.41)
    expect(result.score).toBe(37)
    expect(result.risk_level).toBe('high')
    expect(result.score_detail).toEqual({
      age: 18,
      bmi: 3,
      family_history: 6,
      gender: 2,
      waist: 7,
      sbp: 1
    })
  })

  it.each([
    [20, 0],
    [24, 0],
    [25, 4],
    [34, 4],
    [35, 8],
    [39, 8],
    [40, 11],
    [44, 11],
    [45, 12],
    [49, 12],
    [50, 13],
    [54, 13],
    [55, 15],
    [59, 15],
    [60, 16],
    [64, 16],
    [65, 18],
    [74, 18]
  ])('scores age boundary %s as %s', (age, expected) => {
    expect(calculateChinaDiabetesRisk({ ...base, age }).score_detail.age).toBe(expected)
  })

  it.each([
    [21.99, 0],
    [22.00, 1],
    [23.99, 1],
    [24.00, 3],
    [29.99, 3],
    [30.00, 5]
  ])('scores BMI boundary %s as %s', (bmi, expected) => {
    const height = 100
    const result = calculateChinaDiabetesRisk({
      ...base,
      height_cm: height,
      weight_kg: bmi
    })

    expect(result.score_detail.bmi).toBe(expected)
  })

  it.each([
    ['male', 74.99, 0],
    ['male', 75.00, 3],
    ['male', 79.99, 3],
    ['male', 80.00, 5],
    ['male', 84.99, 5],
    ['male', 85.00, 7],
    ['male', 89.99, 7],
    ['male', 90.00, 8],
    ['male', 94.99, 8],
    ['male', 95.00, 10],
    ['female', 69.99, 0],
    ['female', 70.00, 3],
    ['female', 74.99, 3],
    ['female', 75.00, 5],
    ['female', 79.99, 5],
    ['female', 80.00, 7],
    ['female', 84.99, 7],
    ['female', 85.00, 8],
    ['female', 89.99, 8],
    ['female', 90.00, 10]
  ])('scores waist boundary %s %s as %s', (gender, waist, expected) => {
    const result = calculateChinaDiabetesRisk({
      ...base,
      gender,
      waist_cm: waist
    })

    expect(result.score_detail.waist).toBe(expected)
  })

  it.each([
    [109, 0],
    [110, 1],
    [119, 1],
    [120, 3],
    [129, 3],
    [130, 6],
    [139, 6],
    [140, 7],
    [149, 7],
    [150, 8],
    [159, 8],
    [160, 10]
  ])('scores SBP boundary %s as %s', (sbp, expected) => {
    expect(calculateChinaDiabetesRisk({ ...base, sbp_mm_hg: sbp }).score_detail.sbp).toBe(expected)
  })

  it('returns incomplete without formal score when waist or sbp is missing', () => {
    const result = calculateChinaDiabetesRisk({
      ...base,
      waist_cm: null,
      sbp_mm_hg: undefined
    })

    expect(result.score_status).toBe('incomplete')
    expect(result.score).toBeNull()
    expect(result.risk_level).toBeNull()
    expect(result.is_high_risk).toBeNull()
    expect(result.missing_fields).toEqual(['waist_cm', 'sbp_mm_hg'])
  })

  it('returns not_applicable outside 20-74 without formal risk level', () => {
    expect(calculateChinaDiabetesRisk({ ...base, age: 19 }).score_status).toBe('not_applicable')
    expect(calculateChinaDiabetesRisk({ ...base, age: 75 }).risk_level).toBeNull()
  })

  it('returns diagnosed without formal prevention score', () => {
    const result = calculateChinaDiabetesRisk({
      ...base,
      diagnosed_diabetes: true,
      diabetes_type: 'type2'
    })

    expect(result.score_status).toBe('diagnosed')
    expect(result.score).toBeNull()
    expect(result.risk_level).toBe('diagnosed')
  })
})
