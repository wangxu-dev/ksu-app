import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { saveAuth } from "@/lib/auth";

interface LoginCredentials {
  username: string;
  password: string;
  remember: boolean;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  message: string;
}

interface UserInfoData {
  username: string;
  user_name: string;
  user_uid: string;
  user_id: string;
  organization_name?: string;
  identity_type_name?: string;
}

interface UserInfoResponse {
  success: boolean;
  data?: UserInfoData;
  message: string;
}

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async ({ username, password, remember }: LoginCredentials): Promise<{ token?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<LoginResponse>("login", {
        username,
        password,
        remember,
      });

      if (result.success && result.token) {
        // 获取用户信息
        const userInfo = await invoke<UserInfoResponse>("get_user_info", {
          token: result.token,
        });

        if (userInfo.success && userInfo.data) {
          saveAuth(result.token, userInfo.data);
          return { token: result.token };
        } else {
          throw new Error(userInfo.message || "获取用户信息失败");
        }
      } else {
        throw new Error(result.message || "登录失败");
      }
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
      const token = await invoke<string | null>("get_saved_token");
      if (!token) {
        return { success: false };
      }

      // 验证 token 是否有效
      const userInfo = await invoke<UserInfoResponse>("get_user_info", {
        token,
      });

      if (userInfo.success && userInfo.data) {
        saveAuth(token, userInfo.data);
        return { success: true, token };
      } else {
        return { success: false };
      }
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
  };
}
