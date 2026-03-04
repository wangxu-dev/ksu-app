import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DirectChatTransport, getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { MessageSquareText, Plus, SendHorizontal, Settings2, Trash2, X, Bot, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  if (name === "get_user_info") return "身份验证";
  if (name === "get_personal_info") return "档案提取";
  if (name === "get_grades") return "成绩查询";
  if (name === "get_calendar") return "校历同步";
  if (name === "get_current_time") return "时钟对准";
  return name;
}

export function AssistantPage() {
  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-xl font-black uppercase tracking-tight">KSU_INTELLIGENCE</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">终端 AI 助手 / 实时校务数据关联</p>
        </div>
        <Badge variant="outline" className="h-5 text-[9px] px-2 font-mono border-primary/20 text-primary">AGENT_ACTIVE</Badge>
      </div>
      <AssistantContent />
    </div>
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
  const TOOL_NOTICE_MIN_MS = 800;
  const token = getSavedToken() || "";
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [settings, setSettings] = useState<AssistantSettings>(EMPTY_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [toolNotice, setToolNotice] = useState<{ labels: string; until: number } | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const toolNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const runningToolLabels = lastAssistant
      ? extractToolActivities(lastAssistant)
          .filter((activity) => activity.state === "running")
          .map((activity) => activity.label)
      : [];

    if (toolNoticeTimerRef.current) {
      clearTimeout(toolNoticeTimerRef.current);
      toolNoticeTimerRef.current = null;
    }

    if (runningToolLabels.length > 0) {
      setToolNotice({
        labels: runningToolLabels.join("、"),
        until: Date.now() + TOOL_NOTICE_MIN_MS,
      });
      return;
    }

    setToolNotice((prev) => {
      if (!prev) return null;
      const remain = prev.until - Date.now();
      if (remain <= 0) return null;
      toolNoticeTimerRef.current = setTimeout(() => setToolNotice(null), remain);
      return prev;
    });
  }, [messages]);

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
    <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/30 shadow-none">
      <div className="shrink-0 flex items-center justify-between border-b px-4 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest">{conversations.find(c => c.id === activeConversationId)?.title || "对话中"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowConversations((v) => !v)}>
            <MessageSquareText className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 space-y-6 overflow-auto px-6 py-5 [scrollbar-width:thin]"
        onScroll={(e) => {
          const el = e.currentTarget;
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          setShouldAutoScroll(distanceToBottom < 80);
        }}
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
             <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <Bot className="h-6 w-6" />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-widest">初始化成功</p>
                <p className="text-[10px] font-bold">可以向我询问关于成绩单或个人信息的内容</p>
             </div>
          </div>
        )}
        {messages.map((m) => {
          const content = extractMessageText(m);
          const toolActivities = extractToolActivities(m).filter(
            (activity) => activity.state === "running",
          );
          const isUser = m.role === "user";
          const hasText = content.trim().length > 0;
          const statusText =
            !isUser && !hasText
              ? toolActivities.map((a) => a.label).join(" / ") || (status === "streaming" ? "THINKING..." : "")
              : "";

          return (
            <div key={m.id} className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
               <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border", isUser ? "bg-primary border-primary" : "bg-muted border-border")}>
                 {isUser ? <UserIcon className="h-3.5 w-3.5 text-primary-foreground" /> : <Bot className="h-3.5 w-3.5" />}
               </div>
              <div className={cn("max-w-[85%] space-y-1", isUser ? "items-end text-right" : "items-start text-left")}>
                {isUser ? (
                  <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs font-bold leading-relaxed inline-block">
                    {content}
                  </div>
                ) : hasText ? (
                  <div className="text-xs leading-6 font-medium text-foreground/90 bg-muted/30 border border-border/40 p-3 rounded-xl">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
                        code: ({ children }) => <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] font-bold">{children}</code>,
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : null}

                {statusText && (
                  <div className="text-[9px] font-black text-primary uppercase tracking-tighter flex items-center gap-2">
                    <span className="h-1 w-1 bg-primary rounded-full animate-pulse" />
                    {statusText}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesBottomRef} />
      </div>

      <div className="shrink-0 border-t bg-muted/10 p-4">
        <div className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-xl border border-border/60 bg-background p-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder="INPUT_COMMAND_OR_QUESTION..."
            rows={1}
            className="min-h-9 flex-1 resize-none border-0 bg-transparent text-[11px] font-bold shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            disabled={!canSend}
            onClick={onSend}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* OVERLAYS (Conversations/Settings) */}
      {showConversations && (
        <div className="absolute inset-x-0 top-0 bottom-0 z-20 bg-background/95 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-xs font-black uppercase tracking-widest">历史对话_HISTORY</h3>
             <Button variant="ghost" size="icon" onClick={() => setShowConversations(false)}><X className="h-4 w-4" /></Button>
           </div>
           <div className="space-y-2 overflow-auto max-h-[80%]">
             {conversations.map(c => (
               <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 hover:bg-muted/50 cursor-pointer" onClick={() => { setActiveConversationId(c.id); setShowConversations(false); }}>
                  <MessageSquareText className="h-4 w-4 opacity-50" />
                  <span className="text-xs font-bold truncate flex-1">{c.title}</span>
               </div>
             ))}
           </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute right-3 top-11 z-20 w-80 rounded-xl border bg-background p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
             <h3 className="text-xs font-black">AI_CONFIG</h3>
             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(false)}><X className="h-3 w-3" /></Button>
          </div>
          <div className="space-y-3">
             <Input className="h-8 text-[10px] font-mono" value={settings.model} onChange={e => setSettings({...settings, model: e.target.value})} />
             <Input className="h-8 text-[10px] font-mono" type="password" placeholder="API_KEY" value={settings.apiKey} onChange={e => setSettings({...settings, apiKey: e.target.value})} />
             <Button size="sm" className="w-full text-xs font-bold" onClick={async () => { await setAssistantSettings(settings); setShowSettings(false); }}>SAVE_CHANGES</Button>
          </div>
        </div>
      )}
    </div>
  );
}
