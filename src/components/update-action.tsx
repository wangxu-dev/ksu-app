import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/use-app-update";

export function UpdateAction() {
  const { status, installNow, installing } = useAppUpdate();

  if (status.state === "downloaded") {
    return (
      <Button size="sm" className="h-8 px-3 text-xs" onClick={installNow} disabled={installing}>
        {installing ? "准备更新..." : "重启更新"}
      </Button>
    );
  }

  if (status.state === "downloading") {
    const percent = Number(status.progress || 0);
    return (
      <Button size="sm" variant="secondary" className="h-8 px-3 text-xs" disabled>
        更新下载中 {percent}%
      </Button>
    );
  }

  return null;
}
