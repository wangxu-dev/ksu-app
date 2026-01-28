export type ThemeMode = 'system' | 'light' | 'dark'

const THEME_KEY = 'ksu:theme'

function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'system' || v === 'light' || v === 'dark'
}

export function getThemeMode(): ThemeMode {
  const raw = localStorage.getItem(THEME_KEY)
  return isThemeMode(raw) ? raw : 'system'
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(THEME_KEY, mode)
  applyThemeMode(mode)
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyThemeMode(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  window.dispatchEvent(new CustomEvent('ksu:theme'))
}

export function initTheme() {
  applyThemeMode(getThemeMode())

  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getThemeMode() === 'system') applyThemeMode('system')
  }

  if (media?.addEventListener) media.addEventListener('change', onChange)
  else if (media?.addListener) media.addListener(onChange)

  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) applyThemeMode(getThemeMode())
  }
  window.addEventListener('storage', onStorage)

  return () => {
    if (media?.removeEventListener) media.removeEventListener('change', onChange)
    else if (media?.removeListener) media.removeListener(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

