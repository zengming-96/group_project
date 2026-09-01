# 行测批改平台前后端接口文档

## 1. 基本约定

- 基础地址：`VITE_API_BASE_URL`，默认 `http://localhost:8080/api`
- 数据格式：`application/json`（文件上传除外）
- 认证：除登录/注册/忘记密码外，前端统一通过 `Authorization: Bearer <accessToken>` 访问受保护接口
- 生产环境：前端不再使用本地 mock 数据；接口失败时展示错误提示，请确保后端可用并正确配置 `VITE_API_BASE_URL`

## 2. 接口列表

### 2.1 登录

- 方法：`POST`
- 路径：`/auth/login`
- 请求体：

```json
{
  "email": "student@example.com",
  "password": "12345678"
}
```

- 响应体（LoginResponse，以下字段前端均已兼容）：

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9....",
  "expiresIn": 7200
}
```

或传统形态：

```json
{
  "accessToken": "jwt-or-opaque-token",
  "refreshToken": "可选，若返回则 access 过期时前端会用其调用刷新接口",
  "tokenType": "Bearer",
  "expiresIn": 7200
}
```

- 前端行为：当存在 `token` 或 `accessToken`（或 `access_token`）时视为登录成功；`expiresIn`（秒）会写入本地用于大致过期时间；若返回 `refreshToken`，会持久化；**切换账号登录前会清除上一用户的 access / refresh 与本地学习统计缓存**

#### 2.1.1 刷新访问令牌（可选，供无感续期）

- 方法：`POST`
- 路径：`/auth/refresh`
- 请求体：

```json
{
  "refreshToken": "登录时下发的 refreshToken"
}
```

- 响应体：与登录相同（至少包含新的 `accessToken` 或 `token`；若轮换 refresh，可一并返回新的 `refreshToken`）
- 说明：当受保护接口返回 `401` 且本地存在 `refreshToken` 时，前端会先请求本接口，成功则重试原请求；失败则登出。未实现刷新或从不返回 `refreshToken` 时，行为与仅 access 一致。

### 2.2 忘记密码

- 方法：`POST`
- 路径：`/auth/forgot-password`
- 请求体：

```json
{
  "email": "student@example.com"
}
```

### 2.3 注册

- 方法：`POST`
- 路径：`/auth/register`
- 请求体：

```json
{
  "fullName": "张三",
  "email": "student@example.com",
  "role": "student",
  "password": "12345678"
}
```

- 说明：前端已改为学生专用，`role` 固定传 `student`

### 2.4 试卷分析（上传）

- 方法：`POST`
- 路径：`/exams/upload-pdf`（与前端 `uploadPaper` 一致）
- Content-Type：由客户端自动生成 `multipart/form-data; boundary=...`（**不要**手写为 `application/json` 或不含 boundary 的 multipart）
- 表单字段：**`file`**（文件），对应 Spring `@RequestPart("file")`；字段名不可用 `paper`、`upload`、`pdf` 等替代
- 说明：服务端可能在调用 AI 后**较长时间**才返回；前端对该请求超时设为 **10 分钟**（600s），若仍超时需后端优化或前端再调大。
- 响应体（**推荐**，与 `GET /exams/{id}/detail` 中 `detail` 结构一致）：

```json
{
  "gradingMode": "LANGCHAIN4J",
  "detail": {
    "examId": 16,
    "fileName": "行测2.pdf",
    "pdfPath": "pdfs/14/....pdf",
    "fileUrl": "https://....supabase.co/.../....pdf",
    "storageBucket": "pdfs",
    "storageObjectKey": "14/....pdf",
    "status": 3,
    "accuracyRate": 66.67,
    "totalQuestions": 6,
    "correctCount": 4,
    "examCreatedAt": "2026-04-04T05:24:00.940015Z",
    "questions": [
      {
        "questionDetailId": 66,
        "questionNo": 1,
        "question": "题干…",
        "questionType": 1,
        "userAnswer": "B",
        "correctAnswer": "A",
        "correct": false,
        "analysis": "解析…",
        "createdAt": "2026-04-04T05:24:01.042291Z"
      }
    ]
  }
}
```

- **兼容旧版**（仅当响应中无 `detail` 时）：顶层 `paperTitle` + `questions`（`status` 为 `correct` / `wrong` 等），与历史 `DashboardResponse` 一致。
- `detail.questions` 中单题字段说明：`correct` 为布尔；`analysis` 映射为前端「AI 解析」。

### 2.4.1 试卷历史列表（当前用户）

- 方法：`GET`
- 路径：`/exams/history`（与前端 `fetchExamHistoryRecords` 一致；完整 URL 形如 `http://localhost:8080/api/exams/history`）
- 认证：需要 `Authorization: Bearer <accessToken>`
- 响应体：JSON 对象，含 **`records`** 数组；若后端直接返回数组，前端亦兼容

