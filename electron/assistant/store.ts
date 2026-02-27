// @ts-nocheck
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { createLogger } = require("../shared/logger.js");

const DEFAULT_SETTINGS = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openai/gpt-4o-mini",
  apiKey: "",
  systemPrompt: "",
};

function now() {
  return Date.now();
}

function createAssistantStore(userDataDir) {
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
  `);

  const createConversationStmt = db.prepare(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  const listConversationsStmt = db.prepare(`
    SELECT c.id, c.title, c.created_at, c.updated_at,
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
    "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
  );
  const touchConversationStmt = db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?");
  const addMessageStmt = db.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const updateMessageStmt = db.prepare("UPDATE messages SET content = ? WHERE id = ?");
  const listMessagesStmt = db.prepare(
    "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
  );
  const deleteMessagesStmt = db.prepare("DELETE FROM messages WHERE conversation_id = ?");
  const setSettingStmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `);
  const getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");

  function getSettings() {
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const row = getSettingStmt.get(key);
      if (row && typeof row.value === "string") {
        out[key] = row.value;
      }
    }
    return out;
  }

  function setSettings(patch) {
    for (const [key, value] of Object.entries(patch || {})) {
      if (!(key in DEFAULT_SETTINGS)) continue;
      setSettingStmt.run(key, String(value ?? ""));
    }
    return getSettings();
  }

  function createConversation(title) {
    const id = randomUUID();
    const ts = now();
    const safeTitle = String(title || "新对话").slice(0, 60);
    createConversationStmt.run(id, safeTitle, ts, ts);
    return getConversationStmt.get(id);
  }

  function listConversations() {
    return listConversationsStmt.all().map((row) => ({
      ...row,
      preview: row.last_message ? String(row.last_message).slice(0, 50) : "",
    }));
  }

  function getMessages(conversationId) {
    return listMessagesStmt.all(conversationId);
  }

  function addMessage(conversationId, role, content) {
    const id = randomUUID();
    const ts = now();
    addMessageStmt.run(id, conversationId, role, content, ts);
    touchConversationStmt.run(ts, conversationId);
    return id;
  }

  function updateMessage(id, content) {
    updateMessageStmt.run(String(content || ""), id);
  }

  function replaceMessages(conversationId, messages) {
    const ts = now();
    const rows = Array.isArray(messages) ? messages : [];
    logger.debug("replace messages begin", { conversationId, count: rows.length });
    db.exec("BEGIN");
    try {
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

  return {
    getSettings,
    setSettings,
    createConversation,
    listConversations,
    getMessages,
    addMessage,
    updateMessage,
    replaceMessages,
  };
}

export { createAssistantStore };
