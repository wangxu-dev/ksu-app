const { BrowserWindow } = require("electron");
const { randomUUID } = require("node:crypto");
const { REQUESTER_RESULT_CHANNEL, REQUESTER_TASK_CHANNEL } = require("./channels.cjs");

function requestViaRenderer(ipcMain, event, payload) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
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
