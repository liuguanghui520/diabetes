export const doctors = [
    {
        id: 1,
        name: '内分泌专家 A',
        title: '专家风格助手',
        department: '内分泌科',
        specialty: '糖尿病综合管理、胰岛素治疗',
        years: 25,
        status: 'AI参考',
        avatar: 'A',
        accent: 'blue',
        intro: '基于内分泌代谢病知识库提供 1 型、2 型糖尿病综合管理和并发症风险参考。'
    },
    {
        id: 2,
        name: '营养干预专家 B',
        title: '专家风格助手',
        department: '内分泌科',
        specialty: '妊娠糖尿病、营养干预',
        years: 16,
        status: 'AI参考',
        avatar: 'B',
        accent: 'green',
        intro: '围绕女性糖代谢异常、妊娠期血糖管理和营养干预提供健康管理参考。'
    },
    {
        id: 3,
        name: '随访管理专家 C',
        title: '专家风格助手',
        department: '内分泌科',
        specialty: '血糖监测、慢病随访',
        years: 12,
        status: 'AI参考',
        avatar: 'C',
        accent: 'amber',
        intro: '面向血糖记录、慢病随访和运动饮食方案调整提供结构化问答参考。'
    }
]

export const articles = [
    {
        id: 1,
        title: '糖尿病的早期症状及预防措施',
        summary: '了解多饮、多食、多尿、体重下降等典型信号，建立早筛意识。',
        tag: '血糖监测',
        color: 'blue',
        views: 120,
        time: '5 分钟阅读',
        date: '今日推荐',
        image: 'monitor',
        content: [
            '糖尿病早期可能表现为口渴、多饮、多尿、体重下降和疲劳，也可能没有明显症状。',
            '高风险人群应结合年龄、体重、家族史、血压和腰围等因素进行定期筛查。',
            '日常预防重点包括控制总能量摄入、减少含糖饮料、保持规律运动和定期体检。'
        ]
    },
    {
        id: 2,
        title: '糖尿病患者的饮食指南',
        summary: '合理控制碳水化合物摄入，建立更稳定的餐盘结构。',
        tag: '控糖饮食',
        color: 'green',
        views: 80,
        time: '4 分钟阅读',
        date: '推荐阅读',
        image: 'food',
        content: [
            '控糖饮食不是完全不吃主食，而是关注份量、种类和进餐顺序。',
            '建议优先摄入蔬菜和优质蛋白，再搭配适量全谷物、杂豆或薯类。',
            '减少含糖饮料、甜点和油炸食品，有助于降低餐后血糖波动。'
        ]
    },
    {
        id: 3,
        title: '运动对糖尿病的影响',
        summary: '适量运动可以帮助改善胰岛素敏感性，提升体重管理效果。',
        tag: '科学运动',
        color: 'amber',
        views: 150,
        time: '3 分钟阅读',
        date: '健康科普',
        image: 'exercise',
        content: [
            '快走、骑行、游泳和轻量力量训练都适合多数控糖人群从低强度开始。',
            '建议从饭后 10-20 分钟步行开始，逐步增加运动频率和时长。',
            '若出现胸闷、头晕或明显不适，应停止运动并及时寻求专业建议。'
        ]
    },
    {
        id: 4,
        title: '糖尿病并发症预防日常清单',
        summary: '从足部护理、眼底检查到血压管理，建立长期防护意识。',
        tag: '并发症预防',
        color: 'coral',
        views: 96,
        time: '6 分钟阅读',
        date: '重点阅读',
        image: 'care',
        content: [
            '长期血糖异常可能增加心血管、肾脏、眼底和神经病变风险。',
            '建议定期复查血糖、血压、血脂、尿蛋白和眼底，关注足部皮肤状态。',
            '出现伤口不易愈合、视力改变或持续异常指标时，应及时就医。'
        ]
    }
]

export const diabetesTypes = [
    {
        code: 'type1',
        name: '1 型糖尿病',
        subtitle: '胰岛素绝对缺乏',
        icon: 'needle',
        color: 'blue',
        mechanism: '多与自身免疫相关，胰岛 beta 细胞受损导致胰岛素分泌不足。',
        symptoms: '起病可较急，常见多饮、多尿、多食、体重下降，部分患者可能出现酮症风险。',
        treatment: '通常需要终身胰岛素治疗，并配合血糖监测、饮食运动管理和低血糖预防。'
    },
    {
        code: 'type2',
        name: '2 型糖尿病',
        subtitle: '胰岛素抵抗为主',
        icon: 'capsule',
        color: 'green',
        mechanism: '以胰岛素抵抗和胰岛 beta 细胞功能下降为主要机制，与年龄、体重和生活方式密切相关。',
        symptoms: '早期可能症状不明显，也可能出现口渴、乏力、餐后困倦和体重变化。',
        treatment: '核心是生活方式干预、体重管理、规律监测，并在医生指导下进行药物治疗。'
    },
    {
        code: 'gestational',
        name: '妊娠型糖尿病',
        subtitle: '妊娠期间发生',
        icon: 'mother',
        color: 'amber',
        mechanism: '妊娠期激素变化可能降低胰岛素敏感性，导致血糖升高。',
        symptoms: '多数无明显症状，常通过产检筛查发现。',
        treatment: '需在产科和内分泌科指导下进行饮食、运动和血糖监测管理。'
    },
    {
        code: 'special',
        name: '特殊类型糖尿病',
        subtitle: '其他特异病因',
        icon: 'question',
        color: 'coral',
        mechanism: '可由遗传、胰腺疾病、内分泌疾病、药物或其他因素导致。',
        symptoms: '表现差异较大，需要结合病史、检查和医生评估。',
        treatment: '治疗应根据病因和个体情况制定，建议在专科医生指导下管理。'
    }
]

export const quickStats = [
    {
        label: '风险评分',
        value: '18',
        unit: '分',
        status: '低风险'
    },
    {
        label: 'BMI',
        value: '22.4',
        unit: '',
        status: '正常'
    },
    {
        label: '连续打卡',
        value: '12',
        unit: '天',
        status: '稳定'
    }
]

export const planTasks = [
    {
        key: 'diet',
        title: '控糖饮食',
        time: '07:30-19:00',
        target: '三餐低糖均衡',
        detail: '早餐燕麦和鸡蛋，午餐瘦肉加蔬菜，晚餐减少精制主食。'
    },
    {
        key: 'exercise',
        title: '运动管理',
        time: '18:00-18:45',
        target: '45 分钟',
        detail: '快走、骑行或舒缓力量训练，避免饭后久坐。'
    },
    {
        key: 'sleep',
        title: '睡眠修复',
        time: '23:30 前',
        target: '7 小时',
        detail: '睡前减少屏幕时间，保持固定入睡节律。'
    }
]
