# 糖尿病预治智能助手 Express 服务

这是项目的轻量 Express 后端。它定位为 API 网关与业务编排层：前端只调用 Express，Express 负责鉴权、参数校验、KingbaseES 读写、幂等、风险评分和 Dify 代理；医学解释、方案生成和对话回复交给 Dify Workflow / Chatflow。

## 目录结构

```text
express/
  src/
    app.js                 # Express 应用工厂，便于测试注入依赖
    server.js              # 启动入口，支持 .env 与命令行参数
    config/                # 环境变量和 CLI 参数解析
    db/                    # KingbaseES/pg 连接、SQL 仓储、测试内存仓储
    http/                  # 统一响应、错误码、traceId
    modules/               # auth/profile/risk/assistant/content/admin/internal/health
    services/dify/         # Dify Service API 客户端和测试 Mock
    utils/                 # 幂等键、脱敏、JSON 工具
  migrations/kingbase/     # Kingbase/PostgreSQL 兼容迁移 SQL
  scripts/                 # 迁移和管理员 seed 脚本
  docs/                    # Dify 工作流与对话流搭建文档
  tests/                   # Vitest + Supertest 测试
```

## 快速开始

安装依赖：

```bash
npm install
```

复制配置：

```bash
cp .env.example .env
```

开发启动：

```bash
npm run dev -- --host 127.0.0.1 --port 3001
```

也可以显式指定配置文件：

```bash
node src/server.js --env-file .env.local --host 0.0.0.0 --port 3001
```

健康检查：

```bash
curl http://127.0.0.1:3001/health
```

数据库检查：

```bash
curl http://127.0.0.1:3001/api/health/db
```

`DB_CONNECT_ON_START=false` 时，启动阶段不会强制连接数据库；访问 `/api/health/db` 才会检查真实 KingbaseES 连接。

## 配置说明

核心环境变量见 `.env.example`：

```bash
HOST=127.0.0.1
PORT=3001
JWT_SECRET=change-this-in-production

KINGBASE_HOST=127.0.0.1
KINGBASE_PORT=54321
KINGBASE_DATABASE=diabetes_assistant
KINGBASE_USER=system
KINGBASE_PASSWORD=change-me
DB_CONNECT_ON_START=false

DIFY_BASE_URL=http://127.0.0.1
DIFY_RISK_API_KEY=app-xxx
DIFY_PLAN_API_KEY=app-xxx
DIFY_CHECKIN_API_KEY=app-xxx
DIFY_REPORT_API_KEY=app-xxx
DIFY_ASSISTANT_API_KEY=app-xxx
DIFY_DOCTOR_API_KEY=app-xxx
DIFY_ADMIN_API_KEY=app-xxx
INTERNAL_DIFY_TOKEN=change-me
```

安全要求：

- 不要提交 `.env` 或任何真实 API Key、数据库密码。
- `JWT_SECRET`、`INTERNAL_DIFY_TOKEN` 生产环境必须替换为强随机值。
- Dify API Key 只允许保存在 Express 环境变量中，不能进入前端代码。
- 内部接口 `/internal/dify/**` 必须通过 `X-Internal-Token` 调用。

## 数据库迁移与管理员 seed

迁移脚本会创建 `schema_migration` 表并按文件名顺序执行未应用 SQL。所有新增迁移均采用增量字段、`if not exists` 和事务执行，避免重建已有业务表。

```bash
npm run migrate
```

创建或重置管理员账号：

```bash
npm run seed:admin -- --username admin --password <password>
```

管理员仍存储在 `sys_user` 表，区别是 `role in ('admin', 'super_admin')`。

## 已实现接口

通用响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "traceId": "req_xxx"
}
```

错误响应：

```json
{
  "code": 40001,
  "message": "参数错误",
  "details": [],
  "traceId": "req_xxx"
}
```

主要接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 服务健康检查 |
| GET | `/api/health/db` | KingbaseES 连接检查 |
| POST | `/api/auth/register` | 注册并签发 JWT |
| POST | `/api/auth/login` | 登录并签发 JWT |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/profile` | 当前用户健康档案、最近风险 |
| PUT | `/api/profile` | 更新健康档案并计算 BMI |
| POST | `/api/risk-assessments` | 风险评估，Express 评分后调用 WF-RISK |
| GET | `/api/risk-assessments/latest` | 最近一次风险评估 |
| GET | `/api/risk-assessments` | 风险评估列表 |
| POST | `/api/assistant/chat` | 代理 Dify Chatflow SSE |
| GET | `/api/assistant/conversations` | 助手会话列表 |
| GET | `/api/assistant/conversations/:id/messages` | 会话消息 |
| GET | `/api/articles` | 健康资讯列表 |
| GET | `/api/articles/:id` | 文章详情并记录阅读 |
| POST | `/api/articles/:id/favorite` | 收藏/取消收藏 |
| GET | `/api/doctors` | 医生列表 |
| GET | `/api/doctors/:id` | 医生详情 |
| POST | `/api/doctors/:doctorId/chat` | 医生咨询 SSE，并创建咨询工单 |
| GET | `/api/plans/active` | 当前生活方案 |
| POST | `/api/plans/generate` | 调用 WF-PLAN 并落库生活方案 |
| POST | `/api/checkins` | 饮食/运动等打卡 |
| GET | `/api/checkins` | 打卡记录 |
| GET | `/api/checkins/analysis` | 本地打卡分析摘要 |
| POST | `/api/checkins/analysis` | 调用 WF-CHECKIN 并落库健康分析报告 |
| POST | `/api/reports/interpret` | 调用 WF-REPORT 并代理返回报告解读 |

