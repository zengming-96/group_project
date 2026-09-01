import { Calendar, ChevronLeft, ChevronRight, Clock3, Loader2, LogOut, Mail, User } from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageTransition } from '../components/layout/page-transition'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { fetchLearningInsights, fetchUserMe, patchUserMe } from '../lib/api'
import { getHttpErrorMessage } from '../lib/http-error'
import { getLearningStats } from '../lib/learning-stats'
import { clearAllClientAuthAndCaches } from '../lib/session-reset'
import { loadSessionUser, saveSessionUser } from '../lib/user-session'
import type {
  DailyLearningStat,
  LearningInsightsResponse,
  LearningKnowledgePoint,
  LearningQuestionType,
  UserLearningStats,
  UserMeResponse,
  UserProfile,
} from '../types'

const questionTypes: LearningQuestionType[] = ['言语理解', '数量关系', '判断推理', '资料分析', '常识判断']

/** 与后端 questionType 1–5 对齐；展示名以接口 typeName 为准，缺省时用此表 */
const QUESTION_TYPE_CODE_LABELS: Record<number, string> = {
  1: '言语判断',
  2: '数量关系',
  3: '判断推理',
  4: '资料分析',
  5: '常识判断',
}

function yearMonthToAxisLabel(yearMonth: string) {
  const m = yearMonth.match(/^(\d{4})-(\d{2})$/)
  return m ? `${m[1]}.${m[2]}` : yearMonth
}

/** 接口题型名与学习洞察里的题型 key 对齐（洞察仍为「言语理解」） */
function insightKeyForTypeLabel(label: string): LearningQuestionType {
  if (label === '言语判断') return '言语理解'
  const hit = questionTypes.find((t) => t === label)
  return hit ?? '言语理解'
}

const emptyKnowledgeByType: Record<LearningQuestionType, LearningKnowledgePoint[]> = {
  言语理解: [],
  数量关系: [],
  判断推理: [],
  资料分析: [],
  常识判断: [],
}

const emptyLearningInsights: LearningInsightsResponse = {
  trend30d: [],
  knowledgeByType: emptyKnowledgeByType,
}

const emptyUserProfile: UserProfile = {
  name: '',
  role: '学生',
  email: '',
  school: '',
  learningTime: '',
  age: 0,
  recentPapers: 0,
  avgScore: 0,
}

function sessionBackedDefaults(): UserProfile {
  const s = loadSessionUser()
  return {
    ...emptyUserProfile,
    name: s?.name?.trim() || '',
    email: s?.email?.trim() || '',
    role: s?.role?.trim() || emptyUserProfile.role,
    school: s?.school?.trim() || '',
  }
}

function mergeUserMeIntoProfile(me: UserMeResponse, previous: UserProfile): UserProfile {
  const username = me.username.trim()
  const email = me.email.trim()
  const days = me.daysSinceCreated
  const learningTime =
    Number.isFinite(days) && days >= 0 ? `${Math.floor(days)} 天` : previous.learningTime

  return {
    ...previous,
    name: username || previous.name,
    email: email || previous.email,
    age: Number.isFinite(me.age) ? me.age : previous.age,
    learningTime,
  }
}

/** GET /users/me 并写回 session，供页面与顶栏展示同步 */
async function refreshUserProfileFromApi(): Promise<{
  profile: UserProfile
  learningStats?: UserLearningStats
}> {
  const me = await fetchUserMe()
  const base = sessionBackedDefaults()
  const merged = mergeUserMeIntoProfile(me, base)
  const prev = loadSessionUser()
  saveSessionUser({
    name: merged.name,
    email: merged.email,
    role: merged.role,
    school: merged.school,
    ...(prev?.registeredAt ? { registeredAt: prev.registeredAt } : {}),
  })
  return { profile: merged, learningStats: me.learningStats }
}

type QuestionType = LearningQuestionType
type CompareView = 'bar' | 'radar'

const baseAccuracy: Record<QuestionType, number> = {
  言语理解: 76,
  数量关系: 64,
  判断推理: 72,
  资料分析: 68,
  常识判断: 58,
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  })
}

