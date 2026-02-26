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
  };
}

module.exports = {
  buildKsuMcpTools,
};
