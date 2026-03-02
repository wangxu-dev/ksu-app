import { ipcInvoke } from "@/lib/ipc";
import { AUTH_LOGIN_CHANNEL } from "@/lib/request/channels";
import {
  clearAuth,
  clearRememberedAccount,
  saveAuth,
  saveRememberedAccount,
  type PersonalInfoData,
  type UserInfoData,
} from "@/lib/auth";
import { getCalendarMonth, getGrades, getPersonalInfo, getUserInfo } from "@/lib/api/ksu";
import { KSU_CACHE_POLICY } from "@/lib/cache/policy";
import { getCachedGrades, setCachedGrades, type CachedGrades, type GradesData } from "@/lib/grades";
import {
  getCachedPersonalInfo,
  setCachedPersonalInfo,
  type CachedPersonalInfo,
} from "@/lib/personal";
import {
  formatYearMonth,
  getCachedCalendarMonth,
  setCachedCalendarMonth,
  type CalendarDay,
} from "@/lib/calendar";

type LoginResponse = {
  success: boolean;
  token?: string;
  message: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserInfoWithRetry(token: string, retryCount = 1): Promise<UserInfoData> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await getUserInfo(token);
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) {
        await sleep(300);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("获取用户信息失败");
}

export async function loginWithBackend(opts: {
  username: string;
  password: string;
  rememberAccount: boolean;
}): Promise<{ token: string; user: UserInfoData }> {
  const result = await ipcInvoke<LoginResponse>(AUTH_LOGIN_CHANNEL, {
    username: opts.username,
    password: opts.password,
  });

  if (!result.success || !result.token) {
    throw new Error(result.message || "登录失败");
  }

  let user: UserInfoData;
  try {
    user = await getUserInfoWithRetry(result.token, 1);
  } catch {
    user = {
      username: opts.username,
      user_name: opts.username,
      user_uid: "",
      user_id: "",
    };
  }
  saveAuth(result.token, user);

  if (opts.rememberAccount) saveRememberedAccount(opts.username);
  else clearRememberedAccount();

  return { token: result.token, user };
}

export async function validateToken(token: string): Promise<UserInfoData> {
  const user = await getUserInfoWithRetry(token, 1);
  saveAuth(token, user);
  return user;
}

export async function fetchDashboard(
  token: string,
  opts?: { maxAgeMs?: number; force?: boolean },
): Promise<PersonalInfoData> {
  const maxAgeMs = opts?.maxAgeMs ?? KSU_CACHE_POLICY.personalInfo.ttlMs;
  const cached: CachedPersonalInfo | null = getCachedPersonalInfo();
  const isFresh = cached ? Date.now() - cached.fetchedAt <= maxAgeMs : false;

  if (cached && isFresh && !opts?.force) {
    return cached.data;
  }

  const data = await getPersonalInfo(token);
  setCachedPersonalInfo(data);
  return data;
}

export async function getGradesCached(
  token: string,
  opts?: { maxAgeMs?: number; force?: boolean },
): Promise<{ data: GradesData; cached: boolean; fetchedAt: number }> {
  const maxAgeMs = opts?.maxAgeMs ?? KSU_CACHE_POLICY.grades.ttlMs;
  const cached: CachedGrades | null = getCachedGrades();
  const isFresh = cached ? Date.now() - cached.fetchedAt <= maxAgeMs : false;

  if (cached && isFresh && !opts?.force) {
    return { data: cached.data, cached: true, fetchedAt: cached.fetchedAt };
  }

  const data = await getGrades(token);
  setCachedGrades(data);
  return { data, cached: false, fetchedAt: Date.now() };
}

export async function getCalendarMonthCached(
  token: string,
  yearMonth: string,
  opts?: { maxAgeMs?: number; force?: boolean },
): Promise<{ data: CalendarDay[]; cached: boolean; fetchedAt: number }> {
  const maxAgeMs = opts?.maxAgeMs ?? KSU_CACHE_POLICY.calendar.ttlMs;
  const cached = getCachedCalendarMonth(yearMonth);
  const isFresh = cached ? Date.now() - cached.fetchedAt <= maxAgeMs : false;

  if (cached && isFresh && !opts?.force) {
    return { data: cached.data, cached: true, fetchedAt: cached.fetchedAt };
  }

  const data = await getCalendarMonth(token, yearMonth);
  setCachedCalendarMonth(yearMonth, data);
  return { data, cached: false, fetchedAt: Date.now() };
}

export function currentYearMonth() {
  return formatYearMonth(new Date());
}

export function logout() {
  clearAuth();
}
