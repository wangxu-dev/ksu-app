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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { HomeSearch } from "@/components/home-search";

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

/**
 * ARCHITECTURE: DATA LAYER
 * Encapsulates all data fetching and transformation logic.
 */
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

/**
 * ARCHITECTURE: UI LAYER (MAIN PAGE)
 */
export function Home() {
  const navigate = useNavigate();
  const user = getSavedUser();
  const { token, personal, gpa, week, isLoading } = useDashboardData();

  useEffect(() => {
    if (!token) navigate({ to: "/login" });
  }, [token, navigate]);

  return (
    <div className="flex-1 space-y-8 p-0 md:p-2 pt-6">
      <PageHeader>
        <HomeSearch />
      </PageHeader>

      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">工作台</h2>
          <p className="text-muted-foreground">
            欢迎回来，{user?.user_name || "学生"}。这是你的校园数据概览。
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="h-8 rounded-md px-3 font-medium">
            <Clock className="mr-2 h-3 w-3" />
            {new Date().toLocaleDateString("zh-CN", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Badge>
        </div>
      </div>

      {/* TOP STATS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="平均绩点 (GPA)"
          value={gpa}
          icon={<GraduationCap className="h-4 w-4 text-muted-foreground" />}
          description="基于上一学期归档成绩"
          isLoading={isLoading}
        />
        <MetricCard
          title="校园卡余额"
          value={personal?.xykye ? `¥${Number(personal.xykye).toFixed(2)}` : null}
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
          description="实时账户可用资金"
          isLoading={isLoading}
        />
        <MetricCard
          title="当前进度"
          value={week}
          icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
          description="教学周运行状态"
          isLoading={isLoading}
        />
        <MetricCard
          title="图书在借"
          value={personal?.tszj ?? null}
          icon={<LibraryBig className="h-4 w-4 text-muted-foreground" />}
          description={`累计借阅 ${personal?.tsyj || 0} 本`}
          isLoading={isLoading}
        />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>学业概况</CardTitle>
            <CardDescription>同步自教务系统，包含课程及科研成果统计。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-4">
                  <span className="text-sm font-medium text-muted-foreground">累计修读课程</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{personal?.kcs || "0"}</span>
                    <span className="text-xs text-muted-foreground font-normal">门</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-4">
                  <span className="text-sm font-medium text-muted-foreground">登记科研成果</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{personal?.kycg || "0"}</span>
                    <span className="text-xs text-muted-foreground font-normal">项</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 flex items-start space-x-4">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Info className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">数据声明</p>
                  <p className="text-sm text-muted-foreground leading-snug">
                    GPA 与课程记录基于上一完整学期的教务存档。当前学期的实时成绩可能尚未计入。
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => navigate({ to: "/grades" })}
                >
                  查看成绩单详情 <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>学生档案</CardTitle>
              <CardDescription>身份验证及所属组织信息。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-bold border-2 border-background shadow-sm">
                    {user?.user_name?.slice(0, 1)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold leading-none">{user?.user_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{user?.username}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">身份</span>
                    <Badge variant="secondary" className="rounded-md">
                      {user?.identity_type_name || "普通学生"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">所属机构</span>
                    <span className="text-sm font-medium text-right max-w-[180px]">
                      {user?.organization_name || "未归类"}
                    </span>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" disabled>
                  编辑个人信息
                </Button>
              </div>
            </CardContent>
          </Card>
          <CampusNewsCard token={token} />
        </div>
      </div>
    </div>
  );
}

/**
 * ARCHITECTURE: ATOMIC COMPONENT
 */
interface MetricCardProps {
  title: string;
  value: string | number | null;
  icon: React.ReactNode;
  description: string;
  isLoading: boolean;
}

function MetricCard({ title, value, icon, description, isLoading }: MetricCardProps) {
  return (
    <Card className="shadow-none border-border/60 hover:border-border transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold tracking-tight tabular-nums">{value || "--"}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function formatNewsDate(input: string | null): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
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
    <Card className="shadow-none border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">校园新闻</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={source === "latest" ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => switchSource("latest")}
            >
              最新
            </Button>
            <Button
              type="button"
              size="sm"
              variant={source === "hot" ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => switchSource("hot")}
            >
              热门
            </Button>
          </div>
        </div>
        <CardDescription>只展示标题和跳转</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openNews(item)}
                className="group flex items-start justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
              >
                <span className="line-clamp-1 text-sm text-foreground/90 group-hover:text-foreground">
                  {item.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatNewsDate(item.publishedAt)}
                </span>
              </button>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                第 {pageNo} 页{typeof data?.total === "number" ? ` · 共 ${data.total} 条` : ""}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!canPrev}
                  onClick={() => setPageNo((prev) => Math.max(1, prev - 1))}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!canNext}
                  onClick={() => setPageNo((prev) => prev + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {newsQuery.isError ? "新闻请求失败" : "暂无新闻数据"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
