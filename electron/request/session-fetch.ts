import type { Session } from "electron";
import { createLogger } from "../shared/logger.js";

const logger = createLogger("request:session");
const DEFAULT_TIMEOUT_MS = 15000;
type SessionFetchInit = RequestInit & {
  timeoutMs?: number;
  disableNodeFallback?: boolean;
};

function shouldFallbackToNode(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("ERR_BLOCKED_BY_CLIENT") || message.includes("Redirect was cancelled");
}

function shouldAllowNodeFallback(init: SessionFetchInit): boolean {
  return !init.disableNodeFallback;
}

function resolveSignal(init: SessionFetchInit, timeoutMs: number): AbortSignal | null | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return init?.signal;
  }
  if (init?.signal) return init.signal;
  return AbortSignal.timeout(timeoutMs);
}

async function sessionFetch(
  electronSession: Session,
  url: string,
  init: SessionFetchInit = {},
): Promise<Response> {
  const timeoutMs = Number(init.timeoutMs || DEFAULT_TIMEOUT_MS);
  const mergedInit = {
    ...init,
    signal: resolveSignal(init, timeoutMs),
  };
  delete mergedInit.timeoutMs;
  delete mergedInit.disableNodeFallback;

  logger.debug("fetch start", {
    url,
    method: mergedInit.method || "GET",
    timeoutMs,
    via: electronSession && typeof electronSession.fetch === "function" ? "session" : "node",
  });

  if (electronSession && typeof electronSession.fetch === "function") {
    try {
      const response = await electronSession.fetch(url, mergedInit);
      logger.debug("fetch success", {
        url,
        status: response.status,
        via: "session",
      });
      return response;
    } catch (error) {
      logger.warn("session fetch failed", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!shouldFallbackToNode(error) || !shouldAllowNodeFallback(init)) {
        throw error;
      }
      const response = await fetch(url, mergedInit);
      logger.debug("fetch fallback success", {
        url,
        status: response.status,
        via: "node",
      });
      return response;
    }
  }
  const response = await fetch(url, mergedInit);
  logger.debug("fetch success", {
    url,
    status: response.status,
    via: "node",
  });
  return response;
}

export { sessionFetch };
