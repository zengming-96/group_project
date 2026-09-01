import axios, { type AxiosError, type InternalAxiosRequestConfig, isAxiosError } from 'axios'
import type {
  AIGuidancePayload,
  AIGuidanceResponse,
  ExamDetailQuestion,
  ExamDetailResponse,
  ExamHistoryRecord,
  ForgotPasswordPayload,
  LearningInsightsResponse,
  LearningStatsIngestPayload,
  LearningStatsIngestResponse,
  LearningQuestionType,
  LearningTimeRange,
  LoginPayload,
  QuestionAnalysis,
  RegisterPayload,
  ReportItem,
  PatchUserMePayload,
  SimilarPracticeItem,
  SimilarPracticeResponse,
  UploadPaperResult,
  UserLearningStats,
  UserLearningStatsByQuestionType,
  UserLearningStatsDay,
  UserLearningStatsMonthAggregate,
  UserMeResponse,
  UserProfile,
} from '../types'
import {
  applyRefreshedTokens,
  clearAccessToken,
  emitUnauthorizedEvent,
  loadAccessToken,
  loadRefreshToken,
} from './auth-token'
import { normalizeLoginResponse } from './normalize-login-response'
import { clearSessionUser } from './user-session'

function resolveApiBaseURL(): string {
  const primary = import.meta.env.VITE_API_BASE_URL?.trim()
  if (primary) return primary
  const legacy = import.meta.env.VITE_APP_BASE_API?.trim()
  if (legacy?.startsWith('http')) return legacy
  return 'http://localhost:8080/api'
}

const baseURL = resolveApiBaseURL()

const api = axios.create({
  baseURL,
  timeout: 12000,
})

/** 不带鉴权拦截器的客户端，用于 refresh，避免循环依赖 */
const authFreeClient = axios.create({
  baseURL,
  timeout: 12000,
})

type RequestWithRetry = InternalAxiosRequestConfig & { _authRetry?: boolean }

function isPublicAuthPath(config: InternalAxiosRequestConfig) {
  const path = config.url || ''
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/forgot-password')
  )
}

function isRefreshPath(config: InternalAxiosRequestConfig) {
  return (config.url || '').includes('/auth/refresh')
}

async function fetchNewAccessToken(): Promise<string> {
  const refreshToken = loadRefreshToken()
  if (!refreshToken) throw new Error('missing refresh token')

  const { data } = await authFreeClient.post<unknown>('/auth/refresh', { refreshToken })
  const normalized = normalizeLoginResponse(data)
  const access = (normalized.accessToken || normalized.token || '').trim()
  if (!access) throw new Error('refresh response missing access token')
  applyRefreshedTokens(normalized)
  return access
}

let refreshPromise: Promise<string> | null = null

