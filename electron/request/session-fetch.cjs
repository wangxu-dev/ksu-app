function shouldFallbackToNode(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("ERR_BLOCKED_BY_CLIENT") || message.includes("Redirect was cancelled");
}

async function sessionFetch(electronSession, url, init) {
  if (electronSession && typeof electronSession.fetch === "function") {
    try {
      return await electronSession.fetch(url, init);
    } catch (error) {
      if (!shouldFallbackToNode(error)) {
        throw error;
      }
      return fetch(url, init);
    }
  }
  return fetch(url, init);
}

module.exports = {
  sessionFetch,
};
