import type { PersistedDrafts } from "@/lib/assistant/types";

const ASSISTANT_DRAFTS_KEY = "assistant:drafts";
const ASSISTANT_ACTIVE_CONVERSATION_KEY = "assistant:active-conversation";
const DRAFT_SCOPE = "__draft__";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readDrafts(): PersistedDrafts {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(ASSISTANT_DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as PersistedDrafts) : {};
  } catch {
    return {};
  }
}

function writeDrafts(drafts: PersistedDrafts): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(ASSISTANT_DRAFTS_KEY, JSON.stringify(drafts));
}

function readDraft(scope: string | null): string {
  const drafts = readDrafts();
  return drafts[scope || DRAFT_SCOPE] || "";
}

function writeDraft(scope: string | null, value: string): void {
  const drafts = readDrafts();
  drafts[scope || DRAFT_SCOPE] = value;
  writeDrafts(drafts);
}

function clearDraft(scope: string | null): void {
  const drafts = readDrafts();
  delete drafts[scope || DRAFT_SCOPE];
  writeDrafts(drafts);
}

function readActiveConversationId(): string | null {
  return getStorage()?.getItem(ASSISTANT_ACTIVE_CONVERSATION_KEY) || null;
}

function writeActiveConversationId(conversationId: string | null): void {
  const storage = getStorage();
  if (!storage) return;
  if (!conversationId) {
    storage.removeItem(ASSISTANT_ACTIVE_CONVERSATION_KEY);
    return;
  }
  storage.setItem(ASSISTANT_ACTIVE_CONVERSATION_KEY, conversationId);
}

export { clearDraft, readActiveConversationId, readDraft, writeActiveConversationId, writeDraft };
