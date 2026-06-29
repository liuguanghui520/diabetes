export function normalizePlanTask(task, index = 0, options = {}) {
  return {
    task_type: task.task_type || task.category || 'review',
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
