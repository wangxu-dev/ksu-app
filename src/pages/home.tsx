import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { HomeSearch } from "@/components/home-search";
import { getSavedToken, getSavedUser, type PersonalInfoData } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  LibraryBig,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDashboard, getCalendarMonthCached, getGradesCached } from "@/lib/auth/service";
import { getCachedGrades } from "@/lib/grades";
import { formatYearMonth, weekText } from "@/lib/calendar";

export function Home() {
  return (
    <>
      <PageHeader>
        <HomeSearch />
      </PageHeader>
      <HomeContent />
    </>
  );
}

function HomeContent() {
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
  }: {
    title: string;
    value: string;
    unit?: string;
    icon: React.ReactNode;
  }) => (
    <Card className="relative overflow-hidden">
      <CardHeader className="space-y-0">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-lg border bg-background"
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
    <div className="grid gap-6 lg:grid-cols-3">
      <Card id="profile" className="lg:col-span-1 scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">个人信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xl font-semibold">{user?.user_name ? `你好，${user.user_name}` : "你好"}</div>
          <div className="text-sm text-muted-foreground">{user?.username ? `学号：${user.username}` : "学号：--"}</div>
          {user?.organization_name ? (
            <div className="text-sm text-muted-foreground">班级：{user.organization_name}</div>
          ) : null}
          {user?.identity_type_name ? (
            <div className="text-sm text-muted-foreground">身份：{user.identity_type_name}</div>
          ) : null}
        </CardContent>
      </Card>

      <div id="overview" className="lg:col-span-2 scroll-mt-20">
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
              />
              <Stat
                title="GPA"
                value={gpa ?? "--"}
                icon={<GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />}
              />
              <Stat
                title="教学周"
                value={week ?? "--"}
                icon={<CalendarDays className="h-5 w-5 text-sky-600 dark:text-sky-300" />}
              />
              <Stat
                title="课程数"
                value={isLoading ? "--" : (personal?.kcs ?? "--")}
                unit="门"
                icon={<BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-300" />}
              />
              <Stat
                title="科研成果"
                value={isLoading ? "--" : (personal?.kycg ?? "--")}
                unit="项"
                icon={<FlaskConical className="h-5 w-5 text-fuchsia-700 dark:text-fuchsia-300" />}
              />
              <Stat
                title="图书馆借阅"
                value={isLoading ? "--" : (personal ? `${personal.tszj}/${personal.tsyj}` : "--")}
                unit="在借/已借"
                icon={<LibraryBig className="h-5 w-5 text-teal-700 dark:text-teal-300" />}
              />
        </div>

        {personalError ? (
          <p className="mt-3 text-sm text-muted-foreground">个人信息获取失败：{personalError}</p>
        ) : null}
      </div>
    </div>
  );
}
