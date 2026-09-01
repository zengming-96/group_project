# 行测智能批改平台

> COMP5241 Software Engineering and Development — Group Project Team 10

一个基于 AI 的行测（行政职业能力测验）试卷智能批改与学习分析平台。用户上传试卷 PDF，系统自动提取题目、调用大模型进行逐题批改与解析，并提供学习统计、错题辅导和相似题目推荐。

## 功能特性

### 用户认证
- 注册 / 登录 / 忘记密码
- JWT Token 认证，支持无感续期
- 个人资料管理（姓名、邮箱、年龄）

### 试卷批改
- PDF 试卷上传，支持文字层提取与 OCR（扫描件）
- 基于通义千问大模型的逐题智能批改
- 自动判分、正确率统计、逐题 AI 解析
- PDF 在线预览与批改结果对照查看

### 学习分析
- 考试历史记录与详情回溯
- 学习统计仪表盘（正确率趋势、题型掌握度）
- 按题型分类的知识掌握度分析
- 学习时长与累计练习数据

### AI 辅导
- 错题 AI 引导对话（苏格拉底式提问，不直接给答案）
- 相似题目推荐，针对性强化练习

## 技术栈

### 前端
| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建工具 | Vite |
| 样式 | Tailwind CSS + Radix UI |
| 路由 | React Router v7 |
| 图表 | Recharts |
| 动画 | Framer Motion |
| HTTP 客户端 | Axios |
| 图标 | Lucide React |

### 后端
| 类别 | 技术 |
|------|------|
| 框架 | Spring Boot 3 + Java |
| 构建工具 | Maven |
| 安全 | Spring Security + JWT (jjwt) |
| 数据库 | PostgreSQL (Supabase) / H2（本地开发） |
| 数据库迁移 | Flyway |
| AI 客户端 | LangChain4j（通义千问 / 阿里百炼） |
| 文件存储 | Supabase S3（PDF 存储） |
| PDF 处理 | Apache PDFBox + Tesseract OCR |

## 项目结构

```
groupproject-team_10/
├── app/                          # 前端（React + Vite）
│   ├── src/
│   │   ├── pages/                # 页面组件
│   │   │   ├── splash-page.tsx       # 启动页
│   │   │   ├── login-page.tsx        # 登录
│   │   │   ├── register-page.tsx     # 注册
│   │   │   ├── forgot-password-page.tsx  # 忘记密码
│   │   │   ├── dashboard-page.tsx    # 主仪表盘（批改/历史/统计）
│   │   │   └── profile-page.tsx      # 个人中心
│   │   ├── components/           # 可复用组件
│   │   ├── lib/                  # API 客户端、工具函数
│   │   └── types.ts              # TypeScript 类型定义
│   ├── docs/                     # 接口文档、Postman 集合
│   └── package.json
├── backend/                      # 后端（Spring Boot）
│   ├── src/main/java/com/examgrading/api/
│   │   ├── auth/                 # 认证模块
│   │   ├── exam/                 # 考试批改模块
│   │   │   ├── ai/               # AI 客户端（LangChain4j）
│   │   │   ├── dto/              # 数据传输对象
│   │   │   └── pdf/              # PDF 提取与 OCR
│   │   ├── user/                 # 用户模块
│   │   ├── security/             # JWT 安全过滤器
│   │   ├── config/               # 配置类
│   │   └── error/                # 全局异常处理
│   ├── src/main/resources/
│   │   ├── application.yml       # 应用配置
│   │   └── db/migration/         # Flyway 数据库迁移脚本
│   ├── postman/                  # Postman 接口集合
│   └── pom.xml
└── README.md
```

## 快速开始

### 前置要求

- **Node.js** ≥ 18（前端）
- **JDK** ≥ 17（后端）
- **Maven** ≥ 3.8（后端）
- **PostgreSQL** 或使用 Supabase 云数据库
- **Tesseract OCR**（可选，用于扫描件 PDF 识别）

### 1. 克隆仓库

