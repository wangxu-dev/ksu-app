import type { LucideIcon } from "lucide-react";
import { Home, Bot, GraduationCap, CalendarDays } from "lucide-react";

export type AppNavItem = {
  to: "/home" | "/assistant" | "/grades" | "/calendar";
  labelKey: "home" | "grades" | "calendar" | "assistant";
  icon: LucideIcon;
};

export const NAV_ITEMS: AppNavItem[] = [
  { to: "/home", labelKey: "home", icon: Home },
  { to: "/grades", labelKey: "grades", icon: GraduationCap },
  { to: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { to: "/assistant", labelKey: "assistant", icon: Bot },
];
