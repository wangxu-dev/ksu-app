import type { UnifiedRequestPayload } from "../request/types.js";

const USER_INFO_URL = "https://authx-service.ksu.edu.cn/personal/api/v1/personal/me/user";
const PERSONAL_INFO_URL =
  "https://portal-data.ksu.edu.cn/portalCenter/v2/personalData/getPersonalInfo";
const GRADES_URL = "https://score-inquiry.ksu.edu.cn/api/std-grade/detail?project=1";
const CALENDAR_URL = "https://portal-data.ksu.edu.cn/portalCenter/v2/personalData/getXlInfo";
const CAMPUS_NEWS_URL = "https://portal.ksu.edu.cn/portal-api/v1/cms/content/getColumncontents";
const CAMPUS_NEWS_HOT_URL = "https://portal.ksu.edu.cn/portal-api/v1/cms/content/getHotCms";

type KsuEndpoint =
  | "userInfo"
  | "personalInfo"
  | "grades"
  | "calendarMonth"
  | "campusNews"
  | "campusNewsHot";

type KsuRequestPayload = {
  endpoint: KsuEndpoint;
  token: string;
  yearMonth?: string;
  columnId?: string;
  pageNo?: number;
  pageSize?: number;
};

function baseHeaders(token: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "x-id-token": token,
    "x-device-info": "PC",
    "x-terminal-info": "PC",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };
}

function buildKsuRequest(payload: KsuRequestPayload): UnifiedRequestPayload {
  const endpoint = payload?.endpoint;
  const token = payload?.token;
  if (!endpoint || !token) {
    throw new Error("invalid ksu request payload");
  }

  if (endpoint === "userInfo") {
    return {
      mode: "main",
      method: "GET",
      url: USER_INFO_URL,
      headers: baseHeaders(token),
      timeoutMs: 20_000,
      retryCount: 1,
      retryDelayMs: 300,
    };
  }

  if (endpoint === "personalInfo") {
    const url = new URL(PERSONAL_INFO_URL);
    url.searchParams.set("random_number", String(Date.now()));

    return {
      mode: "renderer",
      method: "GET",
      url: url.toString(),
      headers: baseHeaders(token),
      timeoutMs: 35_000,
      retryCount: 1,
      retryDelayMs: 350,
    };
  }

  if (endpoint === "grades") {
    return {
      mode: "main",
      method: "GET",
      url: GRADES_URL,
      headers: baseHeaders(token),
      timeoutMs: 25_000,
    };
  }

  if (endpoint === "calendarMonth") {
    if (!payload.yearMonth) {
      throw new Error("yearMonth is required for calendarMonth");
    }

    const url = new URL(CALENDAR_URL);
    url.searchParams.set("ny", payload.yearMonth);
    url.searchParams.set("random_number", String(Date.now()));

    return {
      mode: "renderer",
      method: "GET",
      url: url.toString(),
      headers: {
        "x-id-token": token,
      },
      timeoutMs: 35_000,
      retryCount: 1,
      retryDelayMs: 350,
    };
  }

  if (endpoint === "campusNews") {
    const url = new URL(CAMPUS_NEWS_URL);
    url.searchParams.set("kw", "");
    url.searchParams.set("columnId", payload.columnId || "remote-a");
    url.searchParams.set("pageNo", String(payload.pageNo || 1));
    url.searchParams.set("pageSize", String(payload.pageSize || 5));
    url.searchParams.set("loadContent", "false");
    url.searchParams.set("loadPicContents", "false");

    return {
      mode: "renderer",
      method: "GET",
      url: url.toString(),
      headers: {
        ...baseHeaders(token),
        referer: "https://portal.ksu.edu.cn/main.html",
      },
      timeoutMs: 25_000,
      retryCount: 1,
      retryDelayMs: 350,
    };
  }

  if (endpoint === "campusNewsHot") {
    const url = new URL(CAMPUS_NEWS_HOT_URL);
    url.searchParams.set("columnId", payload.columnId || "remote-a");
    url.searchParams.set("pageNo", String(payload.pageNo || 1));
    url.searchParams.set("pageSize", String(payload.pageSize || 5));
    url.searchParams.set("random_number", String(Date.now()));

    return {
      mode: "renderer",
      method: "GET",
      url: url.toString(),
      headers: {
        ...baseHeaders(token),
        referer: "https://portal.ksu.edu.cn/main.html",
      },
      timeoutMs: 25_000,
      retryCount: 1,
      retryDelayMs: 350,
    };
  }

  throw new Error(`unsupported endpoint: ${endpoint}`);
}

export { buildKsuRequest };
export type { KsuRequestPayload };
