import { randomUUID } from "node:crypto";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { requestViaMain } from "./main-requester.js";
import { requestViaRenderer } from "./renderer-requester.js";
import { createLogger } from "../shared/logger.js";
import type { UnifiedRequestPayload, UnifiedResponsePayload } from "./types.js";

const logger = createLogger("request:dispatcher");
function resolveMode(rawMode: unknown): { mode: "main" | "renderer"; source: string } {
  if (rawMode === "main") return { mode: "main", source: "explicit" };
  if (rawMode === "renderer") return { mode: "renderer", source: "explicit" };
  return { mode: "main", source: "default" };
}

function resolveDisableNodeFallback(rawValue: unknown): boolean {
  if (typeof rawValue === "boolean") return rawValue;
  return false;
}

function normalizePayload(payload: unknown): UnifiedRequestPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid request payload");
  }

  const raw = payload as Partial<UnifiedRequestPayload>;
  const method = String(raw.method || "GET").toUpperCase();
  const url = String(raw.url || "");
  if (!url) throw new Error("url is required");
  const resolved = resolveMode(raw.mode);
  const disableNodeFallback = resolveDisableNodeFallback(raw.disableNodeFallback);

  return {
    requestId: raw.requestId || randomUUID(),
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
  return resolveMode(raw.mode).source;
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
    const requestId = randomUUID();
    logger.error("normalize payload failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      requestId,
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: error instanceof Error ? error.message : "invalid request payload",
      errorCode: "INVALID_REQUEST_PAYLOAD",
    };
  }

  logger.debug("dispatch request", {
    requestId: request.requestId,
    mode: request.mode,
    modeSource,
    method: request.method,
    url: request.url,
    timeoutMs: request.timeoutMs,
    retryCount: request.retryCount,
    disableNodeFallback: request.disableNodeFallback,
  });
  if (request.mode === "main") {
    const result = await requestViaMain(event.sender.session, request);
    logger.debug("dispatch result", {
      requestId: request.requestId,
      mode: request.mode,
      ok: result.ok,
      status: result.status,
      errorCode: result.errorCode,
    });
    return result;
  }
  const result = await requestViaRenderer(ipcMain, event, request);
  logger.debug("dispatch result", {
    requestId: request.requestId,
    mode: request.mode,
    ok: result.ok,
    status: result.status,
    errorCode: result.errorCode,
  });
  return result;
}

export { dispatchRequest };
