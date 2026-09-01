import { clearAccessToken } from './auth-token'
import { clearLearningStats } from './learning-stats'
import { clearSessionUser } from './user-session'

/** 与 dashboard 中 AI 引导缓存一致，退出/换账号时需清空 */
export const AI_GUIDANCE_STORAGE_KEY = 'ag.ai.guidance.v1'

/** 退出登录或换账号登录前调用：清除 token、会话、本地统计与 AI 引导缓存 */
export function clearAllClientAuthAndCaches() {
  clearAccessToken()
  clearSessionUser()
  clearLearningStats()
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AI_GUIDANCE_STORAGE_KEY)
  }
}
