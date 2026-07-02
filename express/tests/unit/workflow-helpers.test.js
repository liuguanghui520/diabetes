import { describe, expect, it } from 'vitest'

// These functions are internal to workflow/routes.js and not exported.
// We test them by re-implementing the logic here.

function splitTargetValue(target) {
  const text = String(target || '').trim()
  if (!text) return { target_value: null, unit: null }
  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(text)
  if (!match) return { target_value: null, unit: text }
  return { target_value: Number(match[1]), unit: match[2]?.trim() || null }
}

function workflowResponse({ requestId, appCode, log = null }) {
  const outputs = safeJson(log?.outputs, log?.outputs) || {}
  return {
    request_id: requestId,
    app_code: appCode || log?.app_code || '',
    status: log?.status || 'processing',
    workflow_run_id: log?.workflow_run_id || null,
    task_id: log?.task_id || null,
    result: outputs.result || null,
    outputs: outputs.workflow_outputs || outputs,
    error_message: log?.error_message || null,
    elapsed_time: log?.elapsed_time || null
  }
}

function safeJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

function normalizePlanOutput(outputs, preferences) {
  const parsed = safeJson(outputs, outputs) || {}
  const plan = parsed.result || parsed.plan || parsed.data || parsed
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : []
  return {
    title: String(plan.title || preferences.goal || 'AI 生活方案'),
    summary: String(plan.summary || plan.goal_summary || ''),
    sections: Array.isArray(plan.sections) ? plan.sections : [],
    tasks: tasks.map((task, index) => normalizePlanTask(task, index, { emptyTimeFallback: '' })),
    disclaimer: String(plan.disclaimer || ''),
    raw: plan
  }
}

