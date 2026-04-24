import { Bot, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AssistantChatHeaderProps = {
  activeTitle: string;
  onOpenSettings: () => void;
  onToggleHistory: () => void;
  showHistory: boolean;
};

function AssistantChatHeader({
  activeTitle,
  onOpenSettings,
  onToggleHistory,
  showHistory,
}: AssistantChatHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b bg-muted/20 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={onToggleHistory}
        >
          {showHistory ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="max-w-50 truncate text-[11px] font-bold text-foreground/80">
            {activeTitle}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground"
        onClick={onOpenSettings}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export { AssistantChatHeader };
