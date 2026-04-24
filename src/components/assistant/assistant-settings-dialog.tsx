import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { AssistantSettings } from "@/lib/assistant/types";

type AssistantSettingsDialogProps = {
  onOpenChange: (open: boolean) => void;
  onSave: () => void | Promise<void>;
  open: boolean;
  setSettings: (settings: AssistantSettings) => void;
  settings: AssistantSettings;
};

function AssistantSettingsDialog({
  onOpenChange,
  onSave,
  open,
  setSettings,
  settings,
}: AssistantSettingsDialogProps) {
  const { messages } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-112.5 border-border/60">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {messages.assistant.settings}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {messages.assistant.baseUrl}
            </label>
            <Input
              className="h-9 bg-muted/20 font-mono text-sm"
              value={settings.baseUrl}
              onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {messages.assistant.model}
            </label>
            <Input
              className="h-9 bg-muted/20 font-mono text-sm"
              value={settings.model}
              onChange={(event) => setSettings({ ...settings, model: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {messages.assistant.apiKey}
            </label>
            <Input
              type="password"
              className="h-9 bg-muted/20 font-mono text-sm"
              value={settings.apiKey}
              onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {messages.assistant.systemPrompt}
            </label>
            <Textarea
              className="min-h-25 bg-muted/20 text-sm"
              value={settings.systemPrompt}
              onChange={(event) => setSettings({ ...settings, systemPrompt: event.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {messages.common.cancel}
          </Button>
          <Button size="sm" onClick={() => void onSave()}>
            {messages.assistant.saveSettings}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AssistantSettingsDialog };
