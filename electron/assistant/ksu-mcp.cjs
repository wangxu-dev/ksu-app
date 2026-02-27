function parseJsonBody(response) {
  if (!response.ok) {
    throw new Error(response.error || `request failed (${response.status})`);
  }
  try {
    return JSON.parse(response.body || "{}");
  } catch {
    throw new Error("invalid json response");
  }
}

function getCurrentTimePayload() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][
    now.getDay()
  ];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  return {
    datetime: `${y}年${m}月${d}日 ${hh}:${mm}:${ss}`,
    weekday,
    timezone,
    text: `本机时间为：${y}年${m}月${d}日 ${hh}:${mm}:${ss} ${weekday}`,
  };
}

function buildKsuMcpTools({ callKsuEndpoint, token }) {
  return {
    async get_user_info() {
      const raw = parseJsonBody(await callKsuEndpoint({ endpoint: "userInfo", token }));
      if (raw.code !== 0 || !raw.data) {
        throw new Error(raw.message || "failed to get user info");
      }
      return raw.data;
    },

    async get_personal_info() {
      const raw = parseJsonBody(await callKsuEndpoint({ endpoint: "personalInfo", token }));
      if (raw.code !== 0 || !raw.data) {
        throw new Error(raw.message || "failed to get personal info");
      }
      return raw.data;
    },

    async get_grades() {
      const raw = parseJsonBody(await callKsuEndpoint({ endpoint: "grades", token }));
      if (raw.code !== 200 || !raw.success || !raw.data) {
        throw new Error(raw.msg || "failed to get grades");
      }
      return raw.data;
    },

    async get_calendar(input) {
      const yearMonth = input?.yearMonth;
      if (!yearMonth) throw new Error("yearMonth is required");

      const raw = parseJsonBody(
        await callKsuEndpoint({ endpoint: "calendarMonth", token, yearMonth }),
      );
      if (raw.code !== 0) {
        throw new Error(raw.message || "failed to get calendar");
      }
      return raw.data || [];
    },

    async get_current_time() {
      return getCurrentTimePayload();
    },
  };
}

module.exports = {
  buildKsuMcpTools,
};
