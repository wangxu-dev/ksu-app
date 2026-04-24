import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  applyThemeMode,
  getThemeMode,
  resolveTheme,
  setThemeMode,
  type ThemeMode,
} from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function Icon({ mode }: { mode: "light" | "dark" }) {
  return mode === "dark" ? (
    <Moon aria-hidden="true" className="h-4 w-4" />
  ) : (
    <Sun aria-hidden="true" className="h-4 w-4" />
  );
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => getThemeMode());
  const { messages } = useI18n();
  const resolved = useMemo(() => resolveTheme(mode), [mode]);

  useEffect(() => {
    const onTheme = () => setMode(getThemeMode());
    window.addEventListener("ksu:theme" as any, onTheme);
    return () => window.removeEventListener("ksu:theme" as any, onTheme);
  }, []);

  const choose = (m: ThemeMode) => {
    setMode(m);
    setThemeMode(m);
    applyThemeMode(m);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label={messages.theme.ariaLabel}>
          <Icon mode={resolved} />
          <span className="hidden sm:inline">{messages.theme.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2">
        <div className="grid gap-1">
          <Button
            variant={mode === "system" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start gap-2"
            onClick={() => choose("system")}
          >
            <Laptop aria-hidden="true" className="h-4 w-4" />
            {messages.theme.system}
          </Button>
          <Button
            variant={mode === "light" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start gap-2"
            onClick={() => choose("light")}
          >
            <Sun aria-hidden="true" className="h-4 w-4" />
            {messages.theme.light}
          </Button>
          <Button
            variant={mode === "dark" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start gap-2"
            onClick={() => choose("dark")}
          >
            <Moon aria-hidden="true" className="h-4 w-4" />
            {messages.theme.dark}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
