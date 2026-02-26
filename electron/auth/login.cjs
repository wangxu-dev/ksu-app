const LOGIN_URL =
  "https://cas.ksu.edu.cn/cas/login?service=https%3A%2F%2Fportal.ksu.edu.cn%2F%3Fpath%3Dhttps%253A%252F%252Fportal.ksu.edu.cn%252Fmain.html%2523%252F";
const { sessionFetch } = require("../request/session-fetch.cjs");

function parseHiddenFields(html) {
  const fields = {
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
    const attrs = {};
    let match;
    while ((match = attrRegex.exec(tag)) !== null) {
      const key = String(match[1]).toLowerCase();
      attrs[key] = match[2] ?? match[3] ?? "";
    }
    attrRegex.lastIndex = 0;

    if ((attrs.type || "").toLowerCase() !== "hidden") continue;
    if (!attrs.name) continue;
    if (attrs.name in fields) fields[attrs.name] = attrs.value || "";
  }

  return fields;
}

function extractIdTokenFromLocation(location) {
  const decoded = decodeURIComponent(location);
  const ticketMatch = decoded.match(/ticket=([^&]+)/);
  if (!ticketMatch) throw new Error("无法提取 ticket");
  const ticket = ticketMatch[1];
  const parts = ticket.split(".");
  if (parts.length !== 3) throw new Error("ticket 格式错误");
  const payload = parts[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const payloadJson = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  if (!payloadJson.idToken) throw new Error("无法获取 idToken");
  return payloadJson.idToken;
}

async function login(electronSession, { username, password }) {
  const loginPageResp = await sessionFetch(electronSession, LOGIN_URL, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  const html = await loginPageResp.text();
  const fields = parseHiddenFields(html);
  if (!fields.execution) throw new Error("无法获取登录参数（execution）");

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

  const location = postResp.headers.get("location");
  if (!location || !location.includes("ticket=")) {
    return { success: false, message: "登录失败，用户名或密码错误" };
  }

  return {
    success: true,
    token: extractIdTokenFromLocation(location),
    message: "登录成功",
  };
}

module.exports = {
  login,
};
