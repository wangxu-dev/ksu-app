const { sessionFetch } = require("./session-fetch.cjs");

async function requestViaMain(electronSession, payload) {
  const controller = new AbortController();
  const timeoutMs = payload.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await sessionFetch(electronSession, payload.url, {
      method: payload.method ?? "GET",
      headers: payload.headers,
      body: payload.body,
      redirect: payload.followRedirects ? "follow" : "manual",
      signal: controller.signal,
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
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: error instanceof Error ? error.message : "main requester failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  requestViaMain,
};
