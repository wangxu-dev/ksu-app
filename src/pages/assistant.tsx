import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { HomeSearch } from "@/components/home-search";
import { getSavedToken } from "@/lib/auth";
import {
  onAssistantChunk,
  onAssistantDone,
  onAssistantError,
  startAssistantStream,
} from "@/lib/assistant/client";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  streamId?: string;
  status?: "streaming" | "done" | "error";
};

function toHistoryMessages(messages: ChatMessage[]): Array<{ role: Role; content: string }> {
  return messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

const API_KEY_STORAGE_KEY = "ai:openai:key";
const MODEL_STORAGE_KEY = "ai:openai:model";
const BASE_URL_STORAGE_KEY = "ai:openai:base-url";

export function AssistantPage() {
  return (
    <>
      <PageHeader>
        <HomeSearch />
      </PageHeader>
      <AssistantContent />
    </>
  );
}

function AssistantContent() {
  const [token] = useState(() => getSavedToken() || "");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE_KEY) || "");
  const [model, setModel] = useState(
    () => localStorage.getItem(MODEL_STORAGE_KEY) || "gpt-4o-mini",
  );
  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem(BASE_URL_STORAGE_KEY) || "https://openrouter.ai/api/v1",
  );
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, [model]);
  useEffect(() => {
    localStorage.setItem(BASE_URL_STORAGE_KEY, baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    const offChunk = onAssistantChunk(({ streamId, delta }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.streamId === streamId
            ? { ...m, content: `${m.content}${delta}`, status: "streaming" }
            : m,
        ),
      );
    });

    const offDone = onAssistantDone(({ streamId }) => {
      setMessages((prev) =>
        prev.map((m) => (m.streamId === streamId ? { ...m, status: "done" } : m)),
      );
      setIsSending(false);
    });

    const offError = onAssistantError(({ streamId, error }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.streamId === streamId
            ? {
                ...m,
                content: m.content ? `${m.content}\n\n[error] ${error}` : `[error] ${error}`,
                status: "error",
              }
            : m,
        ),
      );
      setIsSending(false);
    });

    return () => {
      offChunk();
      offDone();
      offError();
    };
  }, []);

  const canSend = useMemo(
    () => !!prompt.trim() && !!token && !isSending,
    [prompt, token, isSending],
  );

  const onSend = async () => {
    const text = prompt.trim();
    if (!text || !token || isSending) return;

    setPrompt("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      status: "done",
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "streaming",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const history = toHistoryMessages(messages);
      const { streamId } = await startAssistantStream({
        message: text,
        token,
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
        history,
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessage.id ? { ...m, streamId } : m)),
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `[error] ${error instanceof Error ? error.message : "assistant start failed"}`,
                status: "error",
              }
            : m,
        ),
      );
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>AI 设置</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL（默认 OpenRouter /v1）"
          />
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API Key（可留空走环境变量）"
          />
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="模型名（如 openai/gpt-4o-mini）"
          />
        </CardContent>
      </Card>

      <Card className="min-h-[420px]">
        <CardHeader>
          <CardTitle>AI 对话</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[360px] space-y-3 overflow-auto rounded-md border p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">输入“我是谁”或“我的成绩如何”开始。</p>
            ) : null}
            {messages.map((m) => (
              <div key={m.id} className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {m.role === "user" ? "你" : "AI"}
                </div>
                <div className="whitespace-pre-wrap rounded-md bg-muted/60 p-2 text-sm">
                  {m.content || "..."}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={token ? "请输入问题..." : "未检测到登录 token，请先登录"}
              rows={4}
            />
            <div className="flex justify-end">
              <Button onClick={onSend} disabled={!canSend}>
                发送
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
