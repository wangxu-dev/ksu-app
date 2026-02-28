import { getCurrentTimePayload } from "../shared/time.js";
import type { UnifiedResponsePayload } from "../request/types.js";

type KsuEndpointInput = {
  endpoint: "userInfo" | "personalInfo" | "grades" | "calendarMonth";
  token: string;
  yearMonth?: string;
};

type CallKsuEndpoint = (input: KsuEndpointInput) => Promise<UnifiedResponsePayload>;

type KsuMcpTools = {
  get_user_info: () => Promise<unknown>;
  get_personal_info: () => Promise<unknown>;
  get_grades: () => Promise<unknown>;
  get_calendar: (input: { yearMonth: string }) => Promise<unknown[]>;
  get_current_time: () => Promise<ReturnType<typeof getCurrentTimePayload>>;
};

function parseJsonBody(response: UnifiedResponsePayload): Record<string, unknown> {
  if (!response.ok) {
    throw new Error(response.error || `request failed (${response.status})`);
  }
  try {
    return JSON.parse(response.body || "{}") as Record<string, unknown>;
  } catch {
    throw new Error("invalid json response");
  }
}

function buildKsuMcpTools({
  callKsuEndpoint,
  token,
}: {
  callKsuEndpoint: CallKsuEndpoint;
  token: string;
}): KsuMcpTools {
  return {
    async get_user_info() {
      const raw = parseJsonBody(await callKsuEndpoint({ endpoint: "userInfo", token }));
      if (raw.code !== 0 || !raw.data) {
        throw new Error(String(raw.message || "failed to get user info"));
      }
      return raw.data;
    },

    async get_personal_info() {
      const raw = parseJsonBody(await callKsuEndpoint({ endpoint: "personalInfo", token }));
      if (raw.code !== 0 || !raw.data) {
        throw new Error(String(raw.message || "failed to get personal info"));
      }
      return raw.data;
    },

    async get_grades() {
      const raw = parseJsonBody(await callKsuEndpoint({ endpoint: "grades", token }));
      if (raw.code !== 200 || !raw.success || !raw.data) {
        throw new Error(String(raw.msg || "failed to get grades"));
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
        throw new Error(String(raw.message || "failed to get calendar"));
      }
      return (raw.data as unknown[]) || [];
    },

    async get_current_time() {
      return getCurrentTimePayload();
    },
  };
}

export { buildKsuMcpTools };
export type { CallKsuEndpoint, KsuEndpointInput, KsuMcpTools };
