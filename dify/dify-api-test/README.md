# Dify API 自动化测试

这是一个基于 Node.js、Vitest、Axios、dotenv、Ajv 的 Dify API 自动化测试项目，用于真实调用多个 Dify Workflow / Chatflow，检查接口连通性、输出结构、业务边界、安全表述、异常输入和性能指标。

## 环境要求

- Node.js 18 或以上
- 可访问 Dify API 的网络环境
- 各 Dify 应用 API Key

## 安装与配置

```bash
npm install
```

复制 `.env.example` 为 `.env` 并填写真实配置。Windows 可以手动复制并重命名，也可以使用：

```powershell
Copy-Item .env.example .env
```

核心配置：

```env
DIFY_API_BASE_URL=http://服务器IP/v1

DIFY_ADMIN_API_KEY=app-xxxxxxxx
DIFY_REPORT_API_KEY=app-xxxxxxxx
DIFY_DOCTOR_API_KEY=app-xxxxxxxx
DIFY_ASSISTANT_API_KEY=app-xxxxxxxx
DIFY_PLAN_API_KEY=app-xxxxxxxx
DIFY_CHECKIN_API_KEY=app-xxxxxxxx
DIFY_RISK_API_KEY=app-xxxxxxxx
DIFY_DATA_API_KEY=app-xxxxxxxx
```

测试会真实调用 Dify 和大模型并消耗 Token，请避免高频运行。

## 运行测试

运行全部测试：

```bash
npm test
```

运行单个测试文件：

```bash
npx vitest run tests/data-workflow.test.js
```

详细输出：

```bash
npm run test:verbose
```

监听模式：

```bash
npm run test:watch
```

## 当前覆盖范围

Chatflow：

- `tests/connection.test.js`：医生智能体基础连通性。
- `tests/workflow.test.js`：医生智能体首轮、续聊、切换医生、高风险线下就医建议。
- `tests/invalid-input.test.js`：医生智能体异常输入。
- `tests/performance.test.js`：医生智能体耗时和 Token 指标。
- `tests/assistant-chatflow.test.js`：糖尿病助手基础问答和续聊。
- `tests/admin-chatflow.test.js`：管理员助手统计查询和资料维护草案。

Workflow：

- `tests/data-workflow.test.js`：WF-DATA 数据上下文组装器。
- `tests/risk-workflow.test.js`：WF-RISK 糖尿病风险建议。
- `tests/plan-workflow.test.js`：WF-PLAN 生活方案定制。
- `tests/checkin-workflow.test.js`：WF-CHECKIN 生活状态分析。
- `tests/report-workflow.test.js`：WF-REPORT 体检报告解读。
- `tests/news-workflow.test.js`：WF-NEWS 健康资讯推荐，当前通过 WF-DATA 的 `article_recommend` action 调用。

## 设计原则

- 不断言整段自然语言完全相等。
- 优先校验 JSON 结构、必填字段、枚举范围、禁止风险表达和业务边界。
- Workflow 测试调用 `/workflows/run` 的 blocking 模式。
- Chatflow 测试调用 `/chat-messages` 的 blocking 模式。
- 如果 Dify Start 表单存在必填 file 变量，测试客户端会自动上传 `test-assets/placeholder.txt` 并写入对应 `inputs.file`。

## 常见问题

- 缺少环境变量：复制 `.env.example` 为 `.env`，填写 `DIFY_API_BASE_URL` 和对应应用 API Key。
- 401/403：检查 API Key 是否属于当前 Dify 应用。
- 404：检查 Dify Workflow 内部 HTTP Request 节点配置的 Express 内部接口路径。
- 超时：调大 `DIFY_REQUEST_TIMEOUT` 和 `VITEST_TEST_TIMEOUT`。
- 输出结构不匹配：优先检查 Dify End 节点输出字段名是否和测试 Schema 一致。
