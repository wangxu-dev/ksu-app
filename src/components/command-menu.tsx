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
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { logout } from "@/lib/auth/service";

export function CommandMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { setTheme } = useTheme();

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-full items-center justify-start rounded-full border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:pr-12 md:w-40 lg:w-64"
      >
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <span className="inline-flex">搜索...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="输入指令或搜索内容..." />
        <CommandList>
          <CommandEmpty>没有找到结果。</CommandEmpty>
          <CommandGroup heading="导航">
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/home" }))}>
              <Home className="mr-2 h-4 w-4" />
              <span>首页</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/grades" }))}>
              <GraduationCap className="mr-2 h-4 w-4" />
              <span>成绩单</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/calendar" }))}>
              <CalendarDays className="mr-2 h-4 w-4" />
              <span>校历</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/assistant" }))}>
              <Bot className="mr-2 h-4 w-4" />
              <span>AI 助手</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="主题">
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
              <span>系统默认</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="账号">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  logout();
                  navigate({ to: "/login" });
                })
              }
            >
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">退出登录</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
