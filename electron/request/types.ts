type RequestMode = "renderer" | "main";

type UnifiedRequestPayload = {
  mode: RequestMode;
  method: string;
  url: string;
  requestId?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  followRedirects?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
  disableNodeFallback?: boolean;
};

type UnifiedResponsePayload = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  requestId?: string;
  error?: string;
  errorCode?: string;
};

type RendererRequestTask = UnifiedRequestPayload & {
  requestId: string;
};

type RendererRequestResult = UnifiedResponsePayload & {
  requestId: string;
};

export type {
  RendererRequestResult,
  RendererRequestTask,
  UnifiedRequestPayload,
  UnifiedResponsePayload,
};
