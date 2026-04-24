import { Badge } from "@/components/ui/badge";

function AssistantPageHeader() {
  return (
    <div className="shrink-0 flex items-center justify-between">
      <div className="space-y-0.5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">智能助手</h2>
        <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
          OpenAI Agents SDK · 主进程流式运行
        </p>
      </div>
      <Badge
        variant="outline"
        className="h-5 border-primary/20 bg-primary/5 px-2 text-[9px] font-bold text-primary"
      >
        服务就绪
      </Badge>
    </div>
  );
}

export { AssistantPageHeader };
