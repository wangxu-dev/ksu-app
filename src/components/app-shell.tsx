import { ThemeToggle } from '@/components/theme-toggle'
import { AppTopNav } from '@/components/app-top-nav'
import { usePageHeader } from '@/components/page-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { header } = usePageHeader()
  const { collapsed, toggle } = useSidebarCollapsed()

  return (
    <div
      className="flex min-h-svh w-full bg-background"
      style={
        {
          // Sidebar widths (tweak these two values to your preference)
          '--sidebar-expanded': '12rem',
          '--sidebar-collapsed': '3.5rem',
          '--sidebar-width': collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
        } as React.CSSProperties
      }
    >
      <div
        className="shrink-0 transition-[width] duration-200 ease-linear"
        style={{ width: 'var(--sidebar-width)' }}
      >
        <AppSidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:mx-auto lg:max-w-6xl">
            <div className="min-w-0">
              <AppTopNav />
            </div>
            <div className="flex min-w-0 items-center justify-end gap-2">
              {header ? <div className="min-w-0">{header}</div> : null}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className={cn('w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:mx-auto lg:max-w-6xl')}>
          {children}
        </main>
      </div>
    </div>
  )
}
