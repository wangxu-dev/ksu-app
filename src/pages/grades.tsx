import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSavedToken } from '@/lib/auth'
import { getGradesCached } from '@/lib/auth/service'
import type { GradesData } from '@/lib/grades'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

export function GradesPage() {
  const navigate = useNavigate()
  const [token] = useState(() => getSavedToken())
  const [data, setData] = useState<GradesData | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      navigate({ to: '/login' })
    }
  }, [token, navigate])

  const load = async (force: boolean) => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await getGradesCached(token, { maxAgeMs: 7 * 24 * 60 * 60 * 1000, force })
      setData(res.data)
      setFetchedAt(res.fetchedAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取成绩失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const summary = useMemo(() => {
    if (!data) return null
    return {
      gpa: data.gpa,
      ga: data.ga,
      totalCredit: data.totalCredit,
      totalScore: data.totalScore,
    }
  }, [data])

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-muted/30 to-background dark:from-primary/10 dark:via-muted/20">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate({ to: '/home' })}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              返回
            </Button>
            <div className="ml-1 text-sm font-semibold">成绩</div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => load(true)}
              disabled={isLoading}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">成绩概览</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {fetchedAt ? `上次更新：${formatDateTime(fetchedAt)}` : ' '}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-muted-foreground">获取失败：{error}</p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">GPA</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {summary ? summary.gpa : '--'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">加权平均</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {summary ? summary.ga : '--'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">总学分</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {summary ? summary.totalCredit.toFixed(1) : '--'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">总分</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {summary ? summary.totalScore.toFixed(0) : '--'}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 space-y-4">
          {data?.semesterGradeList?.map((sem) => (
            <Card key={sem.semester}>
              <CardHeader>
                <CardTitle className="text-base">{sem.semester}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sem.gradeList.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-4 rounded-lg border bg-background px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{g.courseName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        学分 {g.credit.toFixed(1)} · 绩点 {g.gp.toFixed(1)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold tabular-nums">{g.scoreText}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
