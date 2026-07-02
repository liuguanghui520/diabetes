import { describe, expect, it } from 'vitest'
import { normalizePlanTask } from '../../src/utils/planTask.js'

describe('normalizePlanTask', () => {
  it('maps Chinese 饮食 to diet', () => {
    const result = normalizePlanTask({ task_type: '饮食', title: '低糖饮食' })
    expect(result.task_type).toBe('diet')
    expect(result.title).toBe('低糖饮食')
  })

  it('maps Chinese 运动 to exercise', () => {
    const result = normalizePlanTask({ task_type: '运动', title: '晨跑' })
    expect(result.task_type).toBe('exercise')
  })

  it('maps Chinese 饮水 to water', () => {
    const result = normalizePlanTask({ task_type: '饮水', title: '喝水' })
    expect(result.task_type).toBe('water')
  })

  it('maps Chinese 睡眠 to sleep', () => {
    const result = normalizePlanTask({ task_type: '睡眠', title: '早睡' })
    expect(result.task_type).toBe('sleep')
  })

  it('maps Chinese 血糖 to glucose', () => {
    const result = normalizePlanTask({ task_type: '血糖', title: '测血糖' })
    expect(result.task_type).toBe('glucose')
  })

  it('maps Chinese 复查 to review', () => {
    const result = normalizePlanTask({ task_type: '复查', title: '复查' })
    expect(result.task_type).toBe('review')
  })

  it('passes through valid English task_type', () => {
    const result = normalizePlanTask({ task_type: 'diet', title: 'Meal plan' })
    expect(result.task_type).toBe('diet')
  })

  it('maps food to diet', () => {
    const result = normalizePlanTask({ task_type: 'food', title: '食物' })
    expect(result.task_type).toBe('diet')
  })

  it('maps workout to exercise', () => {
    const result = normalizePlanTask({ task_type: 'workout', title: '锻炼' })
    expect(result.task_type).toBe('exercise')
  })

  it('maps blood_sugar to glucose', () => {
    const result = normalizePlanTask({ task_type: 'blood_sugar', title: '血糖' })
    expect(result.task_type).toBe('glucose')
  })

  it('defaults unknown task_type to review', () => {
    const result = normalizePlanTask({ task_type: 'unknown_type', title: '未知' })
    expect(result.task_type).toBe('review')
  })

  it('uses category field as fallback', () => {
    const result = normalizePlanTask({ category: 'diet', title: '饮食' })
    expect(result.task_type).toBe('diet')
  })

  it('provides default title when missing', () => {
    const result = normalizePlanTask({ task_type: 'diet' })
    expect(result.title).toBe('健康管理任务')
  })

  it('uses description field', () => {
    const result = normalizePlanTask({ task_type: 'diet', description: '吃蔬菜' })
    expect(result.description).toBe('吃蔬菜')
  })

  it('falls back to desc field for description', () => {
    const result = normalizePlanTask({ task_type: 'diet', desc: '多喝水' })
    expect(result.description).toBe('多喝水')
  })

  it('falls back to content field for description', () => {
    const result = normalizePlanTask({ task_type: 'diet', content: '注意饮食' })
    expect(result.description).toBe('注意饮食')
  })

  it('uses target_value', () => {
    const result = normalizePlanTask({ task_type: 'water', target_value: 2000 })
    expect(result.target_value).toBe(2000)
  })

  it('falls back to value for target_value', () => {
    const result = normalizePlanTask({ task_type: 'water', value: 1500 })
    expect(result.target_value).toBe(1500)
  })

  it('uses unit field', () => {
    const result = normalizePlanTask({ task_type: 'water', unit: 'ml' })
    expect(result.unit).toBe('ml')
  })

  it('uses target_time field', () => {
    const result = normalizePlanTask({ task_type: 'sleep', target_time: '22:00' })
    expect(result.target_time).toBe('22:00')
  })

  it('uses time field as fallback for target_time', () => {
    const result = normalizePlanTask({ task_type: 'sleep', time: '07:00' })
    expect(result.target_time).toBe('07:00')
  })

  it('uses emptyTimeFallback when no time fields set', () => {
    // In the real normalizePlanTask, target_time uses || chain:
    // task.target_time || task.time || options.emptyTimeFallback || null
    // emptyTimeFallback of '' is falsy, so final fallback is null
    const result = normalizePlanTask({ task_type: 'sleep' }, 0, { emptyTimeFallback: '' })
    expect(result.target_time).toBe(null)
  })

  it('uses weekdays field', () => {
    const result = normalizePlanTask({ task_type: 'exercise', weekdays: [1, 3, 5] })
    expect(result.weekdays).toEqual([1, 3, 5])
  })

  it('uses sort_order from task or index', () => {
    const result1 = normalizePlanTask({ task_type: 'diet', sort_order: 5 })
    expect(result1.sort_order).toBe(5)

    const result2 = normalizePlanTask({ task_type: 'diet' }, 3)
    expect(result2.sort_order).toBe(3)
  })

  it('includes metadata', () => {
    const result = normalizePlanTask({ task_type: 'diet', metadata: { source: 'dify' } })
    expect(result.metadata).toEqual({ source: 'dify' })
  })

  it('has empty metadata by default', () => {
    const result = normalizePlanTask({ task_type: 'diet' })
    expect(result.metadata).toEqual({})
  })

  it('maps 锻炼 to exercise', () => {
    const result = normalizePlanTask({ task_type: '锻炼' })
    expect(result.task_type).toBe('exercise')
  })

  it('maps 监测 to glucose', () => {
    const result = normalizePlanTask({ task_type: '监测' })
    expect(result.task_type).toBe('glucose')
  })

  it('maps drink to water', () => {
    const result = normalizePlanTask({ task_type: 'drink' })
    expect(result.task_type).toBe('water')
  })

  it('maps rest to sleep', () => {
    const result = normalizePlanTask({ task_type: 'rest' })
    expect(result.task_type).toBe('sleep')
  })

  it('maps checkup to review', () => {
    const result = normalizePlanTask({ task_type: 'checkup' })
    expect(result.task_type).toBe('review')
  })

  it('maps meal to diet', () => {
    const result = normalizePlanTask({ task_type: 'meal' })
    expect(result.task_type).toBe('diet')
  })

  it('maps 营养 to diet', () => {
    const result = normalizePlanTask({ task_type: '营养' })
    expect(result.task_type).toBe('diet')
  })

  it('maps hydration to water', () => {
    const result = normalizePlanTask({ task_type: 'hydration' })
    expect(result.task_type).toBe('water')
  })

  it('maps nap to sleep', () => {
    const result = normalizePlanTask({ task_type: 'nap' })
    expect(result.task_type).toBe('sleep')
  })

  it('maps sport to exercise', () => {
    const result = normalizePlanTask({ task_type: 'sport' })
    expect(result.task_type).toBe('exercise')
  })

  it('maps 复诊 to review', () => {
    const result = normalizePlanTask({ task_type: '复诊' })
    expect(result.task_type).toBe('review')
  })
})
