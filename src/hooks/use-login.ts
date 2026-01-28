import { useState, useCallback } from "react";
import { getSavedToken, getRememberedAccount } from "@/lib/auth";
import { loginWithBackend, validateToken } from "@/lib/auth/service";

interface LoginCredentials {
  username: string;
  password: string;
  remember: boolean;
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberedAccount] = useState(() => getRememberedAccount());

  const login = useCallback(async ({ username, password, remember }: LoginCredentials): Promise<{ token?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithBackend({ username, password, rememberAccount: remember });
      return { token: result.token };
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败，请重试";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const autoLogin = useCallback(async (): Promise<{ success: boolean; token?: string }> => {
    try {
      const token = getSavedToken();
      if (!token) {
        return { success: false };
      }

      // 验证 token 是否有效
      await validateToken(token);
        return { success: true, token };
    } catch (e) {
      console.error("自动登录失败:", e);
      return { success: false };
    }
  }, []);

  return {
    login,
    isLoading,
    error,
    autoLogin,
    rememberedAccount,
  };
}
