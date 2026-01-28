import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useLogin } from '@/hooks/use-login'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const navigate = useNavigate()
  const { autoLogin } = useLogin()

  useEffect(() => {
    // 尝试自动登录
    autoLogin().then((result) => {
      if (result.success) {
        navigate({ to: '/home' })
      } else {
        navigate({ to: '/login' })
      }
    })
  }, [navigate, autoLogin])

  // 加载中显示
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">加载中...</p>
    </div>
  )
}
