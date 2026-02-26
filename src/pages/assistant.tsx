import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DirectChatTransport, getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { MessageSquareText, Plus, SendHorizontal, Settings2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  replaceConversationMessages,
  setAssistantSettings,
  type AssistantConversation,
  type AssistantSettings,
} from "@/lib/assistant/client";
import { createAssistantAgent } from "@/lib/assistant/agent";

const EMPTY_SETTINGS: AssistantSettings = {
  apiKey: "",
  model: "openai/gpt-4o-mini",
  baseUrl: "https://openrouter.ai/api/v1",
  systemPrompt: "",
};

type ToolActivity = {
  name: string;
  state: "running" | "success" | "error";
  label: string;
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

function extractMessageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function extractToolActivities(message: UIMessage): ToolActivity[] {
  return message.parts.filter(isToolUIPart).map((part) => {
    const name = getToolName(part);
    if (part.state === "output-available") {
      return { name, state: "success", label: `工具 ${name} 已完成` };
    }
    if (part.state === "output-error") {
      return { name, state: "error", label: `工具 ${name} 调用失败` };
    }
    return { name, state: "running", label: `工具 ${name} 执行中` };
  });
}

function toPersistedMessages(
  messages: UIMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter(
      (m): m is UIMessage & { role: "user" | "assistant" } =>
        m.role === "user" || m.role === "assistant",
    )
    .map((m) => ({
      role: m.role,
      content: extractMessageText(m),
    }))
    .filter((m) => m.content.trim().length > 0);
}

function toUIMessages(
  rows: Array<{ id: string; role: "user" | "assistant"; content: string }>,
): UIMessage[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
  }));
}

function AssistantContent() {
  const token = getSavedToken() || "";
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [settings, setSettings] = useState<AssistantSettings>(EMPTY_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);

  async function refreshConversations() {
    const items = await listConversations();
    setConversations(items);
    return items;
  }

  const agent = useMemo(() => {
    if (!token || !settings.apiKey) return null;
    try {
      return createAssistantAgent(settings, token);
    } catch {
      return null;
    }
  }, [settings, token]);

  const transport = useMemo(() => {
    if (!agent) return undefined;
    return new DirectChatTransport({ agent });
  }, [agent]);

  const { messages, sendMessage, setMessages, status } = useChat({
    id: activeConversationId || "assistant",
    transport: transport as any,
    onError: (error) => {
      console.error("[assistant] chat error", error);
    },
    onFinish: async ({ messages }) => {
      if (!activeConversationId) return;
      await replaceConversationMessages(activeConversationId, toPersistedMessages(messages));
      await refreshConversations();
    },
  });

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    console.debug("[assistant] state", {
      status,
      messageCount: messages.length,
      lastRole: last.role,
      parts: last.parts.map((part) => part.type),
    });
  }, [messages, status]);

  useEffect(() => {
    if (!shouldAutoScroll) return;
    messagesBottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, status, shouldAutoScroll]);

  useEffect(() => {
    Promise.all([refreshConversations(), getAssistantSettings()]).then(async ([items, cfg]) => {
      setSettings(cfg);
      if (items.length === 0) {
        const created = await createConversation("新对话");
        setConversations([created]);
        setActiveConversationId(created.id);
        setMessages([]);
      } else {
        const first = items[0];
        setActiveConversationId(first.id);
        const rows = await getConversationMessages(first.id);
        setMessages(toUIMessages(rows) as any);
      }
    });
  }, [setMessages]);

  const canSend = useMemo(
    () =>
      !!prompt.trim() &&
      !!token &&
      !!activeConversationId &&
      !!transport &&
      status !== "submitted" &&
      status !== "streaming",
    [prompt, token, activeConversationId, transport, status],
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
    const rows = await getConversationMessages(conversationId);
    setMessages(toUIMessages(rows) as any);
    setShowConversations(false);
  }

  async function onSaveSettings() {
    const latest = await setAssistantSettings(settings);
    setSettings(latest);
    setShowSettings(false);
  }

  async function onSend() {
    const text = prompt.trim();
    if (!canSend || !text) return;
    setPrompt("");
    setShouldAutoScroll(true);
    try {
      await sendMessage({ text });
    } catch (error) {
      console.error("[assistant] send message failed", error);
    }
  }

  return (
    <div className="relative mx-auto flex h-[calc(100vh-10rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background">
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

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-5 overflow-auto px-5 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          setShouldAutoScroll(distanceToBottom < 80);
        }}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">输入“我是谁”或“我的成绩如何”开始。</p>
        ) : null}
        {messages.map((m) => {
          const content = extractMessageText(m);
          const toolActivities = extractToolActivities(m);
          const isUser = m.role === "user";
          const shouldShowWaiting =
            !isUser &&
            status === "streaming" &&
            content.trim().length === 0 &&
            toolActivities.length === 0;

          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%] space-y-2">
                <div
                  className={`text-xs ${
                    isUser
                      ? "text-right text-muted-foreground/80"
                      : "text-left text-muted-foreground"
                  }`}
                >
                  {isUser ? "你" : "AI"}
                </div>

                {isUser ? (
                  <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                    <div className="whitespace-pre-wrap break-words">
                      {content || "处理中（等待发送）..."}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm leading-7 text-foreground">
                    {content.trim().length > 0 ? (
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
                            <code className="rounded bg-muted px-1 py-0.5">{children}</code>
                          ),
                        }}
                      >
                        {content}
                      </ReactMarkdown>
                    ) : null}
                    {shouldShowWaiting ? (
                      <div className="text-sm text-muted-foreground">思考中...</div>
                    ) : null}
                  </div>
                )}

                {!isUser && toolActivities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {toolActivities.map((activity, index) => (
                      <div
                        key={`${activity.name}-${index}`}
                        className={`rounded-full px-3 py-1 text-xs ${
                          activity.state === "error"
                            ? "bg-destructive/10 text-destructive"
                            : activity.state === "success"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {activity.label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={messagesBottomRef} />
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex w-full items-end gap-2 rounded-2xl border bg-muted/20 p-2">
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
            className="min-h-[44px] flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            disabled={!canSend}
            onClick={onSend}
          >
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
