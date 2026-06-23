# 糖尿病预治智能助手前端

本目录是“糖尿病预治智能助手”的 Vue 3 移动端原型，覆盖首页、健康档案、风险预测、生活方案、健康资讯、AI 助手、专家风格问答和个人中心等页面。

## 技术栈

- Vue 3
- Vue Router
- Element Plus
- Vite

## 本地运行

```bash
npm install
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173/
```

## 构建

```bash
npm run build
```

构建产物位于 `dist/`，该目录不提交到 Git。

## Dify 流式接口

AI 助手默认使用本地健康问答后备回复。后端接口联调完成后，可通过环境变量切换为 Express 代理的 Dify Chatflow SSE：

```env
VITE_USE_REAL_ASSISTANT_STREAM=true
VITE_ASSISTANT_CHAT_URL=/api/assistant/chat
```

前端使用 `fetch` 与 `ReadableStream` 解析 `text/event-stream`，不在浏览器中保存 Dify API Key。

## 提交说明

仓库只提交前端源码与配置文件，不提交以下目录：

- `node_modules/`
- `dist/`
- `dist-ssr/`
- 本地 `.env*.local`

相关规则已写入 `.gitignore`。
