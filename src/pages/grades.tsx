import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw, GraduationCap, Calculator, Award, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSavedToken } from "@/lib/auth";
import { KSU_CACHE_POLICY } from "@/lib/cache/policy";
import { useI18n } from "@/lib/i18n";
import { getGrades } from "@/lib/api/ksu";
import { toUserMessage } from "@/lib/errors/user-message";
import { getCachedGrades } from "@/lib/grades";
import { cn } from "@/lib/utils";

function formatDateTime(ts: number, locale: string) {
  return new Date(ts).toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function GradesPage() {
  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      <GradesContent />
    </div>
  );
}

function GradesContent() {
  const navigate = useNavigate();
  const [token] = useState(() => getSavedToken());
  const { locale, messages } = useI18n();

  useEffect(() => {
    if (!token) {
      navigate({ to: "/login" });
    }
  }, [token, navigate]);

  const gradesQuery = useQuery({
    queryKey: ["grades", token],
    enabled: !!token,
    staleTime: KSU_CACHE_POLICY.grades.ttlMs,
    queryFn: async () => getGrades(String(token)),
    initialData: getCachedGrades()?.data,
  });

  const data = gradesQuery.data ?? null;
  const fetchedAt = gradesQuery.dataUpdatedAt || null;
  const isLoading = gradesQuery.isFetching;
  const error = gradesQuery.error
    ? toUserMessage(gradesQuery.error, messages.grades.fetchFailed)
    : null;

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      gpa: data.gpa,
      ga: data.ga,
      totalCredit: data.totalCredit,
      totalScore: data.totalScore,
    };
  }, [data]);

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      {/* 顶部固定区域 */}
      <div className="shrink-0 space-y-6">
        <div id="summary" className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{messages.grades.title}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {messages.grades.sync}
              </span>
              {fetchedAt && (
                <Badge variant="outline" className="h-5 border-border/60 px-2 font-mono text-xs">
                  {messages.grades.syncTime(formatDateTime(fetchedAt, locale))}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 rounded-lg border-border/60 text-xs font-medium shadow-none hover:border-primary/40"
            onClick={() => gradesQuery.refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            {isLoading ? messages.grades.syncing : messages.grades.refresh}
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive">
            {messages.grades.syncError}：{error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={messages.grades.gpa}
            value={summary?.gpa}
            icon={GraduationCap}
            color="text-primary"
          />
          <StatCard
            title={messages.grades.ga}
            value={summary?.ga}
            icon={Calculator}
            color="text-chart-2"
          />
          <StatCard
            title={messages.grades.totalCredit}
            value={summary?.totalCredit?.toFixed(1)}
            icon={Award}
            color="text-chart-3"
          />
          <StatCard
            title={messages.grades.totalScore}
            value={summary?.totalScore?.toFixed(0)}
            icon={Star}
            color="text-chart-4"
          />
        </div>
      </div>

      {/* 滚动列表区域 */}
      <div className="flex-1 min-h-0 overflow-auto pr-1">
        <div id="semesters" className="space-y-8 pb-4">
          {data?.semesterGradeList?.map((sem) => (
            <div key={sem.semester} className="space-y-3">
              <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 py-1 backdrop-blur-sm">
                <h3 className="text-xs font-bold text-primary">{sem.semester}</h3>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              <div className="grid gap-2">
                {sem.gradeList.map((g) => (
                  <div
                    key={g.id}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card p-3 shadow-xs transition-all hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-xs group-hover:text-primary transition-colors text-foreground">
                        {g.courseName}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {messages.grades.credit}：{g.credit.toFixed(1)}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {messages.grades.gp}：{g.gp.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold tabular-nums tracking-tighter text-foreground">
                        {g.scoreText}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="overflow-hidden border-border/40 bg-muted/5 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 px-4 pt-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-3.5 w-3.5 opacity-60", color)} />
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="text-xl font-bold tracking-tighter tabular-nums text-foreground">
          {value ?? "--"}
        </div>
      </CardContent>
    </Card>
  );
}
