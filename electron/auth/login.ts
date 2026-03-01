import type { Session } from "electron";
import { sessionFetch } from "../request/session-fetch.js";
import { createLogger } from "../shared/logger.js";

const LOGIN_URL =
  "https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fportal.ksu.edu.cn%2F%3Fpath%3Dhttps%253A%252F%252Fportal.ksu.edu.cn%252Fmain.html%2523%252F";

const logger = createLogger("auth:login");
const LOGIN_PAGE_RETRY_LIMIT = 2;

type LoginPayload = {
  username: string;
  password: string;
};

type LoginResult =
  | { success: true; token: string; message: string }
  | { success: false; message: string };

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type HiddenFields = {
  execution: string;
  currentMenu: string;
  failN: string;
  geolocation: string;
  fpVisitorId: string;
};

function isHiddenFieldName(name: string): name is keyof HiddenFields {
  return (
    name === "execution" ||
    name === "currentMenu" ||
    name === "failN" ||
    name === "geolocation" ||
    name === "fpVisitorId"
  );
}

function parseHiddenFields(html: string): HiddenFields {
  const fields: HiddenFields = {
    execution: "",
    currentMenu: "1",
    failN: "0",
    geolocation: "",
    fpVisitorId: "",
  };

  const inputRegex = /<input[^>]*>/g;
  const attrRegex = /([A-Za-z_:-][A-Za-z0-9_:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const inputs = html.match(inputRegex) || [];

  for (const tag of inputs) {
    const attrs: Record<string, string> = {};
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(tag)) !== null) {
      const key = String(match[1]).toLowerCase();
      attrs[key] = match[2] ?? match[3] ?? "";
    }
    attrRegex.lastIndex = 0;

    if ((attrs.type || "").toLowerCase() !== "hidden") continue;
    if (!attrs.name) continue;
    if (isHiddenFieldName(attrs.name)) fields[attrs.name] = attrs.value || "";
  }

  return fields;
}

function extractIdTokenFromLocation(location: string): string {
  const decoded = decodeURIComponent(location);
  const ticketMatch = decoded.match(/ticket=([^&]+)/);
  if (!ticketMatch) throw new Error("无法提取 ticket");
  const ticket = ticketMatch[1];
  const parts = ticket.split(".");
  if (parts.length !== 3) throw new Error("ticket 格式错误");
  const payload = parts[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const payloadJson = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
    idToken?: string;
  };
  if (!payloadJson.idToken) throw new Error("无法获取 idToken");
  return payloadJson.idToken;
}

async function login(
  electronSession: Session,
  { username, password }: LoginPayload,
): Promise<LoginResult> {
  const userTag = String(username || "").trim();
  logger.info("login started", {
    username: userTag ? `${userTag.slice(0, 3)}***` : "",
  });
  let loginPageResp = null;
  for (let attempt = 1; attempt <= LOGIN_PAGE_RETRY_LIMIT; attempt += 1) {
    const response = await sessionFetch(electronSession, LOGIN_URL, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    logger.debug("login page fetched", { attempt, status: response.status });
    loginPageResp = response;

    if (response.status === 200) break;
    if (attempt < LOGIN_PAGE_RETRY_LIMIT && shouldRetryStatus(response.status)) {
      logger.warn("login page request retrying", {
        attempt,
        status: response.status,
      });
      await sleep(350);
      continue;
    }
    break;
  }

  if (!loginPageResp) {
    throw new Error("CAS 登录页请求失败");
  }
  if (loginPageResp.status !== 200) {
    throw new Error(`CAS 登录页访问失败（状态码: ${loginPageResp.status}）`);
  }

  const html = await loginPageResp.text();
  const fields = parseHiddenFields(html);
  if (!fields.execution) throw new Error("CAS 登录页异常，缺少 execution 参数");

  const formData = new URLSearchParams({
    username,
    password,
    captcha: "",
    mfaState: "",
    currentMenu: fields.currentMenu || "1",
    failN: fields.failN || "0",
    execution: fields.execution,
    _eventId: "submit",
    geolocation: fields.geolocation || "",
    fpVisitorId: fields.fpVisitorId || "",
  });

  const postResp = await sessionFetch(electronSession, LOGIN_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      origin: "https://cas.ksu.edu.cn",
      referer: LOGIN_URL,
    },
    body: formData.toString(),
  });
  logger.debug("login submit finished", { status: postResp.status });

  const location = postResp.headers.get("location");
  if (postResp.status !== 302 || !location || !location.includes("ticket=")) {
    if (postResp.status >= 500) {
      throw new Error(`CAS 登录服务异常（状态码: ${postResp.status}）`);
    }
    logger.warn("login failed", { reason: "missing ticket in location header" });
    return { success: false, message: "登录失败，用户名或密码错误" };
  }

  const token = extractIdTokenFromLocation(location);
  logger.info("login succeeded");
  return {
    success: true,
    token,
    message: "登录成功",
  };
}

export { login };
