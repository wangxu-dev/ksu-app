import { Bot, Loader2, RotateCcw, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssistantViewStatus, ChatMessage } from "@/lib/assistant/types";

type AssistantMessageListProps = {
  messages: ChatMessage[];
  canRegenerate?: boolean;
  isBusy?: boolean;
  lastAssistantMessageId?: string | null;
  onScrollNearBottomChange: (nearBottom: boolean) => void;
  onRegenerate?: () => void | Promise<void>;
  status: AssistantViewStatus;
  bottomRef: React.RefObject<HTMLDivElement | null>;
};

function AssistantMessageList({
  bottomRef,
  canRegenerate,
  isBusy,
  lastAssistantMessageId,
  messages,
  onScrollNearBottomChange,
  onRegenerate,
  status,
}: AssistantMessageListProps) {
  return (
    <div
      className="flex-1 min-h-0 space-y-6 overflow-auto px-6 py-5 [scrollbar-width:thin]"
      onScroll={(event) => {
        const element = event.currentTarget;
        onScrollNearBottomChange(
          element.scrollHeight - element.scrollTop - element.clientHeight < 100,
        );
      }}
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center space-y-4 text-center opacity-40">
          <Bot className="h-10 w-10 text-primary" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground">准备开始</p>
            <p className="text-[10px] font-medium">
              输入任何问题，我将通过主进程助手调用你的教务工具
            </p>
          </div>
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
                <div className="rounded-xl border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-[13px] font-medium text-foreground">
                  {message.content}
                </div>
              ) : hasText ? (
                <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-[13px] font-medium leading-relaxed text-foreground/90 shadow-xs">
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
                <div className="flex items-center gap-2 text-[9px] font-bold text-primary">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  <span className="tracking-widest">
                    {status === "submitted" ? "请求已发送" : "助手处理中"}
                  </span>
                </div>
              )}
              {showRegenerate ? (
                <div className="pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => void onRegenerate?.()}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    重新回答
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
