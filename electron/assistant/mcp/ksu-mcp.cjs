const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const { createLogger } = require("../../shared/logger.cjs");

const logger = createLogger("assistant:mcp");

function parseResponse(response, label) {
  if (!response.ok) throw new Error(response.error || `${label} failed`);
  const json = JSON.parse(response.body || "{}");
  return json;
}

function requireToken(context) {
  const token = String(context?.token || "").trim();
  if (!token) throw new Error("token is required");
  return token;
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

function createKsuMcpRegistry({ callKsuEndpoint }) {
  const server = new McpServer({
    name: "ksu_mcp",
    version: "0.1.0",
  });

  const tools = new Map();
  const register = (name, description, schema, handler) => {
    server.tool(name, description, schema, async (args) => {
      const output = await handler(args, {});
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    });
    tools.set(name, { name, description, schema, handler });
  };

  register("get_user_info", "获取当前登录用户基础信息", z.object({}), async (_args, context) => {
    const token = requireToken(context);
    const raw = parseResponse(
      await callKsuEndpoint({ endpoint: "userInfo", token }),
      "get_user_info",
    );
    if (raw.code !== 0 || !raw.data) throw new Error(raw.message || "get_user_info failed");
    return raw.data;
  });

  register("get_personal_info", "获取个人概览信息", z.object({}), async (_args, context) => {
    const token = requireToken(context);
    const raw = parseResponse(
      await callKsuEndpoint({ endpoint: "personalInfo", token }),
      "get_personal_info",
    );
    if (raw.code !== 0 || !raw.data) throw new Error(raw.message || "get_personal_info failed");
    return raw.data;
  });

  register("get_grades", "获取成绩信息", z.object({}), async (_args, context) => {
    const token = requireToken(context);
    const raw = parseResponse(await callKsuEndpoint({ endpoint: "grades", token }), "get_grades");
    if (!raw.success || raw.code !== 200 || !raw.data)
      throw new Error(raw.msg || "get_grades failed");
    return raw.data;
  });

  register(
    "get_calendar",
    "获取指定月份校历，格式如 2026年02月",
    z.object({ yearMonth: z.string() }),
    async (args, context) => {
      const token = requireToken(context);
      const raw = parseResponse(
        await callKsuEndpoint({
          endpoint: "calendarMonth",
          token,
          yearMonth: args.yearMonth,
        }),
        "get_calendar",
      );
      if (raw.code !== 0) throw new Error(raw.message || "get_calendar failed");
      return raw.data || [];
    },
  );

  register("get_current_time", "获取当前设备本机时间", z.object({}), async () =>
    getCurrentTimePayload(),
  );

  return {
    listTools() {
      const result = Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
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
      const parsed = tool.schema.parse(args || {});
      try {
        const output = await tool.handler(parsed, context);
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

module.exports = {
  createKsuMcpRegistry,
};
