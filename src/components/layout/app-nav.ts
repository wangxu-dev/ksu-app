import type { LucideIcon } from 'lucide-react'
import { Home } from 'lucide-react'

export type AppNavItem = {
  to: '/home'
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: AppNavItem[] = [
  { to: '/home', label: '首页', icon: Home }
]

