import { createHash } from "node:crypto";
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

type CachePolicy = {
  scope: "none" | "memory" | "storage";
  ttlMs: number;
  note?: string;
};

type ToolExecutionErrorCode =
  | "TOKEN_REQUIRED"
  | "INVALID_ARGUMENT"
  | "UPSTREAM_REQUEST_FAILED"
  | "INVALID_JSON"
  | "UPSTREAM_BUSINESS_ERROR"
  | "UNKNOWN_TOOL"
  | "TOOL_EXECUTION_FAILED";

type ToolCacheAdapter = {
  get: (cacheKey: string, nowTs: number) => { value: string; updatedAt: number } | null;
  set: (input: {
    cacheKey: string;
    scope: "memory" | "storage";
    value: string;
    expiresAt: number;
    updatedAt: number;
  }) => void;
  delete: (cacheKey: string) => void;
};

type RegisteredTool = {
  name: string;
  description: string;
  cacheVersion?: string;
  input: z.ZodObject<z.ZodRawShape>;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  errorCodes: string[];
  cachePolicy: CachePolicy;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
};

type KsuMcpRegistry = {
  listTools: () => Array<{
    name: string;
    description: string;
    cacheVersion?: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    errorCodes: string[];
    cachePolicy: CachePolicy;
  }>;
  callTool: (
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext,
  ) => Promise<unknown>;
  callToolDetailed: (
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext,
  ) => Promise<{
    data: unknown;
    meta: {
      cached: boolean;
      cacheScope: CachePolicy["scope"];
      fetchedAt: number;
    };
  }>;
};

type KsuToolDefinition = {
  name: string;
  description: string;
  cacheVersion?: string;
  input: z.ZodObject<z.ZodRawShape>;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  errorCodes: string[];
  cachePolicy: CachePolicy;
  handler: RegisteredTool["handler"];
};

type GradeCourse = {
  courseName?: unknown;
  credit?: unknown;
  gp?: unknown;
  score?: unknown;
  scoreText?: unknown;
  semesterName?: unknown;
};

type SemesterGrade = {
  semester?: unknown;
  gradeList?: unknown;
};

type GradesData = {
  totalCredit?: unknown;
  gpa?: unknown;
  ga?: unknown;
  totalScore?: unknown;
  semesterGradeList?: unknown;
};

const logger = createLogger("assistant:mcp");
const memoryCache = new Map<
  string,
  { value: string; expiresAt: number; updatedAt: number; scope: "memory" | "storage" }
>();

class ToolExecutionError extends Error {
  readonly code: ToolExecutionErrorCode;
  readonly toolName: string;
  readonly cause?: unknown;

