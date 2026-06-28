function encodeSse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function createMockDifyClient() {
  const calls = {
    workflows: [],
    chats: []
  }

  return {
    calls,
    async runWorkflow(appCode, inputs) {
      calls.workflows.push({ appCode, inputs })

      if (appCode === 'plan') {
        return {
          workflow_run_id: 'mock_plan_workflow_run_id',
          outputs: {
            title: '基础健康预治计划',
            summary: '从饮食记录、餐后运动和复查整理开始，建立一周可执行节奏。',
            tasks: [
              {
                task_type: 'diet',
                title: '记录三餐结构',
                description: '记录主食、蛋白质和蔬菜搭配。',
                target_value: 3,
                unit: '次',
                target_time: '三餐后'
              },
              {
                task_type: 'exercise',
                title: '饭后轻走',
                description: '选择一餐后轻走 15-20 分钟。',
                target_value: 20,
                unit: '分钟',
                target_time: '餐后'
              }
            ],
            disclaimer: '方案仅供健康管理参考。'
          }
        }
      }

      if (appCode === 'checkin') {
        return {
          workflow_run_id: 'mock_checkin_workflow_run_id',
          outputs: {
            completion_rate: inputs.checkin_summary?.completion_rate ?? 0,
            metrics: inputs.checkin_summary?.by_type || {},
            evaluation: '近期打卡已形成初步记录，可继续稳定饮食和运动两类任务。',
            improvements: ['优先保持每天一次饮食记录', '饭后活动从低强度开始'],
            advice: '继续保持规律记录，数据越完整，后续分析越贴近实际。'
          }
        }
      }

      if (appCode === 'report') {
        return {
          workflow_run_id: 'mock_report_workflow_run_id',
          outputs: {
            status: 'pending_confirm',
            indicators: [],
            summary: '已收到报告文本，当前为本地模拟解读结果。',
            advice: ['请结合原始报告和医生意见确认'],
            confirm_required: true
          }
        }
      }

      return {
        workflow_run_id: 'mock_workflow_run_id',
        outputs: {
          advice: {
            summary: inputs.score_status === 'complete'
              ? '您属于糖尿病风险筛查人群，请结合生活方式管理并按需复查。'
              : '当前资料不足或量表不适用，请补充信息后再评估。',
            diet: ['减少含糖饮料', '增加蔬菜和优质蛋白'],
            exercise: ['每周至少 150 分钟中等强度运动'],
            review: ['建议完善空腹血糖、餐后 2 小时血糖和 HbA1c 检查'],
            warning: '本结果仅用于健康管理参考，不作为医学诊断。'
          }
        }
      }
    },
    normalizeWorkflowAdvice(outputs, fallback) {
      return outputs.advice || fallback
    },
    async chatStream(input) {
      calls.chats.push(input)
      const prefix = input.appType === 'admin'
        ? '已进入管理员助手模式。请先确认操作对象和字段，涉及写库会生成待确认操作。'
        : '建议先记录近期血糖变化，'
      const suffix = input.appType === 'admin'
        ? '例如可统计咨询关键词、草拟医生排班变更，确认后再调用管理接口。'
        : '并结合饮食、运动和睡眠一起观察。'
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(encodeSse('message', {
            event: 'message',
            answer: prefix
          })))
          controller.enqueue(new TextEncoder().encode(encodeSse('message', {
            event: 'message',
            answer: suffix
          })))
          controller.enqueue(new TextEncoder().encode(encodeSse('message_end', {
            event: 'message_end',
            conversation_id: 'dify_mock_conversation',
            message_id: 'dify_mock_message'
          })))
          controller.close()
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream'
        }
      })
    }
  }
}
