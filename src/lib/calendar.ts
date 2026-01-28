export type CalendarDay = {
  xnxq: string
  ny: string
  zc: string | null
  xqj: string
  rq: string
  rc: string | null
}

export type CalendarResponse = {
  code: number
  message: string | null
  data: CalendarDay[]
}

export type CachedCalendarMonth = {
  fetchedAt: number
  yearMonth: string // e.g. "2026年01月"
  data: CalendarDay[]
}

function cacheKey(yearMonth: string) {
  return `ksu:calendar:${yearMonth}`
}

export function getCachedCalendarMonth(yearMonth: string): CachedCalendarMonth | null {
  const raw = localStorage.getItem(cacheKey(yearMonth))
  if (!raw) return null
  try {
    return JSON.parse(raw) as CachedCalendarMonth
  } catch {
    return null
  }
}

export function setCachedCalendarMonth(yearMonth: string, data: CalendarDay[]) {
  const payload: CachedCalendarMonth = { fetchedAt: Date.now(), yearMonth, data }
  localStorage.setItem(cacheKey(yearMonth), JSON.stringify(payload))
}

export function clearCachedCalendarMonth(yearMonth: string) {
  localStorage.removeItem(cacheKey(yearMonth))
}

export function formatYearMonth(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}年${m}月`
}

export function weekText(zc: string | null) {
  if (zc === null) return '假期'
  if (zc === '0') return '准备周'
  return `第${zc}周`
}

