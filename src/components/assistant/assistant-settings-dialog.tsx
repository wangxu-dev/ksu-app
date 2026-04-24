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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-112.5 border-border/60">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">助手配置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              接口地址
            </label>
            <Input
              className="h-9 bg-muted/20 font-mono text-xs"
              value={settings.baseUrl}
              onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              模型名称
            </label>
            <Input
              className="h-9 bg-muted/20 font-mono text-xs"
              value={settings.model}
              onChange={(event) => setSettings({ ...settings, model: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              密钥 (API Key)
            </label>
            <Input
              type="password"
              className="h-9 bg-muted/20 font-mono text-xs"
              value={settings.apiKey}
              onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              系统提示词
            </label>
            <Textarea
              className="min-h-25 bg-muted/20 text-xs"
              value={settings.systemPrompt}
              onChange={(event) => setSettings({ ...settings, systemPrompt: event.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={() => void onSave()}>
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AssistantSettingsDialog };
