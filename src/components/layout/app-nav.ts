import type { LucideIcon } from "lucide-react";
import { Home, Bot } from "lucide-react";

export type AppNavItem = {
  to: "/home" | "/assistant";
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: AppNavItem[] = [
  { to: "/home", label: "首页", icon: Home },
  { to: "/assistant", label: "AI", icon: Bot },
];
