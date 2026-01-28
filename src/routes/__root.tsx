import { AppShell } from '@/components/app-shell'
import { PageHeaderProvider } from '@/components/page-header'
import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <RootLayout />
  ),
})

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  if (pathname.startsWith('/login')) {
    return <Outlet />
  }

  return (
    <PageHeaderProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </PageHeaderProvider>
  )
}
