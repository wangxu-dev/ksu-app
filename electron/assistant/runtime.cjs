const { randomUUID } = require("node:crypto");
const { buildKsuMcpTools } = require("./ksu-mcp.cjs");
const {
  ASSISTANT_STREAM_CHUNK_CHANNEL,
  ASSISTANT_STREAM_DONE_CHANNEL,
  ASSISTANT_STREAM_ERROR_CHANNEL,
} = require("./channels.cjs");

function emitChunk(event, streamId, delta) {
  event.sender.send(ASSISTANT_STREAM_CHUNK_CHANNEL, { streamId, delta });
}

function emitDone(event, streamId) {
  event.sender.send(ASSISTANT_STREAM_DONE_CHANNEL, { streamId });
}

function emitError(event, streamId, error) {
  event.sender.send(ASSISTANT_STREAM_ERROR_CHANNEL, {
    streamId,
    error: error instanceof Error ? error.message : "assistant failed",
  });
}

function currentDateText() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}年${m}月${d}日`;
}

function buildSystemPrompt() {
  return [
    "你是 Ksu-App 内置助手。",
    "你只能通过 ksu_mcp 工具访问学校数据。",
    "回答要简洁、准确、可执行。",
    `当前日期：${currentDateText()}`,
    "如果工具返回为空或失败，明确说明并建议用户重试。",
  ].join("\n");
}

function resolveOpenAIConfig(payload, settings) {
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

async function runAssistantStream({ event, payload, callKsuEndpoint, store }) {
  const streamId = randomUUID();
  const message = String(payload?.message || "").trim();
  const token = String(payload?.token || "").trim();
  const conversationId = String(payload?.conversationId || "");

  if (!message) {
    emitError(event, streamId, new Error("message is required"));
    return { streamId };
  }
  if (!token) {
    emitError(event, streamId, new Error("token is required"));
    return { streamId };
  }
  if (!conversationId) {
    emitError(event, streamId, new Error("conversationId is required"));
    return { streamId };
  }

  queueMicrotask(async () => {
    try {
      const settings = store.getSettings();
      const { apiKey, model, baseURL } = resolveOpenAIConfig(payload, settings);
      const { streamText, tool } = await import("ai");
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { z } = await import("zod");

      const openai = createOpenAI({ apiKey, baseURL });
      const ksu = buildKsuMcpTools({ callKsuEndpoint, token });
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

      const result = streamText({
        model: openai.chat(model),
        system: systemPrompt,
        messages: [...modelMessages, { role: "user", content: message }],
        tools: {
          get_user_info: tool({
            description: "获取当前用户基础信息",
            inputSchema: z.object({}),
            execute: async () => ksu.get_user_info(),
          }),
          get_personal_info: tool({
            description: "获取个人概览信息（校园卡、课程数等）",
            inputSchema: z.object({}),
            execute: async () => ksu.get_personal_info(),
          }),
          get_grades: tool({
            description: "获取成绩数据",
            inputSchema: z.object({}),
            execute: async () => ksu.get_grades(),
          }),
          get_calendar: tool({
            description: "获取某个月校历，格式如 2026年02月",
            inputSchema: z.object({
              yearMonth: z.string(),
            }),
            execute: async ({ yearMonth }) => ksu.get_calendar({ yearMonth }),
          }),
          get_current_time: tool({
            description: "获取当前本机时间",
            inputSchema: z.object({}),
            execute: async () => ksu.get_current_time(),
          }),
        },
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

module.exports = {
  runAssistantStream,
};
