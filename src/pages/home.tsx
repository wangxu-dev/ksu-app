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
import { getCachedPersonalInfo } from "@/lib/personal";
import { ipcInvoke } from "@/lib/ipc";
import { NEWS_OPEN_CHANNEL } from "@/lib/request/channels";
import { cn } from "@/lib/utils";

function useDashboardData() {
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
    error: personalQuery.error ? toUserMessage(personalQuery.error, "数据同步异常") : null,
  };
}

export function Home() {
  const navigate = useNavigate();
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
          title="平均绩点"
          value={gpa}
          icon={<GraduationCap className="h-4 w-4" />}
          description="教务系统上一学期存档"
          isLoading={isLoading}
        />
        <MetricCard
          title="卡片余额"
          value={personal?.xykye ? `¥${Number(personal.xykye).toFixed(2)}` : null}
          icon={<Wallet className="h-4 w-4" />}
          description="一卡通实时账户余额"
          isLoading={isLoading}
        />
        <MetricCard
          title="教学周次"
          value={week}
          icon={<CalendarDays className="h-4 w-4" />}
          description="当前校历运行进度"
          isLoading={isLoading}
        />
        <MetricCard
          title="图书借阅"
          value={personal?.tszj ?? null}
          icon={<LibraryBig className="h-4 w-4" />}
          description={`累计借阅 ${personal?.tsyj || 0} 本`}
          isLoading={isLoading}
        />
      </section>

      {/* 主内容区域 */}
      <div className="flex-1 min-h-0 grid gap-6 md:grid-cols-12 overflow-hidden">
        <div className="md:col-span-8 flex flex-col gap-6 overflow-hidden">
          <Card className="flex flex-col flex-1 overflow-hidden border-border/50 shadow-none">
            <CardHeader className="shrink-0 border-b bg-muted/20 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground/80">学业数据动态</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-semibold hover:bg-background"
                  onClick={() => navigate({ to: "/grades" })}
                >
                  成绩单详情 <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pt-4 pb-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <AcademicStatBlock
                  label="累计修读课程"
                  value={personal?.kcs || "0"}
                  unit="门"
                  indicatorColor="bg-primary"
                />
                <AcademicStatBlock
                  label="登记科研成果"
                  value={personal?.kycg || "0"}
                  unit="项"
                  indicatorColor="bg-chart-2"
                />
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-2 px-1 text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold tracking-wider">学期关键摘要</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <SimpleBox label="应得学分" value="--" />
                  <SimpleBox label="选修课程" value="--" />
                  <SimpleBox label="必修课程" value="--" />
                </div>
              </div>

              <div className="mt-8 flex items-start gap-3 rounded-lg border border-primary/10 bg-primary/5 p-4 text-primary">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-medium">
                  数据均同步自校务系统存档，仅供参考。如有异议，请以学校教务处发布的官方纸质报表为准。
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4 flex flex-col gap-6 overflow-hidden">
          <Card className="shrink-0 border-border/50 shadow-none">
            <CardHeader className="py-3 bg-muted/10 border-b">
              <CardTitle className="text-sm font-bold">学生档案</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-xl font-bold border">
                  {user?.user_name?.slice(0, 1)}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="font-bold text-sm truncate text-foreground">{user?.user_name}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    {user?.username}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-2 font-semibold bg-muted/30 border-border/60"
                >
                  {user?.identity_type_name || "普通学生"}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-2 font-semibold truncate max-w-35 border-border/60"
                >
                  {user?.organization_name || "喀什大学"}
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
      <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
        <div className={cn("h-1.5 w-1.5 rounded-full", indicatorColor)} />
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <span className="text-[11px] font-semibold text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function SimpleBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-center">
      <div className="text-[10px] font-bold text-muted-foreground/60">{label}</div>
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
        <CardTitle className="text-[11px] font-bold text-muted-foreground tracking-wider">
          {title}
        </CardTitle>
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
        <p className="text-[10px] text-muted-foreground/70 mt-1 font-medium italic">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function CampusNewsCard({ token }: { token: string | null }) {
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
          <CardTitle className="text-sm font-bold">校园公告与新闻</CardTitle>
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border/40">
            <button
              onClick={() => switchSource("latest")}
              className={cn(
                "px-2 py-0.5 text-[9px] font-bold rounded transition-all",
                source === "latest"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              最新
            </button>
            <button
              onClick={() => switchSource("hot")}
              className={cn(
                "px-2 py-0.5 text-[9px] font-bold rounded transition-all",
                source === "hot"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              热门
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
                  <span className="line-clamp-1 text-xs font-semibold text-foreground/80 group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-[9px] font-mono text-muted-foreground">
                    {item.publishedAt?.slice(5, 10).replace("-", "/")}
                  </span>
                </button>
              ))}
            </div>
            <div className="shrink-0 flex items-center justify-between pt-3 pb-1 border-t border-border/20 mt-2">
              <span className="text-[9px] text-muted-foreground font-semibold">
                第 {pageNo} 页 / 共 {data?.total || "???"} 条
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
            未发现数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
