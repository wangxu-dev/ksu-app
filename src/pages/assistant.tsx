import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, Plus, SendHorizontal, Settings2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { HomeSearch } from "@/components/home-search";
import { getSavedToken } from "@/lib/auth";
import { toUserMessage } from "@/lib/errors/user-message";
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
  const token = getSavedToken() || "";
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [settings, setSettings] = useState<AssistantSettings>(EMPTY_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [activeStreamId, setActiveStreamId] = useState("");
  const [pendingUserText, setPendingUserText] = useState("");
  const [streamingAssistantText, setStreamingAssistantText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const activeConversationIdRef = useRef("");

  const isStreaming = activeStreamId.length > 0;

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  async function refreshConversations() {
    const items = await listConversations();
    setConversations(items);
    return items;
  }

  async function loadConversationMessages(conversationId: string) {
    const rows = await getConversationMessages(conversationId);
    setMessages(rows);
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
        const first = items[0];
        setActiveConversationId(first.id);
        await loadConversationMessages(first.id);
      }
    });
  }, []);

  useEffect(() => {
    const offChunk = onAssistantChunk((payload) => {
      if (!payload || payload.streamId !== activeStreamId) return;
      setStreamingAssistantText((prev) => `${prev}${payload.delta || ""}`);
    });
    const offDone = onAssistantDone((payload) => {
      if (!payload || payload.streamId !== activeStreamId) return;
      setActiveStreamId("");
      setPendingUserText("");
      setStreamingAssistantText("");
      setStreamError(null);
      const currentConversationId = activeConversationIdRef.current;
      if (!currentConversationId) return;
      void Promise.all([loadConversationMessages(currentConversationId), refreshConversations()]);
    });
    const offError = onAssistantError((payload) => {
      if (!payload || payload.streamId !== activeStreamId) return;
      setActiveStreamId("");
      setPendingUserText("");
      setStreamingAssistantText("");
      setStreamError(toUserMessage(payload.error || "assistant failed", "助手请求失败"));
      const currentConversationId = activeConversationIdRef.current;
      if (!currentConversationId) return;
      void Promise.all([loadConversationMessages(currentConversationId), refreshConversations()]);
    });

    return () => {
      offChunk();
      offDone();
      offError();
    };
  }, [activeStreamId]);

  useEffect(() => {
    if (!shouldAutoScroll) return;
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pendingUserText, streamingAssistantText, shouldAutoScroll]);

  const canSend = useMemo(
    () => !!prompt.trim() && !!token && !!activeConversationId && !isStreaming,
    [prompt, token, activeConversationId, isStreaming],
  );

  async function onNewConversation() {
    if (isStreaming) return;
    const created = await createConversation("新对话");
    setConversations((prev) => [created, ...prev]);
    setActiveConversationId(created.id);
    setMessages([]);
    setPendingUserText("");
    setStreamingAssistantText("");
    setStreamError(null);
    setShowConversations(false);
  }

  async function onSelectConversation(conversationId: string) {
    if (isStreaming) return;
    setActiveConversationId(conversationId);
    await loadConversationMessages(conversationId);
    setPendingUserText("");
    setStreamingAssistantText("");
    setStreamError(null);
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
    setPendingUserText(text);
    setStreamingAssistantText("");
    setStreamError(null);
    try {
      const { streamId } = await startAssistantStream({
        message: text,
        token,
        conversationId: activeConversationId,
      });
      setActiveStreamId(streamId);
    } catch (error) {
      setPendingUserText("");
      setStreamingAssistantText("");
      setStreamError(toUserMessage(error, "发送失败"));
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
          <Button variant="ghost" size="icon" onClick={onNewConversation} disabled={isStreaming}>
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 />
          </Button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 space-y-6 overflow-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          setShouldAutoScroll(distanceToBottom < 80);
        }}
      >
        {messages.length === 0 && !pendingUserText && !streamingAssistantText ? (
          <p className="text-sm text-muted-foreground">输入“我是谁”或“我的成绩如何”开始。</p>
        ) : null}

        {messages.map((m) => {
          const isUser = m.role === "user";
          const content = m.content || "";
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] space-y-2">
                {isUser ? (
                  <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                    <div className="whitespace-pre-wrap wrap-break-word">{content}</div>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          );
        })}

        {pendingUserText ? (
          <div className="flex justify-end">
            <div className="max-w-[82%] space-y-2">
              <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                <div className="whitespace-pre-wrap wrap-break-word">{pendingUserText}</div>
              </div>
            </div>
          </div>
        ) : null}

        {isStreaming ? (
          <div className="flex justify-start">
            <div className="max-w-[82%]">
              {streamingAssistantText ? (
                <div className="px-1 py-0.5 text-sm leading-7 text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streamingAssistantText}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="animate-[pulse_2.4s_ease-in-out_infinite] text-sm text-muted-foreground">
                  思考中...
                </div>
              )}
            </div>
          </div>
        ) : null}

        {streamError ? (
          <div className="text-sm text-muted-foreground">本次请求失败：{streamError}</div>
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
