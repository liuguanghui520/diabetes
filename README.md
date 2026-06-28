# diabetes

糖尿病预治智能助手项目，包含 Vue 3 移动端前端和 Express 后端。当前已接入登录注册、健康档案、风险评估、AI 助手 SSE、首页摘要、资讯、医生咨询、生活方案、计划打卡、AI 打卡分析、消息中心和管理员后台。

## 目录结构

- `frontend/`：Vue 3 + Vite 移动端应用，开发环境通过 Vite proxy 访问后端 `/api`。
- `express/`：Express API 服务，负责鉴权、业务接口、Kingbase/PostgreSQL 访问、SSH 隧道连接和 Dify Service API 代理。
- `docs/frontend-integration-guide.md`：前后端接口联调说明。
- `docs/feature-modules-and-data-flow.md`：功能模块与数据流说明。

## 本地运行

后端：

```bash
cd express
npm install
npm run dev
```

远端 Kingbase 迁移：

```bash
cd express
npm run migrate
```

创建或重置管理员：

```bash
cd express
npm run seed:admin -- --username admin --password <password>
```

前端：

```bash
cd frontend
npm install
npm run dev
```

默认前端开发模式为真实接口模式：

```env
VITE_API_MODE=real
VITE_API_PROXY_TARGET=http://127.0.0.1:3001
```

## 后端环境变量

复制 `express/.env.example` 为 `express/.env`，按需配置：

- `USE_IN_MEMORY_DB=true`：使用内存数据，便于本地快速联调。
- `KINGBASE_*`：远端 Kingbase/PostgreSQL 连接参数。
- `SSH_*`：需要通过 SSH 隧道访问远端数据库时启用。
- `DIFY_*_API_KEY`、`DIFY_BASE_URL`：Dify Workflow/Chatflow 接入。

## 管理员与头像

- 管理端路由：`/admin/dashboard`，使用普通登录接口登录，账号 `role` 需要为 `admin` 或 `super_admin`。
- 医生头像暂用占位图。后续更新头像时，在医生资料的 `avatar_url` 填入图片 URL；为空时用户端显示医生姓氏占位头像。
- 用户头像同理使用 `sys_user.avatar_url`，前端读取到 URL 后会直接展示真实图片。

## 验证

```bash
cd express && npm test
cd frontend && npm run build
```

## 提交说明

`node_modules/`、`dist/`、本地 `.env` 和临时过程文档不提交到仓库。
