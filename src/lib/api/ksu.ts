import { fetchJson, ApiError } from '@/lib/api/client'
import type { PersonalInfoData, UserInfoData } from '@/lib/auth'
import type { GradesData, GradesRaw } from '@/lib/grades'

const USER_INFO_URL = 'https://authx-service.ksu.edu.cn/personal/api/v1/personal/me/user'
const PERSONAL_INFO_URL =
  'https://portal-data.ksu.edu.cn/portalCenter/v2/personalData/getPersonalInfo'
const GRADES_URL = 'https://score-inquiry.ksu.edu.cn/api/std-grade/detail?project=1'

type UserInfoRaw = {
  code: number
  message: string | null
  data?: {
    username: string
    roles?: string[]
    attributes?: {
      organizationName?: string | null
      identityTypeName?: string | null
      userName?: string | null
      userId?: string | null
      userUid?: string | null
    }
  } | null
}

type PersonalInfoRaw = {
  code: number
  message: string | null
  data?: PersonalInfoData | null
}

function baseHeaders(token: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'x-id-token': token,
    'x-device-info': 'PC',
    'x-terminal-info': 'PC',
    Referer: 'https://portal.ksu.edu.cn/main.html',
  }
}

export async function getUserInfo(token: string): Promise<UserInfoData> {
  const raw = await fetchJson<UserInfoRaw>(USER_INFO_URL, {
    method: 'GET',
    headers: baseHeaders(token),
    timeoutMs: 20_000,
  })

  if (raw.code !== 0 || !raw.data) {
    throw new ApiError(raw.message || '获取用户信息失败', { code: raw.code, payload: raw })
  }

  const attrs = raw.data.attributes ?? {}
  return {
    username: raw.data.username,
    user_name: attrs.userName ?? '',
    user_uid: attrs.userUid ?? '',
    user_id: attrs.userId ?? '',
    organization_name: attrs.organizationName ?? undefined,
    identity_type_name: attrs.identityTypeName ?? undefined,
  }
}

export async function getPersonalInfo(token: string): Promise<PersonalInfoData> {
  const raw = await fetchJson<PersonalInfoRaw>(PERSONAL_INFO_URL, {
    method: 'GET',
    headers: baseHeaders(token),
    timeoutMs: 20_000,
  })

  if (raw.code !== 0 || !raw.data) {
    throw new ApiError(raw.message || '获取个人信息失败', { code: raw.code, payload: raw })
  }

  return raw.data
}

export async function getGrades(token: string): Promise<GradesData> {
  const raw = await fetchJson<GradesRaw>(GRADES_URL, {
    method: 'GET',
    headers: baseHeaders(token),
    timeoutMs: 25_000,
  })

  if (!raw.success || raw.code !== 200 || !raw.data) {
    throw new ApiError(raw.msg || '获取成绩失败', { code: raw.code, payload: raw })
  }

  return raw.data
}
