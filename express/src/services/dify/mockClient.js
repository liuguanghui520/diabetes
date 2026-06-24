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
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(encodeSse('message', {
            event: 'message',
            answer: '建议先记录近期血糖变化，'
          })))
          controller.enqueue(new TextEncoder().encode(encodeSse('message', {
            event: 'message',
            answer: '并结合饮食、运动和睡眠一起观察。'
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
