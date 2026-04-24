import { Bot, Loader2, RotateCcw, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
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
  text: {
    requestSubmitted: string;
    assistantWorking: string;
    toolWorking: string;
    toolDone: string;
    toolSummarizing: string;
    streaming: string;
    aborted: string;
    failed: string;
  },
): string {
  const latestTool =
    [...toolActivities].reverse().find((item) => item.state === "running") ||
    toolActivities[toolActivities.length - 1];

  if (status === "submitted") return text.requestSubmitted;
  if (status === "thinking") {
    if (latestTool) {
      return `${getToolDisplayName(latestTool.name)} · ${latestTool.state === "running" ? text.toolWorking : text.toolDone}`;
    }
    return text.assistantWorking;
  }
  if (status === "streaming") {
    if (latestTool?.state === "running") {
      return `${getToolDisplayName(latestTool.name)} · ${text.toolSummarizing}`;
    }
    return text.streaming;
  }
  if (status === "aborted") return text.aborted;
  if (status === "error") return lastError || text.failed;
  return text.assistantWorking;
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
  const { messages: text } = useI18n();
  const inlineStatusText = buildInlineStatusText(status, toolActivities, lastError, {
    requestSubmitted: text.assistant.requestSubmitted,
    assistantWorking: text.assistant.assistantWorking,
    toolWorking: text.assistant.toolWorking,
    toolDone: text.assistant.toolDone,
    toolSummarizing: text.assistant.toolSummarizing,
    streaming: text.assistant.streaming,
    aborted: text.assistant.aborted,
    failed: text.assistant.failed,
  });

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
          <Bot className="h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{text.assistant.startConversation}</p>
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
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-foreground">
                  {message.content}
                </div>
              ) : hasText ? (
                <div className="px-1 py-1 text-sm font-medium leading-relaxed text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => (
                        <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
                      ),
                      code: ({ children }) => (
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
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
                    title={text.assistant.regenerate}
                    aria-label={text.assistant.regenerate}
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
