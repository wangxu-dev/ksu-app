import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { getSavedToken } from '@/lib/auth'
import { getCalendarMonthCached } from '@/lib/auth/service'
import { formatYearMonth, getCachedCalendarMonth, weekText, type CalendarDay } from '@/lib/calendar'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function addMonths(date: Date, delta: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + delta)
  return d
}

function ymd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function CalendarPage() {
  const navigate = useNavigate()
  const [token] = useState(() => getSavedToken())
  const [cursor, setCursor] = useState(() => new Date())
  const [days, setDays] = useState<CalendarDay[]>([])
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) navigate({ to: '/login' })
  }, [token, navigate])

  const yearMonth = useMemo(() => formatYearMonth(cursor), [cursor])

  const load = async (force: boolean) => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await getCalendarMonthCached(token, yearMonth, {
        maxAgeMs: 30 * 24 * 60 * 60 * 1000,
        force,
      })
      setDays(res.data)
      setFetchedAt(res.fetchedAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取校历失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const cached = getCachedCalendarMonth(yearMonth)
    if (cached) {
      setDays(cached.data)
      setFetchedAt(cached.fetchedAt)
    }
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, yearMonth])

  const dayByDate = useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const d of days) m.set(d.rq, d)
    return m
  }, [days])

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const firstWeekday = (first.getDay() + 6) % 7 // Mon=0 ... Sun=6
    const cells: Array<{ date: Date; inMonth: boolean }> = []
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(first)
      d.setDate(d.getDate() - (firstWeekday - i))
      cells.push({ date: d, inMonth: false })
    }
    for (let day = 1; day <= last.getDate(); day++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), day), inMonth: true })
    }
    const trailing = (7 - (cells.length % 7)) % 7
    for (let i = 0; i < trailing; i++) {
      const d = new Date(last)
      d.setDate(d.getDate() + (i + 1))
      cells.push({ date: d, inMonth: false })
    }
    return cells
  }, [cursor])

  const today = useMemo(() => ymd(new Date()), [])

  return (
    <div className="min-h-screen bg-linear-to-b from-primary/5 via-muted/30 to-background dark:from-primary/10 dark:via-muted/20">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate({ to: '/home' })}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              返回
            </Button>
            <div className="ml-1 text-sm font-semibold">校历</div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => load(true)} disabled={isLoading}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{yearMonth}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {fetchedAt ? `上次更新：${new Date(fetchedAt).toLocaleString('zh-CN', { hour12: false })}` : ' '}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor((d) => addMonths(d, -1))} className="gap-2">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              上月
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              本月
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor((d) => addMonths(d, 1))} className="gap-2">
              下月
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-muted-foreground">获取失败：{error}</p> : null}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">月视图</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
              {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
                <div key={w} className="px-1 py-1 text-center">
                  周{w}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {grid.map((cell) => {
                const dateStr = ymd(cell.date)
                const day = dayByDate.get(dateStr)
                const isToday = dateStr === today
                const label = day?.rc ?? (day ? weekText(day.zc) : null)
                const showLabel = Boolean(day?.rc)
                return (
                  <div
                    key={dateStr}
                    className={[
                      'min-h-20 rounded-lg border bg-background p-2',
                      cell.inMonth ? '' : 'opacity-50',
                      isToday ? 'border-primary ring-1 ring-primary/30' : '',
                      showLabel ? 'bg-primary/5 dark:bg-primary/10 border-primary/20' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold tabular-nums">{cell.date.getDate()}</div>
                      {day?.zc ? (
                        <div className="text-[10px] text-muted-foreground">{weekText(day.zc)}</div>
                      ) : null}
                    </div>
                    {label ? (
                      <div className={['mt-2 text-xs', day?.rc ? 'font-medium text-foreground' : 'text-muted-foreground'].join(' ')}>
                        {label}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
