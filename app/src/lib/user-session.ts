import type { RegisterPayload } from '../types'

const SESSION_USER_KEY = 'ag.session.user'
const REGISTERED_USERS_KEY = 'ag.registered.users'

interface RegisteredUser {
  fullName: string
  email: string
  password?: string
  role: 'teacher' | 'student'
  school?: string
  registeredAt?: string
}

export interface SessionUser {
  name: string
  email: string
  role: string
  school: string
  registeredAt?: string
}

const DEFAULT_SCHOOL = 'School Not Set'

function toRoleLabel(role: 'teacher' | 'student') {
  return role === 'teacher' ? 'Teacher' : 'Student'
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function deriveNameFromEmail(email: string) {
  const local = email.split('@')[0] ?? ''
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRegisteredUsers() {
  return readJson<RegisteredUser[]>(REGISTERED_USERS_KEY, [])
}

export function loadSessionUser() {
  return readJson<SessionUser | null>(SESSION_USER_KEY, null)
}

function emitSessionUserChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('ag-session-user-changed'))
}

export function saveSessionUser(user: SessionUser) {
  writeJson(SESSION_USER_KEY, user)
  emitSessionUserChanged()
}

export function clearSessionUser() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_USER_KEY)
  emitSessionUserChanged()
}

export function upsertRegisteredUser(payload: RegisterPayload, school = DEFAULT_SCHOOL) {
  const users = getRegisteredUsers()
  const normalizedEmail = payload.email.trim().toLowerCase()
  const existingIndex = users.findIndex((item) => item.email.trim().toLowerCase() === normalizedEmail)
  const existingUser = existingIndex >= 0 ? users[existingIndex] : null

  const nextUser: RegisteredUser = {
    fullName: payload.fullName.trim(),
    email: payload.email.trim(),
    password: payload.password,
    role: payload.role,
    school,
    registeredAt: existingUser?.registeredAt || new Date().toISOString(),
  }

  if (existingIndex >= 0) {
    users[existingIndex] = nextUser
  } else {
    users.push(nextUser)
  }

  writeJson(REGISTERED_USERS_KEY, users)

  return {
    name: nextUser.fullName,
    email: nextUser.email,
    role: toRoleLabel(nextUser.role),
    school: nextUser.school || DEFAULT_SCHOOL,
    registeredAt: nextUser.registeredAt,
  }
}

export function ensureSessionUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const registeredUser = getRegisteredUsers().find(
    (item) => item.email.trim().toLowerCase() === normalizedEmail,
  )

  const sessionUser: SessionUser = registeredUser
    ? {
        name: registeredUser.fullName,
        email: registeredUser.email,
        role: toRoleLabel(registeredUser.role),
        school: registeredUser.school || DEFAULT_SCHOOL,
        registeredAt: registeredUser.registeredAt || new Date().toISOString(),
      }
    : {
        name: deriveNameFromEmail(email) || 'User',
        email: email.trim(),
        role: 'Teacher',
        school: DEFAULT_SCHOOL,
        registeredAt: new Date().toISOString(),
      }

  saveSessionUser(sessionUser)

  return sessionUser
}

export function verifyLocalCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = getRegisteredUsers().find((item) => item.email.trim().toLowerCase() === normalizedEmail)

  if (!user) return false
  if (!user.password) return false
  return user.password === password
}