`records` 中每一项（camelCase；若为 `snake_case` 前端会尝试映射）示例：

```json
{
  "examId": 8,
  "fileName": "学生成绩卡.pdf",
  "status": 3,
  "createdAt": "2026-04-03T18:48:28.819899Z",
  "totalQuestions": 6,
  "correctCount": 4,
  "accuracyRate": 66.67
}
```

- 仪表盘行为：页面挂载时请求本接口，将记录与「本会话」本地上传列表合并展示在历史区；选中云端项时会再请求试卷详情（见下）。

### 2.4.2 试卷详情（单份，含 PDF 与逐题）

- 方法：`GET`
- 路径：`/exams/{examId}/detail`（如 `http://localhost:8080/api/exams/8/detail`）
- 认证：需要 `Authorization: Bearer <accessToken>`
- 路径参数：`examId` 与历史列表中的 `examId` 一致
- 响应体（camelCase；`snake_case` 及个别字段拼写变体前端会尽量映射）字段示例：

```json
{
  "examId": 8,
  "fileName": "学生成绩卡.pdf",
  "pdfPath": "pdfs/14/2ff46111-d16a-420d-9d10-3e63dc0882c5.pdf",
  "fileUrl": "https://....supabase.co/storage/v1/object/public/.../xxx.pdf",
  "storageBucket": "pdfs",
  "storageObjectKey": "14/2ff46111-d16a-420d-9d10-3e63dc0882c5.pdf",
  "status": 3,
  "accuracyRate": 66.67,
  "totalQuestions": 6,
  "correctCount": 4,
  "examCreatedAt": "2026-04-03T18:48:28.819899Z",
  "questions": [
    {
      "questionDetailId": 31,
      "questionNo": 1,
      "question": "第1题(模拟)",
      "questionType": 1,
      "userAnswer": "D",
      "correctAnswer": "D",
      "correct": true,
      "analysis": "[模拟AI]第1题:…",
      "createdAt": "2026-04-03T18:48:28.915621Z"
    }
  ]
}
```

- 仪表盘行为：选中左侧云端历史项时请求本接口；中间栏用 `fileUrl` 内嵌 PDF 预览（若存在）；右侧以 `questions` 展示逐题解析，并与本会话上传的分析 UI 共用分页与 AI 引导（`paperId` 使用 `server-exam-{examId}`）。

### 2.5 用户资料

#### 获取当前用户（个人中心 / 顶栏姓名同步）

- 方法：`GET`
- 路径：`/users/me`（完整示例：`http://localhost:8080/api/users/me`）
- 认证：需要 `Authorization: Bearer <token>`
- 响应体（camelCase；`username` 对应前端展示姓名；`snake_case` 前端会尝试映射）：

```json
{
  "username": "Wuzhe123",
  "email": "wuzhe@163.com",
  "age": 23,
  "daysSinceCreated": 0
}
```

- `daysSinceCreated`：自注册起天数，个人中心「学习时间」展示为「N 天」。
- 个人中心挂载与 PATCH 保存成功后均会再次请求本接口以刷新页面与本地会话中的姓名、邮箱、年龄与学习时长展示。

#### （可选）用户资料扩展

- 方法：`GET`
- 路径：`/users/profile`
- 响应体（UserProfile，若后端仍提供可与 `/users/me` 并存）：

```json
{
  "name": "张老师",
  "role": "学生",
  "email": "student@example.com",
  "school": "某某学校",
  "learningTime": "6个月",
  "age": 20,
  "recentPapers": 8,
  "avgScore": 72
}
```

#### 更新当前用户资料（个人中心保存）

- 方法：`PATCH`
- 路径：`/users/me`（完整示例：`http://localhost:8080/api/users/me`）
- 认证：需要 `Authorization: Bearer <token>`
- 请求体（仅允许修改以下字段，前端不提交 `learningTime`）：

