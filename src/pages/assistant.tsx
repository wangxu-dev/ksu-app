import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DirectChatTransport, getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import {
  MessageSquareText,
  Plus,
  SendHorizontal,
  Settings2,
  Trash2,
  Bot,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Inbox,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const EMPTY_SETTINGS: AssistantSettings = {
  apiKey: "",
  model: "openai/gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
  systemPrompt: "",
};

type ToolActivity = {
  name: string;
  state: "running" | "success" | "error";
  label: string;
};

function toolDisplayName(name: string): string {
  const mapping: Record<string, string> = {
    get_user_info: "验证身份",
    get_personal_info: "读取档案",
    get_grades: "查询成绩",
    get_calendar: "同步校历",
    get_current_time: "校准时间",
  };
  return mapping[name] || name;
}

export function AssistantPage() {
  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground">智能助手</h2>
          <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
            关联校务数据 · 实时问答终端
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-5 text-[9px] px-2 font-bold border-primary/20 text-primary bg-primary/5"
        >
          服务就绪
        </Badge>
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
    if (part.state === "output-available") return { name, state: "success", label: display };
    if (part.state === "output-error") return { name, state: "error", label: display };
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
    .map((m) => ({ role: m.role, content: extractMessageText(m) }))
    .filter((m) => m.content.trim().length > 0);
}

function toUIMessages(
  rows: Array<{ id: string; role: "user" | "assistant"; content: string }>,
): UIMessage[] {
  return rows.map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text", text: m.content }] }));
}

function AssistantContent() {
  const token = getSavedToken() || "";
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null); // null 表示草稿模式
  const [settings, setSettings] = useState<AssistantSettings>(EMPTY_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
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

  const transport = useMemo(
    () => (agent ? new DirectChatTransport({ agent }) : undefined),
    [agent],
  );

  const { messages, sendMessage, setMessages, status } = useChat({
    id: activeConversationId || "draft-session",
    transport: transport as any,
    onFinish: async ({ messages }) => {
      // 在这里持久化：如果已经有 ID，则更新；如果没有，我们在 onSend 里处理了创建
      if (activeConversationId) {
        await replaceConversationMessages(activeConversationId, toPersistedMessages(messages));
        await refreshConversations();
      }
    },
  });

  useEffect(() => {
    if (shouldAutoScroll) messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, shouldAutoScroll]);

  // 初始化加载：只读历史，不强制创建
  useEffect(() => {
    Promise.all([refreshConversations(), getAssistantSettings()]).then(async ([items, cfg]) => {
      setSettings(cfg);
      if (items.length > 0) {
        onSelectConversation(items[0].id);
      } else {
        onNewConversation(); // 这只是前端重置，不调接口
      }
    });
  }, []);

  const canSend =
    !!prompt.trim() && !!token && !!transport && status !== "submitted" && status !== "streaming";

  function onNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
  }

  async function onDeleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await deleteConversation(id);
    if (!res.ok) return;
    const items = await refreshConversations();
    if (activeConversationId === id) {
      if (items.length > 0) {
        onSelectConversation(items[0].id);
      } else {
        onNewConversation();
      }
    }
  }

  async function onSelectConversation(id: string) {
    setActiveConversationId(id);
    const rows = await getConversationMessages(id);
    setMessages(toUIMessages(rows) as any);
  }

  async function onSaveSettings() {
    await setAssistantSettings(settings);
    setShowSettings(false);
  }

  async function onSend() {
    const text = prompt.trim();
    if (!canSend || !text) return;

    let targetId = activeConversationId;

    // 草稿模式下的第一条消息：触发真正的后台创建
    if (!targetId) {
      const created = await createConversation(text.slice(0, 20));
      targetId = created.id;
      setActiveConversationId(targetId);
      setConversations((prev) => [created, ...prev]);
    }

    setPrompt("");
    setShouldAutoScroll(true);
    await sendMessage({ text });
  }

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* 历史记录：抽屉式布局 */}
      <div
        className={cn(
          "flex flex-col border border-border/40 rounded-xl bg-muted/5 transition-[margin,opacity] duration-300 ease-in-out shrink-0 overflow-hidden",
          showHistory ? "w-48 mr-4 opacity-100" : "w-48 -ml-48 opacity-0 pointer-events-none",
        )}
      >
        <div className="p-2.5 border-b shrink-0 flex items-center justify-between bg-muted/10">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            对话历史
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
            onClick={onNewConversation}
            title="开启新对话"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-1.5 space-y-0.5 [scrollbar-width:thin]">
          {conversations.length === 0 ? (
            <div className="h-20 flex flex-col items-center justify-center text-[10px] text-muted-foreground opacity-50 px-2 text-center">
              <Inbox className="h-4 w-4 mb-1" />
              <span>暂无历史记录</span>
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={cn(
                  "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border border-transparent",
                  activeConversationId === c.id
                    ? "bg-muted/50 border-border/20 shadow-xs"
                    : "hover:bg-muted/30",
                )}
              >
                <MessageSquareText className="h-3 w-3 shrink-0 opacity-40" />
                <span className="text-[11px] font-medium truncate flex-1 text-foreground/80">
                  {c.title}
                </span>
                <button
                  onClick={(e) => onDeleteConversation(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 聊天主体 */}
      <div className="flex-1 flex flex-col min-w-0 border border-border/50 rounded-xl bg-card/30 overflow-hidden transition-all duration-300">
        <div className="shrink-0 flex items-center justify-between border-b px-4 py-2.5 bg-muted/20">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-bold truncate max-w-50 text-foreground/80">
                {!activeConversationId
                  ? "新对话 (草稿)"
                  : conversations.find((c) => c.id === activeConversationId)?.title || "加载中..."}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => setShowSettings(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 space-y-6 overflow-auto px-6 py-5 [scrollbar-width:thin]"
          onScroll={(e) => {
            const el = e.currentTarget;
            setShouldAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
          }}
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Bot className="h-10 w-10 text-primary" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">准备开始</p>
                <p className="text-[10px] font-medium">
                  输入任何问题，我将基于你的教务数据进行回答
                </p>
              </div>
            </div>
          )}
          {messages.map((m) => {
            const content = extractMessageText(m);
            const tools = extractToolActivities(m).filter((a) => a.state === "running");
            const isUser = m.role === "user";
            const hasText = content.trim().length > 0;

            return (
              <div
                key={m.id}
                className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
                    isUser ? "bg-primary border-primary shadow-sm" : "bg-muted border-border",
                  )}
                >
                  {isUser ? (
                    <UserIcon className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Bot className="h-4 w-4 text-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] space-y-1.5",
                    isUser ? "items-end text-right" : "items-start text-left",
                  )}
                >
                  {isUser ? (
                    <div className="rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-[13px] font-medium text-foreground">
                      {content}
                    </div>
                  ) : hasText ? (
                    <div className="text-[13px] leading-relaxed font-medium text-foreground/90 bg-muted/30 border border-border/40 p-4 rounded-xl shadow-xs">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                          ul: ({ children }) => (
                            <ul className="mb-3 list-disc pl-5 space-y-1">{children}</ul>
                          ),
                          code: ({ children }) => (
                            <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {content}
                      </ReactMarkdown>
                    </div>
                  ) : null}

                  {!isUser && tools.length > 0 && (
                    <div className="text-[9px] font-bold text-primary flex items-center gap-2 mt-1">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      <span className="tracking-widest">
                        执行中: {tools.map((t) => t.label).join(" & ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesBottomRef} />
        </div>

        <div className="shrink-0 border-t bg-muted/10 p-4">
          <div className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-xl border border-border/60 bg-background p-2 shadow-sm focus-within:border-primary/40 transition-all">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder="输入指令或提问..."
              rows={1}
              className="min-h-10 max-h-32 flex-1 resize-none border-0 bg-transparent text-[13px] font-medium shadow-none focus-visible:ring-0 py-2"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg shadow-xs"
              disabled={!canSend}
              onClick={onSend}
            >
              {status === "submitted" || status === "streaming" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-112.5 border-border/60">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">助手配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                接口地址
              </label>
              <Input
                className="font-mono text-xs h-9 bg-muted/20"
                value={settings.baseUrl}
                onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                模型名称
              </label>
              <Input
                className="font-mono text-xs h-9 bg-muted/20"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                密钥 (API Key)
              </label>
              <Input
                type="password"
                className="font-mono text-xs h-9 bg-muted/20"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                系统提示词
              </label>
              <Textarea
                className="text-xs min-h-25 bg-muted/20"
                value={settings.systemPrompt}
                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(false)}>
              取消
            </Button>
            <Button size="sm" onClick={onSaveSettings}>
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