```bash
git clone https://github.com/zengming-96/group_project.git
cd group_project
```

### 2. 配置环境变量

后端需要配置以下环境变量（参考 `backend/.env.example`）：

```bash
# 数据库
SUPABASE_DB_PASSWORD=your_postgres_password

# Supabase S3 存储
SUPABASE_STORAGE_ACCESS_KEY=your_s3_access_key
SUPABASE_STORAGE_SECRET_KEY=your_s3_secret_key

# 通义千问 AI
DASHSCOPE_API_KEY=sk-your_dashscope_api_key

# JWT 密钥（至少 32 字节）
JWT_SECRET=your_jwt_secret_at_least_32_bytes
```

> 未配置 `DASHSCOPE_API_KEY` 时，AI 批改会自动降级为 Mock 模式，方便前端开发调试。

前端开发环境变量（`app/.env.development`）：

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

### 3. 启动后端

```bash
cd backend
mvn spring-boot:run
```

后端默认运行在 `http://localhost:8080`，API 基础路径为 `/api`。

**本地内存数据库模式**（无需 PostgreSQL，适合快速体验）：

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

### 4. 启动前端

```bash
cd app
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`。

### 5. 访问应用

打开浏览器访问 `http://localhost:5173`，注册账号后即可上传试卷进行批改。

## API 概览

所有接口基础路径：`http://localhost:8080/api`

| 模块 | 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|------|
| 认证 | POST | `/auth/register` | 用户注册 | ❌ |
| 认证 | POST | `/auth/login` | 用户登录 | ❌ |
| 认证 | POST | `/auth/forgot-password` | 忘记密码 | ❌ |
| 认证 | POST | `/auth/refresh` | 刷新 Token | ❌ |
| 考试 | POST | `/exams/upload-pdf` | 上传试卷并 AI 批改 | ✅ |
| 考试 | GET | `/exams/history` | 获取考试历史列表 | ✅ |
| 考试 | GET | `/exams/{examId}/detail` | 获取试卷批改详情 | ✅ |
| 考试 | POST | `/exams/extract-text` | 提取 PDF 文本 | ✅ |
| 考试 | GET | `/exams/similar-practice` | 相似题目推荐 | ✅ |
| 用户 | GET | `/users/me` | 获取当前用户信息 | ✅ |
| 用户 | PATCH | `/users/me` | 更新用户资料 | ✅ |
| 统计 | GET | `/reports/learning-insights` | 学习洞察数据 | ✅ |

完整接口文档见 [`app/docs/api-contract.md`](app/docs/api-contract.md)，Postman 集合见 [`backend/postman/`](backend/postman/)。

## 数据库

项目使用 **Flyway** 进行数据库版本管理，迁移脚本位于 `backend/src/main/resources/db/migration/`。

- `V1__create_users.sql` — 用户表
- `V2__frontend_domain_tables.sql` — 前端领域表
- `V3__core_exam_schema_bigint.sql` — 核心考试表
- `V4__exam_records_storage_metadata.sql` — 考试记录存储元数据
- `V5~V8` — 用户表结构迭代与题型分类

## 部署

### 前端部署

前端为纯静态应用，可部署到 Vercel、Netlify、Cloudflare Pages、GitHub Pages 等平台：

```bash
cd app
npm install
npm run build
# 产物在 app/dist/
```

### 后端部署

后端为 Spring Boot 应用，可部署到 Render、Railway、Fly.io、Heroku 等支持 Java 的平台，或使用 Docker 容器化部署。

构建可执行 JAR：

```bash
cd backend
mvn clean package
# 产物在 backend/target/exam-grading-api-*.jar
java -jar target/exam-grading-api-*.jar
```

部署时需通过环境变量注入所有敏感配置（数据库密码、API Key、JWT 密钥等）。

## 团队

- **课程**：COMP5241 Software Engineering and Development
- **小组**：Team 10
- **项目周期**：2026 春季学期

## 许可证

本项目为课程作业，仅供学习参考。
