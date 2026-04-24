import { randomUUID } from "node:crypto";
import {
  createKsuMcpRegistry,
  createKsuToolDefinitions,
  type CallKsuEndpoint,
} from "./mcp/ksu-mcp.js";
import { createLogger } from "../shared/logger.js";
import {
  ASSISTANT_STREAM_CHUNK_CHANNEL,
  ASSISTANT_STREAM_DONE_CHANNEL,
  ASSISTANT_STREAM_ERROR_CHANNEL,
} from "./channels.js";
import type { IpcMainInvokeEvent } from "electron";
import type { AssistantStore } from "./store.js";

type AssistantRunPayload = {
  message?: string;
  token?: string;
  conversationId?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL: string;
};

type StreamResult = {
  streamId: string;
};

const logger = createLogger("assistant:runtime");

function createAssistantToolCacheAdapter(store: AssistantStore) {
  return {
    get(cacheKey: string, nowTs: number) {
      const row = store.getToolCache(cacheKey, nowTs);
      if (!row) return null;
      return { value: row.value, updatedAt: row.updated_at };
    },
    set({
      cacheKey,
      scope,
      value,
      expiresAt,
      updatedAt,
    }: {
      cacheKey: string;
      scope: "memory" | "storage";
      value: string;
      expiresAt: number;
      updatedAt: number;
    }) {
      store.setToolCache({
        cacheKey,
        scope,
        value,
        expiresAt,
        updatedAt,
      });
    },
    delete(cacheKey: string) {
      store.deleteToolCache(cacheKey);
    },
  };
}

function emitChunk(event: IpcMainInvokeEvent, streamId: string, delta: string): void {
  logger.debug("stream chunk", { streamId, chunkLength: delta.length });
  event.sender.send(ASSISTANT_STREAM_CHUNK_CHANNEL, { streamId, delta });
}

function emitDone(event: IpcMainInvokeEvent, streamId: string): void {
  logger.info("stream done", { streamId });
  event.sender.send(ASSISTANT_STREAM_DONE_CHANNEL, { streamId });
}

function emitError(event: IpcMainInvokeEvent, streamId: string, error: unknown): void {
  logger.error("stream error", {
    streamId,
    error: error instanceof Error ? error.message : String(error),
  });
  event.sender.send(ASSISTANT_STREAM_ERROR_CHANNEL, {
    streamId,
    error: error instanceof Error ? error.message : "assistant failed",
  });
}

function currentDateText(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}年${m}月${d}日`;
}

function buildSystemPrompt(): string {
  return [
    "你是 Ksu-App 内置助手。",
    "你只能通过 ksu_mcp 工具访问学校数据。",
    "回答要简洁、准确、可执行。",
    `当前日期：${currentDateText()}`,
    "如果工具返回为空或失败，明确说明并建议用户重试。",
  ].join("\n");
}

function resolveOpenAIConfig(
  payload: AssistantRunPayload,
  settings: ReturnType<AssistantStore["getSettings"]>,
): OpenAIConfig {
  const apiKey = payload?.apiKey || settings?.apiKey || process.env.OPENAI_API_KEY || "";
  const model =
    payload?.model || settings?.model || process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
  const baseURL =
    payload?.baseUrl ||
    settings?.baseUrl ||
    process.env.OPENAI_BASE_URL ||
    "https://openrouter.ai/api/v1";
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
  return { apiKey, model, baseURL };
}

async function runAssistantStream({
  event,
  payload,
  callKsuEndpoint,
  store,
}: {
  event: IpcMainInvokeEvent;
  payload: AssistantRunPayload;
  callKsuEndpoint: CallKsuEndpoint;
  store: AssistantStore;
}): Promise<StreamResult> {
  const streamId = randomUUID();
  const message = String(payload?.message || "").trim();
  const token = String(payload?.token || "").trim();
  const conversationId = String(payload?.conversationId || "");

  if (!message) {
    logger.warn("stream invalid payload", { streamId, reason: "message is required" });
    emitError(event, streamId, new Error("message is required"));
    return { streamId };
  }
  if (!token) {
    logger.warn("stream invalid payload", { streamId, reason: "token is required" });
    emitError(event, streamId, new Error("token is required"));
    return { streamId };
  }
  if (!conversationId) {
    logger.warn("stream invalid payload", { streamId, reason: "conversationId is required" });
    emitError(event, streamId, new Error("conversationId is required"));
    return { streamId };
  }

  queueMicrotask(async () => {
    try {
      const settings = store.getSettings();
      const { apiKey, model, baseURL } = resolveOpenAIConfig(payload, settings);
      const { streamText, tool } = await import("ai");
      const { createOpenAI } = await import("@ai-sdk/openai");

      const openai = createOpenAI({ apiKey, baseURL });
      const registry = createKsuMcpRegistry({
        callKsuEndpoint,
        cache: createAssistantToolCacheAdapter(store),
      });
      const toolDefinitions = createKsuToolDefinitions({ callKsuEndpoint });
      const modelMessages = store
        .getMessages(conversationId)
        .filter(
          (item) => (item.role === "user" || item.role === "assistant") && item.content.trim(),
        )
        .map((item) => ({ role: item.role, content: item.content }));
      store.addMessage(conversationId, "user", message);
      const assistantMessageId = store.addMessage(conversationId, "assistant", "");
      const systemPrompt = settings.systemPrompt
        ? `${buildSystemPrompt()}\n\n${settings.systemPrompt}`
        : buildSystemPrompt();
      const tools = Object.fromEntries(
        toolDefinitions.map((definition) => [
          definition.name,
          tool({
            description: definition.description,
            inputSchema: definition.input,
            execute: async (args: Record<string, unknown>) =>
              registry.callTool(definition.name, args, { token }),
          }),
        ]),
      );

      const result = streamText({
        model: openai.chat(model),
        system: systemPrompt,
        messages: [...modelMessages, { role: "user", content: message }],
        tools,
      });
      let aggregated = "";

      for await (const delta of result.textStream) {
        if (delta) {
          aggregated += delta;
          store.updateMessage(assistantMessageId, aggregated);
          emitChunk(event, streamId, delta);
        }
      }
      emitDone(event, streamId);
    } catch (error) {
      emitError(event, streamId, error);
    }
  });

  return { streamId };
}

export { runAssistantStream };
