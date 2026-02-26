import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type FrontendRequestTask = {
  requestId: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  followRedirects?: boolean;
};

type FrontendResponsePayload = {
  requestId: string;
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
};

let started = false;

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function executeTask(task: FrontendRequestTask): Promise<FrontendResponsePayload> {
  const controller = new AbortController();
  const timeoutMs = task.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(task.url, {
      method: task.method,
      headers: task.headers,
      body: task.body,
      redirect: task.followRedirects === false ? "manual" : "follow",
      signal: controller.signal,
    });

    const body = await response.text();
    return {
      requestId: task.requestId,
      ok: response.ok,
      status: response.status,
      headers: headersToRecord(response.headers),
      body,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "frontend requester failed";
    return {
      requestId: task.requestId,
      ok: false,
      status: 0,
      headers: {},
      body: "",
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function startFrontendRequesterBridge() {
  if (started) return;
  started = true;

  await listen<FrontendRequestTask>("frontend-request-task", async (event) => {
    const payload = await executeTask(event.payload);
    try {
      await invoke("proxy_submit_frontend_response", { payload });
    } catch (error) {
      console.error("submit frontend response failed", error);
    }
  });
}
