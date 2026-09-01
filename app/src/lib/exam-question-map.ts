import type { ExamDetailQuestion, QuestionAnalysis } from '../types'

/**
 * @param orderIndex 仅用于展示「第 n 题」：当接口未给 questionNo 时回退为在试卷中的序号（1-based）
 */
export function mapExamDetailQuestionToAnalysis(
  q: ExamDetailQuestion,
  orderIndex?: number,
): QuestionAnalysis {
  const hasBackendNo = q.questionNo > 0
  const displayNumber = hasBackendNo ? q.questionNo : (orderIndex != null && orderIndex > 0 ? orderIndex : 1)

  return {
    id: String(q.questionDetailId),
    questionNumber: displayNumber,
    examQuestionNo: hasBackendNo ? q.questionNo : undefined,
    status: q.correct ? 'correct' : 'wrong',
    explanation: q.analysis,
    stem: q.question,
    userAnswer: q.userAnswer,
    correctAnswer: q.correctAnswer,
    knowledgePoint: Number.isFinite(q.questionType) ? `题型 ${q.questionType}` : undefined,
  }
}
