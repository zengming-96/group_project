import type { DailyLearningStat, QuestionAnalysis } from '../types'

const LEARNING_STATS_KEY = 'ag.learning.stats.v1'

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readStats() {
  if (typeof window === 'undefined') return [] as DailyLearningStat[]

  try {
    const raw = window.localStorage.getItem(LEARNING_STATS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as DailyLearningStat[]
  } catch {
    return []
  }
}

function writeStats(stats: DailyLearningStat[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LEARNING_STATS_KEY, JSON.stringify(stats))
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

export function getLearningStats() {
  return readStats().sort((a, b) => a.date.localeCompare(b.date))
}

export function clearLearningStats() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LEARNING_STATS_KEY)
}

export function recordPaperResult(questions: QuestionAnalysis[], at = new Date()) {
  const totalQuestions = questions.length
  if (totalQuestions === 0) return

  const wrongQuestions = questions.filter((item) => item.status === 'wrong').length
  const date = toDateKey(at)

  const stats = readStats()
  const index = stats.findIndex((item) => item.date === date)

  if (index < 0) {
    const errorRate = round((wrongQuestions / totalQuestions) * 100)
    const accuracy = round(100 - errorRate)
    stats.push({
      date,
      uploadCount: 1,
      totalQuestions,
      wrongQuestions,
      accuracy,
      errorRate,
    })
  } else {
    const current = stats[index]
    const nextTotal = current.totalQuestions + totalQuestions
    const nextWrong = current.wrongQuestions + wrongQuestions
    const nextErrorRate = round((nextWrong / nextTotal) * 100)
    stats[index] = {
      ...current,
      uploadCount: current.uploadCount + 1,
      totalQuestions: nextTotal,
      wrongQuestions: nextWrong,
      errorRate: nextErrorRate,
      accuracy: round(100 - nextErrorRate),
    }
  }

  writeStats(stats)
}
