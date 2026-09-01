import type { QuestionAnalysis } from '../types'

/** 后端批改未就绪时用于仪表盘联调：含对题与错题（错题可点「练习」） */
export const MOCK_ANALYSIS_QUESTIONS: QuestionAnalysis[] = [
  {
    id: 'mock-demo-1',
    questionNumber: 1,
    status: 'correct',
    explanation: '【模拟】作答与参考答案一致，推理过程完整。',
    knowledgePoint: '言语理解 · 主旨归纳',
  },
  {
    id: 'mock-demo-2',
    questionNumber: 2,
    status: 'wrong',
    explanation: '【模拟】对作者态度判断片面，忽略了转折后的否定倾向。',
    knowledgePoint: '言语理解 · 态度观点',
  },
  {
    id: 'mock-demo-3',
    questionNumber: 3,
    status: 'wrong',
    explanation: '【模拟】数量关系方程列错，未统一单位。',
    knowledgePoint: '数量关系 · 行程问题',
  },
  {
    id: 'mock-demo-4',
    questionNumber: 4,
    status: 'correct',
    explanation: '【模拟】资料分析增速计算正确。',
    knowledgePoint: '资料分析 · 增长率',
  },
]

const MOCK_PREVIEW_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">' +
      '<rect fill="#f9fafb" width="100%" height="100%"/>' +
      '<text x="50%" y="42%" text-anchor="middle" fill="#6b7280" font-family="system-ui,sans-serif" font-size="20">模拟试卷预览</text>' +
      '<text x="50%" y="48%" text-anchor="middle" fill="#9ca3af" font-family="system-ui,sans-serif" font-size="14">未接真实批改时使用</text>' +
      '</svg>',
  )

export function createMockAnalysisPaper(paperId: string) {
  return {
    id: paperId,
    name: '模拟批改结果（测试用）',
    previewUrl: MOCK_PREVIEW_SVG,
    isPdf: false,
    isAnalyzing: false,
    errorText: '',
    questions: MOCK_ANALYSIS_QUESTIONS,
  }
}
