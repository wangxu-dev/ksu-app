import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Lock } from "lucide-react";
import { useLogin } from "@/hooks/use-login";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { login, isLoading } = useLogin();

  const handleSubmit = async () => {
    if (!username || !password) return;
    try {
      await login({ username, password, rememberMe });
    } catch {
      // 错误已在 useLogin 中处理
    }
  };

  const isValid = username.length > 0 && password.length > 0;

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <img src="/ksu.svg" alt="KSU" className="h-14 w-14" />
      </div>

      {/* 表单容器 */}
      <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-lg space-y-5">
        {/* 标题 */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Ksu-App</h1>
          <p className="text-sm text-muted-foreground">喀什大学校园统一入口</p>
        </div>

        {/* 表单字段 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm">学号</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                placeholder="请输入学号"
                className="pl-10"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="remember" className="text-sm cursor-pointer">
              记住密码
            </Label>
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
          >
            {isLoading ? "登录中..." : "登录"}
          </Button>
        </div>
      </div>
    </div>
  );
}
