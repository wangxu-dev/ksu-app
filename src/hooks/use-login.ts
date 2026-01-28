import { useState } from "react";

interface LoginCredentials {
  username: string;
  password: string;
  rememberMe: boolean;
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: 调用 Tauri command 进行真实登录
      // const result = await invoke('login', { ...credentials });

      // 模拟登录请求
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Login attempt:", credentials);

      // 这里后续会处理真实登录逻辑
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败，请重试";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login,
    isLoading,
    error,
  };
}
