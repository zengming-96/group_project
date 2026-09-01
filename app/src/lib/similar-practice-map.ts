import type { PracticeQuestion, SimilarPracticeItem } from '../types'

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

export function mapSimilarItemToPracticeQuestion(item: SimilarPracticeItem): PracticeQuestion {
  const options = [item.optionA, item.optionB, item.optionC, item.optionD]
  const raw = item.correctAnswer?.trim() ?? ''
  const letter = raw.charAt(0).toUpperCase()
  let correctOptionIndex = OPTION_LETTERS.indexOf(letter as (typeof OPTION_LETTERS)[number])
  if (correctOptionIndex < 0) {
    const byText = options.findIndex((o) => o.trim() === raw)
    correctOptionIndex = byText >= 0 ? byText : 0
  }

  return {
    id: `similar-${item.index}`,
    title: `相似巩固 · 第 ${item.index} 题`,
    prompt: item.question,
    options,
    correctOptionIndex,
    explanation: `参考答案：${item.correctAnswer}。请结合解析回顾原题思路。`,
  }
}
