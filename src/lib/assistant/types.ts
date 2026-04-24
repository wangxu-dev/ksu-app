import type {
  AssistantConversation,
  AssistantMessage,
  AssistantSettings,
  AssistantStreamStatus,
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
};

type PersistedDrafts = Record<string, string>;

function toChatMessages(rows: AssistantMessage[]): ChatMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
  }));
}

export { toChatMessages };
export type {
  AssistantConversation,
  AssistantSettings,
  AssistantViewStatus,
  ChatMessage,
  PersistedDrafts,
  ToolActivity,
};
