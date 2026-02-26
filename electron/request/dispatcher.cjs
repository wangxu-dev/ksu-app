const { requestViaMain } = require("./main-requester.cjs");
const { requestViaRenderer } = require("./renderer-requester.cjs");

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid request payload");
  }

  const method = String(payload.method || "GET").toUpperCase();
  const url = String(payload.url || "");
  const mode = payload.mode === "main" ? "main" : "renderer";
  if (!url) throw new Error("url is required");

  return {
    mode,
    method,
    url,
    headers: payload.headers || {},
    body: payload.body,
    timeoutMs: payload.timeoutMs,
    followRedirects: payload.followRedirects,
  };
}

async function dispatchRequest(ipcMain, event, payload) {
  let request;
  try {
    request = normalizePayload(payload);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: error instanceof Error ? error.message : "invalid request payload",
    };
  }

  if (request.mode === "main") {
    return requestViaMain(event.sender.session, request);
  }
  return requestViaRenderer(ipcMain, event, request);
}

module.exports = {
  dispatchRequest,
};
