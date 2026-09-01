import type { LoginResponse } from '../types'

function pickStr(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key]
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function pickNum(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
  return undefined
}

/**
 * 将后端多种 JSON 形态统一为 LoginResponse，便于写入 localStorage。
 * 当前后端登录成功示例：{ "token": "<JWT>", "expiresIn": 7200 }
 */
export function normalizeLoginResponse(raw: unknown): LoginResponse {
  if (!raw || typeof raw !== 'object') return {}

  let o = raw as Record<string, unknown>

  if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
    o = o.data as Record<string, unknown>
  } else if (o.result && typeof o.result === 'object' && !Array.isArray(o.result)) {
    o = o.result as Record<string, unknown>
  }

  // 与后端约定：优先 JWT 字段名 token，其次 accessToken / access_token
  const bearer =
    pickStr(o, 'token') ||
    pickStr(o, 'accessToken') ||
    pickStr(o, 'access_token')

  const refreshToken = pickStr(o, 'refreshToken') || pickStr(o, 'refresh_token')
  const tokenType = pickStr(o, 'tokenType') || pickStr(o, 'token_type')
  const expiresIn = pickNum(o, 'expiresIn') ?? pickNum(o, 'expires_in')

  return {
    accessToken: bearer,
    token: bearer,
    refreshToken,
    tokenType,
    expiresIn,
  }
}
