const { sessionFetch } = require("./session-fetch.cjs");
const { createLogger } = require("../shared/logger.cjs");

const logger = createLogger("request:main");
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function shouldRetryError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("aborted") || message.includes("Timeout") || message.includes("timed out")
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
  const retryCount = Math.max(0, Number(payload.retryCount || 0));
  const retryDelayMs = Math.max(0, Number(payload.retryDelayMs || 350));

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const result = await executeOnce(electronSession, payload, timeoutMs);
      const shouldRetry = attempt < retryCount && shouldRetryResponse(method, result.status);
      if (!shouldRetry) return result;

      logger.warn("retrying request after retryable status", {
        url: payload.url,
        method,
        status: result.status,
        attempt: attempt + 1,
        retryCount,
      });
      await sleep(retryDelayMs);
      continue;
    } catch (error) {
      const shouldRetry = attempt < retryCount && method === "GET" && shouldRetryError(error);
      if (shouldRetry) {
        logger.warn("retrying request after transient error", {
          url: payload.url,
          method,
          error: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
          retryCount,
        });
        await sleep(retryDelayMs);
        continue;
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

  return {
    ok: false,
    status: 0,
    headers: {},
    body: "",
    error: "main requester failed",
  };
}

module.exports = {
  requestViaMain,
};
