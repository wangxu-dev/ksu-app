import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getToolDisplayName } from "@/lib/assistant/tool-display";
import type { AssistantViewStatus, ToolActivity } from "@/lib/assistant/types";

type AssistantStatusBarProps = {
  lastError: string | null;
  status: AssistantViewStatus;
  toolActivities: ToolActivity[];
};

function statusText(status: AssistantViewStatus): string {
  if (status === "submitted") return "请求已发送";
  if (status === "thinking") return "助手处理中";
  if (status === "streaming") return "正在生成回复";
  if (status === "completed") return "生成完成";
  if (status === "aborted") return "已停止";
  if (status === "error") return "请求失败";
  return "等待输入";
}

function AssistantStatusBar({ lastError, status, toolActivities }: AssistantStatusBarProps) {
  const visibleTools = toolActivities.slice(-3);
  const isWorking = status === "submitted" || status === "thinking" || status === "streaming";

  return (
    <div className="shrink-0 border-b bg-muted/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-border/60 text-[10px]">
            {isWorking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {statusText(status)}
          </Badge>
          {lastError ? (
            <span className="text-[10px] font-medium text-destructive">{lastError}</span>
          ) : null}
        </div>
      </div>
      {visibleTools.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {visibleTools.map((tool) => (
            <Badge
              key={tool.toolCallId}
              variant="outline"
              className="max-w-full gap-1.5 border-border/60 text-[10px]"
            >
              {tool.state === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              <span>{getToolDisplayName(tool.name)}</span>
              <span className="text-muted-foreground">
                {tool.state === "running" ? "处理中" : tool.state === "success" ? "完成" : "失败"}
              </span>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { AssistantStatusBar };
