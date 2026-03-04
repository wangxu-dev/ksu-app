import { NAV_ITEMS } from "@/components/layout/app-nav";
import { getSavedUser } from "@/lib/auth";
import { logout } from "@/lib/auth/service";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, User, Settings, Moon, Sun } from "lucide-react";
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
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useMemo(() => getSavedUser(), []);
  const userInitial = (user?.user_name || user?.username || "U").trim().slice(0, 1);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r border-border/40 bg-sidebar">
      {/* 1. HEADER: ONLY SEARCH */}
      <SidebarHeader className="py-4 px-2">
        <SidebarMenu>
          <SidebarMenuItem>
             <CommandMenu isSidebarTrigger={true} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* 2. CONTENT: MAIN NAV */}
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
                    <span className="text-[11px] font-black uppercase tracking-wide">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* 3. FOOTER: ACTIONS + PROFILE */}
      <SidebarFooter className="p-2 gap-2">
        <SidebarMenu className="gap-2">
          {/* THEME TOGGLE + UPDATER */}
          <SidebarMenuItem>
            <div className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/40 bg-muted/20",
                isCollapsed ? "flex-col border-0 bg-transparent px-0" : "justify-between"
            )}>
                {!isCollapsed && <UpdateAction />}
                <button 
                    onClick={toggleTheme}
                    className={cn(
                        "flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-all hover:text-primary",
                        isCollapsed ? "h-8 w-8 rounded-lg border border-border/40 bg-muted/20" : "text-muted-foreground"
                    )}
                    title="切换主题"
                >
                    {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {!isCollapsed && <span>{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>}
                </button>
            </div>
          </SidebarMenuItem>

          {/* USER PROFILE */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent border border-transparent hover:border-border/40 transition-all">
                  <Avatar className="h-8 w-8 rounded-lg border border-border/50 shadow-xs">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-[10px] font-black">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="grid flex-1 text-left text-xs leading-tight ml-1">
                      <span className="truncate font-black uppercase tracking-tight">{user?.user_name}</span>
                      <span className="truncate text-[9px] font-bold text-muted-foreground opacity-60 italic">
                        {user?.username}
                      </span>
                    </div>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-xl border-border/50 shadow-xl" side="right" align="end" sideOffset={12}>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg border">
                      <AvatarFallback className="rounded-lg bg-muted font-black">{userInitial}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-black uppercase tracking-tight">{user?.user_name}</span>
                      <span className="truncate text-[10px] text-muted-foreground font-bold">{user?.organization_name}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/home" })} className="text-xs font-bold uppercase">
                  <User className="mr-2 size-3.5" /> Profile_Archive
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-xs font-bold uppercase">
                  <Settings className="mr-2 size-3.5" /> System_Config
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                    onClick={() => { logout(); navigate({ to: "/login" }); }} 
                    className="text-destructive font-black text-xs uppercase"
                >
                  <LogOut className="mr-2 size-3.5" /> Terminate_Session
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
