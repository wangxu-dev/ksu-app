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
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const dateString = useMemo(() => {
    return new Date().toLocaleDateString("zh-CN", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden">
      {/* STATS STRIP (Top) */}
      <section className="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="GPA"
          value={gpa}
          icon={<GraduationCap className="h-4 w-4" />}
          description="上一学期存档"
          isLoading={isLoading}
        />
        <MetricCard
          title="余额"
          value={personal?.xykye ? `¥${Number(personal.xykye).toFixed(2)}` : null}
          icon={<Wallet className="h-4 w-4" />}
          description="校园卡可用"
          isLoading={isLoading}
        />
        <MetricCard
          title="学期周"
          value={week}
          icon={<CalendarDays className="h-4 w-4" />}
          description="教学运行状态"
          isLoading={isLoading}
        />
        <MetricCard
          title="借阅"
          value={personal?.tszj ?? null}
          icon={<LibraryBig className="h-4 w-4" />}
          description={`累计借 ${personal?.tsyj || 0} 本`}
          isLoading={isLoading}
        />
      </section>

      {/* MAIN TWO-COLUMN AREA (Flexible Middle) */}
      <div className="flex-1 min-h-0 grid gap-6 md:grid-cols-12 overflow-hidden">
        {/* LEFT: PRIMARY CONTENT */}
        <div className="md:col-span-8 flex flex-col gap-6 overflow-hidden">
          <Card className="flex flex-col flex-1 overflow-hidden border-border/50 shadow-none">
            <CardHeader className="shrink-0 border-b bg-muted/20 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">学业动态</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs hover:bg-background"
                  onClick={() => navigate({ to: "/grades" })}
                >
                  成绩详情 <ArrowUpRight className="ml-1 h-3 w-3" />
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

              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">学期关键数据</span>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    <SimpleBox label="应得学分" value="--" />
                    <SimpleBox label="选修课程" value="--" />
                    <SimpleBox label="必修课程" value="--" />
                </div>
              </div>

              <div className="mt-8 flex items-start gap-3 rounded-lg border border-primary/10 bg-primary/5 p-4 text-primary">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed opacity-90 font-medium">
                  数据均同步自校务存档，仅供参考。如有异议请以官方纸质报表为准。
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: SIDEBAR CONTENT */}
        <div className="md:col-span-4 flex flex-col gap-6 overflow-hidden">
          {/* PROFILE SUMMARY */}
          <Card className="shrink-0 border-border/50 shadow-none">
            <CardHeader className="py-3 bg-muted/10 border-b">
              <CardTitle className="text-sm">档案摘要</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-xl font-bold border shadow-sm">
                  {user?.user_name?.slice(0, 1)}
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="font-bold text-sm truncate">{user?.user_name}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">{user?.username}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium bg-muted/30">
                  {user?.identity_type_name || "学生"}
                </Badge>
                <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium truncate max-w-[140px]">
                  {user?.organization_name || "KSU"}
                </Badge>
              </div>
            </CardContent>
          </Card>
          
          {/* NEWS (Fills remaining height) */}
          <CampusNewsCard token={token} />
        </div>
      </div>
    </div>
  );
}

function AcademicStatBlock({ label, value, unit, indicatorColor }: any) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border bg-card/50 p-4 transition-colors hover:border-primary/20">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                <div className={cn("h-1.5 w-1.5 rounded-full", indicatorColor)} />
                {label}
            </div>
            <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tracking-tight">{value}</span>
                <span className="text-[11px] font-bold text-muted-foreground/70">{unit}</span>
            </div>
        </div>
    );
}

function SimpleBox({ label, value }: { label: string, value: string }) {
    return (
        <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase">{label}</div>
            <div className="mt-1 font-bold text-sm">{value}</div>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
        <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="text-muted-foreground/60 group-hover:text-primary transition-colors">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-6 w-20 rounded" />
        ) : (
          <div className="text-xl font-black tracking-tight tabular-nums">
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
    <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-none">
      <CardHeader className="shrink-0 pb-2 border-b bg-muted/10 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold">校园新闻</CardTitle>
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md">
            <button
              onClick={() => switchSource("latest")}
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-bold rounded transition-all",
                source === "latest" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              最新
            </button>
            <button
              onClick={() => switchSource("hot")}
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-bold rounded transition-all",
                source === "hot" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
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
                  <span className="line-clamp-1 text-xs font-bold text-foreground/70 group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-[9px] font-mono text-muted-foreground">
                    {item.publishedAt?.slice(5, 10).replace('-', '/')}
                  </span>
                </button>
              ))}
            </div>
            <div className="shrink-0 flex items-center justify-between pt-3 pb-1">
              <span className="text-[9px] text-muted-foreground font-mono">
                P.{pageNo} / ITEMS.{data?.total || "???"}
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
            暂无数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
