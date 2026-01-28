import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { useNavigate } from '@tanstack/react-router'
import { CalendarDays, GraduationCap, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const COMMANDS = [
  { label: '成绩', to: '/grades' as const, icon: GraduationCap },
  { label: '校历', to: '/calendar' as const, icon: CalendarDays },
]

export function HomeSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const placeholder = useMemo(() => '搜索功能（Ctrl+K）', [])

  return (
    <>
      <div className="relative w-full max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-9"
          onFocus={() => setOpen(true)}
          readOnly
        />
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="搜索…" />
        <CommandList>
          <CommandEmpty>没有匹配的结果</CommandEmpty>
          <CommandGroup heading="功能">
            {COMMANDS.map((c) => {
              const Icon = c.icon
              return (
                <CommandItem
                  key={c.to}
                  onSelect={() => {
                    setOpen(false)
                    navigate({ to: c.to })
                  }}
                >
                  <Icon aria-hidden="true" className="mr-2 h-4 w-4" />
                  {c.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
