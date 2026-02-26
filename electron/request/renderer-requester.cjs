const { BrowserWindow } = require("electron");
const { randomUUID } = require("node:crypto");
const { REQUESTER_RESULT_CHANNEL, REQUESTER_TASK_CHANNEL } = require("./channels.cjs");
const { createLogger } = require("../shared/logger.cjs");

const logger = createLogger("request:renderer");

function requestViaRenderer(ipcMain, event, payload) {
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

  return new Promise((resolve) => {
    let done = false;

    const cleanup = (handler, timer) => {
      ipcMain.removeListener(REQUESTER_RESULT_CHANNEL, handler);
      clearTimeout(timer);
    };

    const handler = (_evt, result) => {
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
    window.webContents.send(REQUESTER_TASK_CHANNEL, {
      ...payload,
      requestId,
    });
  });
}

module.exports = {
  requestViaRenderer,
};
