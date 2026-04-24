import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, GraduationCap, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function HomeSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { messages } = useI18n();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo(
    () => [
      { label: messages.calendar.grades, to: "/grades" as const, icon: GraduationCap },
      { label: messages.calendar.calendar, to: "/calendar" as const, icon: CalendarDays },
    ],
    [messages],
  );
  const placeholder = useMemo(() => messages.calendar.searchPlaceholder, [messages]);

  return (
    <>
      <div className="relative w-full max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input placeholder={placeholder} className="pl-9" onFocus={() => setOpen(true)} readOnly />
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={messages.calendar.searchInput} />
        <CommandList>
          <CommandEmpty>{messages.calendar.searchEmpty}</CommandEmpty>
          <CommandGroup heading={messages.calendar.function}>
            {commands.map((c) => {
              const Icon = c.icon;
              return (
                <CommandItem
                  key={c.to}
                  onSelect={() => {
                    setOpen(false);
                    navigate({ to: c.to });
                  }}
                >
                  <Icon aria-hidden="true" className="mr-2 h-4 w-4" />
                  {c.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
