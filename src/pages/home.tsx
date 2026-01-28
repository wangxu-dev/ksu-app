import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSavedToken, getSavedUser, type PersonalInfoData } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDashboard, logout } from "@/lib/auth/service";

export function Home() {
  const navigate = useNavigate();
  const [user] = useState(() => getSavedUser());
  const [personal, setPersonal] = useState<PersonalInfoData | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [token] = useState(() => getSavedToken());

  useEffect(() => {
    let canceled = false;
    if (!token) return;

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
      });

    return () => {
      canceled = true;
    };
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <span>主页</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </Button>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {user?.user_name ? `欢迎回来，${user.user_name}` : "欢迎回来"}
          </h1>
          <p className="text-muted-foreground">
            {user
              ? `学号：${user.username}`
              : "登录成功，这里将展示您的校园信息"}
          </p>
          {user?.organization_name && (
            <p className="text-muted-foreground">班级：{user.organization_name}</p>
          )}
          {user?.identity_type_name && (
            <p className="text-muted-foreground">身份：{user.identity_type_name}</p>
          )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>校园卡余额</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {personal?.xykye ?? "--"}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>课程数</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {personal?.kcs ?? "--"}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>科研成果</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {personal?.kycg ?? "--"}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>图书馆在借</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {personal?.tszj ?? "--"}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>图书馆已借阅</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {personal?.tsyj ?? "--"}
              </CardContent>
            </Card>
          </div>

          {personalError && (
            <p className="text-sm text-muted-foreground">
              个人信息面板获取失败：{personalError}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
