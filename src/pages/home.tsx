import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  GraduationCap,
  LibraryBig,
  Wallet,
  ArrowUpRight,
  Info,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSavedToken, getSavedUser } from "@/lib/auth";
import { KSU_CACHE_POLICY } from "@/lib/cache/policy";
import { formatYearMonth, weekText } from "@/lib/calendar";
import {
  getCalendarMonth,
  type CampusNewsPage,
  type CampusNewsSource,
  getCampusNews,
  getGrades,
  getPersonalInfo,
} from "@/lib/api/ksu";
import { toUserMessage } from "@/lib/errors/user-message";
import { getCachedGrades } from "@/lib/grades";
import { useI18n } from "@/lib/i18n";
import { getCachedPersonalInfo } from "@/lib/personal";
import { ipcInvoke } from "@/lib/ipc";
import { NEWS_OPEN_CHANNEL } from "@/lib/request/channels";
import { cn } from "@/lib/utils";

function useDashboardData() {
  const { messages } = useI18n();
  const [token] = useState(() => getSavedToken());
  const yearMonth = useMemo(() => formatYearMonth(new Date()), []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const personalQuery = useQuery({
    queryKey: ["personal-info", token],
    enabled: !!token,
    staleTime: KSU_CACHE_POLICY.personalInfo.ttlMs,
    queryFn: async () => getPersonalInfo(String(token)),
    initialData: getCachedPersonalInfo()?.data,
  });

  const gradesQuery = useQuery({
    queryKey: ["grades", token],
    enabled: !!token,
    staleTime: KSU_CACHE_POLICY.grades.ttlMs,
    queryFn: async () => getGrades(String(token)),
    initialData: getCachedGrades()?.data,
  });

  const calendarQuery = useQuery({
    queryKey: ["calendar", token, yearMonth],
    enabled: !!token,
    staleTime: KSU_CACHE_POLICY.calendar.ttlMs,
    queryFn: async () => getCalendarMonth(String(token), yearMonth),
  });

  const day = calendarQuery.data?.find((d) => d.rq === today);

  return {
    token,
    isLoading: personalQuery.isLoading || gradesQuery.isLoading,
    personal: personalQuery.data ?? null,
    gpa: gradesQuery.data?.gpa ?? null,
    week: day ? weekText(day.zc) : null,
    error: personalQuery.error ? toUserMessage(personalQuery.error, messages.home.syncError) : null,
  };
}

export function Home() {
  const navigate = useNavigate();
  const { messages } = useI18n();
  const user = getSavedUser();
  const { token, personal, gpa, week, isLoading } = useDashboardData();

  useEffect(() => {
    if (!token) navigate({ to: "/login" });
  }, [token, navigate]);

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      {/* 顶部统计卡片 */}
      <section className="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={messages.home.gpa}
          value={gpa}
          icon={<GraduationCap className="h-4 w-4" />}
          description={messages.home.gpaDesc}
          isLoading={isLoading}
        />
        <MetricCard
          title={messages.home.balance}
          value={personal?.xykye ? `¥${Number(personal.xykye).toFixed(2)}` : null}
          icon={<Wallet className="h-4 w-4" />}
          description={messages.home.balanceDesc}
          isLoading={isLoading}
        />
        <MetricCard
          title={messages.home.week}
          value={week}
          icon={<CalendarDays className="h-4 w-4" />}
          description={messages.home.weekDesc}
          isLoading={isLoading}
        />
        <MetricCard
          title={messages.home.library}
          value={personal?.tszj ?? null}
          icon={<LibraryBig className="h-4 w-4" />}
          description={messages.home.libraryDesc(personal?.tsyj || 0)}
          isLoading={isLoading}
        />
      </section>

      {/* 主内容区域 */}
      <div className="flex-1 min-h-0 grid gap-6 md:grid-cols-12 overflow-hidden">
        <div className="md:col-span-8 flex flex-col gap-6 overflow-hidden">
          <Card className="flex flex-col flex-1 overflow-hidden border-border/50 shadow-none">
            <CardHeader className="shrink-0 border-b bg-muted/20 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {messages.home.academic}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-semibold hover:bg-background"
                  onClick={() => navigate({ to: "/grades" })}
                >
                  {messages.home.gradesDetail} <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pt-4 pb-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <AcademicStatBlock
                  label={messages.home.courses}
                  value={personal?.kcs || "0"}
                  unit="门"
                  indicatorColor="bg-primary"
                />
                <AcademicStatBlock
                  label={messages.home.achievements}
                  value={personal?.kycg || "0"}
                  unit="项"
                  indicatorColor="bg-chart-2"
                />
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-2 px-1 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold tracking-wide">
                    {messages.home.termSummary}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <SimpleBox label={messages.home.creditsEarned} value="--" />
                  <SimpleBox label={messages.home.electiveCourses} value="--" />
                  <SimpleBox label={messages.home.requiredCourses} value="--" />
                </div>
              </div>

              <div className="mt-8 flex items-start gap-3 rounded-lg border border-primary/10 bg-primary/5 p-4 text-primary">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-medium">{messages.home.note}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4 flex flex-col gap-6 overflow-hidden">
          <Card className="shrink-0 border-border/50 shadow-none">
            <CardHeader className="py-3 bg-muted/10 border-b">
              <CardTitle className="text-sm font-semibold">{messages.home.profile}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-xl font-bold border">
                  {user?.user_name?.slice(0, 1)}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="font-bold text-sm truncate text-foreground">{user?.user_name}</h3>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {user?.username}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="bg-muted/30 border-border/60 px-2 py-0 text-xs font-medium"
                >
                  {user?.identity_type_name || messages.home.defaultIdentity}
                </Badge>
                <Badge
                  variant="outline"
                  className="max-w-35 truncate border-border/60 px-2 py-0 text-xs font-medium"
                >
                  {user?.organization_name || messages.home.defaultOrg}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <CampusNewsCard token={token} />
        </div>
      </div>
    </div>
  );
}

