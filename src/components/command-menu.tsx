import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { 
  CalendarDays, 
  GraduationCap, 
  Bot, 
  Home, 
  LogOut, 
  Moon, 
  Sun, 
  Laptop,
  Search
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { logout } from "@/lib/auth/service";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function CommandMenu({ isSidebarTrigger = false }: { isSidebarTrigger?: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { setTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (isSidebarTrigger) {
    return (
        <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
            isCollapsed ? "justify-center px-0 h-9" : "justify-start"
          )}
          title="搜索功能 (Ctrl+K)"
        >
          <Search className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="text-[12px] font-medium">搜索功能...</span>}
          {!isCollapsed && <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-background px-1 font-mono text-[9px] font-bold opacity-100">
            K
          </kbd>}
        </button>
        <CommandDialogContents open={open} setOpen={setOpen} runCommand={runCommand} setTheme={setTheme} navigate={navigate} />
        </>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-full items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:pr-12 md:w-40 lg:w-64"
      >
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <span className="inline-flex">搜索功能...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialogContents open={open} setOpen={setOpen} runCommand={runCommand} setTheme={setTheme} navigate={navigate} />
    </>
  );
}

function CommandDialogContents({ open, setOpen, runCommand, setTheme, navigate }: any) {
    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="输入指令或搜索内容..." />
        <CommandList className="[scrollbar-width:thin]">
          <CommandEmpty>未找到相关结果。</CommandEmpty>
          <CommandGroup heading="页面跳转">
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/home" }))}>
              <Home className="mr-2 h-4 w-4" />
              <span>控制台首页</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/grades" }))}>
              <GraduationCap className="mr-2 h-4 w-4" />
              <span>我的成绩单</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/calendar" }))}>
              <CalendarDays className="mr-2 h-4 w-4" />
              <span>校历查询</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/assistant" }))}>
              <Bot className="mr-2 h-4 w-4" />
              <span>AI 助手</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="界面主题">
            <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
              <Sun className="mr-2 h-4 w-4" />
              <span>浅色模式</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
              <Moon className="mr-2 h-4 w-4" />
              <span>深色模式</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
              <Laptop className="mr-2 h-4 w-4" />
              <span>跟随系统</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="账户管理">
            <CommandItem onSelect={() => runCommand(() => { logout(); navigate({ to: "/login" }); })}>
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive font-bold">退出当前账户</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    )
}
