import { invoke } from '@tauri-apps/api/core'
import {
  clearAuth,
  clearRememberedAccount,
  saveAuth,
  saveRememberedAccount,
  type UserInfoData,
} from '@/lib/auth'
import { getCalendarMonth, getGrades, getPersonalInfo, getUserInfo } from '@/lib/api/ksu'
import { getCachedGrades, setCachedGrades, type CachedGrades, type GradesData } from '@/lib/grades'
import {
  formatYearMonth,
  getCachedCalendarMonth,
  setCachedCalendarMonth,
  type CalendarDay,
} from '@/lib/calendar'

type LoginResponse = {
  success: boolean
  token?: string
  message: string
}

export async function loginWithBackend(opts: {
  username: string
  password: string
  rememberAccount: boolean
}): Promise<{ token: string; user: UserInfoData }> {
  const result = await invoke<LoginResponse>('login', {
    username: opts.username,
    password: opts.password,
    remember: false,
  })

  if (!result.success || !result.token) {
    throw new Error(result.message || '登录失败')
  }

  const user = await getUserInfo(result.token)
  saveAuth(result.token, user)

  if (opts.rememberAccount) saveRememberedAccount(opts.username)
  else clearRememberedAccount()

  return { token: result.token, user }
}

export async function validateToken(token: string): Promise<UserInfoData> {
  const user = await getUserInfo(token)
  saveAuth(token, user)
  return user
}

export async function fetchDashboard(token: string) {
  return getPersonalInfo(token)
}

export async function getGradesCached(
  token: string,
  opts?: { maxAgeMs?: number; force?: boolean }
): Promise<{ data: GradesData; cached: boolean; fetchedAt: number }> {
  const maxAgeMs = opts?.maxAgeMs ?? 24 * 60 * 60 * 1000
  const cached: CachedGrades | null = getCachedGrades()
  const isFresh = cached ? Date.now() - cached.fetchedAt <= maxAgeMs : false

  if (cached && isFresh && !opts?.force) {
    return { data: cached.data, cached: true, fetchedAt: cached.fetchedAt }
  }

  const data = await getGrades(token)
  setCachedGrades(data)
  return { data, cached: false, fetchedAt: Date.now() }
}

export async function getCalendarMonthCached(
  token: string,
  yearMonth: string,
  opts?: { maxAgeMs?: number; force?: boolean }
): Promise<{ data: CalendarDay[]; cached: boolean; fetchedAt: number }> {
  const maxAgeMs = opts?.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000
  const cached = getCachedCalendarMonth(yearMonth)
  const isFresh = cached ? Date.now() - cached.fetchedAt <= maxAgeMs : false

  if (cached && isFresh && !opts?.force) {
    return { data: cached.data, cached: true, fetchedAt: cached.fetchedAt }
  }

  const data = await getCalendarMonth(token, yearMonth)
  setCachedCalendarMonth(yearMonth, data)
  return { data, cached: false, fetchedAt: Date.now() }
}

export function currentYearMonth() {
  return formatYearMonth(new Date())
}

export function logout() {
  clearAuth()
}
