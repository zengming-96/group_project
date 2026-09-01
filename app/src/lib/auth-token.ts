import type { LoginResponse } from '../types'

const ACCESS_TOKEN_KEY = 'ag.session.accessToken'
const REFRESH_TOKEN_KEY = 'ag.session.refreshToken'
const ACCESS_EXPIRES_AT_KEY = 'ag.session.accessExpiresAt'

export const AUTH_UNAUTHORIZED_EVENT = 'ag.auth.unauthorized'

export function loadAccessToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || ''
}

export function loadRefreshToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(REFRESH_TOKEN_KEY) || ''
}

export function loadAccessExpiresAt() {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(ACCESS_EXPIRES_AT_KEY)
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function saveAccessToken(token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

/** 登录成功：写入 access / refresh（若有）/ 过期时间（若有 expiresIn） */
export function persistAuthFromLoginResponse(result: LoginResponse) {
  if (typeof window === 'undefined') return

  const access = (result.accessToken || result.token || '').trim()
  if (!access) return

  window.localStorage.setItem(ACCESS_TOKEN_KEY, access)

  if (result.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken)
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  }

  if (result.expiresIn != null && Number.isFinite(result.expiresIn) && result.expiresIn > 0) {
    window.localStorage.setItem(ACCESS_EXPIRES_AT_KEY, String(Date.now() + result.expiresIn * 1000))
  } else {
    window.localStorage.removeItem(ACCESS_EXPIRES_AT_KEY)
  }
}

/** 刷新接口返回新的 access（及可选的新 refresh）时更新本地 */
export function applyRefreshedTokens(result: LoginResponse) {
  persistAuthFromLoginResponse(result)
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  window.localStorage.removeItem(ACCESS_EXPIRES_AT_KEY)
}

export function emitUnauthorizedEvent() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
}