function getRefreshedAccess(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = fetchNewAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

api.interceptors.request.use((config) => {
  const token = loadAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    ;(config.headers as Record<string, string>).Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RequestWithRetry | undefined
    if (!originalRequest) return Promise.reject(error)

    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    if (isPublicAuthPath(originalRequest)) {
      return Promise.reject(error)
    }

    if (isRefreshPath(originalRequest)) {
      clearAccessToken()
      clearSessionUser()
      emitUnauthorizedEvent()
      return Promise.reject(error)
    }

    if (originalRequest._authRetry) {
      clearAccessToken()
      clearSessionUser()
      emitUnauthorizedEvent()
      return Promise.reject(error)
    }

    if (!loadRefreshToken()) {
      clearAccessToken()
      clearSessionUser()
      emitUnauthorizedEvent()
      return Promise.reject(error)
    }

    originalRequest._authRetry = true

    try {
      const newAccess = await getRefreshedAccess()
      originalRequest.headers = originalRequest.headers ?? {}
      ;(originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`
      return api(originalRequest)
    } catch {
      clearAccessToken()
      clearSessionUser()
      emitUnauthorizedEvent()
      return Promise.reject(error)
    }
  },
)

export async function login(payload: LoginPayload) {
  const { data } = await api.post<unknown>('/auth/login', payload)
  return normalizeLoginResponse(data)
}

export async function requestPasswordReset(payload: ForgotPasswordPayload) {
  const { data } = await api.post('/auth/forgot-password', payload)
  return data
}

export async function registerAccount(payload: RegisterPayload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}

function pickNum(obj: Record<string, unknown>, camel: string, snake: string): number {
  const v = obj[camel] ?? obj[snake]
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function pickFloat(obj: Record<string, unknown>, camel: string, snake: string): number {
  const v = obj[camel] ?? obj[snake]
  if (v == null || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function pickStr(obj: Record<string, unknown>, camel: string, snake: string): string {
  const v = obj[camel] ?? obj[snake]
  return v == null ? '' : String(v)
}

function pickStrAny(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (v != null && v !== '') return String(v)
  }
  return ''
}

function pickBoolAny(obj: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'boolean') return v
    if (v === 1 || v === '1' || v === true) return true
    if (v === 0 || v === '0' || v === false) return false
  }
  return false
}

/** 与上传/批改 detail.questions[] 中题号字段对齐（勿用 questionDetailId 作路径参数） */
function pickQuestionNoFromExamQuestionRow(o: Record<string, unknown>): number {
  const candidates = [
    o.questionNo,
    o.question_no,
    o.sourceQuestionNo,
    o.source_question_no,
    o.questionNumber,
    o.question_number,
    o.no,
    o.num,
    o.questionIndex,
    o.question_index,
  ]
  for (const v of candidates) {
    if (v == null || v === '') continue
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n) && n > 0) return Math.trunc(n)
  }
  return 0
}

function normalizeExamQuestionDetail(item: unknown): ExamDetailQuestion | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const rawId = o.questionDetailId ?? o.question_detail_id
  if (rawId == null || rawId === '') return null
  const questionDetailId = typeof rawId === 'number' ? rawId : Number(rawId)
  if (!Number.isFinite(questionDetailId)) return null

  return {
    questionDetailId,
    questionNo: pickQuestionNoFromExamQuestionRow(o),
    question: pickStrAny(o, ['question', 'question_text', 'questionText']),
    questionType: pickNum(o, 'questionType', 'question_type'),
    userAnswer: pickStrAny(o, ['userAnswer', 'user_answer', 'useIAnswer', 'use_i_answer']),
    correctAnswer: pickStrAny(o, [
      'correctAnswer',
      'correct_answer',
      'correctAnSWeI',
      'correct_an_s_we_i',
    ]),
    correct: pickBoolAny(o, ['correct', 'isCorrect', 'is_correct']),
    analysis: pickStrAny(o, ['analysis', 'explanation']),
    createdAt: pickStr(o, 'createdAt', 'created_at'),
  }
}

function normalizeExamDetail(raw: unknown, fallbackExamId: number): ExamDetailResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      examId: fallbackExamId,
      fileName: '',
      pdfPath: '',
      fileUrl: '',
      storageBucket: '',
      storageObjectKey: '',
      status: 0,
      accuracyRate: 0,
      totalQuestions: 0,
      correctCount: 0,
      examCreatedAt: '',
      questions: [],
    }
  }

  const o = raw as Record<string, unknown>
  const rawExam = o.examId ?? o.exam_id
  let examId = fallbackExamId
  if (rawExam != null && rawExam !== '') {
    const n = typeof rawExam === 'number' ? rawExam : Number(rawExam)
    if (Number.isFinite(n)) examId = n
  }

  const questionsRaw = o.questions
  const questions = Array.isArray(questionsRaw)
    ? questionsRaw.map(normalizeExamQuestionDetail).filter((q): q is ExamDetailQuestion => q != null)
    : []

  return {
    examId,
    fileName: pickStr(o, 'fileName', 'file_name'),
    pdfPath: pickStrAny(o, ['pdfPath', 'pdf_path']),
    fileUrl: pickStrAny(o, ['fileUrl', 'file_url']),
    storageBucket: pickStr(o, 'storageBucket', 'storage_bucket'),
    storageObjectKey: pickStrAny(o, [
      'storageObjectKey',
      'storage_object_key',
      'storage0bjectkey',
    ]),
    status: pickNum(o, 'status', 'status'),
    accuracyRate: pickNum(o, 'accuracyRate', 'accuracy_rate'),
    totalQuestions: pickNum(o, 'totalQuestions', 'total_questions'),
    correctCount: pickNum(o, 'correctCount', 'correct_count'),
    examCreatedAt: pickStrAny(o, ['examCreatedAt', 'exam_created_at', 'createdAt', 'created_at']),
    questions,
  }
}

function normalizeUploadPaperResponse(raw: unknown): UploadPaperResult {
  const empty: UploadPaperResult = {
    gradingMode: '',
    detail: null,
    legacyPaperTitle: '',
    legacyQuestions: [],
  }
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  const gradingMode = pickStrAny(o, ['gradingMode', 'grading_mode'])
  const detailRaw = o.detail
  if (detailRaw && typeof detailRaw === 'object') {
    const dr = detailRaw as Record<string, unknown>
    const rawExamId = dr.examId ?? dr.exam_id
    let fallbackId = 0
    if (rawExamId != null && rawExamId !== '') {
      const n = typeof rawExamId === 'number' ? rawExamId : Number(rawExamId)
      if (Number.isFinite(n)) fallbackId = n
    }
    const detail = normalizeExamDetail(detailRaw, fallbackId)
    return { gradingMode, detail, legacyPaperTitle: '', legacyQuestions: [] }
  }
  const paperTitle = pickStr(o, 'paperTitle', 'paper_title')
  const qs = o.questions
  if (Array.isArray(qs)) {
    return {
      gradingMode: gradingMode || 'LEGACY',
      detail: null,
      legacyPaperTitle: paperTitle,
      legacyQuestions: qs as QuestionAnalysis[],
    }
  }
  return { ...empty, gradingMode }
}

/** 兼容 camelCase 与常见 Spring JSON（snake_case） */
function normalizeExamRecordItem(item: unknown): ExamHistoryRecord | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const rawExamId = o.examId ?? o.exam_id
  if (rawExamId == null || rawExamId === '') return null
  const examId = typeof rawExamId === 'number' ? rawExamId : Number(rawExamId)
  if (!Number.isFinite(examId)) return null
  return {
    examId,
    fileName: pickStr(o, 'fileName', 'file_name'),
    status: pickNum(o, 'status', 'status'),
    createdAt: pickStr(o, 'createdAt', 'created_at'),
    totalQuestions: pickNum(o, 'totalQuestions', 'total_questions'),
    correctCount: pickNum(o, 'correctCount', 'correct_count'),
    accuracyRate: pickNum(o, 'accuracyRate', 'accuracy_rate'),
  }
}

function normalizeExamRecordsResponse(raw: unknown): ExamHistoryRecord[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as { records?: unknown }).records)) {
    list = (raw as { records: unknown[] }).records
  }
  return list.map(normalizeExamRecordItem).filter((r): r is ExamHistoryRecord => r != null)
}

/** 当前用户上传的试卷历史（Bearer 由拦截器自动附加） */
export async function fetchExamHistoryRecords(): Promise<ExamHistoryRecord[]> {
  const { data } = await api.get<unknown>('/exams/history')
  return normalizeExamRecordsResponse(data)
}

/** 单份试卷详情（含 PDF 访问 URL、逐题批改）；路径形如 GET /exams/8/detail */
export async function fetchExamDetail(examId: number): Promise<ExamDetailResponse> {
  const { data } = await api.get<unknown>(`/exams/${examId}/detail`)
  return normalizeExamDetail(data, examId)
}

function normalizeSimilarPracticeItem(item: unknown, fallbackIndex?: number): SimilarPracticeItem | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const rawIdx = o.index ?? o.Index
  let index: number
  if (rawIdx != null && rawIdx !== '') {
    const n = typeof rawIdx === 'number' ? rawIdx : Number(rawIdx)
    index = Number.isFinite(n) ? Math.trunc(n) : -1
  } else {
    index = -1
  }
  if (index < 0) {
    if (fallbackIndex != null && fallbackIndex > 0) index = fallbackIndex
    else return null
  }

  return {
    index,
    question: pickStrAny(o, ['question', 'question_text', 'questionText']),
    optionA: pickStrAny(o, ['optionA', 'option_a']),
    optionB: pickStrAny(o, ['optionB', 'option_b']),
    optionC: pickStrAny(o, ['optionC', 'option_c']),
    optionD: pickStrAny(o, ['optionD', 'option_d']),
    correctAnswer: pickStrAny(o, ['correctAnswer', 'correct_answer']),
  }
}

/** 解包 { data: {...} } / { result: {...} } 等常见外层 */
function unwrapSimilarPracticePayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const inner = o.data ?? o.result ?? o.payload
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>
  }
  return o
}

function normalizeSimilarPracticeResponse(raw: unknown): SimilarPracticeResponse {
  const empty: SimilarPracticeResponse = {
    examId: 0,
    sourceQuestionNo: 0,
    sourceQuestion: '',
    sourceUserAnswer: '',
    sourceCorrectAnswer: '',
    similarQuestions: [],
  }
  const o = unwrapSimilarPracticePayload(raw)
  if (!o) return empty

  const sq =
    o.similarQuestions ??
    o.similar_questions ??
    o.items ??
    o.list ??
    o.questions
  const similarQuestions = Array.isArray(sq)
    ? sq
        .map((item, i) => normalizeSimilarPracticeItem(item, i + 1))
        .filter((x): x is SimilarPracticeItem => x != null)
    : []
  return {
    examId: pickNum(o, 'examId', 'exam_id'),
    sourceQuestionNo: pickNum(o, 'sourceQuestionNo', 'source_question_no'),
    sourceQuestion: pickStrAny(o, ['sourceQuestion', 'source_question']),
    sourceUserAnswer: pickStrAny(o, ['sourceUserAnswer', 'source_user_answer']),
    sourceCorrectAnswer: pickStrAny(o, ['sourceCorrectAnswer', 'source_correct_answer']),
    similarQuestions,
  }
}

/**
 * GET /exams/{examId}/questions/{questionNo}/similar-practice
 * - 路径参数优先使用试卷中的 questionNo；若返回 404，且传入 questionDetailId 与 questionNo 不同，会再尝试用 questionDetailId 作为路径段（兼容部分后端实现）。
 * - 超时单独放宽：相似题生成可能较慢，避免落回默认 12s 超时。
 */
export async function fetchSimilarPractice(
  examId: number,
  questionNo: number,
  questionDetailId?: number,
): Promise<SimilarPracticeResponse> {
  const timeout = 300_000
  const url = (segment: number) => `/exams/${examId}/questions/${segment}/similar-practice`

  try {
    const { data } = await api.get<unknown>(url(questionNo), { timeout })
    return normalizeSimilarPracticeResponse(data)
  } catch (err) {
    const detailId =
      questionDetailId != null && questionDetailId > 0 ? Math.trunc(questionDetailId) : undefined
    if (
      isAxiosError(err) &&
      err.response?.status === 404 &&
      detailId != null &&
      detailId !== Math.trunc(questionNo)
    ) {
      const { data } = await api.get<unknown>(url(detailId), { timeout })
      return normalizeSimilarPracticeResponse(data)
    }
    throw err
  }
}

export async function uploadPaper(file: File): Promise<UploadPaperResult> {
  const formData = new FormData()
  // 与后端 @RequestPart("file") 一致，字段名必须为 file，且勿手动设置 Content-Type
  formData.append('file', file)

  const token = loadAccessToken().trim()
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // 不要手动设置 Content-Type：FormData 需由浏览器带上 multipart boundary，否则后端无法解析且易丢鉴权头合并
  // 后端可能长时间调用 AI 后再返回，超时放宽至 10 分钟
  const { data } = await api.post<unknown>('/exams/upload-pdf', formData, {
    headers,
    timeout: 600_000,
  })
  return normalizeUploadPaperResponse(data)
}

export async function fetchProfile() {
  const { data } = await api.get<UserProfile>('/users/profile')
  return data
}

function normalizeByQuestionTypeRow(item: unknown): UserLearningStatsByQuestionType | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const qt = o.questionType ?? o.question_type
  const questionType = qt == null || qt === '' ? NaN : typeof qt === 'number' ? qt : Number(qt)
  if (!Number.isFinite(questionType)) return null
  return {
    questionType,
    typeName: pickStrAny(o, ['typeName', 'type_name']),
    totalQuestions: pickNum(o, 'totalQuestions', 'total_questions'),
    correctCount: pickNum(o, 'correctCount', 'correct_count'),
    wrongCount: pickNum(o, 'wrongCount', 'wrong_count'),
    correctRatePercent: pickFloat(o, 'correctRatePercent', 'correct_rate_percent'),
    wrongRatePercent: pickFloat(o, 'wrongRatePercent', 'wrong_rate_percent'),
  }
}

function normalizeLearningStatsDay(item: unknown): UserLearningStatsDay | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  let dateStr = pickStrAny(o, ['date', 'day'])
  if (!dateStr) {
    const y = pickNum(o, 'year', 'year')
    const m = pickNum(o, 'month', 'month')
    const d = pickNum(o, 'dayOfMonth', 'day_of_month')
    if (y > 0 && m > 0 && d > 0) {
      dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  if (!dateStr) return null
  return {
    year: pickNum(o, 'year', 'year'),
    month: pickNum(o, 'month', 'month'),
    dayOfMonth: pickNum(o, 'dayOfMonth', 'day_of_month'),
    date: dateStr,
    totalQuestions: pickNum(o, 'totalQuestions', 'total_questions'),
    correctCount: pickNum(o, 'correctCount', 'correct_count'),
    wrongCount: pickNum(o, 'wrongCount', 'wrong_count'),
    correctRatePercent: pickFloat(o, 'correctRatePercent', 'correct_rate_percent'),
    wrongRatePercent: pickFloat(o, 'wrongRatePercent', 'wrong_rate_percent'),
  }
}

function normalizeMonthAggregate(item: unknown): UserLearningStatsMonthAggregate | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const year = pickNum(o, 'year', 'year')
  const month = pickNum(o, 'month', 'month')
  if (year <= 0 || month <= 0) return null
  const ym = pickStrAny(o, ['yearMonth', 'year_month'])
  return {
    year,
    month,
    yearMonth: ym || `${year}-${String(month).padStart(2, '0')}`,
    totalQuestions: pickNum(o, 'totalQuestions', 'total_questions'),
    correctCount: pickNum(o, 'correctCount', 'correct_count'),
    wrongCount: pickNum(o, 'wrongCount', 'wrong_count'),
    correctRatePercent: pickFloat(o, 'correctRatePercent', 'correct_rate_percent'),
    wrongRatePercent: pickFloat(o, 'wrongRatePercent', 'wrong_rate_percent'),
  }
}

function normalizeLearningStats(raw: unknown): UserLearningStats | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const byQt = o.byQuestionType ?? o.by_question_type
  const byDay = o.currentMonthByDay ?? o.current_month_by_day
  const cur = o.currentMonth ?? o.current_month
  const trend = o.monthlyTrendLast12 ?? o.monthly_trend_last12

  const byQuestionType = Array.isArray(byQt)
    ? byQt.map(normalizeByQuestionTypeRow).filter((x): x is UserLearningStatsByQuestionType => x != null)
    : []
  const currentMonthByDay = Array.isArray(byDay)
    ? byDay.map(normalizeLearningStatsDay).filter((x): x is UserLearningStatsDay => x != null)
    : []
  const currentMonth = cur ? normalizeMonthAggregate(cur) : null
  const monthlyTrendLast12 = Array.isArray(trend)
    ? trend.map(normalizeMonthAggregate).filter((x): x is UserLearningStatsMonthAggregate => x != null)
    : []

  if (
    byQuestionType.length === 0 &&
    currentMonthByDay.length === 0 &&
    !currentMonth &&
    monthlyTrendLast12.length === 0
  ) {
    return undefined
  }

  return { byQuestionType, currentMonthByDay, currentMonth, monthlyTrendLast12 }
}

function normalizeUserMe(raw: unknown): UserMeResponse {
  if (!raw || typeof raw !== 'object') {
    return { username: '', email: '', age: 0, daysSinceCreated: 0 }
  }
  let o = raw as Record<string, unknown>
  const wrapped = o.data ?? o.result ?? o.payload
  if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)) {
    o = wrapped as Record<string, unknown>
  }
  const lsRaw = o.learningStats ?? o.learning_stats
  const learningStats = lsRaw != null ? normalizeLearningStats(lsRaw) : undefined
  return {
    username: pickStrAny(o, ['username', 'userName', 'user_name', 'name', 'fullName', 'full_name']),
    email: pickStrAny(o, ['email', 'userEmail', 'user_email']),
    age: pickNum(o, 'age', 'age'),
    daysSinceCreated: pickNum(o, 'daysSinceCreated', 'days_since_created'),
    ...(learningStats ? { learningStats } : {}),
  }
}

/** 当前登录用户基本信息（个人中心展示以本接口为准） */
export async function fetchUserMe(): Promise<UserMeResponse> {
  const { data } = await api.get<unknown>('/users/me')
  return normalizeUserMe(data)
}

export async function patchUserMe(payload: PatchUserMePayload) {
  const { data } = await api.patch<UserProfile>('/users/me', payload)
  return data
}

export async function fetchReport() {
  const { data } = await api.get<ReportItem[]>('/reports/learning')
  return data
}

export async function fetchLearningInsights(
  range: LearningTimeRange = '30d',
  questionType?: LearningQuestionType,
) {
  const { data } = await api.get<LearningInsightsResponse>('/reports/learning-insights', {
    params: {
      range,
      type: questionType,
    },
  })
  return data
}

export async function requestAIGuidance(payload: AIGuidancePayload) {
  const { data } = await api.post<AIGuidanceResponse>('/ai/guidance', payload)
  return data
}

export async function ingestLearningStats(payload: LearningStatsIngestPayload) {
  const { data } = await api.post<LearningStatsIngestResponse>('/reports/learning/ingest', payload)
  return data
}
