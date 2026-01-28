import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'ksu.sidebar.collapsed'
const SHORTCUT_KEY = 'b'

function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'true') return true
    if (v === 'false') return false
    return false
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  } catch {
    // ignore
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed())

  useEffect(() => {
    writeCollapsed(collapsed)
  }, [collapsed])

  const toggle = useMemo(() => () => setCollapsed((v) => !v), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() !== SHORTCUT_KEY) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  return { collapsed, setCollapsed, toggle }
}

