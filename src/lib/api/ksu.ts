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

export type CampusNewsItem = {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string | null;
};

export type CampusNewsSource = "latest" | "hot";

export type CampusNewsPage = {
  items: CampusNewsItem[];
  total: number;
  pageNo: number;
  pageSize: number;
  hasMore: boolean;
  source: CampusNewsSource;
};

type CampusNewsRaw = {
  code?: number;
  message?: string | null;
  data?: unknown;
  rows?: unknown;
};

type KsuEndpoint =
  | "userInfo"
  | "personalInfo"
  | "grades"
  | "calendarMonth"
  | "campusNews"
  | "campusNewsHot";

async function fetchKsuJson<T>(payload: {
  endpoint: KsuEndpoint;
  token: string;
  yearMonth?: string;
  columnId?: string;
  pageNo?: number;
  pageSize?: number;
}): Promise<T> {
  const response = await ipcInvoke<UnifiedResponsePayload>(KSU_REQUEST_CHANNEL, payload);

  if (!response.ok) {
    throw new ApiError(response.error || `请求失败: ${response.status}`, {
      status: response.status,
      payload: response,
    });
  }

  if (!response.body) {
    throw new ApiError("响应为空", {
      status: response.status,
      payload: response,
    });
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

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function extractList(raw: CampusNewsRaw): Array<Record<string, unknown>> {
  const candidates: unknown[] = [
    (raw.data as { allContents?: unknown } | undefined)?.allContents,
    (raw.data as { picContents?: unknown } | undefined)?.picContents,
    raw.data,
    (raw.data as { list?: unknown } | undefined)?.list,
    (raw.data as { records?: unknown } | undefined)?.records,
    (raw.data as { rows?: unknown } | undefined)?.rows,
    raw.rows,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object",
      );
    }
  }
  return [];
}

function extractTotal(raw: CampusNewsRaw): number | null {
  const candidates: unknown[] = [
    (raw.data as { count?: unknown } | undefined)?.count,
    (raw.data as { total?: unknown } | undefined)?.total,
    (raw.data as { totalCount?: unknown } | undefined)?.totalCount,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return null;
}

function normalizeNewsItem(item: Record<string, unknown>, index: number): CampusNewsItem | null {
  const title = toText(item.title ?? item.contentTitle ?? item.name);
  if (!title) return null;

  const rawUrl = toText(
    item.externalNewsUrl ?? item.url ?? item.linkUrl ?? item.contentUrl ?? item.pcUrl ?? item.h5Url,
  );
  const normalizedUrl = rawUrl
    ? rawUrl.startsWith("http")
      ? rawUrl
      : `https://portal.ksu.edu.cn${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
    : "https://portal.ksu.edu.cn/main.html";

  const publishedAt =
    toText(
      item.releaseStartTime ??
        item.publishTime ??
        item.pubTime ??
        item.releaseTime ??
        item.createTime,
    ) || null;
  const summary =
    toText(item.contentDesc ?? item.summary ?? item.digest ?? item.description) || null;
  const id = toText(item.id ?? item.contentId ?? item.articleId) || `${title}-${index}`;

  return {
    id,
    title,
    url: normalizedUrl,
    publishedAt,
    summary,
  };
}

export async function getCampusNews(
  token: string,
  options?: { pageSize?: number; pageNo?: number; columnId?: string; source?: CampusNewsSource },
): Promise<CampusNewsPage> {
  const pageNo = Math.max(1, Number(options?.pageNo || 1));
  const pageSize = Math.max(1, Number(options?.pageSize || 5));
  const source = options?.source || "latest";

  const raw = await fetchKsuJson<CampusNewsRaw>({
    endpoint: source === "hot" ? "campusNewsHot" : "campusNews",
    token,
    columnId: options?.columnId,
    pageNo,
    pageSize,
  });

  if (typeof raw.code === "number" && raw.code !== 0) {
    throw new ApiError(raw.message || "获取校园新闻失败", { code: raw.code, payload: raw });
  }

  const list = extractList(raw);
  const items = list
    .map((item, index) => normalizeNewsItem(item, index))
    .filter((item): item is CampusNewsItem => Boolean(item));
  const totalFromPayload = extractTotal(raw);
  const total = totalFromPayload ?? items.length;
  const hasMore = totalFromPayload === null ? items.length >= pageSize : pageNo * pageSize < total;

  return {
    items,
    total,
    pageNo,
    pageSize,
    hasMore,
    source,
  };
}