```json
{
  "name": "张三",
  "email": "user@example.com",
  "age": 20
}
```

- 响应体：建议返回完整 `UserProfile`；若字段缺失，前端会用 GET 资料时的本地值合并（如 `learningTime`）。

### 2.6 学习报告（旧）

- 方法：`GET`
- 路径：`/reports/learning`
- 响应体：`ReportItem[]`

```json
[
  { "date": "Week 1", "papers": 3, "errorRate": 24 }
]
```

### 2.7 学习洞察（图表）

- 方法：`GET`
- 路径：`/reports/learning-insights`
- Query：
- `range`：`today | 7d | 30d`
- `type`（可选）：`言语理解 | 数量关系 | 判断推理 | 资料分析 | 常识判断`

- 响应体（LearningInsightsResponse）：

```json
{
  "trend30d": [
    {
      "date": "03-22",
      "accuracyByType": {
        "言语理解": 76,
        "数量关系": 64,
        "判断推理": 72,
        "资料分析": 68,
        "常识判断": 58
      }
    }
  ],
  "knowledgeByType": {
    "言语理解": [
      { "name": "主旨概括", "mastery": 78, "avgTime": 92, "reason": "关键信息提取不完整" }
    ],
    "数量关系": [],
    "判断推理": [],
    "资料分析": [],
    "常识判断": []
  }
}
```

### 2.8 AI 引导对话

- 方法：`POST`
- 路径：`/ai/guidance`
- 请求体（AIGuidancePayload）：

```json
{
  "paperId": "1710000000000-0",
  "questionId": "q-2",
  "questionNumber": 2,
  "userAttempt": "我先用了链式法则，但后面不太确定",
  "sessionId": "optional-session-id",
  "history": [
    { "role": "user", "content": "我先设未知数" },
    { "role": "assistant", "content": "很好，下一步列关系式" }
  ],
  "context": {
    "explanation": "第二步求导时符号处理错误",
    "knowledgePoint": "复合函数求导中的链式法则"
  }
}
```

- 响应体（AIGuidanceResponse）：

```json
{
  "sessionId": "guidance-session-001",
  "message": "先不要急着算最终值，请先写出外层函数导数。",
  "suggestedNextQuestion": "外层函数和内层函数分别是什么？",
  "isResolved": false
}
```

- 字段说明：
- `sessionId`：多轮对话会话 ID（后续请求回传）
- `message`：AI 本轮引导文本
- `suggestedNextQuestion`：可选，前端用于“一键填入下一问”
- `isResolved`：可选，前端用于“已掌握/未掌握”状态展示

### 2.9 学习统计上报（题目对错入库）

- 方法：`POST`
- 路径：`/reports/learning/ingest`
- 说明：前端在 `/papers/analyze` 成功后，立即把本次试卷的逐题对错和汇总指标上报后端，用于后续统计正确率/错误率趋势。

- 请求体（LearningStatsIngestPayload）：

```json
{
  "paperId": "1710000000000-0",
  "paperTitle": "2026模考卷A",
  "submittedAt": "2026-03-27T10:30:00.000Z",
  "totalQuestions": 30,
  "correctQuestions": 18,
  "wrongQuestions": 12,
  "accuracy": 60,
  "errorRate": 40,
  "questions": [
    {
      "questionId": "q-1",
      "questionNumber": 1,
      "status": "correct",
      "knowledgePoint": "可选"
    },
    {
      "questionId": "q-2",
      "questionNumber": 2,
      "status": "wrong",
      "knowledgePoint": "复合函数求导中的链式法则"
    }
  ]
}
```

- 响应体（LearningStatsIngestResponse）：

```json
{
  "accepted": true,
  "statId": "stat-20260327-001"
}
```

## 3. 错误码建议（建议后端统一）

- `400` 参数错误
- `401` 未认证
- `403` 无权限
- `404` 资源不存在
- `409` 业务冲突
- `422` 语义校验失败
- `500` 服务异常

错误响应建议：

```json
{
  "code": "INVALID_PARAM",
  "message": "questionId 不能为空",
  "requestId": "trace-xxx"
}
```

## 4. 与前端代码对应关系

- API 定义：`src/lib/api.ts`（含 `patchUserMe` → `PATCH /users/me`）
- 类型定义：`src/types.ts`
- AI 引导调用页面：`src/pages/dashboard-page.tsx`
- 学习报告调用页面：`src/pages/profile-page.tsx`
