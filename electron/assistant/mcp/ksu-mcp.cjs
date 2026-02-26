const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const { createLogger } = require("../../shared/logger.cjs");

const logger = createLogger("assistant:mcp");

function parseResponse(response, label) {
  if (!response.ok) throw new Error(response.error || `${label} failed`);
  const json = JSON.parse(response.body || "{}");
  return json;
}

function createKsuMcpRegistry({ callKsuEndpoint }) {
  const server = new McpServer({
    name: "ksu_mcp",
    version: "0.1.0",
  });

  const tools = new Map();
  const register = (name, description, schema, handler) => {
    server.tool(name, description, schema, async (args) => {
      const output = await handler(args);
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    });
    tools.set(name, { name, description, schema, handler });
  };

  register(
    "get_user_info",
    "获取当前登录用户基础信息",
    z.object({ token: z.string() }),
    async (args) => {
      const raw = parseResponse(
        await callKsuEndpoint({ endpoint: "userInfo", token: args.token }),
        "get_user_info",
      );
      if (raw.code !== 0 || !raw.data) throw new Error(raw.message || "get_user_info failed");
      return raw.data;
    },
  );

  register(
    "get_personal_info",
    "获取个人概览信息",
    z.object({ token: z.string() }),
    async (args) => {
      const raw = parseResponse(
        await callKsuEndpoint({ endpoint: "personalInfo", token: args.token }),
        "get_personal_info",
      );
      if (raw.code !== 0 || !raw.data) throw new Error(raw.message || "get_personal_info failed");
      return raw.data;
    },
  );

  register("get_grades", "获取成绩信息", z.object({ token: z.string() }), async (args) => {
    const raw = parseResponse(
      await callKsuEndpoint({ endpoint: "grades", token: args.token }),
      "get_grades",
    );
    if (!raw.success || raw.code !== 200 || !raw.data)
      throw new Error(raw.msg || "get_grades failed");
    return raw.data;
  });

  register(
    "get_calendar",
    "获取指定月份校历，格式如 2026年02月",
    z.object({ token: z.string(), yearMonth: z.string() }),
    async (args) => {
      const raw = parseResponse(
        await callKsuEndpoint({
          endpoint: "calendarMonth",
          token: args.token,
          yearMonth: args.yearMonth,
        }),
        "get_calendar",
      );
      if (raw.code !== 0) throw new Error(raw.message || "get_calendar failed");
      return raw.data || [];
    },
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
    async callTool(name, args) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`unknown tool: ${name}`);
      logger.info("call tool", {
        name,
        hasToken: Boolean(args && typeof args.token === "string" && args.token.length > 0),
      });
      const parsed = tool.schema.parse(args || {});
      try {
        const output = await tool.handler(parsed);
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
