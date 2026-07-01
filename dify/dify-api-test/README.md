# Dify 医生智能体 Chatflow API 自动化测试

这是一个基于 Node.js、Vitest、Axios、dotenv、Ajv 的 API 自动化测试项目，用于真实调用 Dify 医生智能体 Chatflow，检查接口连通性、响应结构、续聊 conversation_id、安全表述、异常输入和性能指标。

## 环境要求

- Node.js 18 或以上
- 可访问 Dify API 的网络环境
- Dify 应用 API Key，通常在 Dify 应用的 API 访问或 API Keys 页面获取

## 安装与配置

```bash
npm install
```

复制 `.env.example` 为 `.env` 并填写真实配置。Windows 可以手动复制并重命名，也可以使用：

```powershell
Copy-Item .env.example .env
```

关键配置：

```env
DIFY_API_BASE_URL=http://服务器IP/v1
DIFY_API_KEY=app-xxxxxxxx
DIFY_REQUEST_TIMEOUT=120000
DIFY_MAX_ELAPSED_TIME=60
DIFY_MAX_TOTAL_TOKENS=10000
TEST_USER_ID=10001
TEST_DOCTOR_ID=3
TEST_OTHER_DOCTOR_ID=4
```

Dify 云端地址通常类似 `https://api.dify.ai/v1`，自部署地址通常类似 `http://你的服务器IP/v1`。测试会真实调用大模型并消耗 Token，请避免高频运行。

## 运行测试

运行全部测试：

```bash
npm test
```

运行详细输出：

```bash
npm run test:verbose
```

运行单个测试文件：

```bash
npx vitest run tests/workflow.test.js
```

监听模式：

```bash
npm run test:watch
```

## 当前覆盖范围

- `tests/connection.test.js`：环境变量、API 地址、API Key、基础调用和响应解析。
- `tests/workflow.test.js`：医生咨询首轮、高风险症状线下就医建议、同医生续聊复用 `conversation_id`、切换医生新建会话。
- `tests/invalid-input.test.js`：空 `doctor_id`、空 `user`、空 `query` 等异常输入。
- `tests/performance.test.js`：客户端耗时、Dify usage latency、Token 消耗阈值。

## Chatflow 输入说明

根据当前导出的 `医生智能体Chatflow.yml`，Start 节点包含：

- `user_id`
- `doctor_id`
- `app_type`

Dify Chatflow 请求使用 `/chat-messages`，阻塞模式请求体为：

```json
{
  "query": "医生您好，我最近餐后血糖偏高。",
  "inputs": {
    "user_id": "10001",
    "app_type": "doctor",
    "doctor_id": "3"
  },
  "response_mode": "blocking",
  "conversation_id": "",
  "user": "10001"
}
```

续聊时传入上一轮响应中的 `conversation_id`。切换医生时应由上游 Express 新建本地会话，本测试通过传空 `conversation_id` 验证 Dify 侧会生成新会话。

## 修改 Schema 和规则

当前医生 Chatflow 返回自然语言 `answer`，所以 `src/schemas.js` 校验 Dify Chatflow 响应结构和安全措辞。如果后续改为 JSON 输出，可在 `src/outputParser.js` 的 `parseJsonOutput` 基础上增加业务 JSON Schema，并在 `tests/workflow.test.js` 中补充字段断言。

新增测试用例建议优先检查结构、必填字段、关键词范围、禁止内容和业务边界，不要断言整段自然语言完全相等。

## 常见错误

- 缺少环境变量：复制 `.env.example` 为 `.env`，填写 `DIFY_API_BASE_URL` 和 `DIFY_API_KEY`。
- 401/403：检查 API Key 是否属于当前 Dify 应用。
- 404：确认 API 地址包含 `/v1`，例如 `http://服务器IP/v1`。
- 超时：调大 `DIFY_REQUEST_TIMEOUT` 和 `VITEST_TEST_TIMEOUT`。
- 医生或用户资料未找到：确认 Express 内部接口能通过 Chatflow 中配置的 `express_endpoint` 访问到对应 `user_id`、`doctor_id`。
