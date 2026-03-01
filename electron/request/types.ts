type RequestMode = "renderer" | "main";

type UnifiedRequestPayload = {
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

type UnifiedResponsePayload = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
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
