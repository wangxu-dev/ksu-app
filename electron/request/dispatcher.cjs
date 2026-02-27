const { requestViaMain } = require("./main-requester.cjs");
const { requestViaRenderer } = require("./renderer-requester.cjs");
const { createLogger } = require("../shared/logger.cjs");

const logger = createLogger("request:dispatcher");

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
    retryCount: Number(payload.retryCount || 0),
    retryDelayMs: Number(payload.retryDelayMs || 350),
  };
}

async function dispatchRequest(ipcMain, event, payload) {
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

module.exports = {
  dispatchRequest,
};
