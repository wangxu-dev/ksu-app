import { SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type AssistantComposerProps = {
  disabled?: boolean;
  isBusy?: boolean;
  onAbort?: () => void | Promise<void>;
  onSend: () => void | Promise<void>;
  prompt: string;
  setPrompt: (value: string) => void;
};

function AssistantComposer({
  disabled,
  isBusy,
  onAbort,
  onSend,
  prompt,
  setPrompt,
}: AssistantComposerProps) {
  return (
    <div className="shrink-0 border-t bg-muted/10 p-4">
      <div className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-xl border border-border/60 bg-background p-2 shadow-sm transition-all focus-within:border-primary/40">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void onSend();
            }
          }}
          placeholder="输入指令或提问..."
          rows={1}
          className="min-h-10 max-h-32 flex-1 resize-none border-0 bg-transparent py-2 text-[13px] font-medium shadow-none focus-visible:ring-0"
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg shadow-xs"
          disabled={isBusy ? !onAbort : disabled}
          onClick={() => {
            if (isBusy) {
              void onAbort?.();
              return;
            }
            void onSend();
          }}
        >
          {isBusy ? <Square className="h-4 w-4" /> : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export { AssistantComposer };
