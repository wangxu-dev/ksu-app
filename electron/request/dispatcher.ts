import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { requestViaMain } from "./main-requester.js";
import { requestViaRenderer } from "./renderer-requester.js";
import { createLogger } from "../shared/logger.js";
import type { UnifiedRequestPayload, UnifiedResponsePayload } from "./types.js";

const logger = createLogger("request:dispatcher");

function normalizePayload(payload: unknown): UnifiedRequestPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid request payload");
  }

  const raw = payload as Partial<UnifiedRequestPayload>;
  const method = String(raw.method || "GET").toUpperCase();
  const url = String(raw.url || "");
  const mode = raw.mode === "main" ? "main" : "renderer";
  if (!url) throw new Error("url is required");

  return {
    mode,
    method,
    url,
    headers: raw.headers || {},
    body: raw.body,
    timeoutMs: raw.timeoutMs,
    followRedirects: raw.followRedirects,
    retryCount: Number(raw.retryCount || 0),
    retryDelayMs: Number(raw.retryDelayMs || 350),
  };
}

async function dispatchRequest(
  ipcMain: IpcMain,
  event: IpcMainInvokeEvent,
  payload: unknown,
): Promise<UnifiedResponsePayload> {
  let request;
  try {
    request = normalizePayload(payload);
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
    };
  }

  logger.debug("dispatch request", {
    mode: request.mode,
    method: request.method,
    url: request.url,
    timeoutMs: request.timeoutMs,
    retryCount: request.retryCount,
  });
  if (request.mode === "main") {
    return requestViaMain(event.sender.session, request);
  }
  return requestViaRenderer(ipcMain, event, request);
}

export { dispatchRequest };
