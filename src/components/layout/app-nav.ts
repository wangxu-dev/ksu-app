import type { LucideIcon } from "lucide-react";
import { Home, Bot, GraduationCap, CalendarDays } from "lucide-react";

export type AppNavItem = {
  to: "/home" | "/assistant" | "/grades" | "/calendar";
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: AppNavItem[] = [
  { to: "/home", label: "首页", icon: Home },
  { to: "/grades", label: "成绩单", icon: GraduationCap },
  { to: "/calendar", label: "校历", icon: CalendarDays },
  { to: "/assistant", label: "AI 助手", icon: Bot },
];
