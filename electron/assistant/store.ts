import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createLogger } from "../shared/logger.js";

type AssistantRole = "user" | "assistant";
type AssistantProvider = "openrouter" | "deepseek";

type ConversationRecord = {
  id: string;
  title: string;
  provider: AssistantProvider;
  created_at: number;
  updated_at: number;
};

type ConversationListRow = ConversationRecord & {
  last_message: string | null;
};

type ConversationListItem = ConversationRecord & {
  preview: string;
};

type MessageRecord = {
  id: string;
  conversation_id: string;
  role: AssistantRole;
  content: string;
  created_at: number;
};

type TimelineEventType = "reasoning" | "tool";

type TimelineEventRecord = {
  id: string;
  conversation_id: string;
  assistant_message_id: string;
  type: TimelineEventType;
  tool_call_id: string | null;
  name: string | null;
  state: string | null;
  text: string;
  output: string | null;
  created_at: number;
  updated_at: number;
};

type AssistantSettings = {
  activeProvider: AssistantProvider;
  openrouterApiKey: string;
  openrouterBaseUrl: string;
  openrouterModel: string;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  systemPrompt: string;
};

type SettingsPatch = Partial<Record<keyof AssistantSettings, string>>;

type ReplaceMessageItem = {
  role: AssistantRole;
  content: string;
};

type ToolCacheRecord = {
  cache_key: string;
  scope: string;
  value: string;
  expires_at: number;
  updated_at: number;
};

type AssistantStore = {
  getSettings: () => AssistantSettings;
  setSettings: (patch: SettingsPatch) => AssistantSettings;
  createConversation: (
    title?: string,
    provider?: AssistantProvider,
  ) => ConversationRecord | undefined;
  getConversation: (conversationId: string) => ConversationRecord | undefined;
  deleteConversation: (conversationId: string) => { ok: boolean };
  listConversations: () => ConversationListItem[];
  getMessages: (conversationId: string) => MessageRecord[];
  addMessage: (conversationId: string, role: AssistantRole, content: string) => string;
  updateMessage: (id: string, content: string) => void;
  replaceMessages: (conversationId: string, messages: ReplaceMessageItem[]) => void;
  listTimelineEvents: (conversationId: string) => TimelineEventRecord[];
  addTimelineEvent: (input: {
    id?: string;
    conversationId: string;
    assistantMessageId: string;
    type: TimelineEventType;
    toolCallId?: string | null;
    name?: string | null;
    state?: string | null;
    text?: string;
    output?: string | null;
    createdAt?: number;
    updatedAt?: number;
  }) => string;
  updateTimelineEvent: (input: {
    id: string;
    text?: string;
    state?: string | null;
    output?: string | null;
    updatedAt?: number;
  }) => void;
  clearTimelineEvents: (conversationId: string) => void;
  getToolCache: (cacheKey: string, nowTs?: number) => ToolCacheRecord | null;
  setToolCache: (input: {
    cacheKey: string;
    scope: "memory" | "storage";
    value: string;
    expiresAt: number;
    updatedAt?: number;
  }) => void;
  deleteToolCache: (cacheKey: string) => void;
};

const DEFAULT_SETTINGS: AssistantSettings = {
  activeProvider: "deepseek",
  openrouterApiKey: "",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
  openrouterModel: "openrouter/free",
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  systemPrompt: "",
};

function now(): number {
  return Date.now();
}

