import { Inbox, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AssistantConversation } from "@/lib/assistant/types";

type AssistantHistoryPanelProps = {
  activeConversationId: string | null;
  conversations: AssistantConversation[];
  disabled?: boolean;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  open: boolean;
};

function AssistantHistoryPanel({
  activeConversationId,
  conversations,
  disabled,
  onDeleteConversation,
  onNewConversation,
  onSelectConversation,
  open,
}: AssistantHistoryPanelProps) {
  const { messages } = useI18n();

  return (
    <div
      className={cn(
        "flex w-56 shrink-0 flex-col overflow-hidden border-r border-border/20 bg-transparent transition-[margin,opacity] duration-300 ease-in-out",
        open ? "opacity-100" : "-ml-56 opacity-0 pointer-events-none",
      )}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          {messages.assistant.historyTitle}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          disabled={disabled}
          onClick={onNewConversation}
          title={messages.assistant.newConversation}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-auto px-2 pb-2 [scrollbar-width:thin]">
        {conversations.length === 0 ? (
          <div className="flex h-20 flex-col items-center justify-center px-2 text-center text-xs text-muted-foreground opacity-60">
            <Inbox className="mb-1 h-4 w-4" />
            <span>{messages.assistant.historyEmpty}</span>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-xl border border-transparent p-2 transition-all",
                activeConversationId === conversation.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <MessageSquareText className="h-3 w-3 shrink-0 opacity-40" />
              <span className="flex-1 truncate text-xs font-medium text-foreground">
                {conversation.title}
              </span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteConversation(conversation.id);
                }}
                className="p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                disabled={disabled}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export { AssistantHistoryPanel };