function formatMonthAxis(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${year}.${month}`
}

function resolveRegistrationDate() {
  const sessionUser = loadSessionUser()
  if (sessionUser?.registeredAt) {
    const parsed = new Date(sessionUser.registeredAt)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return new Date()
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDailyDotClass(accuracy: number) {
  if (accuracy >= 80) return 'bg-emerald-500'
  if (accuracy >= 60) return 'bg-amber-400'
  return 'bg-red-500'
}

function getDateSeed(dateKey: string) {
  return dateKey.split('-').reduce((sum, part) => sum + Number(part || 0), 0)
}

function createDailyAccuracy(date: Date, registerDate: Date, type: QuestionType) {
  const dayOffset = Math.max(0, Math.floor((date.getTime() - registerDate.getTime()) / 86_400_000))
  const typeIndex = questionTypes.indexOf(type)
  const wave = Math.sin((dayOffset + typeIndex) * 0.22) * 5 + Math.cos((dayOffset + typeIndex) * 0.12) * 2
  return Math.round(clamp(baseAccuracy[type] + wave, 45, 95) * 10) / 10
}

type TrendRow = { date: string } & Record<QuestionType, number>

export function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile>(emptyUserProfile)
  const [draftProfile, setDraftProfile] = useState<UserProfile>(emptyUserProfile)
  const [profileLoadError, setProfileLoadError] = useState('')
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false)
  const [basicInfoError, setBasicInfoError] = useState('')
  const [basicInfoSuccess, setBasicInfoSuccess] = useState('')
  const [isSavingBasicInfo, setIsSavingBasicInfo] = useState(false)
  const [insights, setInsights] = useState<LearningInsightsResponse>(emptyLearningInsights)
  const [isInsightsLoading, setIsInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const [dailyStats, setDailyStats] = useState<DailyLearningStat[]>([])
  const [selectedDailyDate, setSelectedDailyDate] = useState('')
  const [dailyCalendarMonth, setDailyCalendarMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [learningStats, setLearningStats] = useState<UserLearningStats | undefined>(undefined)

  const [compareView, setCompareView] = useState<CompareView>('bar')
  const [registrationDate, setRegistrationDate] = useState<Date>(() => resolveRegistrationDate())
  const [selectedOverviewMonth, setSelectedOverviewMonth] = useState<Date>(() => startOfMonth(new Date()))

  const currentMonthStart = useMemo(() => startOfMonth(new Date()), [])
  const registrationMonthStart = useMemo(() => startOfMonth(registrationDate), [registrationDate])

  const overviewMonthTrend = useMemo<TrendRow[]>(() => {
    const monthStart = startOfMonth(selectedOverviewMonth)
    const rawMonthEnd = endOfMonth(selectedOverviewMonth)
    const now = new Date()
    const monthEnd = isSameMonth(selectedOverviewMonth, now) ? now : rawMonthEnd
    const effectiveStart = isSameMonth(monthStart, registrationDate) ? registrationDate : monthStart

    const points: TrendRow[] = []
    const cursor = new Date(effectiveStart)

    while (cursor <= monthEnd) {
      points.push({
        date: `${cursor.getDate()}日`,
        言语理解: createDailyAccuracy(cursor, registrationDate, '言语理解'),
        数量关系: createDailyAccuracy(cursor, registrationDate, '数量关系'),
        判断推理: createDailyAccuracy(cursor, registrationDate, '判断推理'),
        资料分析: createDailyAccuracy(cursor, registrationDate, '资料分析'),
        常识判断: createDailyAccuracy(cursor, registrationDate, '常识判断'),
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return points
  }, [registrationDate, selectedOverviewMonth])

  const monthlyAccuracyCurve = useMemo(() => {
    const trend = learningStats?.monthlyTrendLast12
    if (trend?.length) {
      return trend.map((row) => ({
        月份: yearMonthToAxisLabel(row.yearMonth),
        正确率: Math.round(row.correctRatePercent * 100) / 100,
      }))
    }

    const rows: Array<{ 月份: string; 正确率: number }> = []
    const now = new Date()
    const cursor = new Date(registrationMonthStart)

    while (cursor <= selectedOverviewMonth && cursor <= currentMonthStart) {
      const monthStart = startOfMonth(cursor)
      const rawMonthEnd = endOfMonth(cursor)
      const monthEnd = isSameMonth(cursor, now) ? now : rawMonthEnd
      const effectiveStart = isSameMonth(cursor, registrationDate) ? registrationDate : monthStart

      let dayCount = 0
      let totalAccuracy = 0
      const dayCursor = new Date(effectiveStart)

      while (dayCursor <= monthEnd) {
        const dailyAvg =
          questionTypes.reduce((sum, type) => sum + createDailyAccuracy(dayCursor, registrationDate, type), 0) /
          questionTypes.length
        totalAccuracy += dailyAvg
        dayCount += 1
        dayCursor.setDate(dayCursor.getDate() + 1)
      }

      rows.push({
        月份: formatMonthAxis(cursor),
        正确率: dayCount > 0 ? Math.round((totalAccuracy / dayCount) * 10) / 10 : 0,
      })

      cursor.setMonth(cursor.getMonth() + 1)
    }

    return rows
  }, [
    currentMonthStart,
    learningStats?.monthlyTrendLast12,
    registrationDate,
    registrationMonthStart,
    selectedOverviewMonth,
  ])

  const typeComparisonData = useMemo(() => {
    const fromApi = learningStats?.byQuestionType
    if (fromApi?.length) {
      const byCode = new Map(fromApi.map((r) => [r.questionType, r]))
      return [1, 2, 3, 4, 5].map((code) => {
        const row = byCode.get(code)
        const type = (row?.typeName?.trim() || QUESTION_TYPE_CODE_LABELS[code]) ?? `题型 ${code}`
        const 正确率 = row ? Math.round(row.correctRatePercent * 100) / 100 : 0
        const 错误率 = row ? Math.round(row.wrongRatePercent * 100) / 100 : 0
        return { type, 正确率, 错误率 }
      })
    }
    return questionTypes.map((type) => {
      const avg =
        overviewMonthTrend.reduce((sum, row) => sum + row[type], 0) /
        Math.max(1, overviewMonthTrend.length)
      const accuracy = Math.round(avg * 10) / 10
      return {
        type,
        正确率: accuracy,
        错误率: Math.round((100 - accuracy) * 10) / 10,
      }
    })
  }, [learningStats?.byQuestionType, overviewMonthTrend])

  const statsByDate = useMemo(() => {
    const map = new Map(dailyStats.map((item) => [item.date, item]))
    const cm = learningStats?.currentMonth
    const byDay = learningStats?.currentMonthByDay
    if (
      cm &&
      byDay?.length &&
      isSameMonth(dailyCalendarMonth, new Date(cm.year, cm.month - 1, 1))
    ) {
      for (const d of byDay) {
        const key =
          d.date ||
          `${cm.year}-${String(cm.month).padStart(2, '0')}-${String(d.dayOfMonth).padStart(2, '0')}`
        map.set(key, {
          date: key,
          uploadCount: d.totalQuestions > 0 ? 1 : 0,
          totalQuestions: d.totalQuestions,
          wrongQuestions: d.wrongCount,
          accuracy: Math.round(d.correctRatePercent * 100) / 100,
          errorRate: Math.round(d.wrongRatePercent * 100) / 100,
        })
      }
    }
    return map
  }, [dailyStats, learningStats?.currentMonth, learningStats?.currentMonthByDay, dailyCalendarMonth])

  const calendarMeta = useMemo(() => {
    const firstDay = new Date(dailyCalendarMonth.getFullYear(), dailyCalendarMonth.getMonth(), 1)
    const totalDays = new Date(dailyCalendarMonth.getFullYear(), dailyCalendarMonth.getMonth() + 1, 0).getDate()
    return {
      firstWeekday: firstDay.getDay(),
      totalDays,
      year: dailyCalendarMonth.getFullYear(),
      month: dailyCalendarMonth.getMonth(),
    }
  }, [dailyCalendarMonth])

  const dailyMonthLabel = useMemo(() => formatMonthLabel(dailyCalendarMonth), [dailyCalendarMonth])

  const dailyMinMonthStart = useMemo(() => {
    if (learningStats?.monthlyTrendLast12?.length) {
      const first = learningStats.monthlyTrendLast12[0]
      return new Date(first.year, first.month - 1, 1)
    }
    if (dailyStats.length === 0) return registrationMonthStart
    const [year, month] = dailyStats[0].date.split('-').map(Number)
    if (!year || !month) return registrationMonthStart
    return new Date(year, month - 1, 1)
  }, [learningStats?.monthlyTrendLast12, dailyStats, registrationMonthStart])

  const allKnowledgePoints = useMemo(() => {
    return Object.values(insights.knowledgeByType).flat() as LearningKnowledgePoint[]
  }, [insights])

  const selectedDailyStat = selectedDailyDate ? statsByDate.get(selectedDailyDate) ?? null : null

  const selectedDateAvgTime = useMemo(() => {
    if (!selectedDailyDate || allKnowledgePoints.length === 0) return null
    const baseAvg =
      allKnowledgePoints.reduce((sum, item) => sum + item.avgTime, 0) / allKnowledgePoints.length
    const seedOffset = (getDateSeed(selectedDailyDate) % 15) - 7
    return Math.max(45, Math.round(baseAvg + seedOffset))
  }, [allKnowledgePoints, selectedDailyDate])

  const selectedDateReasonItems = useMemo(() => {
    if (!selectedDailyDate || allKnowledgePoints.length === 0) return []
    const seed = getDateSeed(selectedDailyDate)
    return [0, 1, 2].map((offset) => {
      const point = allKnowledgePoints[(seed + offset) % allKnowledgePoints.length]
      return {
        reason: point.reason,
        avgTime: point.avgTime,
      }
    })
  }, [allKnowledgePoints, selectedDailyDate])

  const aiSuggestions = useMemo(() => {
    const weakestTypes = [...typeComparisonData]
      .sort((a, b) => a.正确率 - b.正确率)
      .slice(0, 3)
    const worst = weakestTypes[0]

    const focusType = worst?.type || '言语理解'
    const insightKey = insightKeyForTypeLabel(focusType)
    const focusKnowledge = insights.knowledgeByType[insightKey] ?? []
    const selectedWeakPoint = [...focusKnowledge]
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 2)

    const weakPointLine =
      selectedWeakPoint.length > 0
        ? `针对 ${focusType}，重点复习 ${selectedWeakPoint.map((item) => item.name).join('、')}，先做限时训练再做错因复盘。`
        : `针对 ${focusType}，建议结合错题本与专项套卷巩固相关能力。`

    return [
      `优先提升薄弱题型：${weakestTypes.map((item) => item.type).join('、')}，建议每个题型至少完成 20 道专项练习。`,
      worst
        ? `当前最弱题型为 ${worst.type}（正确率 ${worst.正确率}%），建议在未来 7 天内将该题型训练占比提升到 40%。`
        : '建议继续保持每日稳定练习。',
      weakPointLine,
    ]
  }, [insights, typeComparisonData])

  const validateBasicInfo = (data: UserProfile) => {
    if (!data.name.trim()) return '姓名不能为空。'
    if (!/\S+@\S+\.\S+/.test(data.email)) return '请输入有效的邮箱地址。'
    if (!Number.isFinite(data.age) || data.age <= 0) return '请输入有效年龄。'
    return ''
  }

  useEffect(() => {
    const load = async () => {
      setRegistrationDate(resolveRegistrationDate())

      const nextStats = getLearningStats()
      setDailyStats(nextStats)

      if (nextStats.length > 0) {
        const latest = nextStats[nextStats.length - 1]
        setSelectedDailyDate(latest.date)
        const [year, month] = latest.date.split('-').map(Number)
        if (year && month) {
          setDailyCalendarMonth(new Date(year, month - 1, 1))
        }
      }

      setProfileLoadError('')
      try {
        const { profile: mergedProfile, learningStats: ls } = await refreshUserProfileFromApi()
        setProfile(mergedProfile)
        setDraftProfile(mergedProfile)
        setLearningStats(ls)
        const cm = ls?.currentMonth
        if (cm && ls?.currentMonthByDay?.length) {
          setDailyCalendarMonth(new Date(cm.year, cm.month - 1, 1))
          const withQs = ls.currentMonthByDay.filter((d) => d.totalQuestions > 0)
          if (withQs.length) {
            const last = [...withQs].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!
            setSelectedDailyDate(last.date)
          } else {
            const now = new Date()
            if (now.getFullYear() === cm.year && now.getMonth() === cm.month - 1) {
              setSelectedDailyDate(toDateKey(now))
            } else {
              setSelectedDailyDate(ls.currentMonthByDay[0].date)
            }
          }
        }
      } catch (err) {
        setProfileLoadError(getHttpErrorMessage(err, '个人资料加载失败。'))
        const fallback = sessionBackedDefaults()
        setProfile(fallback)
        setDraftProfile(fallback)
      }
    }

    void load()
  }, [])

  useEffect(() => {
    let active = true

    const loadInsights = async () => {
      setIsInsightsLoading(true)
      setInsightsError('')

      try {
        const nextInsights = await fetchLearningInsights('30d')
        if (!active) return
        setInsights(nextInsights)
      } catch (err) {
        if (!active) return
        setInsights(emptyLearningInsights)
        setInsightsError(getHttpErrorMessage(err, '学习报告加载失败。'))
      } finally {
        if (active) {
          setIsInsightsLoading(false)
        }
      }
    }

    void loadInsights()

    return () => {
      active = false
    }
  }, [])

  return (
    <PageTransition>
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {profile.name.trim() || '个人中心'}
            </h1>
            <p className="mt-2 text-gray-600">管理个人信息并查看学习统计。</p>
            {profileLoadError && (
              <p className="mt-3 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {profileLoadError}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              clearAllClientAuthAndCaches()
              navigate('/login')
            }}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-gray-300">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">基础信息</CardTitle>
                {!isEditingBasicInfo ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraftProfile(profile)
                      setBasicInfoError('')
                      setIsEditingBasicInfo(true)
                    }}
                  >
                    编辑信息
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraftProfile(profile)
                        setBasicInfoError('')
                        setIsEditingBasicInfo(false)
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      disabled={isSavingBasicInfo}
                      onClick={() => {
                        const validationError = validateBasicInfo(draftProfile)
                        if (validationError) {
                          setBasicInfoError(validationError)
                          setBasicInfoSuccess('')
                          return
                        }

                        const runSave = async () => {
                          setIsSavingBasicInfo(true)
                          setBasicInfoError('')
                          setBasicInfoSuccess('')
                          try {
                            await patchUserMe({
                              name: draftProfile.name.trim(),
                              email: draftProfile.email.trim(),
                              age: draftProfile.age,
                            })
                            const { profile: merged, learningStats: ls } = await refreshUserProfileFromApi()
                            setProfile(merged)
                            setDraftProfile(merged)
                            setLearningStats(ls)
                            setBasicInfoSuccess('基础信息已更新。')
                            setIsEditingBasicInfo(false)
                          } catch (err) {
                            setBasicInfoError(getHttpErrorMessage(err, '保存失败，请稍后重试。'))
                          } finally {
                            setIsSavingBasicInfo(false)
                          }
                        }

                        void runSave()
                      }}
                    >
                      {isSavingBasicInfo ? (
                        <>
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          保存中
                        </>
                      ) : (
                        '保存'
                      )}
                    </Button>
                  </div>
                )}
              </div>
              <CardDescription>账号核心资料</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {basicInfoSuccess && !isEditingBasicInfo && (
                <p className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {basicInfoSuccess}
                </p>
              )}

              {!isEditingBasicInfo ? (
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <InfoRow icon={User} label="姓名" value={profile.name} />
                  <InfoRow icon={Mail} label="邮箱" value={profile.email} />
                  <InfoRow icon={Clock3} label="学习时间" value={profile.learningTime} />
                  <InfoRow icon={Calendar} label="年龄" value={`${profile.age}`} />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">姓名</span>
                    <Input
                      value={draftProfile.name}
                      onChange={(event) => {
                        setDraftProfile((prev) => ({ ...prev, name: event.target.value }))
                        setBasicInfoError('')
                        setBasicInfoSuccess('')
                      }}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">邮箱</span>
                    <Input
                      type="email"
                      value={draftProfile.email}
                      onChange={(event) => {
                        setDraftProfile((prev) => ({ ...prev, email: event.target.value }))
                        setBasicInfoError('')
                        setBasicInfoSuccess('')
                      }}
                    />
                  </label>
                  <div className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">学习时间</span>
                    <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800">
                      {draftProfile.learningTime.trim() || '—'}
                    </p>
                    <p className="text-xs text-gray-500">学习时间由系统统计，不可手动修改。</p>
                  </div>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">年龄</span>
                    <Input
                      type="number"
                      min={1}
                      value={draftProfile.age}
                      onChange={(event) => {
                        const nextAge = Number(event.target.value)
                        setDraftProfile((prev) => ({ ...prev, age: Number.isNaN(nextAge) ? 0 : nextAge }))
                        setBasicInfoError('')
                        setBasicInfoSuccess('')
                      }}
                    />
                  </label>

                  {basicInfoError && (
                    <p className="md:col-span-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {basicInfoError}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-300">
            <CardHeader className="space-y-3">
              <CardTitle className="text-xl">学习报告</CardTitle>
              <CardDescription>按月与按日查看正确率表现，并获取AI学习建议</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {insightsError && (
                <p className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {insightsError}
                </p>
              )}

              {isInsightsLoading && (
                <p className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  正在更新学习报告数据...
                </p>
              )}

              <section className="space-y-4 rounded-md border bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">总体概览</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0"
                      onClick={() => {
                        setSelectedOverviewMonth((previous) => {
                          const next = new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                          return next < registrationMonthStart ? previous : next
                        })
                      }}
                      disabled={selectedOverviewMonth <= registrationMonthStart}
                      aria-label="切换到上个月"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-gray-700">{formatMonthLabel(selectedOverviewMonth)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0"
                      onClick={() => {
                        setSelectedOverviewMonth((previous) => {
                          const next = new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                          return next > currentMonthStart ? previous : next
                        })
                      }}
                      disabled={selectedOverviewMonth >= currentMonthStart}
                      aria-label="切换到下个月"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={compareView === 'bar' ? 'default' : 'outline'} onClick={() => setCompareView('bar')}>横向条形图</Button>
                    <Button size="sm" variant={compareView === 'radar' ? 'default' : 'outline'} onClick={() => setCompareView('radar')}>雷达图</Button>
                  </div>
                </div>

                <p className="text-xs text-gray-600">
                  统计周期：按月汇总（注册起始日：{registrationDate.toLocaleDateString('zh-CN')}）。
                </p>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-md border bg-white p-3 lg:col-span-2 lg:h-[360px]">
                    <p className="mb-2 text-sm font-medium">月度正确率曲线</p>
                    <div className="h-[300px] w-full lg:h-[312px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={monthlyAccuracyCurve}
                          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="月份" stroke="#6b7280" />
                          <YAxis
                            stroke="#6b7280"
                            domain={learningStats?.monthlyTrendLast12?.length ? [0, 100] : [40, 100]}
                            unit="%"
                          />
                          <Tooltip />
                          <Line type="monotone" dataKey="正确率" stroke="#111827" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-md border bg-white p-3 lg:h-[360px]">
                    <p className="mb-2 text-sm font-medium">各题型正确率</p>
                    <div className="space-y-2 overflow-y-auto lg:max-h-[312px]">
                      {typeComparisonData.map((item) => (
                        <div key={item.type} className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                          <p className="font-semibold">{item.type}</p>
                          <p className="text-gray-600">正确率 {item.正确率}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-white p-3">
                  <p className="mb-2 text-sm font-medium">题型强弱对比</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      {compareView === 'bar' ? (
                        <BarChart data={typeComparisonData} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis type="number" domain={[0, 100]} stroke="#6b7280" unit="%" />
                          <YAxis dataKey="type" type="category" width={80} stroke="#6b7280" />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="正确率" fill="#10b981" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="错误率" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      ) : (
                        <RadarChart data={typeComparisonData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="type" />
                          <PolarRadiusAxis domain={[0, 100]} />
                          <Radar name="正确率" dataKey="正确率" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
                          <Tooltip />
                          <Legend />
                        </RadarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-md border bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">每日总结</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0"
                      onClick={() => {
                        setDailyCalendarMonth((previous) => {
                          const next = new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                          return next < dailyMinMonthStart ? previous : next
                        })
                      }}
                      disabled={dailyCalendarMonth <= dailyMinMonthStart}
                      aria-label="切换到上个月"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-gray-700">{dailyMonthLabel}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0"
                      onClick={() => {
                        setDailyCalendarMonth((previous) => {
                          const next = new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                          return next > currentMonthStart ? previous : next
                        })
                      }}
                      disabled={dailyCalendarMonth >= currentMonthStart}
                      aria-label="切换到下个月"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border bg-white p-3">
                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
                    {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
                      <div key={label} className="py-1">{label}</div>
                    ))}
                  </div>

                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {Array.from({ length: calendarMeta.firstWeekday }).map((_, index) => (
                      <div key={`empty-${index}`} className="h-16 rounded-md border border-transparent" />
                    ))}

                    {Array.from({ length: calendarMeta.totalDays }).map((_, index) => {
                      const day = index + 1
                      const date = new Date(calendarMeta.year, calendarMeta.month, day)
                      const dateKey = toDateKey(date)
                      const stat = statsByDate.get(dateKey)
                      const isSelected = selectedDailyDate === dateKey

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => setSelectedDailyDate(dateKey)}
                          className={`h-16 rounded-md border p-1 text-left text-xs transition ${
                            isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="block font-medium text-gray-700">{day}</span>
                          {stat && stat.totalQuestions > 0 && (
                            <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${getDailyDotClass(stat.accuracy)}`} />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />正确率 &gt;= 80%</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />正确率 60%-79%</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />正确率 &lt; 60%</span>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border bg-white p-3">
                  <p className="text-sm font-semibold">
                    {selectedDailyDate ? `日期：${selectedDailyDate}` : '请选择日历日期'}
                  </p>

                  {selectedDailyStat ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <div className="rounded-md border bg-gray-50 p-3 text-sm">
                          <p className="text-gray-600">当天做题量</p>
                          <p className="mt-1 text-lg font-semibold">{selectedDailyStat.totalQuestions}</p>
                        </div>
                        <div className="rounded-md border bg-gray-50 p-3 text-sm">
                          <p className="text-gray-600">正确率</p>
                          <p className="mt-1 text-lg font-semibold">{selectedDailyStat.accuracy}%</p>
                        </div>
                        <div className="rounded-md border bg-gray-50 p-3 text-sm">
                          <p className="text-gray-600">错题率</p>
                          <p className="mt-1 text-lg font-semibold">{selectedDailyStat.errorRate}%</p>
                        </div>
                        <div className="rounded-md border bg-gray-50 p-3 text-sm">
                          <p className="text-gray-600">平均用时</p>
                          <p className="mt-1 text-lg font-semibold">{selectedDateAvgTime ?? '--'}s</p>
                        </div>
                        <div className="rounded-md border bg-gray-50 p-3 text-sm">
                          <p className="text-gray-600">当天上传试卷数</p>
                          <p className="mt-1 text-lg font-semibold">{selectedDailyStat.uploadCount}</p>
                        </div>
                      </div>

                      <div className="rounded-md border bg-gray-50 p-3">
                        <p className="mb-2 text-sm font-medium">错误原因与用时观察</p>
                        <div className="space-y-2">
                          {selectedDateReasonItems.length > 0 ? (
                            selectedDateReasonItems.map((item, index) => (
                              <div key={`${item.reason}-${index}`} className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm">
                                <span className="text-gray-700">{item.reason}</span>
                                <span className="text-gray-600">参考用时：{item.avgTime}s</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">当天暂无错误原因样本。</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">该日期暂无上传试卷记录。</p>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-md border bg-gray-50 p-4">
                <h3 className="text-lg font-semibold">AI 学习建议</h3>
                <div className="space-y-2">
                  {aiSuggestions.map((text, index) => (
                    <div key={text} className="rounded-md border bg-white px-3 py-2 text-sm text-gray-700">
                      <span className="font-semibold">建议 {index + 1}：</span>{text}
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </section>
    </PageTransition>
  )
}

interface InfoRowProps {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-gray-700">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
