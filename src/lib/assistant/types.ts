import type {
  AssistantConversation,
  AssistantMessage,
  AssistantSettings,
  AssistantStreamStatus,
  AssistantTimelineEvent,
} from "@/lib/assistant/client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AssistantViewStatus = AssistantStreamStatus | "idle";

type ToolActivity = {
  toolCallId: string;
  name: string;
  label: string;
  state: "running" | "success" | "error";
  output?: string;
  createdAt?: number;
  updatedAt?: number;
};

type ReasoningActivity = {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
};

type AssistantPreResponseEvent =
  | {
      id: string;
      type: "reasoning";
      createdAt: number;
      updatedAt: number;
      text: string;
    }
  | {
      id: string;
      type: "tool";
      createdAt: number;
      updatedAt: number;
      toolCallId: string;
      name: string;
      label: string;
      state: "running" | "success" | "error";
      output?: string;
    };

type PersistedDrafts = Record<string, string>;

function toChatMessages(rows: AssistantMessage[]): ChatMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
  }));
}

function toTimelineEventMap(
  rows: AssistantTimelineEvent[],
): Record<string, AssistantPreResponseEvent[]> {
  return rows.reduce<Record<string, AssistantPreResponseEvent[]>>((acc, row) => {
    const assistantMessageId = row.assistant_message_id;
    if (!assistantMessageId) return acc;
    const nextEvent: AssistantPreResponseEvent =
      row.type === "reasoning"
        ? {
            id: row.id,
            type: "reasoning",
            text: row.text,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }
        : {
            id: row.id,
            type: "tool",
            toolCallId: row.tool_call_id || row.id,
            name: row.name || "",
            label: row.name || "",
            state:
              row.state === "error" ? "error" : row.state === "success" ? "success" : "running",
            output: row.output || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
    const list = acc[assistantMessageId] || [];
    acc[assistantMessageId] = [...list, nextEvent];
    return acc;
  }, {});
}

export { toChatMessages, toTimelineEventMap };
export type {
  AssistantConversation,
  AssistantSettings,
  AssistantViewStatus,
  ChatMessage,
  AssistantPreResponseEvent,
  PersistedDrafts,
  ReasoningActivity,
  ToolActivity,
};
