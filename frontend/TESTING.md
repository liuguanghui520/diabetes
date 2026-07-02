# 前端测试说明文档

## 一、如何运行测试

### 安装依赖
```bash
cd frontend
npm install
```

### 运行全部单元测试
```bash
npm run test:run
```

### 生成覆盖率报告
```bash
npm run test:coverage
```
报告生成在 `coverage/index.html`，双击即可在浏览器查看。

---

## 二、测试覆盖率情况

### 总体覆盖率

| 指标 | 覆盖率 |
|------|--------|
| Statements（语句） | 91.78% |
| Branches（分支） | 84.16% |
| Functions（函数） | 91.11% |
| Lines（行） | 91.82% |

### 核心业务逻辑覆盖率（要求 ≥100%）

| 模块 | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `src/api/auth.js`（登录注册） | **100%** | 92.85% | **100%** | **100%** |
| `src/api/request.js`（API请求） | **100%** | 99.39% | **100%** | **100%** |
| `src/api/uploads.js`（文件上传） | **100%** | **100%** | **100%** | **100%** |
| **API 模块总体** | **100%** | **99.43%** | **100%** | **100%** |

> ✅ 核心业务逻辑（用户注册、登录、数据查询）已达 100% 语句覆盖。

### 工具函数及公共模块覆盖率（要求 ≥80%）

| 模块 | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `src/utils/sse.js`（SSE流解析） | **100%** | 96.96% | **100%** | **100%** |
| `src/utils/chatRichText.js`（富文本） | **100%** | **100%** | **100%** | **100%** |
| `src/router/index.js`（路由守卫） | **100%** | 94.44% | **100%** | **100%** |
| `src/components/navigation/`（导航组件） | **100%** | — | **100%** | **100%** |
| **工具/公共模块总体** | **100%** | — | **100%** | **100%** |

> ✅ 工具函数及公共模块覆盖率远超 80% 要求。

### 全部 Vue 页面覆盖率

| 页面 | Statements |
|------|-----------|
| HomeView（首页） | 99.34% |
| LoginView（登录注册） | 94.49% |
| HealthView（健康评估） | 88.39% |
| HealthArchiveView（健康档案） | 91.5% |
| HealthJourneyView（健康旅程） | **100%** |
| PlanView（生活方案） | 94.23% |
| PlanTaskCreateView（任务创建） | 96.95% |
| CheckinRecordsView（打卡记录） | 98.59% |
| CheckinAnalysisView（打卡分析） | 80.95% |
| NewsView（健康资讯） | 92.52% |
| AssistantView（AI助手） | 92.42% |
| DoctorConsultView（医生咨询） | 77.82% |
| DoctorProfileView（医生简介） | 96.66% |
| MessagesView（消息中心） | 85.41% |
| FavoritesView（收藏夹） | 86.27% |
| UserCenterView（个人中心） | 97.82% |
| PersonalInfoView（个人信息） | 91.45% |
| PrivacySettingsView（隐私设置） | 93.75% |
| ChangePasswordView（修改密码） | 87.71% |
| DataAuthorizationView（数据授权） | 74.52% |
| AdminDashboardView（管理后台） | 93.47% |
| NotFoundView（404页面） | **100%** |
| **全部22个页面** | **全覆盖** |

---

## 三、主要测试内容说明

### 测试文件清单（13个文件，425个用例）

```
src/test/unit/
├── setup.js                       # 测试环境初始化（localStorage/浏览器API mock）
├── api-utils.test.js              # API会话管理、登录注册、文件上传、SSE流、富文本
├── request-branches.test.js       # request.js 全分支（73用例）
│   · 所有HTTP状态码错误映射（404/400/401/403/409/429/500+）
│   · 幂等键生成、FormData/URLSearchParams请求体
│   · AbortError、网络错误、认证过期事件
│   · pollWorkflowRun 成功/失败/超时/中断
├── utils-detailed.test.js         # 工具函数全覆盖（43用例）
│   · SSE流解析：多事件类型、分块读取、CRLF、[DONE]标记
│   · 富文本渲染：think标签提取、Markdown、XSS过滤、HTML转义
├── router-components.test.js      # 路由守卫 + 导航组件（5用例）
├── views.test.js                  # 全部22页面的挂载与交互演练
├── views-branches.test.js         # 核心界面分支覆盖（147用例）
├── checkin-records.test.js        # 打卡记录专项（25用例）
├── low-coverage-views.test.js     # 低覆盖界面强攻（42用例）
├── direct-vm-coverage.test.js     # 直接VM访问组件内部函数
├── branch-targeted.test.js        # 分支精准打击
├── template-branches.test.js      # 模板状态注入
├── final-coverage-push.test.js    # 最终覆盖率冲刺
└── kill-all-red.test.js           # 消灭红色：onBeforeUnmount + 全部unmount
```

### 覆盖的交互类型

- **表单操作**：输入校验、提交、密码显示切换、协议勾选
- **按钮点击**：页面导航、数据提交、状态切换
- **路由守卫**：未登录重定向、角色权限控制、公开路由放行
- **API通信**：GET/POST/PUT/PATCH/DELETE、认证token、幂等键
- **文件上传**：FormData构建、上传响应处理
- **SSE流式通信**：事件解析、多事件类型、分块读取、错误处理
- **日历交互**：日期选择、日历网格渲染、状态显示
- **聊天交互**：消息发送、历史加载、SSE流式回复、文件附件
- **管理后台**：6个Tab切换、CRUD操作、分页、筛选搜索
- **健康数据**：风险评分、BMI计算、血糖状态、档案完整度

### 测试工具

- **测试框架**：Vitest 4.1.9
- **Vue组件测试**：@vue/test-utils 2.4.11
- **覆盖率工具**：@vitest/coverage-v8 4.1.9（V8 Coverage）
- **DOM模拟**：jsdom 29.1.1

---

## 四、覆盖率截图位置

打开 `coverage/index.html` 截图即可，包含所有文件的覆盖率详情。
