import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { User, Lock } from "lucide-react";
import { useLogin } from "@/hooks/use-login";
import { useNavigate } from "@tanstack/react-router";
import { publicAsset } from "@/lib/assets";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { login, isLoading, error, rememberedAccount } = useLogin();
  const { messages } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (rememberedAccount) setUsername(rememberedAccount);
  }, [rememberedAccount]);

  const handleSubmit = async () => {
    if (!username || !password) return;
    try {
      const result = await login({ username, password, remember: rememberMe });
      if (result.token) {
        navigate({ to: "/home" });
      }
    } catch {
      // 错误已在 useLogin 中处理
    }
  };

  const isValid = username.length > 0 && password.length > 0;

  return (
    <div className="w-full max-w-sm space-y-5">
      {/* Logo */}
      <div className="flex justify-center">
        <img src={publicAsset("ksu.svg")} alt="KSU" className="h-14 w-14" />
      </div>

      {/* 标题 */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{messages.login.entry}</p>
      </div>

      {/* 表单字段 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm">
            {messages.login.username}
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="username"
              placeholder={messages.login.usernamePlaceholder}
              className="pl-10"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm">
            {messages.login.password}
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder={messages.login.passwordPlaceholder}
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
            {messages.login.remember}
          </Label>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</div>
        )}

        <Button className="w-full" onClick={handleSubmit} disabled={isLoading || !isValid}>
          {isLoading ? messages.login.submitting : messages.login.submit}
        </Button>
      </div>
    </div>
  );
}
