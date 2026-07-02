# Dify API 单元测试覆盖矩阵

本项目只测试已经提供 API Key 的 8 个 Dify 应用。`WF-NEWS` 在当前配置中没有独立 API Key，设计文档也允许它通过 `WF-DATA action=article_recommend` 获取资讯候选，因此不再单独建测试文件，避免重复测试同一个功能。

| 测试文件 | Dify 应用 | 主要校验点 |
| --- | --- | --- |
| `tests/wf-data.test.js` | `DIFY_DATA_API_KEY` | `profile_get`、`home_summary`、`checkin_summary`、`article_recommend` 四个 action 的统一输出结构；非法 action 失败 |
| `tests/wf-risk.test.js` | `DIFY_RISK_API_KEY` | 完整评分、已诊断分支、缺少 `score_detail` 的异常处理；不覆盖 Express 评分字段 |
| `tests/wf-plan.test.js` | `DIFY_PLAN_API_KEY` | 生活方案结构、任务类型枚举、免责声明、安全边界、缺少 `user_id` |
| `tests/wf-checkin.test.js` | `DIFY_CHECKIN_API_KEY` | 完成率、指标、评价、改进建议；非法日期范围 |
| `tests/wf-report.test.js` | `DIFY_REPORT_API_KEY` | 纯文本报告解读、待确认输出、安全边界；空报告异常 |
| `tests/cf-assistant.test.js` | `DIFY_ASSISTANT_API_KEY` | 基础问答、续聊复用 `conversation_id`、医疗安全边界 |
| `tests/cf-doctor.test.js` | `DIFY_DOCTOR_API_KEY` | 医生风格问答、高风险症状线下就医、续聊、切换医生新会话、安全边界 |
| `tests/cf-admin.test.js` | `DIFY_ADMIN_API_KEY` | 统计查询自然语言回复、维护类只出草案、不暴露 SQL |
| `tests/00-config.test.js` | 全部 | 环境变量和 8 个 API Key 的基础配置 |

测试原则：

- 每个真实 Dify 应用只保留一组测试，避免把同一个 API 包装成多个测试目标。
- 输出内容限制只校验契约、安全边界和关键结构，不要求固定话术。
- Express 本地会话创建、落库、SSE 转发等不属于 Dify Service API 能直接证明的行为，不在本项目中伪造断言。
