export interface UserInfoData {
  username: string
  user_name: string
  user_uid: string
  user_id: string
  organization_name?: string
  identity_type_name?: string
}

export interface PersonalInfoData {
  xgh: string // 学号
  kycg: string // 科研成果
  kcs: string // 课程数
  tszj: string // 图书馆在借
  tsyj: string // 图书馆已借阅
  xykye: string // 校园卡余额
}

const TOKEN_KEY = 'ksu:token'
const USER_KEY = 'ksu:user'

export function saveAuth(token: string, user: UserInfoData) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getSavedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSavedUser(): UserInfoData | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfoData
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
