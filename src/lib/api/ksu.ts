import { ApiError } from "@/lib/api/client";
import { proxyRequest } from "@/lib/api/proxy";
import type { PersonalInfoData, UserInfoData } from "@/lib/auth";
import type { GradesData, GradesRaw } from "@/lib/grades";
import type { CalendarDay, CalendarResponse } from "@/lib/calendar";

const USER_INFO_URL = "https://authx-service.ksu.edu.cn/personal/api/v1/personal/me/user";
const PERSONAL_INFO_URL =
  "https://portal-data.ksu.edu.cn/portalCenter/v2/personalData/getPersonalInfo";
const GRADES_URL = "https://score-inquiry.ksu.edu.cn/api/std-grade/detail?project=1";
const CALENDAR_URL = "https://portal-data.ksu.edu.cn/portalCenter/v2/personalData/getXlInfo";

const REQUEST_MODE = "frontend" as const;

type UserInfoRaw = {
  code: number;
  message: string | null;
  data?: {
    username: string;
    roles?: string[];
    attributes?: {
      organizationName?: string | null;
      identityTypeName?: string | null;
      userName?: string | null;
      userId?: string | null;
      userUid?: string | null;
    };
  } | null;
};

type PersonalInfoRaw = {
  code: number;
  message: string | null;
  data?: PersonalInfoData | null;
};

function baseHeaders(token: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "x-id-token": token,
    "x-device-info": "PC",
    "x-terminal-info": "PC",
    Referer: "https://portal.ksu.edu.cn/main.html",
  };
}

async function fetchKsuJson<T>(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    followRedirects?: boolean;
  } = {}
): Promise<T> {
  const response = await proxyRequest({
    requestMode: REQUEST_MODE,
    method: opts.method ?? "GET",
    url,
    headers: opts.headers,
    body: opts.body,
    timeoutMs: opts.timeoutMs,
    followRedirects: opts.followRedirects,
  });

  if (!response.ok && response.status === 0) {
    throw new ApiError(response.error || "请求失败", { payload: response });
  }

  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new ApiError("响应不是有效 JSON", {
      payload: {
        status: response.status,
        bodyPreview: response.body.slice(0, 200),
      },
    });
  }
}

export async function getUserInfo(token: string): Promise<UserInfoData> {
  const raw = await fetchKsuJson<UserInfoRaw>(USER_INFO_URL, {
    headers: baseHeaders(token),
    timeoutMs: 20_000,
  });

  if (raw.code !== 0 || !raw.data) {
    throw new ApiError(raw.message || "获取用户信息失败", { code: raw.code, payload: raw });
  }

  const attrs = raw.data.attributes ?? {};
  return {
    username: raw.data.username,
    user_name: attrs.userName ?? "",
    user_uid: attrs.userUid ?? "",
    user_id: attrs.userId ?? "",
    organization_name: attrs.organizationName ?? undefined,
    identity_type_name: attrs.identityTypeName ?? undefined,
  };
}

export async function getPersonalInfo(token: string): Promise<PersonalInfoData> {
  const raw = await fetchKsuJson<PersonalInfoRaw>(PERSONAL_INFO_URL, {
    headers: baseHeaders(token),
    timeoutMs: 20_000,
  });

  if (raw.code !== 0 || !raw.data) {
    throw new ApiError(raw.message || "获取个人信息失败", { code: raw.code, payload: raw });
  }

  return raw.data;
}

export async function getGrades(token: string): Promise<GradesData> {
  const raw = await fetchKsuJson<GradesRaw>(GRADES_URL, {
    headers: baseHeaders(token),
    timeoutMs: 25_000,
  });

  if (!raw.success || raw.code !== 200 || !raw.data) {
    throw new ApiError(raw.msg || "获取成绩失败", { code: raw.code, payload: raw });
  }

  return raw.data;
}

export async function getCalendarMonth(token: string, yearMonth: string): Promise<CalendarDay[]> {
  const url = new URL(CALENDAR_URL);
  url.searchParams.set("ny", yearMonth);
  url.searchParams.set("random_number", String(Date.now()));

  const raw = await fetchKsuJson<CalendarResponse>(url.toString(), {
    headers: {
      "x-id-token": token,
    },
    timeoutMs: 25_000,
  });

  if (raw.code !== 0) {
    throw new ApiError(raw.message || "获取校历失败", { code: raw.code, payload: raw });
  }

  return raw.data ?? [];
}