function AcademicStatBlock({ label, value, unit, indicatorColor }: any) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary/20 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <div className={cn("h-1.5 w-1.5 rounded-full", indicatorColor)} />
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <span className="text-xs font-medium text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function SimpleBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-center">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-bold text-sm text-foreground">{value}</div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number | null;
  icon: React.ReactNode;
  description: string;
  isLoading: boolean;
}

function MetricCard({ title, value, icon, description, isLoading }: MetricCardProps) {
  return (
    <Card className="group border-border/40 shadow-none transition-all hover:border-primary/30 bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground/60 group-hover:text-primary transition-colors">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {isLoading ? (
          <Skeleton className="h-6 w-20 rounded" />
        ) : (
          <div className="text-xl font-bold tracking-tight tabular-nums text-foreground">
            {value || "--"}
          </div>
        )}
        <p className="mt-1 text-xs font-medium text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function CampusNewsCard({ token }: { token: string | null }) {
  const { messages } = useI18n();
  const [source, setSource] = useState<CampusNewsSource>("latest");
  const [pageNo, setPageNo] = useState(1);
  const pageSize = 5;

  const newsQuery = useQuery<CampusNewsPage>({
    queryKey: ["campus-news", token, source, pageNo, pageSize],
    enabled: !!token,
    staleTime: KSU_CACHE_POLICY.news.ttlMs,
    queryFn: async () =>
      getCampusNews(String(token), {
        source,
        pageNo,
        pageSize,
        columnId: "remote-a",
      }),
  });

  const data = newsQuery.data;
  const items = data?.items ?? [];
  const isLoading = newsQuery.isLoading;
  const canPrev = pageNo > 1 && !newsQuery.isFetching;
  const canNext = Boolean(data?.hasMore) && !newsQuery.isFetching;

  function switchSource(next: CampusNewsSource) {
    if (next === source) return;
    setSource(next);
    setPageNo(1);
  }

  async function openNews(item: { url: string; title: string }) {
    try {
      await ipcInvoke<{ ok: boolean }>(NEWS_OPEN_CHANNEL, {
        url: item.url,
        title: item.title,
        token: token || "",
      });
    } catch {
      window.open(item.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-none bg-card/50">
      <CardHeader className="shrink-0 border-b bg-muted/10 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{messages.home.news}</CardTitle>
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/40">
            <button
              onClick={() => switchSource("latest")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-all",
                source === "latest"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {messages.home.latest}
            </button>
            <button
              onClick={() => switchSource("hot")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-all",
                source === "hot"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {messages.home.hot}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto pt-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : items.length > 0 ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-0.5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNews(item)}
                  className="group flex items-start justify-between gap-3 w-full rounded-lg px-2 py-2 transition-colors hover:bg-muted/40 text-left"
                >
                  <span className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {item.publishedAt?.slice(5, 10).replace("-", "/")}
                  </span>
                </button>
              ))}
            </div>
            <div className="shrink-0 flex items-center justify-between pt-3 pb-1 border-t border-border/20 mt-2">
              <span className="text-xs font-medium text-muted-foreground">
                {messages.home.newsPage(pageNo, data?.total || "???")}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded hover:bg-muted"
                  disabled={!canPrev}
                  onClick={() => setPageNo((prev) => Math.max(1, prev - 1))}
                >
                  <ArrowUpRight className="h-3 w-3 rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded hover:bg-muted"
                  disabled={!canNext}
                  onClick={() => setPageNo((prev) => prev + 1)}
                >
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-medium">
            {messages.common.noData}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
