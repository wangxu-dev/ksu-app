import { randomUUID } from "node:crypto";
import { BrowserWindow, type IpcMain, type IpcMainInvokeEvent } from "electron";
import { REQUESTER_RESULT_CHANNEL, REQUESTER_TASK_CHANNEL } from "./channels.js";
import { createLogger } from "../shared/logger.js";
import type {
  RendererRequestResult,
  RendererRequestTask,
  UnifiedRequestPayload,
  UnifiedResponsePayload,
} from "./types.js";

const logger = createLogger("request:renderer");

function requestViaRenderer(
  ipcMain: IpcMain,
  event: IpcMainInvokeEvent,
  payload: UnifiedRequestPayload,
): Promise<UnifiedResponsePayload> {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    logger.error("renderer window unavailable");
    return Promise.resolve({
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: "renderer window unavailable",
    });
  }

  const requestId = randomUUID();
  const timeoutMs = payload.timeoutMs ?? 30_000;
  logger.debug("send renderer task", {
    requestId,
    method: payload.method,
    url: payload.url,
    timeoutMs,
  });

  return new Promise((resolve: (value: UnifiedResponsePayload) => void) => {
    let done = false;

    const cleanup = (
      handler: (_evt: unknown, result: RendererRequestResult) => void,
      timer: NodeJS.Timeout,
    ) => {
      ipcMain.removeListener(REQUESTER_RESULT_CHANNEL, handler);
      clearTimeout(timer);
    };

    const handler = (_evt: unknown, result: RendererRequestResult) => {
      if (!result || result.requestId !== requestId) return;
      done = true;
      cleanup(handler, timer);
      logger.debug("renderer task completed", {
        requestId,
        ok: !!result.ok,
        status: Number(result.status || 0),
      });
      resolve({
        ok: !!result.ok,
        status: Number(result.status || 0),
        headers: result.headers || {},
        body: result.body || "",
        error: result.error,
      });
    };

    const timer = setTimeout(() => {
      if (done) return;
      cleanup(handler, timer);
      logger.error("renderer requester timeout", {
        requestId,
        method: payload.method,
        url: payload.url,
        timeoutMs,
      });
      resolve({
        ok: false,
        status: 0,
        headers: {},
        body: "",
        error: "renderer requester timeout",
      });
    }, timeoutMs + 1_000);

    ipcMain.on(REQUESTER_RESULT_CHANNEL, handler);
    const task: RendererRequestTask = {
      ...payload,
      requestId,
    };
    window.webContents.send(REQUESTER_TASK_CHANNEL, task);
  });
}

export { requestViaRenderer };
