import { BookOpen, Eye, FileText, Loader2, Send, UploadCloud, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { mapExamDetailQuestionToAnalysis } from '../lib/exam-question-map'
import { mapSimilarItemToPracticeQuestion } from '../lib/similar-practice-map'
import { recordPaperResult } from '../lib/learning-stats'
import {
  fetchExamDetail,
  fetchExamHistoryRecords,
  fetchSimilarPractice,
  ingestLearningStats,
  requestAIGuidance,
  uploadPaper,
} from '../lib/api'
import { getHttpErrorMessage } from '../lib/http-error'
import { createMockAnalysisPaper } from '../lib/mock-dashboard-analysis'
import { AI_GUIDANCE_STORAGE_KEY } from '../lib/session-reset'
import { PageTransition } from '../components/layout/page-transition'
import type {
  AIGuidanceMessage,
  ExamDetailResponse,
  ExamHistoryRecord,
  PracticeQuestion,
  QuestionAnalysis,
} from '../types'

const acceptedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
const questionsPerPage = 5
const historyItemsPerPage = 6

function round(value: number) {
  return Math.round(value * 10) / 10
}

const PRACTICE_BATCH_SIZE = 5

/** 模拟：生成与后端一致的 N 道类似错题（后续可替换为接口返回的数组） */
function createMockPracticeQuestionsBatch(question: QuestionAnalysis): PracticeQuestion[] {
  const kp = question.knowledgePoint?.trim() || '本题相关核心考点'
  const hint = question.explanation.slice(0, 72).trim() || '结合题干条件逐步推理'
  const suffix = question.explanation.length > 72 ? '…' : ''

  const stems = [
    `下列哪一项最符合「${kp}」的规范思路？`,
    `在「${kp}」场景下，容易出错的是哪种做法？`,
    `针对本题错因，下列表述中最恰当的是？`,
    `复习「${kp}」时，应优先强化的能力是？`,
    `与题干条件「${hint}${suffix}」最匹配的解题策略是？`,
  ]

  return Array.from({ length: PRACTICE_BATCH_SIZE }, (_, i) => {
    const optionA = '先梳理题干约束与考查点，再选方法并验证关键步骤'
    const optionB = '凭印象套相似题型公式，略读题干细节'
    const optionC = '从选项反推，不建立与题干条件的对应关系'
    const optionD = '把次要信息当作核心等量关系直接列式'

    const permutations: [string, string, string, string][] = [
      [optionA, optionB, optionC, optionD],
      [optionB, optionA, optionC, optionD],
      [optionC, optionB, optionA, optionD],
      [optionD, optionB, optionC, optionA],
      [optionA, optionC, optionB, optionD],
    ]
    const options = permutations[i % permutations.length]
    const correctOptionIndex = options.indexOf(optionA)

    return {
      id: `mock-practice-${question.id}-${i}-${Date.now()}`,
      title: `错题巩固 · 练习 ${i + 1} / ${PRACTICE_BATCH_SIZE}`,
      prompt: `【模拟第 ${i + 1} 题】${stems[i]}（关联知识点：${kp}）`,
      options,
      correctOptionIndex,
      explanation: `【第 ${i + 1} 题解析】应先明确考点与题干条件，再选用对应方法；选项「${optionA.slice(0, 24)}…」为推荐路径。接入后端后此处为模型返回的解析。`,
    }
  })
}

interface UploadedPaper {
  id: string
  name: string
  previewUrl: string
  isPdf: boolean
  isAnalyzing: boolean
  errorText: string
  questions: QuestionAnalysis[]
  /** 上传批改接口返回的试卷 id，用于拉取相似练习等 */
  serverExamId?: number
  /** 已选本地文件，待用户点击「确定上传」后再请求接口 */
  file?: File
  awaitingConfirm?: boolean
}

interface GuidancePersistedState {
  guideInputByQuestion: Record<string, string>
  guideMessagesByQuestion: Record<string, AIGuidanceMessage[]>
  guideSessionByQuestion: Record<string, string>
  guideResolvedByQuestion: Record<string, boolean>
  guideSuggestedByQuestion: Record<string, string>
}

export function DashboardPage() {
  const [papers, setPapers] = useState<UploadedPaper[]>([])
  const [activePaperId, setActivePaperId] = useState('')
  const [activeExamId, setActiveExamId] = useState<number | null>(null)
  const [examRecords, setExamRecords] = useState<ExamHistoryRecord[]>([])
  const [examRecordsLoading, setExamRecordsLoading] = useState(false)
  const [examRecordsError, setExamRecordsError] = useState('')
  const [examDetail, setExamDetail] = useState<ExamDetailResponse | null>(null)
  const [examDetailLoading, setExamDetailLoading] = useState(false)
  const [examDetailError, setExamDetailError] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [analysisPage, setAnalysisPage] = useState(1)
  const [guideInputByQuestion, setGuideInputByQuestion] = useState<Record<string, string>>({})
  const [guideMessagesByQuestion, setGuideMessagesByQuestion] = useState<Record<string, AIGuidanceMessage[]>>({})
  const [guideSessionByQuestion, setGuideSessionByQuestion] = useState<Record<string, string>>({})
  const [guideResolvedByQuestion, setGuideResolvedByQuestion] = useState<Record<string, boolean>>({})
  const [guideSuggestedByQuestion, setGuideSuggestedByQuestion] = useState<Record<string, string>>({})
  const [guideLoadingByQuestion, setGuideLoadingByQuestion] = useState<Record<string, boolean>>({})

  const [practiceDialogOpen, setPracticeDialogOpen] = useState(false)
  const [practiceFetchLoading, setPracticeFetchLoading] = useState(false)
  const [practiceFromApi, setPracticeFromApi] = useState(false)
  const [practiceFallbackNote, setPracticeFallbackNote] = useState('')
  const [practiceItems, setPracticeItems] = useState<PracticeQuestion[]>([])
  const [practicePageIndex, setPracticePageIndex] = useState(0)
  /** 每道练习题的已选选项索引，与 practiceItems 对齐 */
  const [practiceSelections, setPracticeSelections] = useState<(number | null)[]>([])

  const activePaper = useMemo(
    () => papers.find((paper) => paper.id === activePaperId) ?? null,
    [papers, activePaperId],
  )

  const activeExamRecord = useMemo(
    () => (activeExamId != null ? examRecords.find((r) => r.examId === activeExamId) ?? null : null),
    [examRecords, activeExamId],
  )

  /** 本地会话用 paper.id；云端详情用稳定前缀，供 AI 引导等接口的 paperId */
  const analysisContextId = useMemo(() => {
    if (activePaper) return activePaper.id
    if (activeExamId != null) return `server-exam-${activeExamId}`
    return ''
  }, [activePaper, activeExamId])

  const historyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(examRecords.length / historyItemsPerPage)),
    [examRecords.length],
  )

  const pagedExamRecords = useMemo(() => {
    const start = (historyPage - 1) * historyItemsPerPage
    return examRecords.slice(start, start + historyItemsPerPage)
  }, [examRecords, historyPage])

  const analysisQuestionList = useMemo((): QuestionAnalysis[] => {
    if (activePaper?.questions?.length) return activePaper.questions
    if (activeExamId != null && examDetail?.questions?.length)
      return examDetail.questions.map((q, i) => mapExamDetailQuestionToAnalysis(q, i + 1))
    return []
  }, [activePaper, activeExamId, examDetail])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(analysisQuestionList.length / questionsPerPage)),
    [analysisQuestionList.length],
  )

  const pagedQuestions = useMemo(() => {
    const start = (analysisPage - 1) * questionsPerPage
    return analysisQuestionList.slice(start, start + questionsPerPage)
  }, [analysisQuestionList, analysisPage])

  const hasAwaitingConfirm = useMemo(
    () => papers.some((p) => p.awaitingConfirm && p.file),
    [papers],
  )

  const isAnyPaperUploading = useMemo(() => papers.some((p) => p.isAnalyzing), [papers])

  useEffect(() => {
    setAnalysisPage(1)
  }, [activePaperId, activeExamId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setExamRecordsLoading(true)
      setExamRecordsError('')
      try {
        const list = await fetchExamHistoryRecords()
        if (!cancelled) setExamRecords(list)
      } catch (err) {
        if (!cancelled) setExamRecordsError(getHttpErrorMessage(err, '加载云端历史失败。'))
      } finally {
        if (!cancelled) setExamRecordsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeExamId == null || activePaperId) {
      setExamDetail(null)
      setExamDetailError('')
      setExamDetailLoading(false)
      return
    }

    let cancelled = false
    setExamDetail(null)
    setExamDetailError('')
    setExamDetailLoading(true)
    ;(async () => {
      try {
        const detail = await fetchExamDetail(activeExamId)
        if (!cancelled) setExamDetail(detail)
      } catch (err) {
        if (!cancelled) {
          setExamDetail(null)
          setExamDetailError(getHttpErrorMessage(err, '加载试卷详情失败。'))
        }
      } finally {
        if (!cancelled) setExamDetailLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeExamId, activePaperId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(AI_GUIDANCE_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as GuidancePersistedState
      setGuideInputByQuestion(parsed.guideInputByQuestion || {})
      setGuideMessagesByQuestion(parsed.guideMessagesByQuestion || {})
      setGuideSessionByQuestion(parsed.guideSessionByQuestion || {})
      setGuideResolvedByQuestion(parsed.guideResolvedByQuestion || {})
      setGuideSuggestedByQuestion(parsed.guideSuggestedByQuestion || {})
    } catch {
      // Ignore malformed local cache to keep dashboard usable.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const payload: GuidancePersistedState = {
      guideInputByQuestion,
      guideMessagesByQuestion,
      guideSessionByQuestion,
      guideResolvedByQuestion,
      guideSuggestedByQuestion,
    }

    window.localStorage.setItem(AI_GUIDANCE_STORAGE_KEY, JSON.stringify(payload))
  }, [
    guideInputByQuestion,
    guideMessagesByQuestion,
    guideSessionByQuestion,
    guideResolvedByQuestion,
    guideSuggestedByQuestion,
  ])

  useEffect(() => {
    if (analysisPage > totalPages) {
      setAnalysisPage(totalPages)
    }
  }, [analysisPage, totalPages])

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages)
    }
  }, [historyPage, historyTotalPages])

  const getGuideStateKey = (paperId: string, questionId: string) =>
    `${paperId}-${questionId}`

  const getVisiblePages = (currentPage: number, pageCount: number): Array<number | 'ellipsis'> => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index + 1)
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', pageCount]
    }

    if (currentPage >= pageCount - 3) {
      return [1, 'ellipsis', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
    }

    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', pageCount]
  }

  const handleFileChange = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return

    const validFiles = Array.from(selected).filter((file) => acceptedTypes.includes(file.type))
    if (validFiles.length === 0) return

    const baseTime = Date.now()
    const newPapers: UploadedPaper[] = validFiles.map((file, index) => {
      const paperId = `${baseTime}-${index}`
      return {
        id: paperId,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        isPdf: file.type === 'application/pdf',
        isAnalyzing: false,
        errorText: '',
        questions: [],
        file,
        awaitingConfirm: true,
      }
    })

    setActiveExamId(null)
    setPapers((previous) => [...previous, ...newPapers])
    if (!activePaperId) {
      setActivePaperId(newPapers[0].id)
    }
  }

  const handleConfirmUpload = async () => {
    const targets = papers.filter((p) => p.awaitingConfirm && p.file)
    if (targets.length === 0) return

    setPapers((previous) =>
      previous.map((p) =>
        targets.some((t) => t.id === p.id)
          ? { ...p, awaitingConfirm: false, isAnalyzing: true, errorText: '' }
          : p,
      ),
    )

    await Promise.all(
      targets.map(async (pending) => {
        const file = pending.file!
        const currentId = pending.id
        try {
          const result = await uploadPaper(file)

          let questions: QuestionAnalysis[]
          let displayName: string
          let nextPreviewUrl = pending.previewUrl
          let nextIsPdf = pending.isPdf
          let totalQuestions: number
          let correctQuestions: number
          let wrongQuestions: number

          if (result.detail) {
            const d = result.detail
            questions = d.questions.map((q, i) => mapExamDetailQuestionToAnalysis(q, i + 1))
            displayName = d.fileName.trim() || file.name
            if (d.fileUrl) {
              URL.revokeObjectURL(pending.previewUrl)
              nextPreviewUrl = d.fileUrl
              nextIsPdf = true
            }
            totalQuestions = d.totalQuestions > 0 ? d.totalQuestions : questions.length
            correctQuestions = d.correctCount
            wrongQuestions = Math.max(0, totalQuestions - correctQuestions)
          } else if (result.legacyQuestions.length > 0) {
            questions = result.legacyQuestions
            displayName = result.legacyPaperTitle.trim() || file.name
            totalQuestions = questions.length
            wrongQuestions = questions.filter((item) => item.status === 'wrong').length
            correctQuestions = totalQuestions - wrongQuestions
          } else {
            throw new Error('EMPTY_UPLOAD_RESPONSE')
          }

          recordPaperResult(questions)

          const errorRate = totalQuestions > 0 ? round((wrongQuestions / totalQuestions) * 100) : 0
          const accuracy = round(100 - errorRate)

          void ingestLearningStats({
            paperId: currentId,
            paperTitle: displayName,
            submittedAt: new Date().toISOString(),
            totalQuestions,
            correctQuestions,
            wrongQuestions,
            accuracy,
            errorRate,
            questions: questions.map((question) => ({
              questionId: question.id,
              questionNumber: question.questionNumber,
              status: question.status,
              knowledgePoint: question.knowledgePoint,
            })),
          }).catch(() => {
            // Do not block UI when backend ingest is temporarily unavailable.
          })

          setPapers((previous) =>
            previous.map((paper) =>
              paper.id === currentId
                ? {
                    ...paper,
                    name: displayName,
                    previewUrl: nextPreviewUrl,
                    isPdf: nextIsPdf,
                    isAnalyzing: false,
                    questions,
                    errorText: '',
                    file: undefined,
                    awaitingConfirm: undefined,
                    serverExamId:
                      result.detail && result.detail.examId > 0 ? result.detail.examId : undefined,
                  }
                : paper,
            ),
          )
        } catch (err) {
          const message =
            err instanceof Error && err.message === 'EMPTY_UPLOAD_RESPONSE'
              ? '服务器返回的批改数据为空，请稍后重试。'
              : getHttpErrorMessage(
                  err,
                  '试卷上传或 AI 批改失败，请稍后重试。（若等待较久仍失败，可能是超时，可尝试减小文件或联系管理员）',
                )
          setPapers((previous) =>
            previous.map((paper) =>
              paper.id === currentId
                ? {
                    ...paper,
                    isAnalyzing: false,
                    questions: [],
                    errorText: message,
                    awaitingConfirm: true,
                  }
                : paper,
            ),
          )
        }
      }),
    )

    void fetchExamHistoryRecords()
      .then((list) => setExamRecords(list))
      .catch(() => {
        // 历史列表刷新失败不影响本次上传结果展示
      })
  }

  const openPracticeDialog = async (question: QuestionAnalysis) => {
    setPracticeFallbackNote('')
    setPracticeFromApi(false)
    setPracticeDialogOpen(true)
    setPracticeFetchLoading(true)
    setPracticeItems([])
    setPracticeSelections([])
    setPracticePageIndex(0)

    const examIdForPractice =
      activeExamId != null && !activePaperId.trim()
        ? activeExamId
        : activePaper?.serverExamId != null && activePaper.serverExamId > 0
          ? activePaper.serverExamId
          : null

    let loadedFromApi = false
    if (examIdForPractice != null) {
      try {
        const questionNoForApi = question.examQuestionNo ?? question.questionNumber
        if (!Number.isFinite(questionNoForApi) || questionNoForApi < 1) {
          setPracticeFallbackNote('当前题目缺少有效题号 questionNo，无法请求相似练习。')
        } else {
          const detailIdParsed = Number.parseInt(question.id, 10)
          const questionDetailId = Number.isFinite(detailIdParsed) ? detailIdParsed : undefined
          const res = await fetchSimilarPractice(
            examIdForPractice,
            Math.trunc(questionNoForApi),
            questionDetailId,
          )
          const batch = res.similarQuestions.map(mapSimilarItemToPracticeQuestion)
          if (batch.length > 0) {
            setPracticeItems(batch)
            setPracticeSelections(Array.from({ length: batch.length }, () => null))
            loadedFromApi = true
            setPracticeFromApi(true)
          }
        }
      } catch (err) {
        setPracticeFallbackNote(
          getHttpErrorMessage(
            err,
            '相似练习接口暂不可用，已使用本地模拟题。（若提示超时，请稍后重试或联系后端延长处理时间）',
          ),
        )
      }
    }

    if (!loadedFromApi) {
      const mock = createMockPracticeQuestionsBatch(question)
      setPracticeItems(mock)
      setPracticeSelections(Array.from({ length: mock.length }, () => null))
      setPracticeFromApi(false)
    }

    setPracticeFetchLoading(false)
  }

  const closePracticeDialog = () => {
    setPracticeDialogOpen(false)
    setPracticeFetchLoading(false)
    setPracticeFromApi(false)
    setPracticeFallbackNote('')
    setPracticeItems([])
    setPracticeSelections([])
    setPracticePageIndex(0)
  }

  const practiceCurrent = practiceItems[practicePageIndex]
  const practiceSelectedIndex = practiceSelections[practicePageIndex] ?? null
  const practiceTotalPages = practiceItems.length

  const setPracticeSelectedForCurrentPage = (optionIndex: number) => {
    setPracticeSelections((prev) => {
      const next = [...prev]
      next[practicePageIndex] = optionIndex
      return next
    })
  }

  const resetPracticeSelectionCurrentPage = () => {
    setPracticeSelections((prev) => {
      const next = [...prev]
      next[practicePageIndex] = null
      return next
    })
  }

  const handleLoadMockAnalysis = () => {
    const paperId = `mock-analysis-${Date.now()}`
    const mockPaper = createMockAnalysisPaper(paperId)
    setActiveExamId(null)
    setPapers((prev) => [...prev, mockPaper])
    setHistoryPage(Math.max(1, Math.ceil(examRecords.length / historyItemsPerPage)))
    setActivePaperId(paperId)
    setAnalysisPage(1)
  }

  return (
    <PageTransition className="max-w-none px-2 pb-8 pt-2 sm:px-3 lg:px-4">
      <section className="flex min-h-[calc(100vh-5rem)] flex-col gap-3">
        <div className="shrink-0">
          <h1 className="text-3xl font-semibold tracking-tight">批改仪表盘</h1>
          <p className="mt-2 text-gray-600">
            左侧上传试卷，右侧查看 AI 批改分析结果。
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="border-gray-300 lg:flex lg:h-[calc(100vh-10rem)] lg:flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">历史记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-2 pb-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
              {examRecordsLoading && examRecords.length === 0 && (
                <p className="flex items-center gap-2 px-1 text-xs text-gray-600">
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  加载云端历史…
                </p>
              )}
              {examRecordsError && (
                <p className="px-1 text-xs text-red-600">{examRecordsError}</p>
              )}
              {examRecords.length === 0 && !examRecordsLoading ? (
                <p className="px-1 text-xs text-gray-500">暂无云端历史记录</p>
              ) : (
                <div className="history-scroll-panel space-y-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 dashboard-scrollbar">
                  {pagedExamRecords.map((record, index) => {
                    const order = (historyPage - 1) * historyItemsPerPage + index + 1
                    const selected = activeExamId === record.examId && !activePaperId
                    return (
                      <div
                        key={`exam-${record.examId}`}
                        className={`flex items-stretch gap-0 overflow-hidden rounded-md border transition ${
                          selected ? 'border-gray-900 bg-white' : 'border-gray-300 bg-white hover:bg-gray-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveExamId(record.examId)
                            setActivePaperId('')
                          }}
                          className="min-w-0 flex-1 p-1.5 text-left"
                        >
                          <p className="text-xs font-semibold text-gray-700">{order}</p>
                          <p className="truncate text-[11px] text-gray-600" title={record.fileName}>
                            {record.fileName}
                          </p>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {examRecords.length > historyItemsPerPage && (
                <div className="mt-1 flex items-center justify-between rounded-md border bg-gray-50 px-2 py-1.5">
                  <div className="flex w-full items-center justify-center gap-1 overflow-x-auto py-0.5">
                    {getVisiblePages(historyPage, historyTotalPages).map((item, index) => {
                      if (item === 'ellipsis') {
                        return (
                          <span
                            key={`history-page-ellipsis-${index}`}
                            className="px-1 text-xs text-gray-500"
                            aria-hidden="true"
                          >
                            ...
                          </span>
                        )
                      }

                      return (
                        <Button
                          key={`history-page-${item}`}
                          size="sm"
                          variant={historyPage === item ? 'default' : 'outline'}
                          className="h-7 min-w-7 px-1 text-xs"
                          onClick={() => setHistoryPage(item)}
                        >
                          {item}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-300 lg:flex lg:h-[calc(100vh-10rem)] lg:flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UploadCloud className="h-5 w-5" />
                试卷上传
              </CardTitle>
              <CardDescription>
                支持 PDF、PNG、JPG。选择文件后请点击「确定上传」；上传后服务端会进行 AI 批改，可能需要数分钟，请勿关闭页面。
              </CardDescription>
            </CardHeader>
            <CardContent className="upload-scroll-panel dashboard-scrollbar space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-scroll lg:pr-2">
              <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-gray-400 p-6 text-center hover:bg-gray-50">
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) => {
                    handleFileChange(event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
                <span className="text-sm text-gray-600">
                  点击选择文件（可多选），然后在下方确认上传
                </span>
              </label>

              {(hasAwaitingConfirm || isAnyPaperUploading) && (
                <Button
                  type="button"
                  className="w-full gap-2"
                  disabled={isAnyPaperUploading}
                  onClick={() => {
                    void handleConfirmUpload()
                  }}
                >
                  {isAnyPaperUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      上传中，AI 批改中…
                    </>
                  ) : (
                    '确定上传'
                  )}
                </Button>
              )}

              <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-700">
                <p>
                  <strong>当前文件：</strong>{' '}
                  {activePaper?.name ?? examDetail?.fileName ?? activeExamRecord?.fileName ?? '未选择文件'}
                </p>
                <p>
                  <strong>云端历史：</strong> {examRecords.length} 条
                </p>
                {papers.length > 0 ? (
                  <p>
                    <strong>当前编辑：</strong> {papers.length} 个文件（仅预览/批改，不写入左侧历史）
                  </p>
                ) : null}
              </div>

              {(activePaper || activeExamRecord) && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Eye className="h-4 w-4" />
                    预览
                  </p>
                  <div className="h-[66vh] min-h-[520px] overflow-hidden rounded-md border bg-white lg:h-[calc(100vh-22rem)] lg:min-h-[420px]">
                    {activePaper ? (
                      activePaper.isPdf ? (
                        <iframe src={activePaper.previewUrl} className="h-full w-full" title="试卷预览" />
                      ) : (
                        <img
                          src={activePaper.previewUrl}
                          alt="Paper preview"
                          className="h-full w-full object-contain"
                        />
                      )
                    ) : examDetail?.fileUrl ? (
                      <iframe src={examDetail.fileUrl} className="h-full w-full" title="试卷预览" />
                    ) : examDetailLoading && activeExamRecord ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 bg-gray-50 text-sm text-gray-600">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        正在获取 PDF 链接…
                      </div>
                    ) : examDetailError ? (
                      <div className="flex h-full items-center justify-center bg-gray-50 p-4 text-center text-sm text-red-700">
                        {examDetailError}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 bg-gray-50 p-6 text-center text-sm text-gray-600">
                        <p>云端试卷「{activeExamRecord?.fileName ?? '—'}」</p>
                        <p className="max-w-xs text-xs text-gray-500">
                          详情接口未返回 fileUrl 时无法内嵌预览；请核对后端试卷详情响应。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-300 lg:flex lg:h-[calc(100vh-10rem)] lg:flex-col">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5" />
                  分析结果
                </CardTitle>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={handleLoadMockAnalysis}>
                    加载模拟分析（测试）
                  </Button>
                </div>
              </div>
              <CardDescription>
                {activePaper
                  ? `当前展示：${activePaper.name}`
                  : activeExamRecord
                    ? `当前展示（云端）：${activeExamRecord.fileName}`
                    : '按题展示评分与解析。后端批改未就绪时可点右上角「加载模拟分析」以测试错题练习。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="analysis-scroll-panel dashboard-scrollbar space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-scroll lg:pr-2">
              {!activePaper && !activeExamRecord && (
                <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-600">
                  请从左侧选择一条云端历史，或在中间栏上传试卷；批改完成后可在右侧查看逐题解析。
                </div>
              )}

              {activeExamRecord && !activePaper && examDetailLoading && (
                <div className="flex items-center gap-2 rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载试卷详情…
                </div>
              )}

              {activeExamRecord && !activePaper && examDetailError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {examDetailError}
                </div>
              )}

              {activeExamRecord && !activePaper && (
                <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
                  <p className="font-semibold text-gray-900">云端批改概要</p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm">
                    <dt className="text-gray-500">试卷 ID</dt>
                    <dd className="text-gray-900">{examDetail?.examId ?? activeExamRecord.examId}</dd>
                    <dt className="text-gray-500">题目总数</dt>
                    <dd className="text-gray-900">
                      {examDetail?.totalQuestions ?? activeExamRecord.totalQuestions}
                    </dd>
                    <dt className="text-gray-500">正确数</dt>
                    <dd className="text-gray-900">
                      {examDetail?.correctCount ?? activeExamRecord.correctCount}
                    </dd>
                    <dt className="text-gray-500">正确率</dt>
                    <dd className="text-gray-900">
                      {examDetail?.accuracyRate ?? activeExamRecord.accuracyRate}%
                    </dd>
                    <dt className="text-gray-500">状态</dt>
                    <dd className="text-gray-900">{examDetail?.status ?? activeExamRecord.status}</dd>
                    <dt className="text-gray-500">上传时间</dt>
                    <dd className="text-gray-900">
                      {new Date(
                        examDetail?.examCreatedAt || activeExamRecord.createdAt,
                      ).toLocaleString('zh-CN')}
                    </dd>
                  </dl>
                </div>
              )}

              {activePaper?.awaitingConfirm && !activePaper.isAnalyzing && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  已选择「{activePaper.name}」，请在左侧上传区点击「确定上传」后开始分析。
                </div>
              )}

              {activePaper?.isAnalyzing && (
                <div className="space-y-2 rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    <span className="font-medium">AI 正在批改当前试卷</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    服务端完成识别与评分后才会返回结果，通常需要一至数分钟。若长时间无响应，可能是网络超时，可稍后重试或拆分试卷。
                  </p>
                </div>
              )}

              {activePaper?.errorText && (
                <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-600">
                  {activePaper.errorText}
                </div>
              )}

              {!activePaper?.isAnalyzing &&
                pagedQuestions.map((question) => {
                  const guideStateKey = analysisContextId
                    ? getGuideStateKey(analysisContextId, question.id)
                    : ''
                  const guideInput = guideStateKey ? guideInputByQuestion[guideStateKey] || '' : ''
                  const guideMessages = guideStateKey ? guideMessagesByQuestion[guideStateKey] || [] : []
                  const guideSessionId = guideStateKey ? guideSessionByQuestion[guideStateKey] : undefined
                  const guideResolved = guideStateKey ? Boolean(guideResolvedByQuestion[guideStateKey]) : false
                  const suggestedNextQuestion = guideStateKey ? guideSuggestedByQuestion[guideStateKey] || '' : ''
                  const isGuiding = guideStateKey ? Boolean(guideLoadingByQuestion[guideStateKey]) : false

                  return (
                    <div key={question.id} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">第 {question.questionNumber} 题</p>
                        <Badge variant={question.status === 'correct' ? 'success' : 'danger'}>
                          {question.status === 'correct' ? '正确' : '错误'}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">对错判定</span>
                          <Badge variant={question.status === 'correct' ? 'success' : 'danger'}>
                            {question.status === 'correct' ? '回答正确' : '回答错误'}
                          </Badge>
                        </div>
                        {question.stem?.trim() ? (
                          <div>
                            <p className="text-xs font-medium text-gray-600">题干</p>
                            <p className="mt-0.5 whitespace-pre-line text-gray-800">{question.stem}</p>
                          </div>
                        ) : null}
                        {(question.userAnswer !== undefined || question.correctAnswer !== undefined) && (
                          <div className="space-y-1 text-xs text-gray-700 sm:text-sm">
                            {question.userAnswer !== undefined && (
                              <p>
                                <span className="font-medium text-gray-600">你的答案：</span>
                                {question.userAnswer || '—'}
                              </p>
                            )}
                            {question.correctAnswer !== undefined && (
                              <p>
                                <span className="font-medium text-gray-600">参考答案：</span>
                                {question.correctAnswer || '—'}
                              </p>
                            )}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-gray-600">知识点</p>
                          <p className="mt-0.5 text-gray-800">
                            {question.knowledgePoint?.trim() || '—（本次 AI 分析未单独标注知识点）'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-600">AI 解析</p>
                          <p className="mt-0.5 text-gray-700">{question.explanation}</p>
                        </div>
                      </div>

                      {question.status === 'wrong' && (
                        <Accordion type="single" collapsible className="mt-3 w-full">
                          <AccordionItem value={`item-${question.id}`}>
                            <AccordionTrigger>错题 · AI 引导对话</AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3">
                                <div className="space-y-3 rounded-md border bg-gray-50 p-3">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold">AI 引导模式</p>
                                    <p className="text-xs text-gray-600">
                                      目标是引导你自己推导出正确答案，而不是直接给出结论。
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      后端预留：`POST /api/ai/guidance`，支持 `sessionId` 与 `history` 多轮上下文。
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-gray-600">引导状态：</span>
                                    <Badge variant={guideResolved ? 'success' : 'danger'}>
                                      {guideResolved ? '已掌握' : '未掌握'}
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (!guideStateKey) return
                                        setGuideResolvedByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: !guideResolved,
                                        }))
                                      }}
                                    >
                                      {guideResolved ? '改为未掌握' : '标记已掌握'}
                                    </Button>
                                  </div>

                                  {suggestedNextQuestion && (
                                    <div className="rounded-md border bg-white p-3">
                                      <p className="text-sm font-medium text-gray-800">AI 推荐下一问</p>
                                      <p className="mt-1 text-sm text-gray-700">{suggestedNextQuestion}</p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-2"
                                        onClick={() => {
                                          if (!guideStateKey) return
                                          setGuideInputByQuestion((previous) => ({
                                            ...previous,
                                            [guideStateKey]: suggestedNextQuestion,
                                          }))
                                        }}
                                      >
                                        使用下一问
                                      </Button>
                                    </div>
                                  )}

                                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-white p-3">
                                    {guideMessages.length === 0 ? (
                                      <p className="text-sm text-gray-500">等待你输入后开始引导对话。</p>
                                    ) : (
                                      guideMessages.map((message, index) => (
                                        <div
                                          key={`${guideStateKey}-${index}`}
                                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                          <div
                                            className={`max-w-[90%] rounded-md px-3 py-2 text-sm whitespace-pre-line ${
                                              message.role === 'user'
                                                ? 'border border-gray-900 bg-gray-900 text-white'
                                                : 'border border-gray-300 bg-gray-50 text-gray-800'
                                            }`}
                                          >
                                            {message.content}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  <label className="space-y-1 text-sm">
                                    <span className="text-gray-700">请先输入你的当前思路或答案：</span>
                                    <textarea
                                      value={guideInput}
                                      onChange={(event) => {
                                        if (!guideStateKey) return
                                        setGuideInputByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: event.target.value,
                                        }))
                                      }}
                                      rows={4}
                                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                                      placeholder="例如：我认为先设未知数，然后列方程..."
                                    />
                                  </label>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        if (!analysisContextId || !guideStateKey) return
                                        const userAttempt = guideInput.trim()
                                        if (!userAttempt) return

                                        const userMessage: AIGuidanceMessage = {
                                          role: 'user',
                                          content: userAttempt,
                                          createdAt: new Date().toISOString(),
                                        }

                                        const history = [...guideMessages, userMessage]
                                        setGuideMessagesByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: history,
                                        }))
                                        setGuideInputByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: '',
                                        }))

                                        setGuideLoadingByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: true,
                                        }))

                                        try {
                                          const response = await requestAIGuidance({
                                            paperId: analysisContextId,
                                            questionId: question.id,
                                            questionNumber: question.questionNumber,
                                            userAttempt,
                                            sessionId: guideSessionId,
                                            history,
                                            context: {
                                              explanation: question.explanation,
                                              knowledgePoint: question.knowledgePoint,
                                            },
                                          })

                                          const assistantMessage: AIGuidanceMessage = {
                                            role: 'assistant',
                                            content: response.message,
                                            createdAt: new Date().toISOString(),
                                          }

                                          setGuideSessionByQuestion((previous) => ({
                                            ...previous,
                                            [guideStateKey]: response.sessionId,
                                          }))
                                          setGuideResolvedByQuestion((previous) => ({
                                            ...previous,
                                            [guideStateKey]: Boolean(response.isResolved),
                                          }))
                                          setGuideSuggestedByQuestion((previous) => ({
                                            ...previous,
                                            [guideStateKey]: response.suggestedNextQuestion || '',
                                          }))
                                          setGuideMessagesByQuestion((previous) => ({
                                            ...previous,
                                            [guideStateKey]: [...history, assistantMessage],
                                          }))
                                        } catch (err) {
                                          const assistantMessage: AIGuidanceMessage = {
                                            role: 'assistant',
                                            content: `请求失败：${getHttpErrorMessage(err, 'AI 引导服务暂时不可用。')}`,
                                            createdAt: new Date().toISOString(),
                                          }
                                          setGuideMessagesByQuestion((previous) => ({
                                            ...previous,
                                            [guideStateKey]: [...history, assistantMessage],
                                          }))
                                        } finally {
                                          setGuideLoadingByQuestion((previous) => ({
                                            ...previous,
                                            [guideStateKey]: false,
                                          }))
                                        }
                                      }}
                                      disabled={isGuiding || !guideInput.trim()}
                                      className="gap-2"
                                    >
                                      {isGuiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                      AI引导
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (!guideStateKey) return
                                        setGuideInputByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: '',
                                        }))
                                        setGuideMessagesByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: [],
                                        }))
                                        setGuideSessionByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: '',
                                        }))
                                        setGuideResolvedByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: false,
                                        }))
                                        setGuideSuggestedByQuestion((previous) => ({
                                          ...previous,
                                          [guideStateKey]: '',
                                        }))
                                      }}
                                    >
                                      清空
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}

                      {question.status === 'wrong' && (
                        <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => {
                              void openPracticeDialog(question)
                            }}
                          >
                            <BookOpen className="h-4 w-4" />
                            练习
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}

              {!activePaper?.isAnalyzing &&
                activeExamRecord &&
                !activePaper &&
                examDetail &&
                !examDetailLoading &&
                analysisQuestionList.length === 0 && (
                  <p className="rounded-md border bg-gray-50 p-3 text-sm text-gray-600">
                    详情中暂无逐题数据。
                  </p>
                )}

              {!activePaper?.isAnalyzing && analysisQuestionList.length > questionsPerPage && (
                <div className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2">
                  <p className="text-sm text-gray-700">
                    第 {analysisPage} / {totalPages} 页
                  </p>
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnalysisPage((current) => Math.max(1, current - 1))}
                      disabled={analysisPage === 1}
                    >
                      上一页
                    </Button>

                    {getVisiblePages(analysisPage, totalPages).map((item, index) => {
                      if (item === 'ellipsis') {
                        return (
                          <span
                            key={`analysis-page-ellipsis-${index}`}
                            className="px-1 text-sm text-gray-500"
                            aria-hidden="true"
                          >
                            ...
                          </span>
                        )
                      }

                      return (
                        <Button
                          key={`analysis-page-${item}`}
                          size="sm"
                          variant={analysisPage === item ? 'default' : 'outline'}
                          onClick={() => setAnalysisPage(item)}
                          className="min-w-9"
                        >
                          {item}
                        </Button>
                      )
                    })}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnalysisPage((current) => Math.min(totalPages, current + 1))}
                      disabled={analysisPage === totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {practiceDialogOpen && (practiceFetchLoading || practiceItems.length > 0) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={practiceFetchLoading ? undefined : closePracticeDialog}
          role="presentation"
        >
          <div
            className="relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-dialog-title"
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              onClick={closePracticeDialog}
              disabled={practiceFetchLoading}
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>

            {practiceFetchLoading ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <Loader2 className="h-10 w-10 animate-spin text-gray-600" />
                <p className="text-center text-sm text-gray-600">正在加载相似练习题…</p>
              </div>
            ) : practiceCurrent ? (
              <>
                <p
                  className={`mb-1 text-xs font-medium uppercase tracking-wide ${
                    practiceFromApi ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {practiceFromApi
                    ? `后端相似练习（共 ${practiceTotalPages} 题）`
                    : `模拟题（共 ${practiceTotalPages} 题）`}
                </p>
                {practiceFallbackNote ? (
                  <p className="mb-2 text-xs text-amber-900">{practiceFallbackNote}</p>
                ) : null}
                <h2 id="practice-dialog-title" className="pr-8 text-lg font-semibold text-gray-900">
                  {practiceCurrent.title}
                </h2>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <p className="text-sm text-gray-600">
                    第 <span className="font-semibold text-gray-900">{practicePageIndex + 1}</span> /{' '}
                    {practiceTotalPages} 题
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={practicePageIndex <= 0}
                      onClick={() => setPracticePageIndex((p) => Math.max(0, p - 1))}
                    >
                      上一题
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={practicePageIndex >= practiceTotalPages - 1}
                      onClick={() => setPracticePageIndex((p) => Math.min(practiceTotalPages - 1, p + 1))}
                    >
                      下一题
                    </Button>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-gray-800">{practiceCurrent.prompt}</p>

                <p className="mt-4 text-xs font-medium text-gray-500">请选择一个选项</p>
                <div className="mt-2 space-y-2">
                  {practiceCurrent.options.map((option, index) => {
                    const revealed = practiceSelectedIndex !== null
                    const isCorrect = index === practiceCurrent.correctOptionIndex
                    const isPicked = index === practiceSelectedIndex
                    const label = String.fromCharCode(65 + index)

                    let optionClass =
                      'w-full rounded-md border px-3 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400'

                    if (revealed) {
                      if (isCorrect) {
                        optionClass += ' border-emerald-600 bg-emerald-50 text-emerald-900'
                      } else if (isPicked) {
                        optionClass += ' border-red-600 bg-red-50 text-red-900'
                      } else {
                        optionClass += ' border-gray-200 bg-gray-50 text-gray-500'
                      }
                    } else {
                      optionClass += ' border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50'
                    }

                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={revealed}
                        className={optionClass}
                        onClick={() => setPracticeSelectedForCurrentPage(index)}
                      >
                        <span className="font-semibold text-gray-600">{label}.</span> {option}
                      </button>
                    )
                  })}
                </div>

                {practiceSelectedIndex !== null && (
                  <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                    {practiceCurrent.explanation}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closePracticeDialog}>
                    关闭
                  </Button>
                  {practiceSelectedIndex !== null && (
                    <Button type="button" variant="outline" onClick={resetPracticeSelectionCurrentPage}>
                      本题重选
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
