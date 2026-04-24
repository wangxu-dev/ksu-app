import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions/completions.js";
import { OpenRouter, callModel, fromChatMessages, tool } from "@openrouter/agent";
import type { Item } from "@openrouter/agent";
import type { ChatMessages as OpenRouterChatMessage } from "@openrouter/sdk/models";
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
  ASSISTANT_STREAM_REASONING_CHANNEL,
  ASSISTANT_STREAM_STATUS_CHANNEL,
  ASSISTANT_STREAM_TOOL_CHANNEL,
} from "./channels.js";
import type { IpcMainInvokeEvent } from "electron";
import type { AssistantProvider, AssistantSettings, AssistantStore } from "./store.js";

type AssistantRunPayload = {
  message?: string;
  token?: string;
  conversationId?: string;
};

type StreamResult = {
  streamId: string;
  assistantMessageId: string;
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

type ProviderConfig = {
  provider: AssistantProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

type RunDependencies = {
  event: IpcMainInvokeEvent;
  payload: AssistantRunPayload;
  store: AssistantStore;
  callKsuEndpoint: CallKsuEndpoint;
};

type DeepSeekToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type DeepSeekAssistantMessage = {
  role: "assistant";
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: DeepSeekToolCall[];
};

type DeepSeekMessage =
  | {
      role: "system" | "user";
      content: string;
    }
  | DeepSeekAssistantMessage
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
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

function emitChunk(
  event: IpcMainInvokeEvent,
  streamId: string,
  delta: string,
  text?: string,
): void {
  event.sender.send(ASSISTANT_STREAM_CHUNK_CHANNEL, { streamId, delta, text });
}

function emitStatus(
  event: IpcMainInvokeEvent,
  streamId: string,
  status: AssistantStreamStatus,
): void {
  event.sender.send(ASSISTANT_STREAM_STATUS_CHANNEL, { streamId, status });
}

function emitReasoning(
  event: IpcMainInvokeEvent,
  streamId: string,
  delta: string,
  text: string,
): void {
  event.sender.send(ASSISTANT_STREAM_REASONING_CHANNEL, { streamId, delta, text });
}

function emitTool(event: IpcMainInvokeEvent, payload: AssistantToolPayload): void {
  event.sender.send(ASSISTANT_STREAM_TOOL_CHANNEL, payload);
}

function emitDone(event: IpcMainInvokeEvent, streamId: string): void {
  logger.info("stream done", { streamId });
  event.sender.send(ASSISTANT_STREAM_DONE_CHANNEL, { streamId });
}

function emitError(event: IpcMainInvokeEvent, streamId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("stream error", { streamId, error: message });
  event.sender.send(ASSISTANT_STREAM_ERROR_CHANNEL, {
    streamId,
    error: message || "assistant failed",
  });
}

function summarizeToolOutput(output: unknown): string | undefined {
  if (typeof output === "string") return output.slice(0, 200);
  if (output && typeof output === "object") {
    try {
      return JSON.stringify(output).slice(0, 200);
    } catch {
      return undefined;
    }
  }
  if (output === null || output === undefined) return undefined;
  return String(output).slice(0, 200);
}

function currentDateText(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}年${m}月${d}日`;
}

function buildSystemPrompt(customPrompt: string): string {
  const parts = [
    "你是喀什大学 Ksu-App 内置助手。",
    "你只能通过已注册工具访问校内数据。",
    "回答要简洁、准确、可执行。",
    "默认使用简短自然语言或短项目符号，不要输出 Markdown 表格。",
    "对于成绩数据，优先先给结论，再按学期或课程简要补充，不要照抄原始结构。",
    "如果信息很多，先总结最重要的 3 到 5 点。",
    "如果工具返回为空或失败，明确说明并建议用户重试。",
    `当前日期：${currentDateText()}`,
  ];
  const extraPrompt = String(customPrompt || "").trim();
  if (extraPrompt) parts.push(extraPrompt);
  return parts.join("\n");
}

function toDeepSeekChatHistory(
  store: AssistantStore,
  conversationId: string,
  assistantMessageId: string,
  systemPrompt: string,
): ChatCompletionMessageParam[] {
  const history = store
    .getMessages(conversationId)
    .filter((item) => item.id !== assistantMessageId)
    .map(
      (item) =>
        ({
          role: item.role,
          content: item.content,
        }) satisfies ChatCompletionMessageParam,
    );

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...history,
  ];
}

function toOpenRouterChatHistory(
  store: AssistantStore,
  conversationId: string,
  assistantMessageId: string,
  systemPrompt: string,
): OpenRouterChatMessage[] {
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...store
      .getMessages(conversationId)
      .filter((item) => item.id !== assistantMessageId)
      .map(
        (item) =>
          ({
            role: item.role,
            content: item.content,
          }) satisfies OpenRouterChatMessage,
      ),
  ];
}

function resolveProviderConfig(
  settings: AssistantSettings,
  provider: AssistantProvider,
): ProviderConfig {
  if (provider === "deepseek") {
    return {
      provider,
      apiKey: settings.deepseekApiKey,
      baseUrl: settings.deepseekBaseUrl,
      model: settings.deepseekModel,
    };
  }

  return {
    provider,
    apiKey: settings.openrouterApiKey,
    baseUrl: settings.openrouterBaseUrl,
    model: settings.openrouterModel,
  };
}

function resolveRunContext(store: AssistantStore, payload: AssistantRunPayload) {
  const conversationId = String(payload.conversationId || "").trim();
  const token = String(payload.token || "").trim();
  const message = String(payload.message || "").trim();

  if (!conversationId) throw new Error("conversationId is required");
  if (!token) throw new Error("token is required");
  if (!message) throw new Error("message is required");

  const conversation = store.getConversation(conversationId);
  if (!conversation) throw new Error("conversation not found");

  const settings = store.getSettings();
  const providerConfig = resolveProviderConfig(settings, conversation.provider);
  if (!providerConfig.apiKey.trim()) {
    throw new Error(`${conversation.provider} api key is required`);
  }
  if (!providerConfig.baseUrl.trim()) {
    throw new Error(`${conversation.provider} base url is required`);
  }
  if (!providerConfig.model.trim()) {
    throw new Error(`${conversation.provider} model is required`);
  }

  return {
    conversation,
    conversationId,
    message,
    providerConfig,
    settings,
    token,
  };
}

function publishText(
  store: AssistantStore,
  assistantMessageId: string,
  nextText: string,
  onPublish: (delta: string, text: string) => void,
  currentText: string,
): string {
  if (nextText === currentText) return currentText;
  const delta = nextText.startsWith(currentText) ? nextText.slice(currentText.length) : nextText;
  store.updateMessage(assistantMessageId, nextText);
  onPublish(delta, nextText);
  return nextText;
}

function createToolRuntime(args: {
  assistantMessageId: string;
  callKsuEndpoint: CallKsuEndpoint;
  conversationId: string;
  event: IpcMainInvokeEvent;
  store: AssistantStore;
  streamId: string;
  token: string;
}) {
  const cache = createAssistantToolCacheAdapter(args.store);
  const registry = createKsuMcpRegistry({
    callKsuEndpoint: args.callKsuEndpoint,
    cache,
  });
  const definitions = createKsuToolDefinitions({
    callKsuEndpoint: args.callKsuEndpoint,
  });

  function executeTool(name: string, input: Record<string, unknown>) {
    const toolCallId = randomUUID();
    args.store.addTimelineEvent({
      id: toolCallId,
      conversationId: args.conversationId,
      assistantMessageId: args.assistantMessageId,
      type: "tool",
      toolCallId,
      name,
      state: "running",
    });
    emitTool(args.event, {
      streamId: args.streamId,
      toolCallId,
      name,
      state: "running",
    });

    return registry
      .callTool(name, input, { token: args.token })
      .then((output) => {
        args.store.updateTimelineEvent({
          id: toolCallId,
          state: "success",
          output: summarizeToolOutput(output) ?? null,
        });
        emitTool(args.event, {
          streamId: args.streamId,
          toolCallId,
          name,
          state: "success",
          output: summarizeToolOutput(output),
        });
        return output;
      })
      .catch((error) => {
        args.store.updateTimelineEvent({
          id: toolCallId,
          state: "error",
          output: summarizeToolOutput(error instanceof Error ? error.message : error) ?? null,
        });
        emitTool(args.event, {
          streamId: args.streamId,
          toolCallId,
          name,
          state: "error",
          output: summarizeToolOutput(error instanceof Error ? error.message : error),
        });
        throw error;
      });
  }

  const openRouterTools = definitions.map((definition) =>
    tool({
      name: definition.name,
      description: definition.description,
      inputSchema: definition.input,
      execute: async (input) => executeTool(definition.name, input),
    }),
  );

  return {
    deepSeekDefinitions: definitions,
    executeTool,
    openRouterTools,
  };
}

function extractDeepSeekErrorText(errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: { message?: string };
      message?: string;
    };
    return String(parsed.error?.message || parsed.message || errorText);
  } catch {
    return errorText;
  }
}

async function runOpenRouterStream(args: {
  abortController: AbortController;
  assistantMessageId: string;
  callKsuEndpoint: CallKsuEndpoint;
  config: ProviderConfig;
  conversationId: string;
  event: IpcMainInvokeEvent;
  settings: AssistantSettings;
  store: AssistantStore;
  streamId: string;
  token: string;
}) {
  const client = new OpenRouter({
    apiKey: args.config.apiKey,
    serverURL: args.config.baseUrl,
  });
  const toolRuntime = createToolRuntime({
    assistantMessageId: args.assistantMessageId,
    callKsuEndpoint: args.callKsuEndpoint,
    conversationId: args.conversationId,
    event: args.event,
    store: args.store,
    streamId: args.streamId,
    token: args.token,
  });
  const chatMessages = toOpenRouterChatHistory(
    args.store,
    args.conversationId,
    args.assistantMessageId,
    buildSystemPrompt(args.settings.systemPrompt),
  );

  logger.warn("assistant run start", {
    streamId: args.streamId,
    conversationId: args.conversationId,
    provider: args.config.provider,
    model: args.config.model,
    baseURL: args.config.baseUrl,
    historyCount: Math.max(chatMessages.length - 2, 0),
    messageLength: String(chatMessages.at(-1)?.content || "").length,
  });

  const result = callModel(
    client,
    {
      model: args.config.model,
      input: fromChatMessages(chatMessages) as Item[],
      tools: toolRuntime.openRouterTools,
    },
    {
      signal: args.abortController.signal,
    },
  );

  let publishedText = "";
  let reasoningText = "";
  let reasoningEventId: string | null = null;
  emitStatus(args.event, args.streamId, "thinking");
  const reasoningTask = (async () => {
    for await (const delta of result.getReasoningStream()) {
      if (!delta) continue;
      reasoningText += delta;
      if (!reasoningEventId) {
        reasoningEventId = args.store.addTimelineEvent({
          conversationId: args.conversationId,
          assistantMessageId: args.assistantMessageId,
          type: "reasoning",
          text: reasoningText,
        });
      } else {
        args.store.updateTimelineEvent({
          id: reasoningEventId,
          text: reasoningText,
        });
      }
      emitReasoning(args.event, args.streamId, delta, reasoningText);
    }
  })();
  for await (const delta of result.getTextStream()) {
    if (!delta) continue;
    if (publishedText.length === 0) {
      emitStatus(args.event, args.streamId, "streaming");
    }
    publishedText = publishText(
      args.store,
      args.assistantMessageId,
      publishedText + delta,
      (nextDelta, text) => emitChunk(args.event, args.streamId, nextDelta, text),
      publishedText,
    );
  }

  const finalText = await result.getText();
  await reasoningTask;
  if (finalText) {
    publishedText = publishText(
      args.store,
      args.assistantMessageId,
      finalText,
      (delta, text) => emitChunk(args.event, args.streamId, delta, text),
      publishedText,
    );
  }

  logger.warn("assistant run summary", {
    streamId: args.streamId,
    provider: args.config.provider,
    finalTextLength: publishedText.length,
  });
}

async function runDeepSeekStream(args: {
  abortController: AbortController;
  assistantMessageId: string;
  callKsuEndpoint: CallKsuEndpoint;
  config: ProviderConfig;
  conversationId: string;
  event: IpcMainInvokeEvent;
  settings: AssistantSettings;
  store: AssistantStore;
  streamId: string;
  token: string;
}) {
  const client = new OpenAI({
    apiKey: args.config.apiKey,
    baseURL: args.config.baseUrl,
  });
  const toolRuntime = createToolRuntime({
    assistantMessageId: args.assistantMessageId,
    callKsuEndpoint: args.callKsuEndpoint,
    conversationId: args.conversationId,
    event: args.event,
    store: args.store,
    streamId: args.streamId,
    token: args.token,
  });
  const chatMessages = toDeepSeekChatHistory(
    args.store,
    args.conversationId,
    args.assistantMessageId,
    buildSystemPrompt(args.settings.systemPrompt),
  );

  logger.warn("assistant run start", {
    streamId: args.streamId,
    conversationId: args.conversationId,
    provider: args.config.provider,
    model: args.config.model,
    baseURL: args.config.baseUrl,
    historyCount: Math.max(chatMessages.length - 2, 0),
    messageLength: String(chatMessages.at(-1)?.content || "").length,
  });

  const messages: DeepSeekMessage[] = chatMessages.map((message) => ({
    role: message.role as "system" | "user",
    content: String(message.content || ""),
  }));
  const tools = toolRuntime.deepSeekDefinitions.map((definition) => ({
    type: "function" as const,
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.inputSchema,
    },
  }));
  let publishedText = "";
  emitStatus(args.event, args.streamId, "thinking");
  for (let turn = 0; turn < 6; turn += 1) {
    if (args.abortController.signal.aborted) {
      throw new Error("aborted");
    }
    logger.warn("deepseek turn request", {
      streamId: args.streamId,
      turn,
      messageCount: messages.length,
      lastMessageRole: messages.at(-1)?.role,
    });
    let finishReason = "";
    let reasoningText = "";
    let contentText = "";
    const toolCallMap = new Map<
      number,
      { id: string; type: "function"; function: { name: string; arguments: string } }
    >();
    try {
      const stream = (await client.chat.completions.create(
        {
          model: args.config.model,
          messages: messages as ChatCompletionMessageParam[],
          tools,
          stream: true,
        } as never,
        {
          signal: args.abortController.signal,
        },
      )) as unknown as AsyncIterable<{
        choices?: Array<{
          finish_reason?: string | null;
          delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              type?: "function";
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
      }>;
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        finishReason = choice.finish_reason || finishReason;
        const delta = (choice.delta || {}) as {
          content?: string | null;
          reasoning_content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: "function";
            function?: { name?: string; arguments?: string };
          }>;
        };
        if (delta.reasoning_content) {
          reasoningText += delta.reasoning_content;
          emitReasoning(args.event, args.streamId, delta.reasoning_content, reasoningText);
        }
        if (delta.content) {
          contentText += delta.content;
          emitStatus(args.event, args.streamId, "streaming");
          publishedText = publishText(
            args.store,
            args.assistantMessageId,
            contentText,
            (nextDelta, text) => emitChunk(args.event, args.streamId, nextDelta, text),
            publishedText,
          );
        }
        for (const partialToolCall of delta.tool_calls || []) {
          const index = partialToolCall.index ?? 0;
          const current = toolCallMap.get(index) || {
            id: partialToolCall.id || randomUUID(),
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (partialToolCall.id) current.id = partialToolCall.id;
          if (partialToolCall.function?.name) current.function.name = partialToolCall.function.name;
          if (partialToolCall.function?.arguments) {
            current.function.arguments += partialToolCall.function.arguments;
          }
          toolCallMap.set(index, current);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("deepseek turn request failed", {
        streamId: args.streamId,
        turn,
        error: extractDeepSeekErrorText(message),
        lastAssistantHasReasoning:
          messages
            .slice()
            .reverse()
            .find((message): message is DeepSeekAssistantMessage => message.role === "assistant")
            ?.reasoning_content?.length || 0,
      });
      throw error;
    }
    const assistantMessage: DeepSeekAssistantMessage = {
      role: "assistant",
      content: contentText || null,
      reasoning_content: reasoningText || null,
      tool_calls: [...toolCallMap.values()],
    };
    logger.warn("deepseek turn response", {
      streamId: args.streamId,
      turn,
      finishReason,
      hasReasoning: Boolean(assistantMessage.reasoning_content),
      reasoningLength: assistantMessage.reasoning_content?.length || 0,
      toolCallCount: assistantMessage.tool_calls?.length || 0,
      contentLength: assistantMessage.content?.length || 0,
    });

    if (assistantMessage.reasoning_content && reasoningText) {
      args.store.addTimelineEvent({
        conversationId: args.conversationId,
        assistantMessageId: args.assistantMessageId,
        type: "reasoning",
        text: assistantMessage.reasoning_content,
      });
    }

    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls || [];
    if (toolCalls.length === 0) {
      const finalText = String(assistantMessage.content || "");
      if (finalText) {
        emitStatus(args.event, args.streamId, "streaming");
        publishedText = publishText(
          args.store,
          args.assistantMessageId,
          finalText,
          (delta, text) => emitChunk(args.event, args.streamId, delta, text),
          publishedText,
        );
      }
      logger.warn("assistant run summary", {
        streamId: args.streamId,
        provider: args.config.provider,
        finalTextLength: publishedText.length,
      });
      return;
    }

    for (const toolCall of toolCalls) {
      const parsedArgs = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
      const output = await toolRuntime.executeTool(toolCall.function.name, parsedArgs);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(output),
      });
    }
  }
  throw new Error("Max turns (6) exceeded");
}

function runAssistantStream({
  event,
  payload,
  store,
  callKsuEndpoint,
}: RunDependencies): StreamResult {
  const streamId = randomUUID();
  const abortController = new AbortController();
  activeAssistantRuns.set(streamId, abortController);

  const { conversationId, message, providerConfig, settings, token } = resolveRunContext(
    store,
    payload,
  );
  store.addMessage(conversationId, "user", message);
  const assistantMessageId = store.addMessage(conversationId, "assistant", "");
  emitStatus(event, streamId, "submitted");

  void (async () => {
    try {
      if (providerConfig.provider === "openrouter") {
        await runOpenRouterStream({
          abortController,
          assistantMessageId,
          callKsuEndpoint,
          config: providerConfig,
          conversationId,
          event,
          settings,
          store,
          streamId,
          token,
        });
      } else {
        await runDeepSeekStream({
          abortController,
          assistantMessageId,
          callKsuEndpoint,
          config: providerConfig,
          conversationId,
          event,
          settings,
          store,
          streamId,
          token,
        });
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
  })();

  return { streamId, assistantMessageId };
}

function abortAssistantStream(streamId: string): boolean {
  const controller = activeAssistantRuns.get(streamId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export { abortAssistantStream, runAssistantStream };
export type { AssistantStreamStatus, AssistantToolPayload };
