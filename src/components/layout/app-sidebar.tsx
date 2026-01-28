import { NAV_ITEMS } from '@/components/layout/app-nav'
import { cn } from '@/lib/utils'
import { getSavedUser } from '@/lib/auth'
import { logout } from '@/lib/auth/service'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { PanelLeft, LogOut } from 'lucide-react'
import { useMemo } from 'react'

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const user = useMemo(() => getSavedUser(), [])
  const userInitial = (user?.user_name || user?.username || '未登录').trim().slice(0, 1)

  const onLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <aside
      className={cn(
        'group relative flex h-full w-full flex-col',
        'bg-sidebar text-sidebar-foreground',
        'border-r border-sidebar-border'
      )}
      data-collapsed={collapsed ? 'true' : 'false'}
      style={{ '--sidebar-icon-col': '2.5rem' } as React.CSSProperties}
    >
      <div className="px-2 pt-3 pb-2">
        <div className="grid grid-cols-[var(--sidebar-icon-col)_1fr_var(--sidebar-icon-col)] items-center">
          <div className="relative grid h-10 w-[--sidebar-icon-col] place-items-center">
            <img
              src="/ksu.png"
              alt="KSU"
              className={cn(
                'h-6 w-6 object-contain transition-opacity duration-150',
                collapsed && 'group-hover:opacity-0'
              )}
            />

            {collapsed ? (
              <button
                type="button"
                aria-label="展开侧边栏"
                onClick={onToggleCollapsed}
                className={cn(
                  'absolute inset-0 grid place-items-center',
                  'opacity-0 transition-opacity duration-150',
                  'group-hover:opacity-100',
                  'rounded-md hover:bg-sidebar-accent',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
                )}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div />

          {!collapsed ? (
            <button
              type="button"
              aria-label="收起侧边栏"
              onClick={onToggleCollapsed}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-md',
                'text-sidebar-foreground/60',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
              )}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <div className="flex-1 overflow-auto px-2">
          <nav className="py-2">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = pathname === item.to

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'grid h-9 w-full grid-cols-[var(--sidebar-icon-col)_1fr] items-center rounded-md text-sm',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <span className="grid h-9 w-[--sidebar-icon-col] place-items-center">
                      <Icon className="h-4 w-4" />
                    </span>

                    {!collapsed ? (
                      <span className="truncate pr-2 text-left">
                        {item.label}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>

        <div className="border-t border-sidebar-border px-2 pt-2 pb-2">
          <div
            className={cn(
              'grid grid-cols-[var(--sidebar-icon-col)_1fr] items-center rounded-md',
              'text-sidebar-foreground/80'
            )}
            title={collapsed ? (user?.user_name || user?.username || '未登录') : undefined}
          >
            <div className="grid h-9 w-[--sidebar-icon-col] place-items-center">
              <div className="grid h-8 w-8 place-items-center rounded-md border border-sidebar-border bg-sidebar-accent/30 text-[11px] font-medium">
                {userInitial}
              </div>
            </div>

            {!collapsed ? (
              <div className="min-w-0 pr-2 text-left leading-snug">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                  {user?.user_name || '未登录'}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user?.username || ''}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? '退出登录' : undefined}
            className={cn(
              'mt-1 grid h-9 w-full grid-cols-[var(--sidebar-icon-col)_1fr] items-center rounded-md text-sm',
              'text-sidebar-foreground/65',
              'transition-colors duration-150',
              'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
            )}
          >
            <span className="grid h-9 w-[--sidebar-icon-col] place-items-center">
              <LogOut className="h-4 w-4" />
            </span>
            {!collapsed ? (
              <span className="truncate pr-2 text-left">退出登录</span>
            ) : null}
          </button>
        </div>
      </div>
    </aside>
  )
}