  constructor(input: {
    code: ToolExecutionErrorCode;
    toolName: string;
    message: string;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ToolExecutionError";
    this.code = input.code;
    this.toolName = input.toolName;
    this.cause = input.cause;
  }
}

function createToolExecutionError(input: {
  code: ToolExecutionErrorCode;
  toolName: string;
  message: string;
  cause?: unknown;
}): ToolExecutionError {
  return new ToolExecutionError(input);
}

function parseResponse(
  response: UnifiedResponsePayload,
  toolName: string,
): Record<string, unknown> {
  if (!response.ok) {
    throw createToolExecutionError({
      code: "UPSTREAM_REQUEST_FAILED",
      toolName,
      message: response.error || `${toolName} failed`,
      cause: response,
    });
  }
  try {
    return JSON.parse(response.body || "{}") as Record<string, unknown>;
  } catch (error) {
    throw createToolExecutionError({
      code: "INVALID_JSON",
      toolName,
      message: `${toolName} returned invalid json`,
      cause: error,
    });
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function buildCacheKey(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
  cacheVersion = "v1",
): string {
  const token = String(context.token || "").trim();
  const payload = stableStringify({
    name,
    cacheVersion,
    args,
    tokenHash: token ? createHash("sha256").update(token).digest("hex") : "",
  });
  return createHash("sha256").update(payload).digest("hex");
}

function createDefaultCacheAdapter(): ToolCacheAdapter {
  return {
    get(cacheKey, nowTs) {
      const cached = memoryCache.get(cacheKey);
      if (!cached) return null;
      if (cached.expiresAt <= nowTs) {
        memoryCache.delete(cacheKey);
        return null;
      }
      return { value: cached.value, updatedAt: cached.updatedAt };
    },
    set(input) {
      memoryCache.set(input.cacheKey, {
        value: input.value,
        expiresAt: input.expiresAt,
        updatedAt: input.updatedAt,
        scope: input.scope,
      });
    },
    delete(cacheKey) {
      memoryCache.delete(cacheKey);
    },
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function normalizeGradeCourse(course: GradeCourse): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  const courseName = toText(course.courseName);
  const credit = toNumber(course.credit);
  const gp = toNumber(course.gp);
  const score = toNumber(course.score);
  const scoreText = toText(course.scoreText);

  if (courseName) normalized.courseName = courseName;
  if (credit !== null) normalized.credit = credit;
  if (gp !== null) normalized.gp = gp;
  if (scoreText) normalized.scoreText = scoreText;
  if (score !== null) normalized.score = score;

  return normalized;
}

function normalizeGradesData(raw: GradesData): Record<string, unknown> {
  const totalCredit = toNumber(raw.totalCredit);
  const gpa = toText(raw.gpa);
  const ga = toText(raw.ga);
  const totalScore = toNumber(raw.totalScore);

  const semesterGradeList = Array.isArray(raw.semesterGradeList)
    ? (raw.semesterGradeList as SemesterGrade[])
    : [];

  const semesters = semesterGradeList
    .map((semesterItem) => {
      const semester = toText(semesterItem.semester);
      const gradeList = Array.isArray(semesterItem.gradeList)
        ? (semesterItem.gradeList as GradeCourse[])
        : [];
      const courses = gradeList
        .map((course) => normalizeGradeCourse(course))
        .filter((course) => Object.keys(course).length > 0);

      if (!semester || courses.length === 0) return null;

      return {
        semester,
        courseCount: courses.length,
        courses: courses.slice(0, 12),
      };
    })
    .filter(
      (
        item,
      ): item is { semester: string; courseCount: number; courses: Record<string, unknown>[] } =>
        item !== null,
    );

  return {
    summary: {
      ...(gpa ? { gpa } : {}),
      ...(ga ? { ga } : {}),
      ...(totalCredit !== null ? { totalCredit } : {}),
      ...(totalScore !== null ? { totalScore } : {}),
    },
    semesterCount: semesters.length,
    semesters: semesters.slice(0, 6),
  };
}

function requireToken(context: ToolContext): string {
  const token = String(context?.token || "").trim();
  if (!token) {
    throw createToolExecutionError({
      code: "TOKEN_REQUIRED",
      toolName: "tool",
      message: "token is required",
    });
  }
  return token;
}

function normalizeToolError(
  tool: RegisteredTool | undefined,
  name: string,
  error: unknown,
): ToolExecutionError {
  if (error instanceof ToolExecutionError) {
    if (error.toolName === "tool") {
      return createToolExecutionError({
        code: error.code,
        toolName: name,
        message: error.message,
        cause: error.cause,
      });
    }
    return error;
  }
  if (error instanceof z.ZodError) {
    return createToolExecutionError({
      code: "INVALID_ARGUMENT",
      toolName: name,
      message: error.issues[0]?.message || `${name} invalid arguments`,
      cause: error,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  const code: ToolExecutionErrorCode =
    tool?.errorCodes.includes("UPSTREAM_BUSINESS_ERROR") === true
      ? "UPSTREAM_BUSINESS_ERROR"
      : "TOOL_EXECUTION_FAILED";
  return createToolExecutionError({
    code,
    toolName: name,
    message: message || `${name} failed`,
    cause: error,
  });
}

function createKsuToolDefinitions({
  callKsuEndpoint,
}: {
  callKsuEndpoint: CallKsuEndpoint;
}): KsuToolDefinition[] {
  const definitions: KsuToolDefinition[] = [];

  const register = (tool: KsuToolDefinition): void => {
    definitions.push(tool);
  };

  register({
    name: "get_user_info",
    description: "获取当前登录用户基础信息",
    input: z.object({}),
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: { type: "object", nullable: false, description: "user profile data" },
    errorCodes: [
      "TOKEN_REQUIRED",
      "UPSTREAM_REQUEST_FAILED",
      "INVALID_JSON",
      "UPSTREAM_BUSINESS_ERROR",
    ],
    cachePolicy: { scope: "storage", ttlMs: 60 * 60 * 1000, note: "建议 1 小时内复用" },
    handler: async (_args, context) => {
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
  });

  register({
    name: "get_personal_info",
    description: "获取个人概览信息",
    input: z.object({}),
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: { type: "object", nullable: false, description: "personal dashboard data" },
    errorCodes: [
      "TOKEN_REQUIRED",
      "UPSTREAM_REQUEST_FAILED",
      "INVALID_JSON",
      "UPSTREAM_BUSINESS_ERROR",
    ],
    cachePolicy: { scope: "storage", ttlMs: 6 * 60 * 60 * 1000, note: "建议 6 小时内复用" },
    handler: async (_args, context) => {
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
  });

  register({
    name: "get_grades",
    description: "获取成绩信息",
    cacheVersion: "v2",
    input: z.object({}),
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: {
      type: "object",
      nullable: false,
      description: "normalized grades summary and semester course list",
    },
    errorCodes: [
      "TOKEN_REQUIRED",
      "UPSTREAM_REQUEST_FAILED",
      "INVALID_JSON",
      "UPSTREAM_BUSINESS_ERROR",
    ],
    cachePolicy: { scope: "storage", ttlMs: 7 * 24 * 60 * 60 * 1000, note: "建议按周刷新" },
    handler: async (_args, context) => {
      const token = requireToken(context);
      const raw = parseResponse(await callKsuEndpoint({ endpoint: "grades", token }), "get_grades");
      if (!raw.success || raw.code !== 200 || !raw.data) {
        throw new Error(String(raw.msg || "get_grades failed"));
      }
      return normalizeGradesData(raw.data as GradesData);
    },
  });

  register({
    name: "get_calendar",
    description: "获取指定月份校历，格式如 2026年02月",
    input: z.object({ yearMonth: z.string() }),
    inputSchema: {
      type: "object",
      properties: {
        yearMonth: { type: "string", description: "格式如 2026年02月" },
      },
      required: ["yearMonth"],
    },
    outputSchema: {
      type: "array",
      items: { type: "object" },
      description: "calendar days of the month",
    },
    errorCodes: [
      "TOKEN_REQUIRED",
      "INVALID_ARGUMENT",
      "UPSTREAM_REQUEST_FAILED",
      "INVALID_JSON",
      "UPSTREAM_BUSINESS_ERROR",
    ],
    cachePolicy: { scope: "storage", ttlMs: 30 * 24 * 60 * 60 * 1000, note: "按月缓存" },
    handler: async (args, context) => {
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
  });

  register({
    name: "get_current_time",
    description: "获取当前本机时间",
    input: z.object({}),
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: { type: "object", description: "local time payload" },
    errorCodes: [],
    cachePolicy: { scope: "none", ttlMs: 0, note: "实时数据，不缓存" },
    handler: async () => getCurrentTimePayload(),
  });

  return definitions;
}

function createKsuMcpRegistry({
  callKsuEndpoint,
  cache,
}: {
  callKsuEndpoint: CallKsuEndpoint;
  cache?: ToolCacheAdapter;
}): KsuMcpRegistry {
  const tools = new Map<string, RegisteredTool>();
  const cacheAdapter = cache || createDefaultCacheAdapter();

  for (const definition of createKsuToolDefinitions({ callKsuEndpoint })) {
    tools.set(definition.name, definition);
  }

  return {
    listTools() {
      const result = Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        cacheVersion: t.cacheVersion,
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
        errorCodes: t.errorCodes,
        cachePolicy: t.cachePolicy,
      }));
      logger.debug("list tools", { count: result.length });
      return result;
    },
    async callToolDetailed(name, args, context = {}) {
      const tool = tools.get(name);
      if (!tool) {
        throw createToolExecutionError({
          code: "UNKNOWN_TOOL",
          toolName: name,
          message: `unknown tool: ${name}`,
        });
      }
      logger.info("call tool", {
        name,
        hasToken: Boolean(context && typeof context.token === "string" && context.token.length > 0),
      });
      let parsedArgs: Record<string, unknown>;
      try {
        const parsed = tool.input.parse(args || {});
        parsedArgs = parsed as Record<string, unknown>;
      } catch (error) {
        const normalized = normalizeToolError(tool, name, error);
        logger.error("tool argument validation failed", {
          name,
          errorCode: normalized.code,
          error: normalized.message,
        });
        throw normalized;
      }
      if (tool.cachePolicy.scope !== "none" && tool.cachePolicy.ttlMs > 0) {
        const nowTs = Date.now();
        const cacheKey = buildCacheKey(name, parsedArgs, context, tool.cacheVersion);
        const cached = cacheAdapter.get(cacheKey, nowTs);
        if (cached) {
          logger.debug("tool cache hit", { name, scope: tool.cachePolicy.scope });
          return {
            data: JSON.parse(cached.value) as unknown,
            meta: {
              cached: true,
              cacheScope: tool.cachePolicy.scope,
              fetchedAt: cached.updatedAt,
            },
          };
        }
        try {
          const output = await tool.handler(parsedArgs, context);
          cacheAdapter.set({
            cacheKey,
            scope: tool.cachePolicy.scope,
            value: JSON.stringify(output),
            expiresAt: nowTs + tool.cachePolicy.ttlMs,
            updatedAt: nowTs,
          });
          logger.debug("tool call success", {
            name,
            cached: false,
            scope: tool.cachePolicy.scope,
          });
          return {
            data: output,
            meta: {
              cached: false,
              cacheScope: tool.cachePolicy.scope,
              fetchedAt: nowTs,
            },
          };
        } catch (error) {
          cacheAdapter.delete(cacheKey);
          const normalized = normalizeToolError(tool, name, error);
          logger.error("tool call failed", {
            name,
            errorCode: normalized.code,
            error: normalized.message,
          });
          throw normalized;
        }
      }
      try {
        const output = await tool.handler(parsedArgs, context);
        logger.debug("tool call success", { name });
        return {
          data: output,
          meta: {
            cached: false,
            cacheScope: tool.cachePolicy.scope,
            fetchedAt: Date.now(),
          },
        };
      } catch (error) {
        const normalized = normalizeToolError(tool, name, error);
        logger.error("tool call failed", {
          name,
          errorCode: normalized.code,
          error: normalized.message,
        });
        throw normalized;
      }
    },
    async callTool(name, args, context = {}) {
      const result = await this.callToolDetailed(name, args, context);
      return result.data;
    },
  };
}

export { createKsuMcpRegistry };
export { createKsuToolDefinitions };
export type {
  CachePolicy,
  CallKsuEndpoint,
  KsuMcpRegistry,
  KsuToolDefinition,
  ToolExecutionErrorCode,
  ToolCacheAdapter,
  ToolContext,
};
export { ToolExecutionError };
