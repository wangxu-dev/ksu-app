import { ApiError } from "@/lib/api/client";
import type { UnifiedResponsePayload } from "@/lib/request/types";

const ERROR_CODE_MESSAGE: Record<string, string> = {
  INVALID_REQUEST_PAYLOAD: "请求参数无效，请稍后重试。",
  RENDERER_WINDOW_UNAVAILABLE: "客户端窗口不可用，请重启应用后重试。",
  RENDERER_REQUEST_TIMEOUT: "请求超时，请检查网络后重试。",
  NETWORK_TIMEOUT: "请求超时，请检查网络后重试。",
  NETWORK_ERROR: "网络异常，请稍后重试。",
  KSU_REQUEST_BUILD_FAILED: "请求构建失败，请稍后重试。",
};

function messageFromErrorCode(code?: string): string | null {
  if (!code) return null;
  return ERROR_CODE_MESSAGE[code] || null;
}

function messageFromStatus(status?: number): string | null {
  if (!status) return null;
  if (status === 401 || status === 403) return "登录状态已失效，请重新登录。";
  if (status >= 500) return "服务暂时不可用，请稍后重试。";
  return null;
}

function extractResponsePayload(payload: unknown): UnifiedResponsePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as Partial<UnifiedResponsePayload>;
  if (typeof response.status !== "number") return null;
  return response as UnifiedResponsePayload;
}

export function toUserMessage(error: unknown, fallback = "请求失败，请稍后重试。"): string {
  if (error instanceof ApiError) {
    const response = extractResponsePayload(error.payload);
    const codeMessage = messageFromErrorCode(response?.errorCode);
    if (codeMessage) return codeMessage;
    const statusMessage = messageFromStatus(error.status ?? response?.status);
    if (statusMessage) return statusMessage;
    if (error.message) return error.message;
    return fallback;
  }

  if (error instanceof Error) {
    const text = error.message || "";
    const lower = text.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return "请求超时，请检查网络后重试。";
    }
    if (text.includes("token is required")) {
      return "登录状态已失效，请重新登录。";
    }
    if (text) return text;
  }

  return fallback;
}
