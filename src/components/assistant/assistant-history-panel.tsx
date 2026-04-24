import { Inbox, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return (
    <div
      className={cn(
        "flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-border/40 bg-muted/5 transition-[margin,opacity] duration-300 ease-in-out",
        open ? "mr-4 opacity-100" : "-ml-56 opacity-0 pointer-events-none",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b bg-muted/10 p-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          对话历史
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
          disabled={disabled}
          onClick={onNewConversation}
          title="开启新对话"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-auto p-1.5 [scrollbar-width:thin]">
        {conversations.length === 0 ? (
          <div className="flex h-20 flex-col items-center justify-center px-2 text-center text-[10px] text-muted-foreground opacity-50">
            <Inbox className="mb-1 h-4 w-4" />
            <span>暂无历史记录</span>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-lg border border-transparent p-2 transition-all",
                activeConversationId === conversation.id
                  ? "border-border/20 bg-muted/50 shadow-xs"
                  : "hover:bg-muted/30",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <MessageSquareText className="h-3 w-3 shrink-0 opacity-40" />
              <span className="flex-1 truncate text-[11px] font-medium text-foreground/80">
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
