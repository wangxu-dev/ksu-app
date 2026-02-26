import { createOpenAI } from "@ai-sdk/openai";
import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { getCalendarMonth, getGrades, getPersonalInfo, getUserInfo } from "@/lib/api/ksu";
import type { AssistantSettings } from "@/lib/assistant/client";

export function createAssistantAgent(settings: AssistantSettings, token: string) {
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error("API Key 未设置");

  const openai = createOpenAI({
    apiKey,
    baseURL: settings.baseUrl || "https://openrouter.ai/api/v1",
  });

  const instructions = [
    "你是 Ksu-App 内置助手。",
    "优先使用工具回答关于用户信息、成绩、校历的问题。",
    "回答要简洁、准确。",
    settings.systemPrompt || "",
  ]
    .filter(Boolean)
    .join("\n");

  return new ToolLoopAgent({
    model: openai.chat(settings.model || "openai/gpt-4o-mini"),
    instructions,
    tools: {
      get_user_info: tool({
        description: "获取当前登录用户基础信息",
        inputSchema: z.object({}),
        execute: async () => getUserInfo(token),
      }),
      get_personal_info: tool({
        description: "获取个人概览信息",
        inputSchema: z.object({}),
        execute: async () => getPersonalInfo(token),
      }),
      get_grades: tool({
        description: "获取成绩信息",
        inputSchema: z.object({}),
        execute: async () => getGrades(token),
      }),
      get_calendar: tool({
        description: "获取指定月份校历，格式如 2026年02月",
        inputSchema: z.object({ yearMonth: z.string() }),
        execute: async ({ yearMonth }) => getCalendarMonth(token, yearMonth),
      }),
    },
  });
}
