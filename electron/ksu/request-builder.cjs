const USER_INFO_URL = "https://authx-service.ksu.edu.cn/personal/api/v1/personal/me/user";
const PERSONAL_INFO_URL =
  "https://portal-data.ksu.edu.cn/portalCenter/v2/personalData/getPersonalInfo";
const GRADES_URL = "https://score-inquiry.ksu.edu.cn/api/std-grade/detail?project=1";
const CALENDAR_URL = "https://portal-data.ksu.edu.cn/portalCenter/v2/personalData/getXlInfo";

function baseHeaders(token) {
  return {
    accept: "application/json, text/plain, */*",
    "x-id-token": token,
    "x-device-info": "PC",
    "x-terminal-info": "PC",
    Referer: "https://portal.ksu.edu.cn/main.html",
  };
}

function buildKsuRequest(payload) {
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
    };
  }

  if (endpoint === "personalInfo") {
    return {
      mode: "main",
      method: "GET",
      url: PERSONAL_INFO_URL,
      headers: baseHeaders(token),
      timeoutMs: 20_000,
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
      mode: "main",
      method: "GET",
      url: url.toString(),
      headers: {
        "x-id-token": token,
      },
      timeoutMs: 25_000,
    };
  }

  throw new Error(`unsupported endpoint: ${endpoint}`);
}

module.exports = {
  buildKsuRequest,
};
