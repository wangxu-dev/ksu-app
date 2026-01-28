import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppTopNav } from '@/components/app-top-nav'
import { usePageHeader } from '@/components/page-header'
import { getSavedUser } from '@/lib/auth'
import { logout } from '@/lib/auth/service'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { CalendarDays, GraduationCap, Home, LogOut } from 'lucide-react'
import { useMemo } from 'react'

const NAV_GROUPS = [
  {
    label: '概览',
    items: [{ to: '/home' as const, label: '首页', icon: Home }],
  },
  {
    label: '学习',
    items: [
      { to: '/grades' as const, label: '成绩', icon: GraduationCap },
      { to: '/calendar' as const, label: '校历', icon: CalendarDays },
    ],
  },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const user = useMemo(() => getSavedUser(), [])
  const { header } = usePageHeader()

  const onLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg border bg-background">
              <img src="/ksu.svg" alt="KSU" className="h-5 w-5" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-semibold tracking-tight">校园助手</div>
              <div className="truncate text-xs text-muted-foreground">Kashgar University</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label}>
                          <Link to={item.to} className="gap-2">
                            <Icon aria-hidden="true" className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <div className="px-2 pb-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user?.user_name || '未登录'}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.username || ''}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 w-full justify-start gap-2" onClick={onLogout}>
              <LogOut aria-hidden="true" className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">退出登录</span>
            </Button>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden md:flex">
                <AppTopNav />
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0">{header}</div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
