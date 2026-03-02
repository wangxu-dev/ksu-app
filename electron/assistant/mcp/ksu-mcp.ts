import { z } from "zod";
import { createLogger } from "../../shared/logger.js";
import { getCurrentTimePayload } from "../../shared/time.js";
import type { UnifiedResponsePayload } from "../../request/types.js";

type ToolContext = {
  token?: string;
};

type KsuEndpointInput = {
  endpoint: "userInfo" | "personalInfo" | "grades" | "calendarMonth";
  token: string;
  yearMonth?: string;
};

type CallKsuEndpoint = (input: KsuEndpointInput) => Promise<UnifiedResponsePayload>;

type RegisteredTool = {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  errorCodes: string[];
  cachePolicy: {
    scope: "none" | "memory" | "storage";
    ttlMs: number;
    note?: string;
  };
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
};

type KsuMcpRegistry = {
  listTools: () => Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    errorCodes: string[];
    cachePolicy: {
      scope: "none" | "memory" | "storage";
      ttlMs: number;
      note?: string;
    };
  }>;
  callTool: (
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext,
  ) => Promise<unknown>;
};

const logger = createLogger("assistant:mcp");

function parseResponse(response: UnifiedResponsePayload, label: string): Record<string, unknown> {
  if (!response.ok) throw new Error(response.error || `${label} failed`);
  return JSON.parse(response.body || "{}") as Record<string, unknown>;
}

function requireToken(context: ToolContext): string {
  const token = String(context?.token || "").trim();
  if (!token) throw new Error("token is required");
  return token;
}

function createKsuMcpRegistry({
  callKsuEndpoint,
}: {
  callKsuEndpoint: CallKsuEndpoint;
}): KsuMcpRegistry {
  const tools = new Map<string, RegisteredTool>();

  const register = (
    name: string,
    description: string,
    schema: z.ZodRawShape,
    inputSchema: Record<string, unknown>,
    outputSchema: Record<string, unknown>,
    errorCodes: string[],
    cachePolicy: {
      scope: "none" | "memory" | "storage";
      ttlMs: number;
      note?: string;
    },
    handler: RegisteredTool["handler"],
  ): void => {
    tools.set(name, {
      name,
      description,
      schema,
      inputSchema,
      outputSchema,
      errorCodes,
      cachePolicy,
      handler,
    });
  };

  register(
    "get_user_info",
    "获取当前登录用户基础信息",
    {},
    { type: "object", properties: {}, required: [] },
    { type: "object", nullable: false, description: "user profile data" },
    ["TOKEN_REQUIRED", "UPSTREAM_REQUEST_FAILED", "INVALID_JSON", "UPSTREAM_BUSINESS_ERROR"],
    { scope: "storage", ttlMs: 60 * 60 * 1000, note: "建议 1 小时内复用" },
    async (_args, context) => {
      const token = requireToken(context);
      const raw = parseResponse(
        await callKsuEndpoint({ endpoint: "userInfo", token }),
        "get_user_info",
      );
      if (raw.code !== 0 || !raw.data) {
        throw new Error(String(raw.message || "get_user_info failed"));
      }
      return raw.data;
    },
  );

  register(
    "get_personal_info",
    "获取个人概览信息",
    {},
    { type: "object", properties: {}, required: [] },
    { type: "object", nullable: false, description: "personal dashboard data" },
    ["TOKEN_REQUIRED", "UPSTREAM_REQUEST_FAILED", "INVALID_JSON", "UPSTREAM_BUSINESS_ERROR"],
    { scope: "storage", ttlMs: 6 * 60 * 60 * 1000, note: "建议 6 小时内复用" },
    async (_args, context) => {
      const token = requireToken(context);
      const raw = parseResponse(
        await callKsuEndpoint({ endpoint: "personalInfo", token }),
        "get_personal_info",
      );
      if (raw.code !== 0 || !raw.data) {
        throw new Error(String(raw.message || "get_personal_info failed"));
      }
      return raw.data;
    },
  );

  register(
    "get_grades",
    "获取成绩信息",
    {},
    { type: "object", properties: {}, required: [] },
    { type: "object", nullable: false, description: "grade list and GPA summary" },
    ["TOKEN_REQUIRED", "UPSTREAM_REQUEST_FAILED", "INVALID_JSON", "UPSTREAM_BUSINESS_ERROR"],
    { scope: "storage", ttlMs: 7 * 24 * 60 * 60 * 1000, note: "建议按周刷新" },
    async (_args, context) => {
      const token = requireToken(context);
      const raw = parseResponse(await callKsuEndpoint({ endpoint: "grades", token }), "get_grades");
      if (!raw.success || raw.code !== 200 || !raw.data) {
        throw new Error(String(raw.msg || "get_grades failed"));
      }
      return raw.data;
    },
  );

  register(
    "get_calendar",
    "获取指定月份校历，格式如 2026年02月",
    { yearMonth: z.string() },
    {
      type: "object",
      properties: {
        yearMonth: { type: "string", description: "格式如 2026年02月" },
      },
      required: ["yearMonth"],
    },
    { type: "array", items: { type: "object" }, description: "calendar days of the month" },
    [
      "TOKEN_REQUIRED",
      "INVALID_ARGUMENT",
      "UPSTREAM_REQUEST_FAILED",
      "INVALID_JSON",
      "UPSTREAM_BUSINESS_ERROR",
    ],
    { scope: "storage", ttlMs: 30 * 24 * 60 * 60 * 1000, note: "按月缓存" },
    async (args, context) => {
      const token = requireToken(context);
      const yearMonth = String(args.yearMonth || "");
      const raw = parseResponse(
        await callKsuEndpoint({
          endpoint: "calendarMonth",
          token,
          yearMonth,
        }),
        "get_calendar",
      );
      if (raw.code !== 0) throw new Error(String(raw.message || "get_calendar failed"));
      return (raw.data as unknown[]) || [];
    },
  );

  register(
    "get_current_time",
    "获取当前本机时间",
    {},
    { type: "object", properties: {}, required: [] },
    { type: "object", description: "local time payload" },
    [],
    { scope: "none", ttlMs: 0, note: "实时数据，不缓存" },
    async () => getCurrentTimePayload(),
  );

  return {
    listTools() {
      const result = Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
        errorCodes: t.errorCodes,
        cachePolicy: t.cachePolicy,
      }));
      logger.debug("list tools", { count: result.length });
      return result;
    },
    async callTool(name, args, context = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`unknown tool: ${name}`);
      logger.info("call tool", {
        name,
        hasToken: Boolean(context && typeof context.token === "string" && context.token.length > 0),
      });
      const parsed = z.object(tool.schema).parse(args || {});
      try {
        const output = await tool.handler(parsed as Record<string, unknown>, context);
        logger.debug("tool call success", { name });
        return output;
      } catch (error) {
        logger.error("tool call failed", {
          name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

export { createKsuMcpRegistry };
export type { CallKsuEndpoint, KsuMcpRegistry, ToolContext };
