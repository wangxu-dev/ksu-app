const { sessionFetch } = require("./session-fetch.cjs");
const { createLogger } = require("../shared/logger.cjs");

const logger = createLogger("request:main");
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function shouldRetryError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("aborted") ||
    message.includes("Timeout") ||
    message.includes("timed out")
  );
}

function shouldRetryResponse(method, status) {
  return method === "GET" && RETRYABLE_STATUS.has(status);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeOnce(electronSession, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await sessionFetch(electronSession, payload.url, {
      method: payload.method ?? "GET",
      headers: payload.headers,
      body: payload.body,
      credentials: "omit",
      redirect: payload.followRedirects ? "follow" : "manual",
      signal: controller.signal,
      timeoutMs,
    });

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      ok: response.ok,
      status: response.status,
      headers,
      body: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function requestViaMain(electronSession, payload) {
  const timeoutMs = payload.timeoutMs ?? 30_000;
  const method = String(payload.method || "GET").toUpperCase();

  try {
    const first = await executeOnce(electronSession, payload, timeoutMs);
    if (!shouldRetryResponse(method, first.status)) return first;

    logger.warn("retrying request after retryable status", {
      url: payload.url,
      method,
      status: first.status,
    });
    await sleep(350);
    return await executeOnce(electronSession, payload, timeoutMs);
  } catch (error) {
    if (method === "GET" && shouldRetryError(error)) {
      logger.warn("retrying request after transient error", {
        url: payload.url,
        method,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await sleep(350);
        return await executeOnce(electronSession, payload, timeoutMs);
      } catch (retryError) {
        return {
          ok: false,
          status: 0,
          headers: {},
          body: "",
          error: retryError instanceof Error ? retryError.message : "main requester failed",
        };
      }
    }
    return {
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: error instanceof Error ? error.message : "main requester failed",
    };
  }
}

module.exports = {
  requestViaMain,
};
