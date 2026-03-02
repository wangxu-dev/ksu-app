import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DirectChatTransport, getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { MessageSquareText, Plus, SendHorizontal, Settings2, Trash2, X } from "lucide-react";
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
  deleteConversation,
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

function toolDisplayName(name: string): string {
  if (name === "get_user_info") return "身份信息";
  if (name === "get_personal_info") return "个人信息";
  if (name === "get_grades") return "成绩数据";
  if (name === "get_calendar") return "校历信息";
  if (name === "get_current_time") return "本机时间";
  return name;
}

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
    const display = toolDisplayName(name);
    if (part.state === "output-available") {
      return { name, state: "success", label: display };
    }
    if (part.state === "output-error") {
      return { name, state: "error", label: display };
    }
    return { name, state: "running", label: display };
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
    if (!shouldAutoScroll) return;
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
  const lastMessage = messages[messages.length - 1];
  const showOptimisticAssistant = status === "submitted" && lastMessage?.role === "user";

  async function onNewConversation() {
    const isCurrentEmpty =
      messages.length === 0 && !prompt.trim() && status !== "submitted" && status !== "streaming";
    if (isCurrentEmpty) {
      setShowConversations(false);
      return;
    }
    const created = await createConversation("新对话");
    setConversations((prev) => [created, ...prev]);
    setActiveConversationId(created.id);
    setMessages([]);
    setShowConversations(false);
  }

  async function onDeleteConversation(conversationId: string) {
    const result = await deleteConversation(conversationId);
    if (!result.ok) return;
    const items = await refreshConversations();
    if (items.length === 0) {
      const created = await createConversation("新对话");
      setConversations([created]);
      setActiveConversationId(created.id);
      setMessages([]);
      return;
    }
    if (activeConversationId === conversationId) {
      const next = items[0];
      setActiveConversationId(next.id);
      const rows = await getConversationMessages(next.id);
      setMessages(toUIMessages(rows) as any);
    }
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
    <div className="relative mx-auto flex h-[calc(100vh-9.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="truncate text-sm font-medium">对话</div>
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
        className="min-h-0 flex-1 space-y-6 overflow-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
          const toolActivities = extractToolActivities(m).filter(
            (activity) => activity.state === "running",
          );
          const isUser = m.role === "user";
          const hasText = content.trim().length > 0;
          const shouldShowWaiting =
            !isUser && status === "streaming" && !hasText && toolActivities.length === 0;
          const shouldShowToolRunning = !isUser && !hasText && toolActivities.length > 0;
          const runningToolNames = toolActivities.map((activity) => activity.label).join("、");

          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] space-y-2">
                {isUser ? (
                  <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                    <div className="whitespace-pre-wrap wrap-break-word">
                      {content || "处理中（等待发送）..."}
                    </div>
                  </div>
                ) : hasText ? (
                  <div className="px-1 py-0.5 text-sm leading-7 text-foreground">
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
                  </div>
                ) : null}

                {shouldShowWaiting ? (
                  <div className="animate-[pulse_2.4s_ease-in-out_infinite] text-sm text-muted-foreground">
                    思考中...
                  </div>
                ) : null}

                {shouldShowToolRunning ? (
                  <div className="animate-[pulse_2.4s_ease-in-out_infinite] text-sm text-muted-foreground">
                    {runningToolNames}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {showOptimisticAssistant ? (
          <div className="flex justify-start">
            <div className="max-w-[82%]">
              <div className="animate-[pulse_2.4s_ease-in-out_infinite] text-sm text-muted-foreground">
                思考中...
              </div>
            </div>
          </div>
        ) : null}
        <div ref={messagesBottomRef} />
      </div>

      <div className="border-t bg-background/80 px-5 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-2xl border bg-muted/20 p-2.5">
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
            className="min-h-11.5 flex-1 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
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
          <div className="max-h-95 space-y-1 overflow-auto">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-1 rounded-md border p-2 text-sm ${activeConversationId === c.id ? "bg-muted" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation(c.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.preview || "暂无消息"}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onDeleteConversation(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showSettings ? (
        <div className="absolute right-3 top-12 z-20 w-90 rounded-lg border bg-background p-3 shadow-xl">
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
