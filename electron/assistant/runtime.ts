import { randomUUID } from "node:crypto";
import {
  Agent,
  OpenAIProvider,
  Runner,
  assistant,
  isOpenAIResponsesRawModelStreamEvent,
  tool,
  user,
  type RunStreamEvent,
} from "@openai/agents";
import {
  createKsuMcpRegistry,
  createKsuToolDefinitions,
  type CallKsuEndpoint,
} from "./mcp/ksu-mcp.js";
import { createLogger } from "../shared/logger.js";
import {
  ASSISTANT_STREAM_CHUNK_CHANNEL,
  ASSISTANT_STREAM_STATUS_CHANNEL,
  ASSISTANT_STREAM_TOOL_CHANNEL,
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

type AssistantRuntimeContext = {
  conversationId: string;
  token: string;
};

type AssistantStreamStatus =
  | "submitted"
  | "thinking"
  | "streaming"
  | "completed"
  | "aborted"
  | "error";

type AssistantToolState = "running" | "success" | "error";

type AssistantToolPayload = {
  streamId: string;
  toolCallId: string;
  name: string;
  state: AssistantToolState;
  output?: string;
};

const logger = createLogger("assistant:runtime");
const activeAssistantRuns = new Map<string, AbortController>();

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

function emitStatus(
  event: IpcMainInvokeEvent,
  streamId: string,
  status: AssistantStreamStatus,
): void {
  logger.debug("stream status", { streamId, status });
  event.sender.send(ASSISTANT_STREAM_STATUS_CHANNEL, { streamId, status });
}

function emitTool(event: IpcMainInvokeEvent, payload: AssistantToolPayload): void {
  logger.debug("stream tool", payload);
  event.sender.send(ASSISTANT_STREAM_TOOL_CHANNEL, payload);
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

function normalizeTextDelta(delta: unknown): string {
  if (typeof delta === "string") return delta;
  if (delta instanceof Uint8Array) {
    return new TextDecoder().decode(delta);
  }
  if (Array.isArray(delta) && delta.every((item) => typeof item === "number")) {
    return new TextDecoder().decode(Uint8Array.from(delta));
  }
  return String(delta || "");
}

function summarizeToolOutput(output: unknown): string | undefined {
  if (typeof output === "string") {
    return output.slice(0, 120);
  }
  if (output && typeof output === "object") {
    try {
      return JSON.stringify(output).slice(0, 120);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function getToolCallInfo(item: unknown): { toolCallId: string; name: string } | null {
  if (!item || typeof item !== "object") return null;
  const rawItem =
    "rawItem" in item ? (item as { rawItem?: Record<string, unknown> }).rawItem : null;
  const record =
    rawItem && typeof rawItem === "object" ? rawItem : (item as Record<string, unknown>);
  const toolCallId = String(record.callId || "");
  const name = String(record.name || "");
  if (!toolCallId || !name) return null;
  return { toolCallId, name };
}

function getToolOutput(item: unknown): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  if ("output" in item) {
    return summarizeToolOutput((item as { output?: unknown }).output);
  }
  const rawItem =
    "rawItem" in item ? (item as { rawItem?: Record<string, unknown> }).rawItem : null;
  if (rawItem && typeof rawItem === "object" && "output" in rawItem) {
    return summarizeToolOutput(rawItem.output);
  }
  return undefined;
}

function extractTextDeltaFromEvent(event: RunStreamEvent): string {
  if (isOpenAIResponsesRawModelStreamEvent(event)) {
    const providerEvent = event.data?.event as { type?: string; delta?: unknown } | undefined;
    if (providerEvent?.type === "response.output_text.delta") {
      return normalizeTextDelta(providerEvent.delta);
    }
  }

  if (event.type !== "raw_model_stream_event") return "";

  const rawEvent = event.data as
    | { type?: string; delta?: unknown }
    | { event?: { type?: string; delta?: unknown } };

  if ("type" in rawEvent && rawEvent.type === "output_text_delta") {
    return normalizeTextDelta(rawEvent.delta);
  }

  if ("event" in rawEvent && rawEvent.event?.type === "response.output_text.delta") {
    return normalizeTextDelta(rawEvent.event.delta);
  }

  return "";
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
    "默认使用简短自然语言或短项目符号，不要输出 Markdown 表格。",
    "不要重复字段名、标签、数值或同一句话。",
    "对于成绩数据，优先先给结论，再按学期或课程简要补充，不要照抄原始结构。",
    "如果信息很多，先总结最重要的 3 到 5 点。",
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

function buildConversationInput(
  rows: Array<{ role: "user" | "assistant"; content: string }>,
  message: string,
) {
  return [
    ...rows.map((item) =>
      item.role === "assistant" ? assistant(item.content) : user(item.content),
    ),
    user(message),
  ];
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
  const abortController = new AbortController();
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
    activeAssistantRuns.set(streamId, abortController);
    try {
      emitStatus(event, streamId, "submitted");
      const settings = store.getSettings();
      const { apiKey, model, baseURL } = resolveOpenAIConfig(payload, settings);
      const provider = new OpenAIProvider({
        apiKey,
        baseURL,
        useResponses: true,
      });
      const runner = new Runner({
        modelProvider: provider,
        tracingDisabled: true,
      });
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
      const assistantAgent = new Agent<AssistantRuntimeContext>({
        name: "Ksu-App Assistant",
        instructions: systemPrompt,
        model,
        tools: toolDefinitions.map((definition) =>
          tool({
            name: definition.name,
            description: definition.description,
            parameters: definition.input,
            execute: async (args) => registry.callTool(definition.name, args, { token }),
          }),
        ),
      });
      const stream = await runner.run(
        assistantAgent,
        buildConversationInput(modelMessages, message),
        {
          stream: true,
          signal: abortController.signal,
          context: {
            conversationId,
            token,
          },
        },
      );
      let aggregated = "";
      let lastTextDelta = "";

      emitStatus(event, streamId, "thinking");

      for await (const streamEvent of stream) {
        const textDelta = extractTextDeltaFromEvent(streamEvent);
        if (textDelta) {
          if (textDelta === lastTextDelta && textDelta.length >= 4) {
            logger.warn("duplicate text delta skipped", { streamId, textDelta });
            continue;
          }
          lastTextDelta = textDelta;
          aggregated += textDelta;
          store.updateMessage(assistantMessageId, aggregated);
          emitStatus(event, streamId, "streaming");
          emitChunk(event, streamId, textDelta);
        }

        if (streamEvent.type === "raw_model_stream_event") {
          continue;
        }

        if (streamEvent.type !== "run_item_stream_event") continue;
        if (streamEvent.name === "tool_called") {
          const info = getToolCallInfo(streamEvent.item);
          if (!info) continue;
          emitStatus(event, streamId, "thinking");
          emitTool(event, {
            streamId,
            toolCallId: info.toolCallId,
            name: info.name,
            state: "running",
          });
          continue;
        }

        if (streamEvent.name === "tool_output") {
          const info = getToolCallInfo(streamEvent.item);
          if (!info) continue;
          emitTool(event, {
            streamId,
            toolCallId: info.toolCallId,
            name: info.name,
            state: "success",
            output: getToolOutput(streamEvent.item),
          });
        }
      }

      await stream.completed;
      if (stream.error) {
        throw stream.error;
      }

      if (!aggregated && typeof stream.finalOutput === "string" && stream.finalOutput.trim()) {
        aggregated = stream.finalOutput.trim();
        store.updateMessage(assistantMessageId, aggregated);
        emitChunk(event, streamId, aggregated);
      }
      emitStatus(event, streamId, "completed");
      emitDone(event, streamId);
    } catch (error) {
      if (abortController.signal.aborted) {
        emitStatus(event, streamId, "aborted");
        emitDone(event, streamId);
        return;
      }
      emitStatus(event, streamId, "error");
      emitError(event, streamId, error);
    } finally {
      activeAssistantRuns.delete(streamId);
    }
  });

  return { streamId };
}

function abortAssistantStream(streamId: string): boolean {
  const controller = activeAssistantRuns.get(streamId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export { abortAssistantStream, runAssistantStream };
export type { AssistantStreamStatus, AssistantToolPayload };
