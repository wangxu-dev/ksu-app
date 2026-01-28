import { Button } from "@/components/ui/button";
import { clearAuth, getSavedUser } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { useMemo } from "react";

export function Home() {
  const navigate = useNavigate();
  const user = useMemo(() => getSavedUser(), []);

  const handleLogout = () => {
    clearAuth();
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

      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
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
      </main>
    </div>
  );
}
