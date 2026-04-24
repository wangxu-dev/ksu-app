import { getCurrentTimePayload } from "../shared/time.js";
import {
  createKsuMcpRegistry,
  type CallKsuEndpoint,
  type KsuToolDefinition,
} from "./mcp/ksu-mcp.js";

type KsuMcpTools = Record<string, (input?: { yearMonth?: string }) => Promise<unknown>> & {
  get_user_info: () => Promise<unknown>;
  get_personal_info: () => Promise<unknown>;
  get_grades: () => Promise<unknown>;
  get_calendar: (input: { yearMonth: string }) => Promise<unknown[]>;
  get_current_time: () => Promise<ReturnType<typeof getCurrentTimePayload>>;
};

function buildKsuMcpTools({
  callKsuEndpoint,
  token,
}: {
  callKsuEndpoint: CallKsuEndpoint;
  token: string;
}): KsuMcpTools {
  const registry = createKsuMcpRegistry({ callKsuEndpoint });
  const tools = Object.create(null) as KsuMcpTools;

  for (const item of registry.listTools()) {
    tools[item.name] = async (input?: { yearMonth?: string }) =>
      registry.callTool(item.name, input || {}, { token });
  }

  if (!tools.get_current_time) {
    tools.get_current_time = async () => getCurrentTimePayload();
  }

  return tools;
}

export { buildKsuMcpTools };
export type { CallKsuEndpoint, KsuMcpTools, KsuToolDefinition };