function normalizePlanTask(task, index = 0, options = {}) {
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

const VALID_TASK_TYPES = new Set(['diet', 'exercise', 'water', 'sleep', 'glucose', 'review'])
function toValidTaskType(value) {
  if (VALID_TASK_TYPES.has(value)) return value
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

function normalizeAnalysisOutput(outputs, summary) {
  const parsed = safeJson(outputs, outputs) || {}
  const analysis = parsed.result || parsed.analysis || parsed.data || parsed
  const completionRate = Number(analysis.completion_rate ?? summary.completion_rate ?? 0)
  const improvements = Array.isArray(analysis.improvements) ? analysis.improvements : []
  const advice = analysis.advice || improvements.join('；') || '继续保持规律记录，优先完成饮食和运动两类核心打卡。'
  return {
    completion_rate: Math.max(0, Math.min(100, Math.round(completionRate))),
    metrics: analysis.metrics || summary.by_type || {},
    evaluation: String(analysis.evaluation || analysis.summary || '已根据近期打卡记录生成生活状态分析。'),
    improvements,
    advice: String(advice),
    raw: analysis
  }
}

function normalizeReportOutput(outputs) {
  const parsed = safeJson(outputs, outputs) || {}
  const report = parsed.result || parsed.report || parsed.interpretation || parsed.data || parsed
  return {
    status: report.status || 'pending_confirm',
    indicators: Array.isArray(report.indicators) ? report.indicators : [],
    summary: String(report.summary || '已完成报告文本初步解读，请结合原始报告和医生意见确认。'),
    advice: Array.isArray(report.advice) ? report.advice : [],
    confirm_required: report.confirm_required !== false,
    raw: report
  }
}

function normalizeManualPlanTask(task) {
  const { target_value, unit } = splitTargetValue(task.target)
  return {
    id: task.id ? Number(task.id) : undefined,
    category: task.category,
    title: task.title,
    desc: task.desc || '',
    target: task.target || '',
    time: task.time || '',
    startDate: task.startDate || null,
    endDate: task.endDate || null,
    task_type: task.category,
    description: task.desc || '',
    target_value,
    unit,
    target_time: task.time || null,
    metadata: {
      source: 'manual',
      start_date: task.startDate || null,
      end_date: task.endDate || null
    }
  }
}

describe('splitTargetValue', () => {
  it('splits "500ml" into value and unit', () => {
    const result = splitTargetValue('500ml')
    expect(result.target_value).toBe(500)
    expect(result.unit).toBe('ml')
  })

  it('splits "2.5L" into value and unit', () => {
    const result = splitTargetValue('2.5L')
    expect(result.target_value).toBe(2.5)
    expect(result.unit).toBe('L')
  })

  it('handles value-only text', () => {
    const result = splitTargetValue('1000')
    expect(result.target_value).toBe(1000)
    expect(result.unit).toBe(null)
  })

  it('handles unit-only text', () => {
    const result = splitTargetValue('steps')
    expect(result.target_value).toBe(null)
    expect(result.unit).toBe('steps')
  })

  it('handles empty string', () => {
    const result = splitTargetValue('')
    expect(result.target_value).toBe(null)
    expect(result.unit).toBe(null)
  })

  it('handles undefined/null', () => {
    const result = splitTargetValue(null)
    expect(result.target_value).toBe(null)
    expect(result.unit).toBe(null)
  })

  it('handles whitespace-only string', () => {
    const result = splitTargetValue('   ')
    expect(result.target_value).toBe(null)
    expect(result.unit).toBe(null)
  })

  it('splits "30min" correctly', () => {
    const result = splitTargetValue('30min')
    expect(result.target_value).toBe(30)
    expect(result.unit).toBe('min')
  })

  it('splits "0.5h" correctly', () => {
    const result = splitTargetValue('0.5h')
    expect(result.target_value).toBe(0.5)
    expect(result.unit).toBe('h')
  })
})

describe('normalizePlanOutput', () => {
  it('normalizes JSON string output', () => {
    const outputs = JSON.stringify({
      result: {
        title: '糖尿病管理方案',
        summary: '综合管理',
        tasks: [{ task_type: 'diet', title: '饮食控制' }],
        sections: [],
        disclaimer: '仅供参考',
      },
    })
    const result = normalizePlanOutput(outputs, {})
    expect(result.title).toBe('糖尿病管理方案')
    expect(result.summary).toBe('综合管理')
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].task_type).toBe('diet')
  })

  it('uses preferences.goal as fallback title', () => {
    const result = normalizePlanOutput('{}', { goal: '减重计划' })
    expect(result.title).toBe('减重计划')
  })

  it('has default title when nothing given', () => {
    const result = normalizePlanOutput('{}', {})
    expect(result.title).toBe('AI 生活方案')
  })

  it('handles non-JSON outputs gracefully', () => {
    const result = normalizePlanOutput('plain text', {})
    expect(result.title).toBe('AI 生活方案')
    expect(result.tasks).toEqual([])
  })

  it('uses plan.data as fallback', () => {
    const outputs = JSON.stringify({
      data: {
        title: 'From Data',
        tasks: [],
      },
    })
    const result = normalizePlanOutput(outputs, {})
    expect(result.title).toBe('From Data')
  })

  it('handles raw object (non-string) outputs', () => {
    const outputs = { title: 'Raw Plan', tasks: [] }
    const result = normalizePlanOutput(outputs, {})
    expect(result.title).toBe('Raw Plan')
  })
})

describe('normalizeAnalysisOutput', () => {
  it('normalizes analysis with completion rate', () => {
    const outputs = JSON.stringify({
      result: {
        completion_rate: 85.5,
        evaluation: '表现良好',
        improvements: ['多喝水', '多运动'],
        advice: '继续保持',
      },
    })
    const summary = { completion_rate: 80, by_type: { diet: 90 } }
    const result = normalizeAnalysisOutput(outputs, summary)
    expect(result.completion_rate).toBe(86) // rounded
    expect(result.evaluation).toBe('表现良好')
    expect(result.improvements).toEqual(['多喝水', '多运动'])
    expect(result.advice).toBe('继续保持')
  })

  it('uses summary completion_rate as fallback', () => {
    const outputs = JSON.stringify({ result: {} })
    const summary = { completion_rate: 70, by_type: {} }
    const result = normalizeAnalysisOutput(outputs, summary)
    expect(result.completion_rate).toBe(70)
  })

  it('clamps completion rate to 0-100', () => {
    const outputs = JSON.stringify({ result: { completion_rate: 150 } })
    const result = normalizeAnalysisOutput(outputs, {})
    expect(result.completion_rate).toBe(100)
  })

  it('handles negative completion rate', () => {
    const outputs = JSON.stringify({ result: { completion_rate: -10 } })
    const result = normalizeAnalysisOutput(outputs, {})
    expect(result.completion_rate).toBe(0)
  })

  it('handles non-array improvements gracefully', () => {
    const outputs = JSON.stringify({ result: { improvements: 'text' } })
    const result = normalizeAnalysisOutput(outputs, {})
    expect(result.improvements).toEqual([])
  })
})

