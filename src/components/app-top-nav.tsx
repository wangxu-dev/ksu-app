import { useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { cn } from '@/lib/utils'

type TopNavItem = {
  label: string
  href: `#${string}`
}

function itemsForPathname(pathname: string): TopNavItem[] {
  if (pathname.startsWith('/grades')) {
    return [
      { label: '概览', href: '#summary' },
      { label: '学期/课程', href: '#semesters' },
    ]
  }

  if (pathname.startsWith('/calendar')) {
    return [{ label: '月视图', href: '#month' }]
  }

  if (pathname.startsWith('/home')) {
    return [
      { label: '个人信息', href: '#profile' },
      { label: '概览', href: '#overview' },
    ]
  }

  return []
}

export function AppTopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const items = useMemo(() => itemsForPathname(pathname), [pathname])
  if (items.length === 0) return null

  return (
    <NavigationMenu>
      <NavigationMenuList className="space-x-0">
        {items.map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink asChild>
              <a
                href={item.href}
                className={cn(navigationMenuTriggerStyle(), 'h-8 px-3 text-xs')}
              >
                {item.label}
              </a>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

