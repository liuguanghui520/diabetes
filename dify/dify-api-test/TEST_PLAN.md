# Dify API 单元测试覆盖矩阵

本项目当前以“轻量连通性 + 输入契约 + 基础输出结构”为主，不再用固定话术或过细内容要求约束 Dify 输出。这样可以覆盖 8 个已提供 API Key 的应用，同时减少模型生成差异、发布态慢响应、内容风格变化造成的误报。

| 测试文件 | Dify 应用 | 当前校验范围 |
| --- | --- | --- |
| `tests/00-config.test.js` | 全部 | `.env` 基础配置和 8 个 API Key 存在 |
| `tests/wf-data.test.js` | `DIFY_DATA_API_KEY` | `profile_get`、`home_summary`、`checkin_summary`、`article_recommend` 四个 action 能跑通，并返回统一外层结构 |
| `tests/wf-risk.test.js` | `DIFY_RISK_API_KEY` | 风险建议工作流能跑通，并返回非空输出 |
| `tests/wf-plan.test.js` | `DIFY_PLAN_API_KEY` | 生活方案工作流能跑通，并返回非空输出 |
| `tests/wf-checkin.test.js` | `DIFY_CHECKIN_API_KEY` | 生活状态分析工作流能跑通，并返回非空输出 |
| `tests/wf-report.test.js` | `DIFY_REPORT_API_KEY` | 当前发布版对缺少文件的请求返回明确参数错误，证明鉴权与应用路由可达 |
| `tests/cf-assistant.test.js` | `DIFY_ASSISTANT_API_KEY` | Chatflow SSE 连接能建立并返回 `text/event-stream` |
| `tests/cf-doctor.test.js` | `DIFY_DOCTOR_API_KEY` | 医生 Chatflow SSE 连接能建立，且 `user_id/app_type/doctor_id` 输入契约不被拒绝 |
| `tests/cf-admin.test.js` | `DIFY_ADMIN_API_KEY` | 管理员助手能完成一次基础对话并返回 `conversation_id` 与非空 answer |

测试原则：

- 保证每个应用至少有一个 API 级测试覆盖。
- Workflow 只校验执行成功、可解析输出和必要的外层契约，不校验固定内容话术。
- Chatflow 按 Dify 文档使用 `response_mode=streaming`；对慢响应的医生/糖尿病助手只验证 SSE 可连接性。
- `WF-DATA` 是内部复用的数据上下文组装器，因此保留四个 action 的轻量覆盖。
- Express 本地会话创建、落库、SSE 转发等不属于 Dify Service API 能直接证明的行为，不在本项目中断言。
- `npm test` 按文件串行执行，降低长连接和慢 Workflow 互相影响的概率。
