import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/use-app-update";
import { useI18n } from "@/lib/i18n";

export function UpdateAction() {
  const { status, installNow, installing } = useAppUpdate();
  const { messages } = useI18n();

  if (status.state === "downloaded") {
    return (
      <Button size="sm" className="h-8 px-3 text-xs" onClick={installNow} disabled={installing}>
        {installing ? messages.updater.preparing : messages.updater.restart}
      </Button>
    );
  }

  if (status.state === "downloading") {
    const percent = Number(status.progress || 0);
    return (
      <Button size="sm" variant="secondary" className="h-8 px-3 text-xs" disabled>
        {messages.updater.downloading(percent)}
      </Button>
    );
  }

  return null;
}
