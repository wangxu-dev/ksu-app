import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { applyThemeMode, getThemeMode, resolveTheme, setThemeMode, type ThemeMode } from '@/lib/theme'
import { Laptop, Moon, Sun } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function Icon({ mode }: { mode: 'light' | 'dark' }) {
  return mode === 'dark' ? (
    <Moon aria-hidden="true" className="h-4 w-4" />
  ) : (
    <Sun aria-hidden="true" className="h-4 w-4" />
  )
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => getThemeMode())
  const resolved = useMemo(() => resolveTheme(mode), [mode])

  useEffect(() => {
    const onTheme = () => setMode(getThemeMode())
    window.addEventListener('ksu:theme' as any, onTheme)
    return () => window.removeEventListener('ksu:theme' as any, onTheme)
  }, [])

  const choose = (m: ThemeMode) => {
    setMode(m)
    setThemeMode(m)
    applyThemeMode(m)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label="切换主题">
          <Icon mode={resolved} />
          <span className="hidden sm:inline">主题</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2">
        <div className="grid gap-1">
          <Button
            variant={mode === 'system' ? 'secondary' : 'ghost'}
            size="sm"
            className="justify-start gap-2"
            onClick={() => choose('system')}
          >
            <Laptop aria-hidden="true" className="h-4 w-4" />
            跟随系统
          </Button>
          <Button
            variant={mode === 'light' ? 'secondary' : 'ghost'}
            size="sm"
            className="justify-start gap-2"
            onClick={() => choose('light')}
          >
            <Sun aria-hidden="true" className="h-4 w-4" />
            浅色
          </Button>
          <Button
            variant={mode === 'dark' ? 'secondary' : 'ghost'}
            size="sm"
            className="justify-start gap-2"
            onClick={() => choose('dark')}
          >
            <Moon aria-hidden="true" className="h-4 w-4" />
            深色
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

