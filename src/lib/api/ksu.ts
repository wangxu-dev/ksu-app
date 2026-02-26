import { ApiError } from "@/lib/api/client";
import type { PersonalInfoData, UserInfoData } from "@/lib/auth";
import type { GradesData, GradesRaw } from "@/lib/grades";
import type { CalendarDay, CalendarResponse } from "@/lib/calendar";
import { ipcInvoke } from "@/lib/ipc";
import { KSU_REQUEST_CHANNEL } from "@/lib/request/channels";
import type { UnifiedResponsePayload } from "@/lib/request/types";

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

type KsuEndpoint = "userInfo" | "personalInfo" | "grades" | "calendarMonth";

async function fetchKsuJson<T>(payload: {
  endpoint: KsuEndpoint;
  token: string;
  yearMonth?: string;
}): Promise<T> {
  const response = await ipcInvoke<UnifiedResponsePayload>(KSU_REQUEST_CHANNEL, payload);

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
  const raw = await fetchKsuJson<UserInfoRaw>({
    endpoint: "userInfo",
    token,
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
  const raw = await fetchKsuJson<PersonalInfoRaw>({
    endpoint: "personalInfo",
    token,
  });

  if (raw.code !== 0 || !raw.data) {
    throw new ApiError(raw.message || "获取个人信息失败", { code: raw.code, payload: raw });
  }

  return raw.data;
}

export async function getGrades(token: string): Promise<GradesData> {
  const raw = await fetchKsuJson<GradesRaw>({
    endpoint: "grades",
    token,
  });

  if (!raw.success || raw.code !== 200 || !raw.data) {
    throw new ApiError(raw.msg || "获取成绩失败", { code: raw.code, payload: raw });
  }

  return raw.data;
}

export async function getCalendarMonth(token: string, yearMonth: string): Promise<CalendarDay[]> {
  const raw = await fetchKsuJson<CalendarResponse>({
    endpoint: "calendarMonth",
    token,
    yearMonth,
  });

  if (raw.code !== 0) {
    throw new ApiError(raw.message || "获取校历失败", { code: raw.code, payload: raw });
  }

  return raw.data ?? [];
}
