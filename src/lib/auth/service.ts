import { invoke } from '@tauri-apps/api/core'
import {
  clearAuth,
  clearRememberedAccount,
  saveAuth,
  saveRememberedAccount,
  type UserInfoData,
} from '@/lib/auth'
import { getPersonalInfo, getUserInfo } from '@/lib/api/ksu'

type LoginResponse = {
  success: boolean
  token?: string
  message: string
}

export async function loginWithBackend(opts: {
  username: string
  password: string
  rememberAccount: boolean
}): Promise<{ token: string; user: UserInfoData }> {
  const result = await invoke<LoginResponse>('login', {
    username: opts.username,
    password: opts.password,
    remember: false,
  })

  if (!result.success || !result.token) {
    throw new Error(result.message || '登录失败')
  }

  const user = await getUserInfo(result.token)
  saveAuth(result.token, user)

  if (opts.rememberAccount) saveRememberedAccount(opts.username)
  else clearRememberedAccount()

  return { token: result.token, user }
}

export async function validateToken(token: string): Promise<UserInfoData> {
  const user = await getUserInfo(token)
  saveAuth(token, user)
  return user
}

export async function fetchDashboard(token: string) {
  return getPersonalInfo(token)
}

export function logout() {
  clearAuth()
}

