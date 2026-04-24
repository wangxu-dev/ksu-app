import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const isOpenRouter = settings.activeProvider === "openrouter";

  async function handleSave() {
    await onSave();
    onOpenChange(false);
  }

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
              {messages.assistant.provider}
            </label>
            <Select
              value={settings.activeProvider}
              onValueChange={(value) =>
                setSettings({
                  ...settings,
                  activeProvider: value === "deepseek" ? "deepseek" : "openrouter",
                })
              }
            >
              <SelectTrigger className="h-9 bg-muted/20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">{messages.assistant.openrouter}</SelectItem>
                <SelectItem value="deepseek">{messages.assistant.deepseek}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {isOpenRouter ? messages.assistant.openrouter : messages.assistant.deepseek}
            </label>
            <div className="space-y-3 rounded-md border border-border/60 p-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {messages.assistant.baseUrl}
                </label>
                <Input
                  className="h-9 bg-muted/20 font-mono text-sm"
                  value={isOpenRouter ? settings.openrouterBaseUrl : settings.deepseekBaseUrl}
                  onChange={(event) =>
                    setSettings(
                      isOpenRouter
                        ? { ...settings, openrouterBaseUrl: event.target.value }
                        : { ...settings, deepseekBaseUrl: event.target.value },
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {messages.assistant.model}
                </label>
                <Input
                  className="h-9 bg-muted/20 font-mono text-sm"
                  value={isOpenRouter ? settings.openrouterModel : settings.deepseekModel}
                  onChange={(event) =>
                    setSettings(
                      isOpenRouter
                        ? { ...settings, openrouterModel: event.target.value }
                        : { ...settings, deepseekModel: event.target.value },
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {messages.assistant.apiKey}
                </label>
                <Input
                  type="password"
                  className="h-9 bg-muted/20 font-mono text-sm"
                  value={isOpenRouter ? settings.openrouterApiKey : settings.deepseekApiKey}
                  onChange={(event) =>
                    setSettings(
                      isOpenRouter
                        ? { ...settings, openrouterApiKey: event.target.value }
                        : { ...settings, deepseekApiKey: event.target.value },
                    )
                  }
                />
              </div>
            </div>
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
          <Button size="sm" onClick={() => void handleSave()}>
            {messages.assistant.saveSettings}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AssistantSettingsDialog };
