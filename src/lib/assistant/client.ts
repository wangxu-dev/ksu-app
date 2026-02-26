import { ipcInvoke, ipcOn } from "@/lib/ipc";
import {
  ASSISTANT_MCP_CALL_TOOL_CHANNEL,
  ASSISTANT_MCP_LIST_TOOLS_CHANNEL,
  ASSISTANT_CONVERSATION_CREATE_CHANNEL,
  ASSISTANT_CONVERSATION_LIST_CHANNEL,
  ASSISTANT_CONVERSATION_MESSAGES_CHANNEL,
  ASSISTANT_CONVERSATION_REPLACE_MESSAGES_CHANNEL,
  ASSISTANT_SETTINGS_GET_CHANNEL,
  ASSISTANT_SETTINGS_SET_CHANNEL,
  ASSISTANT_STREAM_CHUNK_CHANNEL,
  ASSISTANT_STREAM_DONE_CHANNEL,
  ASSISTANT_STREAM_ERROR_CHANNEL,
  ASSISTANT_STREAM_START_CHANNEL,
} from "@/lib/assistant/channels";

type StartPayload = {
  message: string;
  token: string;
  conversationId: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

type StartResponse = { streamId: string };

export async function startAssistantStream(payload: StartPayload): Promise<StartResponse> {
  return ipcInvoke<StartResponse>(ASSISTANT_STREAM_START_CHANNEL, payload);
}

export type AssistantConversation = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  preview?: string;
};

export type AssistantMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
};

export type AssistantSettings = {
  apiKey: string;
  model: string;
  baseUrl: string;
  systemPrompt: string;
};

export function listConversations(): Promise<AssistantConversation[]> {
  return ipcInvoke<AssistantConversation[]>(ASSISTANT_CONVERSATION_LIST_CHANNEL);
}

export function createConversation(title?: string): Promise<AssistantConversation> {
  return ipcInvoke<AssistantConversation>(ASSISTANT_CONVERSATION_CREATE_CHANNEL, { title });
}

export function getConversationMessages(conversationId: string): Promise<AssistantMessage[]> {
  return ipcInvoke<AssistantMessage[]>(ASSISTANT_CONVERSATION_MESSAGES_CHANNEL, { conversationId });
}

export function replaceConversationMessages(
  conversationId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ ok: boolean }> {
  return ipcInvoke<{ ok: boolean }>(ASSISTANT_CONVERSATION_REPLACE_MESSAGES_CHANNEL, {
    conversationId,
    messages,
  });
}

export function getAssistantSettings(): Promise<AssistantSettings> {
  return ipcInvoke<AssistantSettings>(ASSISTANT_SETTINGS_GET_CHANNEL);
}

export function setAssistantSettings(
  settings: Partial<AssistantSettings>,
): Promise<AssistantSettings> {
  return ipcInvoke<AssistantSettings>(ASSISTANT_SETTINGS_SET_CHANNEL, settings);
}

export type McpToolInfo = {
  name: string;
  description?: string;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function listMcpTools(): Promise<McpToolInfo[]> {
  console.debug("[assistant:mcp] list tools start");
  return withTimeout(ipcInvoke<McpToolInfo[]>(ASSISTANT_MCP_LIST_TOOLS_CHANNEL), 15_000, "mcp list")
    .then((tools) => {
      console.debug("[assistant:mcp] list tools success", { count: tools.length });
      return tools;
    })
    .catch((error) => {
      console.error("[assistant:mcp] list tools failed", error);
      throw error;
    });
}

export function callMcpTool<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  const safeArgs = args || {};
  console.debug("[assistant:mcp] call start", { name, keys: Object.keys(safeArgs) });
  return withTimeout(
    ipcInvoke<T>(ASSISTANT_MCP_CALL_TOOL_CHANNEL, { name, args: safeArgs }),
    20_000,
    `mcp ${name}`,
  )
    .then((output) => {
      console.debug("[assistant:mcp] call success", { name });
      return output;
    })
    .catch((error) => {
      console.error("[assistant:mcp] call failed", { name, error });
      throw error;
    });
}

export function onAssistantChunk(
  listener: (payload: { streamId: string; delta: string }) => void,
): () => void {
  return ipcOn(ASSISTANT_STREAM_CHUNK_CHANNEL, (payload) =>
    listener(payload as { streamId: string; delta: string }),
  );
}

export function onAssistantDone(listener: (payload: { streamId: string }) => void): () => void {
  return ipcOn(ASSISTANT_STREAM_DONE_CHANNEL, (payload) =>
    listener(payload as { streamId: string }),
  );
}

export function onAssistantError(
  listener: (payload: { streamId: string; error: string }) => void,
): () => void {
  return ipcOn(ASSISTANT_STREAM_ERROR_CHANNEL, (payload) =>
    listener(payload as { streamId: string; error: string }),
  );
}
