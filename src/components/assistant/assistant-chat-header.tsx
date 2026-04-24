import { Bot, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

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
  const { messages } = useI18n();

  return (
    <div className="flex shrink-0 items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-muted-foreground"
          onClick={onToggleHistory}
        >
          {showHistory ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-50 truncate text-sm font-medium text-foreground">
            {activeTitle}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground"
        onClick={onOpenSettings}
        title={messages.assistant.settings}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export { AssistantChatHeader };
