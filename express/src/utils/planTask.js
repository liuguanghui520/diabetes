const VALID_TASK_TYPES = new Set(['diet', 'exercise', 'water', 'sleep', 'glucose', 'review'])

function toValidTaskType(value) {
  if (VALID_TASK_TYPES.has(value)) return value
  // Map common Dify outputs to valid types
  const mapping = {
    '饮食': 'diet', 'food': 'diet', 'meal': 'diet', '营养': 'diet',
    '运动': 'exercise', 'sport': 'exercise', 'workout': 'exercise', '锻炼': 'exercise',
    '饮水': 'water', 'drink': 'water', 'hydration': 'water',
    '睡眠': 'sleep', 'rest': 'sleep', 'nap': 'sleep',
    '血糖': 'glucose', 'blood_sugar': 'glucose', '监测': 'glucose',
    '复查': 'review', 'checkup': 'review', '复诊': 'review'
  }
  return mapping[value] || 'review'
}

export function normalizePlanTask(task, index = 0, options = {}) {
  const raw = task.task_type || task.category || 'review'
  return {
    task_type: toValidTaskType(raw),
    title: task.title || '健康管理任务',
    description: task.description || task.desc || task.content || '',
    target_value: task.target_value ?? task.value ?? null,
    unit: task.unit || null,
    target_time: task.target_time || task.time || options.emptyTimeFallback || null,
    weekdays: task.weekdays || null,
    sort_order: task.sort_order ?? index,
    metadata: task.metadata || {}
  }
}
