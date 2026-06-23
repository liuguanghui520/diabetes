function getTimeText() {
    return new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })
}

function getDefaultReply() {
    return {
        content: '我已收到你的健康问题。建议你先记录近期饮食、运动、睡眠和血糖变化，再结合自身情况进行健康管理。若出现持续不适、明显异常指标或症状加重，应及时寻求专业医疗帮助。',
        tips: [
            '保持规律饮食，减少高糖饮品和高油零食',
            '每天安排适量运动，避免久坐',
            '规律监测并记录健康数据变化'
        ]
    }
}

function getReplyByQuestion(content) {
    const text = content.trim()

    if (/水果|吃什么|饮食|控糖|主食|早餐|晚餐/.test(text)) {
        return {
            content: '饮食管理的重点不是完全不吃某类食物，而是控制总量、保持规律进餐，并优先选择蔬菜、全谷物、豆制品和优质蛋白。水果通常可作为加餐的一部分，但建议注意种类、份量和自身血糖变化。',
            tips: [
                '减少含糖饮料、甜点和高糖零食',
                '每餐优先增加蔬菜和优质蛋白',
                '主食可适当选择全谷物、杂豆或薯类',
                '记录饮食后身体状态和血糖变化'
            ]
        }
    }

    if (/血糖|空腹|餐后|检测|测量/.test(text)) {
        return {
            content: '血糖数值需要结合测量时间、近期饮食、睡眠、运动和身体状态一起观察。单次记录只能作为健康管理参考；若数值持续偏高、波动明显，或伴随明显不适，建议及时咨询专业医疗人员。',
            tips: [
                '记录测量时间和测量前后的饮食情况',
                '避免熬夜、剧烈运动后立即比较检测结果',
                '持续记录空腹与餐后相关数据',
                '异常或持续波动时及时寻求专业建议'
            ]
        }
    }

    if (/运动|跑步|快走|锻炼|健身|久坐/.test(text)) {
        return {
            content: '运动建议从自己能够长期坚持的强度开始。日常快走、骑行、舒缓拉伸和轻量力量训练都可以作为选择。可以先从饭后步行或每天固定一段轻量活动开始，再根据身体适应情况逐步增加。',
            tips: [
                '从饭后步行 10 至 20 分钟开始',
                '避免久坐，每隔一段时间起身活动',
                '运动前后注意补水与身体感受',
                '出现明显不适时应停止活动'
            ]
        }
    }

    if (/睡眠|失眠|熬夜|困|作息/.test(text)) {
        return {
            content: '规律睡眠有助于维持整体健康状态。建议尽量固定入睡和起床时间，睡前减少长时间使用手机、摄入高糖饮料或进行剧烈运动。若长期存在明显睡眠问题，也建议寻求专业帮助。',
            tips: [
                '尽量在固定时间准备入睡',
                '睡前减少长时间刷手机',
                '晚间避免大量摄入咖啡因和高糖饮品',
                '白天安排适量活动，帮助建立作息节律'
            ]
        }
    }

    if (/体重|BMI|减肥|肥胖/.test(text)) {
        return {
            content: '体重管理更适合采用长期、温和的方式。可以从规律饮食、减少高热量零食、增加日常活动和保证睡眠开始。建议关注长期趋势，而不是只看某一天的体重变化。',
            tips: [
                '每周固定时间记录体重变化',
                '减少高油、高糖和高热量零食',
                '保持饮食规律，避免暴饮暴食',
                '结合步行、骑行等可坚持的运动'
            ]
        }
    }

    return getDefaultReply()
}

export function sendAssistantMessage(payload) {
    const content = typeof payload === 'string'
        ? payload
        : payload.content || ''

    return new Promise((resolve) => {
        window.setTimeout(() => {
            const reply = getReplyByQuestion(content)

            resolve({
                id: Date.now(),
                role: 'assistant',
                content: reply.content,
                tips: reply.tips,
                time: getTimeText()
            })
        }, 650)
    })
}