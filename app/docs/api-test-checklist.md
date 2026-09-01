# 接口联调与测试清单

## 1. 准备

- 启动后端服务（默认 `http://localhost:8080`）
- 启动前端服务（默认 `http://localhost:5174`）
- 如后端地址不同：在 `app` 目录创建 `.env` 或 `.env.local`，参考 `app/.env.example` 设置 `VITE_API_BASE_URL`（修改后需重启 Vite）

## 2. 快速可达性检查

```bash
curl -i http://localhost:8080/api/users/profile
```

- 期望：返回 HTTP 状态码（非连接失败）

## 3. 接口逐项测试（curl 示例）

### 3.1 登录

```bash
curl -i -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@example.com","password":"12345678"}'
```

### 3.2 忘记密码

```bash
curl -i -X POST http://localhost:8080/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@example.com"}'
```

### 3.3 注册（学生）

```bash
curl -i -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"张三","email":"student@example.com","role":"student","password":"12345678"}'
```

### 3.4 上传分析（multipart 字段名须为 `file`）

```bash
curl -i -X POST http://localhost:8080/api/exams/upload-pdf \
  -H "Authorization: Bearer <accessToken>" \
  -F 'file=@/absolute/path/to/demo.pdf'
```

### 3.5 用户资料

```bash
curl -i http://localhost:8080/api/users/profile
```

### 3.6 学习洞察

```bash
curl -i 'http://localhost:8080/api/reports/learning-insights?range=30d'
```

```bash
curl -i 'http://localhost:8080/api/reports/learning-insights?range=7d&type=言语理解'
```

### 3.7 AI 引导

```bash
curl -i -X POST http://localhost:8080/api/ai/guidance \
  -H 'Content-Type: application/json' \
  -d '{
    "paperId":"1710000000000-0",
    "questionId":"q-2",
    "questionNumber":2,
    "userAttempt":"我先用了链式法则",
    "history":[{"role":"user","content":"我先用了链式法则"}],
    "context":{"explanation":"第二步求导符号错误","knowledgePoint":"复合函数求导中的链式法则"}
  }'
```

## 4. 验收勾选表

- [ ] `POST /auth/login` 可用
- [ ] `POST /auth/forgot-password` 可用
- [ ] `POST /auth/register` 可用（student）
- [ ] `POST /exams/upload-pdf` 可用（`multipart` 字段名 `file`，返回 questions）
- [ ] `GET /users/profile` 可用
- [ ] `GET /reports/learning-insights` 可用（range 生效）
- [ ] `POST /ai/guidance` 可用（sessionId / message / suggestedNextQuestion / isResolved）
- [ ] 前端不再出现 fallback 提示文案

## 5. 常见问题

- 连接失败：确认后端端口、容器网络、CORS
- 422/400：对照 `docs/api-contract.md` 的字段与枚举
- AI 引导无多轮：确认后端是否正确接收并返回 `sessionId`，前端会自动回传