function createAssistantStore(userDataDir: string): AssistantStore {
  const logger = createLogger("assistant:store");
  const dir = path.join(userDataDir, "assistant");
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "assistant.sqlite");
  const db = new DatabaseSync(dbPath);
  logger.info("open sqlite store", { dbPath });

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'openrouter',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      assistant_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      tool_call_id TEXT,
      name TEXT,
      state TEXT,
      text TEXT NOT NULL DEFAULT '',
      output TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tool_cache (
      cache_key TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const conversationColumns = db.prepare("PRAGMA table_info(conversations)").all() as Array<{
    name?: string;
  }>;
  const hasProviderColumn = conversationColumns.some((column) => column.name === "provider");
  if (!hasProviderColumn) {
    db.exec("ALTER TABLE conversations ADD COLUMN provider TEXT NOT NULL DEFAULT 'openrouter'");
  }

  const createConversationStmt = db.prepare(
    "INSERT INTO conversations (id, title, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  );
  const listConversationsStmt = db.prepare(`
    SELECT c.id, c.title, c.provider, c.created_at, c.updated_at,
           (
             SELECT m.content
             FROM messages m
             WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC
             LIMIT 1
           ) AS last_message
    FROM conversations c
    ORDER BY c.updated_at DESC
  `);
  const getConversationStmt = db.prepare(
    "SELECT id, title, provider, created_at, updated_at FROM conversations WHERE id = ?",
  );
  const touchConversationStmt = db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?");
  const deleteConversationStmt = db.prepare("DELETE FROM conversations WHERE id = ?");
  const addMessageStmt = db.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const updateMessageStmt = db.prepare("UPDATE messages SET content = ? WHERE id = ?");
  const listMessagesStmt = db.prepare(
    "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
  );
  const deleteMessagesStmt = db.prepare("DELETE FROM messages WHERE conversation_id = ?");
  const listTimelineEventsStmt = db.prepare(
    `SELECT id, conversation_id, assistant_message_id, type, tool_call_id, name, state, text, output, created_at, updated_at
     FROM timeline_events
     WHERE conversation_id = ?
     ORDER BY created_at ASC, updated_at ASC`,
  );
  const addTimelineEventStmt = db.prepare(`
    INSERT INTO timeline_events (
      id, conversation_id, assistant_message_id, type, tool_call_id, name, state, text, output, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateTimelineEventStmt = db.prepare(`
    UPDATE timeline_events
    SET text = ?, state = ?, output = ?, updated_at = ?
    WHERE id = ?
  `);
  const deleteTimelineEventsStmt = db.prepare(
    "DELETE FROM timeline_events WHERE conversation_id = ?",
  );
  const setSettingStmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `);
  const getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
  const getToolCacheStmt = db.prepare(`
    SELECT cache_key, scope, value, expires_at, updated_at
    FROM tool_cache
    WHERE cache_key = ?
  `);
  const setToolCacheStmt = db.prepare(`
    INSERT INTO tool_cache (cache_key, scope, value, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      scope=excluded.scope,
      value=excluded.value,
      expires_at=excluded.expires_at,
      updated_at=excluded.updated_at
  `);
  const deleteToolCacheStmt = db.prepare("DELETE FROM tool_cache WHERE cache_key = ?");
  const purgeExpiredToolCacheStmt = db.prepare("DELETE FROM tool_cache WHERE expires_at <= ?");

  function getSettings(): AssistantSettings {
    const out: AssistantSettings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AssistantSettings)[]) {
      const row = getSettingStmt.get(key) as { value?: string } | undefined;
      if (row && typeof row.value === "string") {
        if (key === "activeProvider") {
          out[key] = row.value === "deepseek" ? "deepseek" : "openrouter";
          continue;
        }
        out[key] = row.value;
      }
    }
    return out;
  }

  function setSettings(patch: SettingsPatch): AssistantSettings {
    for (const [key, value] of Object.entries(patch || {})) {
      if (!(key in DEFAULT_SETTINGS)) continue;
      if (key === "activeProvider") {
        const provider = value === "deepseek" ? "deepseek" : "openrouter";
        setSettingStmt.run(key, provider);
        continue;
      }
      setSettingStmt.run(key, String(value ?? ""));
    }
    return getSettings();
  }

  function createConversation(
    title?: string,
    provider: AssistantProvider = DEFAULT_SETTINGS.activeProvider,
  ): ConversationRecord | undefined {
    const id = randomUUID();
    const ts = now();
    const safeTitle = String(title || "新对话").slice(0, 60);
    const safeProvider: AssistantProvider = provider === "deepseek" ? "deepseek" : "openrouter";
    createConversationStmt.run(id, safeTitle, safeProvider, ts, ts);
    return getConversationStmt.get(id) as ConversationRecord | undefined;
  }

  function getConversation(conversationId: string): ConversationRecord | undefined {
    return getConversationStmt.get(String(conversationId || "")) as ConversationRecord | undefined;
  }

  function listConversations(): ConversationListItem[] {
    const rows = listConversationsStmt.all() as ConversationListRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      provider: row.provider,
      created_at: row.created_at,
      updated_at: row.updated_at,
      preview: row.last_message ? String(row.last_message).slice(0, 50) : "",
    }));
  }

  function deleteConversation(conversationId: string): { ok: boolean } {
    const id = String(conversationId || "");
    if (!id) return { ok: false };
    const info = deleteConversationStmt.run(id);
    return { ok: Number(info.changes || 0) > 0 };
  }

  function getMessages(conversationId: string): MessageRecord[] {
    return listMessagesStmt.all(conversationId) as MessageRecord[];
  }

  function addMessage(conversationId: string, role: AssistantRole, content: string): string {
    const id = randomUUID();
    const ts = now();
    addMessageStmt.run(id, conversationId, role, content, ts);
    touchConversationStmt.run(ts, conversationId);
    return id;
  }

  function updateMessage(id: string, content: string): void {
    updateMessageStmt.run(String(content || ""), id);
  }

  function replaceMessages(conversationId: string, messages: ReplaceMessageItem[]): void {
    const ts = now();
    const rows = Array.isArray(messages) ? messages : [];
    logger.debug("replace messages begin", { conversationId, count: rows.length });
    db.exec("BEGIN");
    try {
      deleteTimelineEventsStmt.run(conversationId);
      deleteMessagesStmt.run(conversationId);
      for (const item of rows) {
        if (!item || (item.role !== "user" && item.role !== "assistant")) continue;
        const text = String(item.content || "");
        addMessageStmt.run(randomUUID(), conversationId, item.role, text, now());
      }
      touchConversationStmt.run(ts, conversationId);
      db.exec("COMMIT");
      logger.debug("replace messages committed", { conversationId, count: rows.length });
    } catch (error) {
      db.exec("ROLLBACK");
      logger.error("replace messages failed", {
        conversationId,
        count: rows.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  function listTimelineEvents(conversationId: string): TimelineEventRecord[] {
    return listTimelineEventsStmt.all(conversationId) as TimelineEventRecord[];
  }

  function addTimelineEvent(input: {
    id?: string;
    conversationId: string;
    assistantMessageId: string;
    type: TimelineEventType;
    toolCallId?: string | null;
    name?: string | null;
    state?: string | null;
    text?: string;
    output?: string | null;
    createdAt?: number;
    updatedAt?: number;
  }): string {
    const id = input.id || randomUUID();
    const createdAt = input.createdAt ?? now();
    const updatedAt = input.updatedAt ?? createdAt;
    addTimelineEventStmt.run(
      id,
      input.conversationId,
      input.assistantMessageId,
      input.type,
      input.toolCallId ?? null,
      input.name ?? null,
      input.state ?? null,
      input.text ?? "",
      input.output ?? null,
      createdAt,
      updatedAt,
    );
    return id;
  }

  function updateTimelineEvent(input: {
    id: string;
    text?: string;
    state?: string | null;
    output?: string | null;
    updatedAt?: number;
  }): void {
    const current = db
      .prepare("SELECT text, state, output FROM timeline_events WHERE id = ?")
      .get(input.id) as
      | { text?: string; state?: string | null; output?: string | null }
      | undefined;
    if (!current) return;
    updateTimelineEventStmt.run(
      input.text ?? current.text ?? "",
      input.state ?? current.state ?? null,
      input.output ?? current.output ?? null,
      input.updatedAt ?? now(),
      input.id,
    );
  }

  function clearTimelineEvents(conversationId: string): void {
    deleteTimelineEventsStmt.run(conversationId);
  }

  function getToolCache(cacheKey: string, nowTs = now()): ToolCacheRecord | null {
    purgeExpiredToolCacheStmt.run(nowTs);
    const row = getToolCacheStmt.get(cacheKey) as ToolCacheRecord | undefined;
    if (!row) return null;
    if (row.expires_at <= nowTs) {
      deleteToolCacheStmt.run(cacheKey);
      return null;
    }
    return row;
  }

  function setToolCache(input: {
    cacheKey: string;
    scope: "memory" | "storage";
    value: string;
    expiresAt: number;
    updatedAt?: number;
  }): void {
    setToolCacheStmt.run(
      input.cacheKey,
      input.scope,
      input.value,
      input.expiresAt,
      input.updatedAt ?? now(),
    );
  }

  function deleteToolCache(cacheKey: string): void {
    deleteToolCacheStmt.run(cacheKey);
  }

  return {
    getSettings,
    setSettings,
    createConversation,
    getConversation,
    deleteConversation,
    listConversations,
    getMessages,
    addMessage,
    updateMessage,
    replaceMessages,
    listTimelineEvents,
    addTimelineEvent,
    updateTimelineEvent,
    clearTimelineEvents,
    getToolCache,
    setToolCache,
    deleteToolCache,
  };
}

export { createAssistantStore };
export type {
  AssistantProvider,
  AssistantRole,
  AssistantSettings,
  AssistantStore,
  ConversationListItem,
  ConversationRecord,
  MessageRecord,
  ReplaceMessageItem,
  TimelineEventRecord,
  ToolCacheRecord,
};
