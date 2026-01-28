import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSavedToken, getSavedUser, type PersonalInfoData } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  LibraryBig,
  LogOut,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDashboard, getCalendarMonthCached, getGradesCached, logout } from "@/lib/auth/service";
import { getCachedGrades } from "@/lib/grades";
import { formatYearMonth, weekText } from "@/lib/calendar";

export function Home() {
  const navigate = useNavigate();
  const [user] = useState(() => getSavedUser());
  const [personal, setPersonal] = useState<PersonalInfoData | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [token] = useState(() => getSavedToken());
  const [isLoading, setIsLoading] = useState(false);
  const [gpa, setGpa] = useState<string | null>(() => getCachedGrades()?.data?.gpa ?? null);
  const [week, setWeek] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    if (!token) {
      navigate({ to: "/login" });
      return;
    }

    setIsLoading(true);
    fetchDashboard(token)
      .then((data) => {
        if (canceled) return;
        setPersonal(data);
        setPersonalError(null);
      })
      .catch((e) => {
        if (canceled) return;
        setPersonal(null);
        setPersonalError(e instanceof Error ? e.message : "获取个人信息失败");
      })
      .finally(() => {
        if (canceled) return;
        setIsLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [token, navigate]);

  useEffect(() => {
    let canceled = false;
    if (!token) return;

    getGradesCached(token, { maxAgeMs: 7 * 24 * 60 * 60 * 1000 })
      .then((res) => {
        if (canceled) return;
        setGpa(res.data.gpa);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      canceled = true;
    };
  }, [token]);

  useEffect(() => {
    let canceled = false;
    if (!token) return;
    const ym = formatYearMonth(new Date());
    const today = new Date().toISOString().slice(0, 10);

    getCalendarMonthCached(token, ym, { maxAgeMs: 30 * 24 * 60 * 60 * 1000 })
      .then((res) => {
        if (canceled) return;
        const day = res.data.find((d) => d.rq === today);
        setWeek(day ? weekText(day.zc) : null);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      canceled = true;
    };
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  const formatCurrency = (v?: string) => {
    if (!v) return "--";
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return n.toFixed(2);
  };

  const Stat = ({
    title,
    value,
    unit,
    icon,
    tint,
  }: {
    title: string;
    value: string;
    unit?: string;
    icon: React.ReactNode;
    tint?: string;
  }) => (
    <Card className="relative overflow-hidden">
      <CardHeader className="space-y-0">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div
            aria-hidden="true"
            className={["grid h-9 w-9 place-items-center rounded-lg border bg-background", tint ?? ""].join(" ")}
          >
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          {unit ? <div className="text-sm text-muted-foreground">{unit}</div> : null}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-muted/30 to-background dark:from-primary/10 dark:via-muted/20">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border bg-background">
              <User aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">校园助手</div>
              <div className="text-xs text-muted-foreground">Kashgar University</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut aria-hidden="true" className="h-4 w-4" />
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">个人信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xl font-semibold">
                {user?.user_name ? `你好，${user.user_name}` : "你好"}
              </div>
              <div className="text-sm text-muted-foreground">
                {user?.username ? `学号：${user.username}` : "学号：--"}
              </div>
              {user?.organization_name ? (
                <div className="text-sm text-muted-foreground">班级：{user.organization_name}</div>
              ) : null}
              {user?.identity_type_name ? (
                <div className="text-sm text-muted-foreground">身份：{user.identity_type_name}</div>
              ) : null}
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">概览</h1>
                <p className="mt-1 text-sm text-muted-foreground">你的校园数据一览</p>
              </div>
              <div className="hidden sm:flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/grades" })}>
                  成绩
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/calendar" })}>
                  校历
                </Button>
                <Button variant="outline" size="sm" disabled>
                  图书馆
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Stat
                title="校园卡余额"
                value={isLoading ? "--" : formatCurrency(personal?.xykye)}
                unit="元"
                icon={<Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                tint="border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-400/20 dark:bg-emerald-500/10"
              />
              <Stat
                title="GPA"
                value={gpa ?? "--"}
                icon={<GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />}
                tint="border-indigo-200/60 bg-indigo-50/50 dark:border-indigo-400/20 dark:bg-indigo-500/10"
              />
              <Stat
                title="教学周"
                value={week ?? "--"}
                icon={<CalendarDays className="h-5 w-5 text-sky-600 dark:text-sky-300" />}
                tint="border-sky-200/60 bg-sky-50/50 dark:border-sky-400/20 dark:bg-sky-500/10"
              />
              <Stat
                title="课程数"
                value={isLoading ? "--" : (personal?.kcs ?? "--")}
                unit="门"
                icon={<BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-300" />}
                tint="border-amber-200/60 bg-amber-50/50 dark:border-amber-400/20 dark:bg-amber-500/10"
              />
              <Stat
                title="科研成果"
                value={isLoading ? "--" : (personal?.kycg ?? "--")}
                unit="项"
                icon={<FlaskConical className="h-5 w-5 text-fuchsia-700 dark:text-fuchsia-300" />}
                tint="border-fuchsia-200/60 bg-fuchsia-50/50 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10"
              />
              <Stat
                title="图书馆借阅"
                value={isLoading ? "--" : (personal ? `${personal.tszj}/${personal.tsyj}` : "--")}
                unit="在借/已借"
                icon={<LibraryBig className="h-5 w-5 text-teal-700 dark:text-teal-300" />}
                tint="border-teal-200/60 bg-teal-50/50 dark:border-teal-400/20 dark:bg-teal-500/10"
              />
            </div>

            {personalError ? (
              <p className="mt-3 text-sm text-muted-foreground">个人信息获取失败：{personalError}</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