管理员接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/dashboard` | 管理端概览 |
| GET/POST | `/api/admin/articles` | 文章列表/创建 |
| GET/PUT/DELETE | `/api/admin/articles/:id` | 文章详情/编辑/删除 |
| POST | `/api/admin/articles/:id/publish` | 发布文章 |
| POST | `/api/admin/articles/:id/unpublish` | 下线文章 |
| GET/POST | `/api/admin/article-categories` | 分类列表/创建 |
| PUT/DELETE | `/api/admin/article-categories/:id` | 分类编辑/删除 |
| GET/POST | `/api/admin/doctors` | 医生列表/创建 |
| GET/PUT/DELETE | `/api/admin/doctors/:id` | 医生详情/编辑/删除 |
| GET | `/api/admin/users` | 用户列表 |
| PUT | `/api/admin/users/:id/status` | 用户启用、禁用或锁定 |
| GET | `/api/admin/consultations` | 咨询工单列表 |
| GET | `/api/admin/dify-run-logs` | Dify 运行日志 |
| POST | `/api/admin/assistant/chat` | 管理员助手 Chatflow SSE |

内部只读接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/internal/dify/users/:userId/context` | 给 Dify 获取最小用户上下文 |
| GET | `/internal/dify/home-summary` | 首页候选数据 |
| GET | `/internal/dify/users/:userId/checkins/summary` | 打卡统计 |
| GET | `/internal/dify/articles/recommend` | 资讯候选 |
| GET | `/internal/dify/doctors/:doctorId` | 医生资料 |
| GET | `/internal/dify/admin/summary` | 管理员助手只读后台摘要 |

## Dify 接入

详细搭建说明见 `docs/dify-workflows-and-chatflows.md`。

当前代码已实现：

- WF-RISK：`POST /api/risk-assessments` 中调用 `/v1/workflows/run`，`response_mode=blocking`。
- WF-PLAN：`POST /api/plans/generate` 中调用 `/v1/workflows/run`，落 `lifestyle_plan` + `plan_task`。
- WF-CHECKIN：`POST /api/checkins/analysis` 中调用 `/v1/workflows/run`，落 `health_analysis_report`。
- WF-REPORT：`POST /api/reports/interpret` 中调用 `/v1/workflows/run`，当前只代理返回，不落库。
- CF-ASSISTANT：`POST /api/assistant/chat` 中调用 `/v1/chat-messages`，`response_mode=streaming`。
- CF-ADMIN：`POST /api/admin/assistant/chat` 中调用 `/v1/chat-messages`，用于管理员自然语言查询和维护草案。
- SSE 转换：Dify `message.answer` 会转为前端 `event: message` + `{ "delta": "..." }`；Dify `message_end` 会转为本地 `conversation_id` 和 `dify_conversation_id`。
- Dify 不写核心业务表。它只返回结构化结果，Express 校验后落库。

## 数据库与 SQL

建表与增量迁移 SQL 位于：

```text
migrations/kingbase/*.sql
```

注意：

- Express 启动时不会自动执行迁移，需要显式运行 `npm run migrate`。
- SQL 使用 KingbaseES/PostgreSQL 兼容写法：`bigint generated by default as identity`、`jsonb`、`timestamp`、`check`、`limit/offset`。
- 若通过 SSH 隧道连接远程 KingbaseES，可先运行仓库根目录 `scripts/ssh_kingbase_connect.py` 建立本地端口，再配置 `KINGBASE_HOST=127.0.0.1`、`KINGBASE_PORT=15432`。

## 测试

运行：

```bash
npm test
```

测试策略：

- 单元测试覆盖 `calculateChinaDiabetesRisk(input)` 的年龄、BMI、腰围、收缩压、性别、家族史边界。
- 集成测试使用内存仓储和 Mock Dify，不依赖真实 KingbaseES 或 Dify API Key。
- 测试覆盖注册登录、`/api/auth/me`、档案 BMI、风险评估幂等、助手 SSE 转换、内部接口令牌校验。

## 设计审查结论

安全性：

- 真实密钥只走 `.env`，仓库只提交 `.env.example`。
- 前端不直接调用 Dify，Dify API Key 不进入浏览器。
- 内部 Dify 数据接口有 `X-Internal-Token` 防护。
- 风险评分是 Express 纯函数，不依赖 Dify 或前端传入的用户 ID。
- Dify 日志输入输出会做基础手机号和邮箱脱敏。
- SQL 只落文件，不自动执行，降低误操作风险。

可行性：

- KingbaseES 兼容 PostgreSQL 协议，后端通过 `pg` 连接，驱动封装在 `db` 模块。
- 路由依赖仓储接口，测试可用内存仓储，生产可切换 SQL 仓储。
- Dify 未就绪时，自动化测试仍可通过 Mock 验证 payload、结构化输出和 SSE 转换。
- 风险评估已形成首轮闭环：鉴权、幂等、评分、Dify 调用、落库响应。

当前边界：

- 方案、打卡、报告、医生 Chatflow 目前只在 Dify 文档和 SQL 中定义，尚未实现完整业务接口。
- 当前鉴权是课程项目 MVP 级 JWT；生产还应增加刷新 token、限流、HTTPS、审计日志和更严格的密码策略。
- 文件上传、报告私有存储、Dify 失败重试队列暂未实现。
