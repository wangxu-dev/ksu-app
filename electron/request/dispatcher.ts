import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { requestViaMain } from "./main-requester.js";
import { requestViaRenderer } from "./renderer-requester.js";
import { createLogger } from "../shared/logger.js";
import type { UnifiedRequestPayload, UnifiedResponsePayload } from "./types.js";

const logger = createLogger("request:dispatcher");
const RENDERER_PREFERRED_HOSTS = new Set([
  "cas.ksu.edu.cn",
  "portal.ksu.edu.cn",
  "portal-data.ksu.edu.cn",
  "score-inquiry.ksu.edu.cn",
  "jwnet.ksu.edu.cn",
  "authx-service.ksu.edu.cn",
]);

function shouldUseRendererByHost(url: string): boolean {
  try {
    return RENDERER_PREFERRED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function resolveMode(rawMode: unknown, url: string): { mode: "main" | "renderer"; source: string } {
  if (rawMode === "main") return { mode: "main", source: "explicit" };
  if (rawMode === "renderer") return { mode: "renderer", source: "explicit" };
  if (shouldUseRendererByHost(url)) return { mode: "renderer", source: "strategy" };
  return { mode: "main", source: "default" };
}

function resolveDisableNodeFallback(rawValue: unknown, modeSource: string): boolean {
  if (typeof rawValue === "boolean") return rawValue;
  // Keep TLS-safe behavior for strategy-selected requests unless explicitly overridden.
  return modeSource === "strategy";
}

function normalizePayload(payload: unknown): UnifiedRequestPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid request payload");
  }

  const raw = payload as Partial<UnifiedRequestPayload>;
  const method = String(raw.method || "GET").toUpperCase();
  const url = String(raw.url || "");
  if (!url) throw new Error("url is required");
  const resolved = resolveMode(raw.mode, url);
  const disableNodeFallback = resolveDisableNodeFallback(raw.disableNodeFallback, resolved.source);

  return {
    mode: resolved.mode,
    method,
    url,
    headers: raw.headers || {},
    body: raw.body,
    timeoutMs: raw.timeoutMs,
    followRedirects: raw.followRedirects,
    retryCount: Number(raw.retryCount || 0),
    retryDelayMs: Number(raw.retryDelayMs || 350),
    disableNodeFallback,
  };
}

function resolveModeSource(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "unknown";
  const raw = payload as Partial<UnifiedRequestPayload>;
  const url = String(raw.url || "");
  return resolveMode(raw.mode, url).source;
}

async function dispatchRequest(
  ipcMain: IpcMain,
  event: IpcMainInvokeEvent,
  payload: unknown,
): Promise<UnifiedResponsePayload> {
  let request;
  let modeSource = "unknown";
  try {
    request = normalizePayload(payload);
    modeSource = resolveModeSource(payload);
  } catch (error) {
    logger.error("normalize payload failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: error instanceof Error ? error.message : "invalid request payload",
      errorCode: "INVALID_REQUEST_PAYLOAD",
    };
  }

  logger.debug("dispatch request", {
    mode: request.mode,
    modeSource,
    method: request.method,
    url: request.url,
    timeoutMs: request.timeoutMs,
    retryCount: request.retryCount,
    disableNodeFallback: request.disableNodeFallback,
  });
  if (request.mode === "main") {
    return requestViaMain(event.sender.session, request);
  }
  return requestViaRenderer(ipcMain, event, request);
}

export { dispatchRequest };
