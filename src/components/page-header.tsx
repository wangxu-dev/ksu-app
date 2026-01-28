import * as React from 'react'

type HeaderContent = React.ReactNode

type PageHeaderContextValue = {
  header: HeaderContent
  setHeader: (header: HeaderContent) => void
}

const PageHeaderContext = React.createContext<PageHeaderContextValue | null>(null)

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = React.useState<HeaderContent>(null)
  const value = React.useMemo(() => ({ header, setHeader }), [header])
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}

export function usePageHeader() {
  const ctx = React.useContext(PageHeaderContext)
  if (!ctx) throw new Error('usePageHeader must be used within PageHeaderProvider')
  return ctx
}

export function PageHeader({ children }: { children: React.ReactNode }) {
  const { setHeader } = usePageHeader()
  React.useEffect(() => {
    setHeader(children)
    return () => setHeader(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children])
  return null
}

