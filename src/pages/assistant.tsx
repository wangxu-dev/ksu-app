import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { HomeSearch } from "@/components/home-search";
import { getSavedToken } from "@/lib/auth";
import {
  createConversation,
  getAssistantSettings,
  getConversationMessages,
  listConversations,
  onAssistantChunk,
  onAssistantDone,
  onAssistantError,
  setAssistantSettings,
  startAssistantStream,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantSettings,
} from "@/lib/assistant/client";
import { MessageSquareText, Plus, SendHorizontal, Settings2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streamId?: string;
  status?: "streaming" | "done" | "error";
};

const EMPTY_SETTINGS: AssistantSettings = {
  apiKey: "",
  model: "openai/gpt-4o-mini",
  baseUrl: "https://openrouter.ai/api/v1",
  systemPrompt: "",
};

export function AssistantPage() {
  return (
    <>
      <PageHeader>
        <HomeSearch />
      </PageHeader>
      <AssistantContent />
    </>
  );
}

function AssistantContent() {
  const [token] = useState(() => getSavedToken() || "");
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [settings, setSettings] = useState<AssistantSettings>(EMPTY_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showConversations, setShowConversations] = useState(false);

  async function refreshConversations() {
    const items = await listConversations();
    setConversations(items);
    return items;
  }

  async function loadMessages(conversationId: string) {
    const rows = await getConversationMessages(conversationId);
    const mapped: ChatMessage[] = rows.map((m: AssistantMessage) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      status: "done",
    }));
    setMessages(mapped);
  }

  useEffect(() => {
    Promise.all([refreshConversations(), getAssistantSettings()]).then(async ([items, cfg]) => {
      setSettings(cfg);
      if (items.length === 0) {
        const created = await createConversation("新对话");
        setConversations([created]);
        setActiveConversationId(created.id);
        setMessages([]);
      } else {
        setActiveConversationId(items[0].id);
        await loadMessages(items[0].id);
      }
    });
  }, []);

  useEffect(() => {
    const offChunk = onAssistantChunk(({ streamId, delta }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.streamId === streamId
            ? { ...m, content: `${m.content}${delta}`, status: "streaming" }
            : m,
        ),
      );
    });
    const offDone = onAssistantDone(async ({ streamId }) => {
      setMessages((prev) =>
        prev.map((m) => (m.streamId === streamId ? { ...m, status: "done" } : m)),
      );
      setIsSending(false);
      if (activeConversationId) {
        await loadMessages(activeConversationId);
        await refreshConversations();
      }
    });
    const offError = onAssistantError(({ streamId, error }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.streamId === streamId
            ? {
                ...m,
                content: m.content ? `${m.content}\n\n[error] ${error}` : `[error] ${error}`,
                status: "error",
              }
            : m,
        ),
      );
      setIsSending(false);
    });
    return () => {
      offChunk();
      offDone();
      offError();
    };
  }, [activeConversationId]);

  const canSend = useMemo(
    () => !!prompt.trim() && !!token && !!activeConversationId && !isSending,
    [prompt, token, activeConversationId, isSending],
  );

  async function onNewConversation() {
    const created = await createConversation("新对话");
    setConversations((prev) => [created, ...prev]);
    setActiveConversationId(created.id);
    setMessages([]);
    setShowConversations(false);
  }

  async function onSelectConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    await loadMessages(conversationId);
    setShowConversations(false);
  }

  async function onSaveSettings() {
    const latest = await setAssistantSettings(settings);
    setSettings(latest);
    setShowSettings(false);
  }

  async function onSend() {
    const text = prompt.trim();
    if (!text || !token || !activeConversationId || isSending) return;

    setPrompt("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      status: "done",
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "streaming",
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const { streamId } = await startAssistantStream({
        message: text,
        token,
        conversationId: activeConversationId,
        apiKey: settings.apiKey || undefined,
        model: settings.model || undefined,
        baseUrl: settings.baseUrl || undefined,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessage.id ? { ...m, streamId } : m)),
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `[error] ${error instanceof Error ? error.message : "assistant start failed"}`,
                status: "error",
              }
            : m,
        ),
      );
      setIsSending(false);
    }
  }

  return (
    <div className="relative flex h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="truncate text-sm font-medium">AI 对话</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowConversations((v) => !v)}>
            <MessageSquareText />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNewConversation}>
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">输入“我是谁”或“我的成绩如何”开始。</p>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className="space-y-1">
            <div className="text-xs text-muted-foreground">{m.role === "user" ? "你" : "AI"}</div>
            {m.role === "assistant" ? (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
                    ),
                    code: ({ children }) => (
                      <code className="rounded bg-background px-1 py-0.5">{children}</code>
                    ),
                  }}
                >
                  {m.content || "..."}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-sm">
                {m.content || "..."}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t px-3 py-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder={
              token ? "输入问题，回车发送，Shift+Enter 换行" : "未检测到登录 token，请先登录"
            }
            rows={2}
            className="resize-none"
          />
          <Button size="icon" disabled={!canSend} onClick={onSend}>
            <SendHorizontal />
          </Button>
        </div>
      </div>

      {showConversations ? (
        <div className="absolute left-3 top-12 z-20 w-[320px] rounded-lg border bg-background p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="text-sm font-medium">会话</div>
            <Button variant="ghost" size="icon" onClick={() => setShowConversations(false)}>
              <X />
            </Button>
          </div>
          <div className="max-h-[380px] space-y-1 overflow-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectConversation(c.id)}
                className={`w-full rounded-md border p-2 text-left text-sm ${activeConversationId === c.id ? "bg-muted" : ""}`}
              >
                <div className="truncate font-medium">{c.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.preview || "暂无消息"}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showSettings ? (
        <div className="absolute right-3 top-12 z-20 w-[360px] rounded-lg border bg-background p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">设置</div>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
              <X />
            </Button>
          </div>
          <div className="space-y-2">
            <Input
              value={settings.baseUrl}
              onChange={(e) => setSettings((s) => ({ ...s, baseUrl: e.target.value }))}
              placeholder="Base URL"
            />
            <Input
              value={settings.apiKey}
              onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
              placeholder="API Key"
            />
            <Input
              value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
              placeholder="Model"
            />
            <Textarea
              value={settings.systemPrompt}
              onChange={(e) => setSettings((s) => ({ ...s, systemPrompt: e.target.value }))}
              placeholder="系统提示词"
              rows={4}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={onSaveSettings}>
              保存
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
