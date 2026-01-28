import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <img src="/ksu.svg" alt="KSU" className="h-16 w-16" />
        </div>
        <CardTitle className="text-2xl">Ksu-App</CardTitle>
        <CardDescription>喀什大学校园统一入口</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">学号</Label>
          <Input
            id="username"
            placeholder="请输入学号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        <div className="flex items-center space-x-2">
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
      </CardContent>
    </Card>
  );
}
