import { Bot, Loader2, RotateCcw, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getToolDisplayName } from "@/lib/assistant/tool-display";
import type { AssistantViewStatus, ChatMessage, ToolActivity } from "@/lib/assistant/types";

type AssistantMessageListProps = {
  messages: ChatMessage[];
  canRegenerate?: boolean;
  isBusy?: boolean;
  lastError?: string | null;
  lastAssistantMessageId?: string | null;
  onScrollNearBottomChange: (nearBottom: boolean) => void;
  onRegenerate?: () => void | Promise<void>;
  status: AssistantViewStatus;
  toolActivities?: ToolActivity[];
  bottomRef: React.RefObject<HTMLDivElement | null>;
};

function buildInlineStatusText(
  status: AssistantViewStatus,
  toolActivities: ToolActivity[],
  lastError: string | null | undefined,
): string {
  const latestTool =
    [...toolActivities].reverse().find((item) => item.state === "running") ||
    toolActivities[toolActivities.length - 1];

  if (status === "submitted") return "请求已发送";
  if (status === "thinking") {
    if (latestTool) {
      return `${getToolDisplayName(latestTool.name)} · ${latestTool.state === "running" ? "处理中" : "已完成"}`;
    }
    return "助手处理中";
  }
  if (status === "streaming") {
    if (latestTool?.state === "running") {
      return `${getToolDisplayName(latestTool.name)} · 正在整理回答`;
    }
    return "正在生成回答";
  }
  if (status === "aborted") return "已停止";
  if (status === "error") return lastError || "请求失败";
  return "助手处理中";
}

function AssistantMessageList({
  bottomRef,
  canRegenerate,
  isBusy,
  lastError,
  lastAssistantMessageId,
  messages,
  onScrollNearBottomChange,
  onRegenerate,
  status,
  toolActivities = [],
}: AssistantMessageListProps) {
  const inlineStatusText = buildInlineStatusText(status, toolActivities, lastError);

  return (
    <div
      className="flex-1 min-h-0 space-y-6 overflow-auto px-4 py-3 [scrollbar-width:thin] sm:px-6"
      onScroll={(event) => {
        const element = event.currentTarget;
        onScrollNearBottomChange(
          element.scrollHeight - element.scrollTop - element.clientHeight < 100,
        );
      }}
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center space-y-3 text-center opacity-40">
          <Bot className="h-9 w-9 text-foreground/70" />
          <p className="text-xs font-medium text-foreground">开始对话</p>
        </div>
      ) : null}

      {messages.map((message) => {
        const isUser = message.role === "user";
        const hasText = message.content.trim().length > 0;
        const showRegenerate =
          !isUser && !isBusy && canRegenerate && message.id === lastAssistantMessageId && hasText;

        return (
          <div
            key={message.id}
            className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                isUser ? "border-primary bg-primary shadow-sm" : "border-border bg-muted",
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
                <div className="rounded-2xl border border-primary/15 bg-primary/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground">
                  {message.content}
                </div>
              ) : hasText ? (
                <div className="px-1 py-1 text-[13px] font-medium leading-relaxed text-foreground/90">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => (
                        <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
                      ),
                      code: ({ children }) => (
                        <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-1 text-[10px] font-medium text-muted-foreground">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  <span>{inlineStatusText}</span>
                </div>
              )}
              {showRegenerate ? (
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => void onRegenerate?.()}
                    title="重新回答"
                    aria-label="重新回答"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

export { AssistantMessageList };
