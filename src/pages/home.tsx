import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function Home() {
  const handleLogout = () => {
    window.location.href = "/login";
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
          <h1 className="text-2xl font-semibold">欢迎回来</h1>
          <p className="text-muted-foreground">
            登录成功，这里将展示您的校园信息
          </p>
        </div>
      </main>
    </div>
  );
}
