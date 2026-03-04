import { NAV_ITEMS } from "@/components/layout/app-nav";
import { getSavedUser } from "@/lib/auth";
import { logout } from "@/lib/auth/service";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, User, Settings, Moon, Sun, Monitor } from "lucide-react";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CommandMenu } from "@/components/command-menu";
import { UpdateAction } from "@/components/update-action";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const navigate = useNavigate();
  const { setTheme, theme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useMemo(() => getSavedUser(), []);

  // 统一初始头像标识，使用“用”字或名字首字符
  const userInitial = useMemo(() => {
    const name = user?.user_name || user?.username || "用户";
    return name.charAt(0);
  }, [user]);

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const themeConfig = {
    light: { label: "浅色模式", icon: Sun },
    dark: { label: "深色模式", icon: Moon },
    system: { label: "跟随系统", icon: Monitor },
  }[theme as "light" | "dark" | "system"] || { label: "跟随系统", icon: Monitor };

  const ThemeIcon = themeConfig.icon;

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="border-r border-border/40 bg-sidebar font-sans"
      style={
        {
          "--sidebar-width": "14rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <SidebarHeader className="py-4 px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <CommandMenu isSidebarTrigger={true} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu className="gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-9">
                  <Link to={item.to} className="flex items-center gap-3">
                    <Icon className="size-4 shrink-0" />
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 gap-2">
        <SidebarMenu className="gap-2">
          {/* 主题切换按钮 */}
          <SidebarMenuItem>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/40 bg-muted/20",
                isCollapsed ? "flex-col border-0 bg-transparent px-0" : "justify-between",
              )}
            >
              {!isCollapsed && <UpdateAction />}
              <button
                onClick={cycleTheme}
                className={cn(
                  "flex items-center justify-center gap-2 text-[11px] font-bold transition-all hover:text-primary",
                  isCollapsed
                    ? "h-9 w-9 rounded-lg border border-border/40 bg-muted/20"
                    : "text-muted-foreground",
                )}
                title={`当前: ${themeConfig.label}`}
              >
                <ThemeIcon className="h-4 w-4" />
                {!isCollapsed && <span>{themeConfig.label}</span>}
              </button>
            </div>
          </SidebarMenuItem>

          {/* 个人资料菜单 */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent border border-transparent transition-all"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-border/50 shadow-sm">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                      <span className="truncate font-bold text-foreground">
                        {user?.user_name || "未登录"}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground font-medium opacity-70">
                        {user?.username || "账号管理"}
                      </span>
                    </div>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg border-border/50 shadow-xl font-sans"
                side="right"
                align="end"
                sideOffset={12}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg border">
                      <AvatarFallback className="rounded-lg bg-muted font-bold text-xs">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold text-foreground">
                        {user?.user_name || "当前用户"}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground font-medium">
                        {user?.organization_name || "喀什大学"}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/home" })}
                  className="text-xs font-medium cursor-pointer"
                >
                  <User className="mr-2 size-4 opacity-70" /> 个人资料首页
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-xs font-medium opacity-50">
                  <Settings className="mr-2 size-4 opacity-70" /> 助手高级设置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate({ to: "/login" });
                  }}
                  className="text-destructive font-bold text-xs cursor-pointer focus:bg-destructive focus:text-destructive-foreground transition-colors"
                >
                  <LogOut className="mr-2 size-4" /> 退出当前账号
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
