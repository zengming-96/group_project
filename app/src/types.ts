export type GradingStatus = 'correct' | 'wrong'

export interface PracticeQuestion {
  id: string
  title: string
  prompt: string
  options: string[]
  correctOptionIndex: number
  explanation: string
}

export interface QuestionAnalysis {
  id: string
  questionNumber: number
  status: GradingStatus
  explanation: string
  knowledgePoint?: string
  practiceQuestions?: PracticeQuestion[]
  /** 云端试卷详情等接口可返回题干 */
  stem?: string
  userAnswer?: string
  correctAnswer?: string
  /**
   * 与上传/详情 JSON 中题目 `questionNo` 一致（非 questionDetailId），
   * 用于 GET .../questions/{questionNo}/similar-practice
   */
  examQuestionNo?: number
}

export interface DashboardResponse {
  paperTitle: string
  questions: QuestionAnalysis[]
}

/** GET 试卷历史 records 单项（与后端字段对齐） */
export interface ExamHistoryRecord {
  examId: number
  fileName: string
  status: number
  createdAt: string
  totalQuestions: number
  correctCount: number
  accuracyRate: number
}

/** GET /exams/{id}/detail 中单题（与后端字段对齐，含常见拼写变体由 api 层归一） */
export interface ExamDetailQuestion {
  questionDetailId: number
  questionNo: number
  question: string
  questionType: number
  userAnswer: string
  correctAnswer: string
  correct: boolean
  analysis: string
  createdAt: string
}

export interface ExamDetailResponse {
  examId: number
  fileName: string
  pdfPath: string
  fileUrl: string
  storageBucket: string
  storageObjectKey: string
  status: number
  accuracyRate: number
  totalQuestions: number
  correctCount: number
  examCreatedAt: string
  questions: ExamDetailQuestion[]
}

/** POST /exams/upload-pdf 归一化结果：新版含 AI 批改后的 detail；旧版为 paperTitle + questions */
export interface UploadPaperResult {
  gradingMode: string
  detail: ExamDetailResponse | null
  legacyPaperTitle: string
  legacyQuestions: QuestionAnalysis[]
}

/** GET /exams/{examId}/questions/{sourceQuestionNo}/similar-practice 中单道相似题 */
export interface SimilarPracticeItem {
  index: number
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  /** 通常为 A/B/C/D，或与某一选项文案一致 */
  correctAnswer: string
}

export interface SimilarPracticeResponse {
  examId: number
  sourceQuestionNo: number
  sourceQuestion: string
  sourceUserAnswer: string
  sourceCorrectAnswer: string
  similarQuestions: SimilarPracticeItem[]
}

export interface LoginPayload {
  email: string
  password: string
}

/** 登录/刷新接口响应；后端可为 { token, expiresIn } 或 { accessToken, ... } */
export interface LoginResponse {
  accessToken?: string
  /** 与 accessToken 等价；后端若只返回 token，规范化后会同时写入二者 */
  token?: string
  refreshToken?: string
  tokenType?: string
  /** 秒；如 7200，用于本地记录 access 大致过期时间 */
  expiresIn?: number
}

export interface RefreshTokenPayload {
  refreshToken: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface RegisterPayload {
  fullName: string
  email: string
  role: 'teacher' | 'student'
  password: string
}

export interface UserProfile {
  name: string
  role: string
  email: string
  school: string
  learningTime: string
  age: number
  recentPapers: number
  avgScore: number
}

/** 与 GET /users/me → learningStats.byQuestionType 对齐；questionType 1–5 见前端 QUESTION_TYPE_CODE_LABELS */
export interface UserLearningStatsByQuestionType {
  questionType: number
  typeName: string
  totalQuestions: number
  correctCount: number
  wrongCount: number
  correctRatePercent: number
  wrongRatePercent: number
}

export interface UserLearningStatsDay {
  year: number
  month: number
  dayOfMonth: number
  date: string
  totalQuestions: number
  correctCount: number
  wrongCount: number
  correctRatePercent: number
  wrongRatePercent: number
}

export interface UserLearningStatsMonthAggregate {
  year: number
  month: number
  yearMonth: string
  totalQuestions: number
  correctCount: number
  wrongCount: number
  correctRatePercent: number
  wrongRatePercent: number
}

export interface UserLearningStats {
  byQuestionType: UserLearningStatsByQuestionType[]
  currentMonthByDay: UserLearningStatsDay[]
  currentMonth: UserLearningStatsMonthAggregate | null
  monthlyTrendLast12: UserLearningStatsMonthAggregate[]
}

/** GET /users/me 当前用户摘要（与后端字段对齐，username 映射为页面「姓名」） */
export interface UserMeResponse {
  username: string
  email: string
  age: number
  /** 自注册起经过的天数，用于「学习时间」展示 */
  daysSinceCreated: number
  learningStats?: UserLearningStats
}

/** PATCH /users/me 仅允许更新姓名、邮箱、年龄 */
export interface PatchUserMePayload {
  name: string
  email: string
  age: number
}

export interface ReportItem {
  date: string
  papers: number
  errorRate: number
}

export interface DailyLearningStat {
  date: string
  uploadCount: number
  totalQuestions: number
  wrongQuestions: number
  accuracy: number
  errorRate: number
}

export type LearningQuestionType =
  | '言语理解'
  | '数量关系'
  | '判断推理'
  | '资料分析'
  | '常识判断'

export type LearningTimeRange = 'today' | '7d' | '30d'

export interface LearningTrendPoint {
  date: string
  accuracyByType: Record<LearningQuestionType, number>
}

export interface LearningKnowledgePoint {
  name: string
  mastery: number
  avgTime: number
  reason: string
}

export interface LearningInsightsResponse {
  trend30d: LearningTrendPoint[]
  knowledgeByType: Record<LearningQuestionType, LearningKnowledgePoint[]>
}

export type AIGuidanceRole = 'user' | 'assistant'

export interface AIGuidanceMessage {
  role: AIGuidanceRole
  content: string
  createdAt?: string
}

export interface AIGuidancePayload {
  paperId: string
  questionId: string
  questionNumber: number
  userAttempt: string
  context?: {
    explanation?: string
    knowledgePoint?: string
  }
  sessionId?: string
  history?: AIGuidanceMessage[]
}

export interface AIGuidanceResponse {
  sessionId: string
  message: string
  suggestedNextQuestion?: string
  isResolved?: boolean
}

export interface LearningStatsIngestQuestion {
  questionId: string
  questionNumber: number
  status: GradingStatus
  knowledgePoint?: string
}

export interface LearningStatsIngestPayload {
  paperId: string
  paperTitle: string
  submittedAt: string
  totalQuestions: number
  correctQuestions: number
  wrongQuestions: number
  accuracy: number
  errorRate: number
  questions: LearningStatsIngestQuestion[]
}

export interface LearningStatsIngestResponse {
  accepted: boolean
  statId?: string
}
