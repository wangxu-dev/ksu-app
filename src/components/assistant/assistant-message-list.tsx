import {
  Bot,
  Brain,
  Check,
  Copy,
  Wrench,
  Loader2,
  RotateCcw,
  TriangleAlert,
  User as UserIcon,
} from "lucide-react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getToolDisplayName } from "@/lib/assistant/tool-display";
import type {
  AssistantPreResponseEvent,
  AssistantViewStatus,
  ChatMessage,
  ToolActivity,
} from "@/lib/assistant/types";

type AssistantMessageListProps = {
  messages: ChatMessage[];
  canRegenerate?: boolean;
  isBusy?: boolean;
  lastError?: string | null;
  lastAssistantMessageId?: string | null;
  onScrollNearBottomChange: (nearBottom: boolean) => void;
  onRegenerate?: () => void | Promise<void>;
  preResponseEventsMap?: Record<string, AssistantPreResponseEvent[]>;
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
    thinking: string;
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
    if (latestTool?.state === "running") return getToolDisplayName(latestTool.name);
    return text.thinking;
  }
  if (status === "streaming") {
    if (latestTool?.state === "running") {
      return getToolDisplayName(latestTool.name);
    }
    return text.streaming;
  }
  if (status === "aborted") return text.aborted;
  if (status === "error") return lastError || text.failed;
  return text.assistantWorking;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function AssistantPreResponseTimeline({ events }: { events: AssistantPreResponseEvent[] }) {
  const { messages } = useI18n();
  const sortedEvents = [...events].sort((a, b) => a.createdAt - b.createdAt);

  if (sortedEvents.length === 0) return null;

  return (
    <details className="group px-1 pb-1">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium text-muted-foreground marker:hidden">
        <Brain className="h-3.5 w-3.5" />
        <span>{messages.assistant.reasoning}</span>
      </summary>
      <div className="mt-2 space-y-3 pl-5">
        {sortedEvents.map((event) =>
          event.type === "reasoning" ? (
            <div key={event.id} className="space-y-1">
              <div className="whitespace-pre-wrap text-xs leading-6 text-muted-foreground/90">
                {event.text}
              </div>
            </div>
          ) : (
            <details key={event.id} className="group space-y-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium text-muted-foreground marker:hidden">
                {event.state === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : event.state === "error" ? (
                  <TriangleAlert className="h-3.5 w-3.5" />
                ) : (
                  <Wrench className="h-3.5 w-3.5" />
                )}
                <span>{getToolDisplayName(event.name)}</span>
              </summary>
              {event.output ? (
                <div className="whitespace-pre-wrap break-all pl-5 text-[11px] leading-5 text-muted-foreground/75">
                  {event.output}
                </div>
              ) : null}
            </details>
          ),
        )}
      </div>
    </details>
  );
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
  preResponseEventsMap = {},
  status,
  toolActivities = [],
}: AssistantMessageListProps) {
  const { messages: text } = useI18n();
  const { resolvedTheme } = useTheme();
  const [elapsedText, setElapsedText] = useState("0s");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const isProcessing = status === "submitted" || status === "thinking" || status === "streaming";

  useEffect(() => {
    if (!isProcessing) {
      setElapsedText("0s");
      return;
    }
    const startedAt = Date.now();
    setElapsedText("0s");
    const timer = window.setInterval(() => {
      setElapsedText(formatDuration(Date.now() - startedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  useEffect(() => {
    if (!copiedMessageId) return;
    const timer = window.setTimeout(() => {
      setCopiedMessageId(null);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [copiedMessageId]);

  const inlineStatusText = buildInlineStatusText(status, toolActivities, lastError, {
    requestSubmitted: text.assistant.requestSubmitted,
    thinking: `${text.assistant.reasoning} · ${elapsedText}`,
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
        const showCopy = hasText;
        const timelineEvents = !isUser ? (preResponseEventsMap[message.id] ?? []) : [];
        const showTimeline = !isUser && timelineEvents.length > 0;

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
                <div className="space-y-2">
                  {showTimeline ? <AssistantPreResponseTimeline events={timelineEvents} /> : null}
                  <div className="assistant-markdown px-1 py-1">
                    <MarkdownPreview
                      source={message.content}
                      wrapperElement={{
                        "data-color-mode": resolvedTheme === "dark" ? "dark" : "light",
                      }}
                      className="!bg-transparent !p-0 !text-sm !leading-relaxed !text-foreground"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {showTimeline ? <AssistantPreResponseTimeline events={timelineEvents} /> : null}
                  <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    <span>{inlineStatusText}</span>
                  </div>
                </div>
              )}
              {showCopy || showRegenerate ? (
                <div className="pt-1">
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    {showCopy ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          await navigator.clipboard.writeText(message.content);
                          setCopiedMessageId(message.id);
                        }}
                        title={
                          copiedMessageId === message.id
                            ? text.assistant.copied
                            : text.assistant.copy
                        }
                        aria-label={
                          copiedMessageId === message.id
                            ? text.assistant.copied
                            : text.assistant.copy
                        }
                      >
                        {copiedMessageId === message.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    ) : null}
                    {showRegenerate ? (
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
                    ) : null}
                  </div>
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