describe('normalizeReportOutput', () => {
  it('normalizes report output', () => {
    const outputs = JSON.stringify({
      result: {
        status: 'confirmed',
        indicators: [{ name: '血糖', value: '5.6' }],
        summary: '报告解读完成',
        advice: ['定期复查'],
        confirm_required: false,
      },
    })
    const result = normalizeReportOutput(outputs)
    expect(result.status).toBe('confirmed')
    expect(result.indicators).toHaveLength(1)
    expect(result.summary).toBe('报告解读完成')
    expect(result.advice).toEqual(['定期复查'])
    expect(result.confirm_required).toBe(false)
  })

  it('uses defaults when output is empty', () => {
    const result = normalizeReportOutput('{}')
    expect(result.status).toBe('pending_confirm')
    expect(result.indicators).toEqual([])
    expect(result.confirm_required).toBe(true)
  })

  it('uses interpretation as fallback', () => {
    const outputs = JSON.stringify({
      interpretation: { status: 'done', indicators: [] },
    })
    const result = normalizeReportOutput(outputs)
    expect(result.status).toBe('done')
  })
})

describe('workflowResponse', () => {
  it('builds response with processing status', () => {
    const result = workflowResponse({ requestId: 'req-123', appCode: 'plan' })
    expect(result.request_id).toBe('req-123')
    expect(result.app_code).toBe('plan')
    expect(result.status).toBe('processing')
    expect(result.workflow_run_id).toBe(null)
  })

  it('builds response from log entry', () => {
    const log = {
      app_code: 'plan',
      status: 'succeeded',
      workflow_run_id: 'wf-run-1',
      task_id: 'task-1',
      outputs: JSON.stringify({ result: 'done' }),
      error_message: null,
      elapsed_time: 1500,
    }
    const result = workflowResponse({ requestId: 'req-1', appCode: 'plan', log })
    expect(result.status).toBe('succeeded')
    expect(result.workflow_run_id).toBe('wf-run-1')
    expect(result.task_id).toBe('task-1')
    expect(result.elapsed_time).toBe(1500)
  })

  it('handles log with error', () => {
    const log = { status: 'failed', error_message: 'timeout', outputs: null }
    const result = workflowResponse({ requestId: 'req-1', appCode: 'plan', log })
    expect(result.status).toBe('failed')
    expect(result.error_message).toBe('timeout')
  })
})

describe('normalizeManualPlanTask', () => {
  it('normalizes a manual task with target', () => {
    const task = {
      id: 1,
      category: 'diet',
      title: '健康饮食',
      desc: '每日三餐均衡',
      target: '2000kcal',
      time: '08:00',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    }
    const result = normalizeManualPlanTask(task)
    expect(result.id).toBe(1)
    expect(result.category).toBe('diet')
    expect(result.title).toBe('健康饮食')
    expect(result.task_type).toBe('diet')
    expect(result.target_value).toBe(2000)
    expect(result.unit).toBe('kcal')
    expect(result.target_time).toBe('08:00')
    expect(result.metadata.source).toBe('manual')
    expect(result.metadata.start_date).toBe('2024-01-01')
  })

  it('handles task without id', () => {
    const task = { category: 'water', title: '喝水', target: '2L' }
    const result = normalizeManualPlanTask(task)
    expect(result.id).toBeUndefined()
    expect(result.target_value).toBe(2)
    expect(result.unit).toBe('L')
  })

  it('handles task without target', () => {
    const task = { category: 'sleep', title: '早睡' }
    const result = normalizeManualPlanTask(task)
    expect(result.target_value).toBe(null)
    expect(result.unit).toBe(null)
  })
})
