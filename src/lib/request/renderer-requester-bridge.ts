import { ipcOn, ipcSend } from "@/lib/ipc";
import { REQUESTER_RESULT_CHANNEL, REQUESTER_TASK_CHANNEL } from "@/lib/request/channels";
import type { RendererRequestResult, RendererRequestTask } from "@/lib/request/types";

let started = false;

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function resolveErrorCode(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "NETWORK_TIMEOUT";
  }
  return "NETWORK_ERROR";
}

async function executeRendererFetch(task: RendererRequestTask): Promise<RendererRequestResult> {
  const controller = new AbortController();
  const timeoutMs = task.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  console.debug("[renderer-requester] start", {
    requestId: task.requestId,
    method: task.method,
    url: task.url,
    timeoutMs,
  });

  try {
    const response = await fetch(task.url, {
      method: task.method,
      headers: task.headers,
      body: task.body,
      credentials: "omit",
      redirect: task.followRedirects === false ? "manual" : "follow",
      signal: controller.signal,
    });

    return {
      requestId: task.requestId,
      ok: response.ok,
      status: response.status,
      headers: headersToRecord(response.headers),
      body: await response.text(),
    };
  } catch (error) {
    console.error("[renderer-requester] failed", {
      requestId: task.requestId,
      method: task.method,
      url: task.url,
      error: error instanceof Error ? error.message : "renderer request failed",
    });
    return {
      requestId: task.requestId,
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: error instanceof Error ? error.message : "renderer request failed",
      errorCode: resolveErrorCode(error),
    };
  } finally {
    console.debug("[renderer-requester] done", {
      requestId: task.requestId,
      method: task.method,
      url: task.url,
    });
    clearTimeout(timer);
  }
}

export function startRendererRequesterBridge(): void {
  if (started) return;
  if (!window.electronAPI) return;
  started = true;

  ipcOn(REQUESTER_TASK_CHANNEL, async (payload) => {
    const task = payload as RendererRequestTask;
    const result = await executeRendererFetch(task);
    ipcSend(REQUESTER_RESULT_CHANNEL, result);
  });
}
