import { invoke } from "@tauri-apps/api/core";

export type RequestMode = "frontend" | "backend";

export type ProxyRequestPayload = {
  requestMode: RequestMode;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  followRedirects?: boolean;
};

export type ProxyResponsePayload = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
};

export async function proxyRequest(
  payload: ProxyRequestPayload
): Promise<ProxyResponsePayload> {
  return invoke<ProxyResponsePayload>("proxy_request", { payload });
}
