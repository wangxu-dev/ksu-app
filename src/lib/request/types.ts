export type RequestMode = "renderer" | "main";

export type UnifiedRequestPayload = {
  mode: RequestMode;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  followRedirects?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
};

export type UnifiedResponsePayload = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
};

export type RendererRequestTask = UnifiedRequestPayload & {
  requestId: string;
};

export type RendererRequestResult = UnifiedResponsePayload & {
  requestId: string;
};
