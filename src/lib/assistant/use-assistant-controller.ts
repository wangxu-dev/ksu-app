import { useEffect, useMemo, useRef, useState } from "react";
import { getSavedToken } from "@/lib/auth";
import {
  abortAssistantStream,
  createConversation,
  deleteConversation,
  getAssistantSettings,
  getConversationMessages,
  getConversationTimeline,
  listConversations,
  onAssistantChunk,
  onAssistantDone,
  onAssistantError,
  onAssistantReasoning,
  onAssistantStatus,
  onAssistantTool,
  replaceConversationMessages,
  setAssistantSettings,
  startAssistantStream,
  type AssistantConversation,
  type AssistantProvider,
  type AssistantSettings,
} from "@/lib/assistant/client";
import {
  clearDraft,
  readActiveConversationId,
  readDraft,
  writeActiveConversationId,
  writeDraft,
} from "@/lib/assistant/persistence";
import { getToolDisplayName } from "@/lib/assistant/tool-display";
import {
  toChatMessages,
  toTimelineEventMap,
  type AssistantPreResponseEvent,
  type AssistantViewStatus,
  type ChatMessage,
  type ToolActivity,
} from "@/lib/assistant/types";

const EMPTY_SETTINGS: AssistantSettings = {
  activeProvider: "deepseek",
  openrouterApiKey: "",
  openrouterBaseUrl: "https://openrouter.ai/api/v1",
  openrouterModel: "openrouter/free",
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-flash",
  systemPrompt: "",
};

type ActiveStreamState = {
  assistantMessageId: string;
  conversationId: string;
  streamId: string;
};

function useAssistantController() {
  const token = getSavedToken() || "";
  const [prompt, setPromptState] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AssistantSettings>(EMPTY_SETTINGS);
  const [status, setStatus] = useState<AssistantViewStatus>("idle");
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [preResponseEventsMap, setPreResponseEventsMap] = useState<
    Record<string, AssistantPreResponseEvent[]>
  >({});
  const [lastError, setLastError] = useState<string | null>(null);

  const activeStreamRef = useRef<ActiveStreamState | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    writeActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  const draftScope = activeConversationId;

  function setPrompt(value: string) {
    setPromptState(value);
    writeDraft(draftScope, value);
  }

  async function refreshConversations() {
    const items = await listConversations();
    setConversations(items);
    return items;
  }

  async function syncConversationMessages(conversationId: string) {
    const [rows, timelineRows] = await Promise.all([
      getConversationMessages(conversationId),
      getConversationTimeline(conversationId),
    ]);
    setMessages(toChatMessages(rows));
    setPreResponseEventsMap(toTimelineEventMap(timelineRows));
  }

  function loadDraftForConversation(conversationId: string | null) {
    setPromptState(readDraft(conversationId));
  }

  useEffect(() => {
    Promise.all([refreshConversations(), getAssistantSettings()]).then(async ([items, cfg]) => {
      setSettings(cfg);
      const savedConversationId = readActiveConversationId();
      const preferredConversation =
        items.find((item) => item.id === savedConversationId) || items[0] || null;
      if (!preferredConversation) {
        setActiveConversationId(null);
        setMessages([]);
        loadDraftForConversation(null);
        return;
      }
      setActiveConversationId(preferredConversation.id);
      await syncConversationMessages(preferredConversation.id);
      loadDraftForConversation(preferredConversation.id);
    });
  }, []);

  useEffect(() => {
    const offChunk = onAssistantChunk(({ streamId, delta, text }) => {
      const activeStream = activeStreamRef.current;
      if (!activeStream || activeStream.streamId !== streamId) return;
      setMessages((prev) =>
        prev.map((item) =>
          item.id === activeStream.assistantMessageId
            ? { ...item, content: typeof text === "string" ? text : item.content + delta }
            : item,
        ),
      );
    });

    const offStatus = onAssistantStatus(({ streamId, status }) => {
      const activeStream = activeStreamRef.current;
      if (!activeStream || activeStream.streamId !== streamId) return;
      setStatus(status);
    });

    const offReasoning = onAssistantReasoning(({ streamId, text }) => {
      const activeStream = activeStreamRef.current;
      if (!activeStream || activeStream.streamId !== streamId) return;
      const now = Date.now();
      setPreResponseEventsMap((prev) => {
        const currentEvents = prev[activeStream.assistantMessageId] || [];
        const last = currentEvents[currentEvents.length - 1];
        if (last?.type === "reasoning") {
          const next = [...currentEvents];
          next[next.length - 1] = { ...last, text, updatedAt: now };
          return { ...prev, [activeStream.assistantMessageId]: next };
        }
        return {
          ...prev,
          [activeStream.assistantMessageId]: [
            ...currentEvents,
            {
              id: `reasoning-${now}`,
              type: "reasoning",
              text,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      });
    });

    const offTool = onAssistantTool((payload) => {
      const activeStream = activeStreamRef.current;
      if (!activeStream || activeStream.streamId !== payload.streamId) return;
      const now = Date.now();
      setToolActivities((prev) => {
        const nextItem: ToolActivity = {
          toolCallId: payload.toolCallId,
          name: payload.name,
          label: getToolDisplayName(payload.name),
          state: payload.state,
          output: payload.output,
          createdAt: now,
          updatedAt: now,
        };
        const index = prev.findIndex((item) => item.toolCallId === payload.toolCallId);
        if (index === -1) return [...prev, nextItem];
        const next = [...prev];
        next[index] = { ...next[index], ...nextItem, updatedAt: now };
        return next;
      });
      setPreResponseEventsMap((prev) => {
        const currentEvents = prev[activeStream.assistantMessageId] || [];
        const index = currentEvents.findIndex(
          (item) => item.type === "tool" && item.toolCallId === payload.toolCallId,
        );
        if (index === -1) {
          return {
            ...prev,
            [activeStream.assistantMessageId]: [
              ...currentEvents,
              {
                id: payload.toolCallId,
                type: "tool",
                toolCallId: payload.toolCallId,
                name: payload.name,
                label: getToolDisplayName(payload.name),
                state: payload.state,
                output: payload.output,
                createdAt: now,
                updatedAt: now,
              },
            ],
          };
        }
        const next = [...currentEvents];
        const current = next[index];
        if (current?.type !== "tool") return prev;
        next[index] = {
          ...current,
          name: payload.name,
          label: getToolDisplayName(payload.name),
          state: payload.state,
          output: payload.output,
          updatedAt: now,
        };
        return { ...prev, [activeStream.assistantMessageId]: next };
      });
    });

    const offDone = onAssistantDone(async ({ streamId }) => {
      const activeStream = activeStreamRef.current;
      if (!activeStream || activeStream.streamId !== streamId) return;
      const { conversationId } = activeStream;
      activeStreamRef.current = null;
      await refreshConversations();
      if (activeConversationIdRef.current === conversationId) {
        await syncConversationMessages(conversationId);
      }
      setStatus("idle");
    });

    const offError = onAssistantError(async ({ streamId, error }) => {
      const activeStream = activeStreamRef.current;
      if (!activeStream || activeStream.streamId !== streamId) return;
      setLastError(error);
      setStatus("error");
      setMessages((prev) =>
        prev.map((item) =>
          item.id === activeStream.assistantMessageId && item.content.trim().length === 0
            ? { ...item, content: `请求失败：${error}` }
            : item,
        ),
      );
      activeStreamRef.current = null;
      await refreshConversations();
    });

    return () => {
      offChunk();
      offStatus();
      offReasoning();
      offTool();
      offDone();
      offError();
    };
  }, []);

  const isBusy = status === "submitted" || status === "thinking" || status === "streaming";

  const canAbort = Boolean(activeStreamRef.current);

  function getProviderApiKey(provider: AssistantProvider): string {
    return provider === "deepseek" ? settings.deepseekApiKey : settings.openrouterApiKey;
  }

  function getConversationProvider(conversationId: string | null): AssistantProvider {
    if (!conversationId) return settings.activeProvider;
    return conversations.find((item) => item.id === conversationId)?.provider || "openrouter";
  }

  const currentProvider = getConversationProvider(activeConversationId);
  const canSend = Boolean(prompt.trim() && token && getProviderApiKey(currentProvider) && !isBusy);

  const lastUserMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user") {
        return { index, message: messages[index] };
      }
    }
    return null;
  }, [messages]);

  const canRegenerate = Boolean(
    activeConversationId &&
    !isBusy &&
    lastUserMessage?.message.content.trim() &&
    getProviderApiKey(getConversationProvider(activeConversationId)),
  );
  const lastAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "assistant") return messages[index]?.id || null;
    }
    return null;
  }, [messages]);

  async function onSelectConversation(conversationId: string) {
    if (isBusy) return;
    setActiveConversationId(conversationId);
    setStatus("idle");
    setToolActivities([]);
    setPreResponseEventsMap({});
    setLastError(null);
    await syncConversationMessages(conversationId);
    loadDraftForConversation(conversationId);
  }

  function onNewConversation() {
    if (isBusy) return;
    setActiveConversationId(null);
    setMessages([]);
    setToolActivities([]);
    setPreResponseEventsMap({});
    setLastError(null);
    setStatus("idle");
    loadDraftForConversation(null);
  }

  async function onDeleteConversation(conversationId: string) {
    if (isBusy) return;
    const result = await deleteConversation(conversationId);
    if (!result.ok) return;
    const items = await refreshConversations();
    if (activeConversationId !== conversationId) return;
    const nextConversation = items[0] || null;
    if (!nextConversation) {
      onNewConversation();
      return;
    }
    await onSelectConversation(nextConversation.id);
  }

  async function onSaveSettings(nextSettings: Partial<AssistantSettings>) {
    const updated = await setAssistantSettings(nextSettings);
    setSettings(updated);
    return updated;
  }

  async function ensureConversation(text: string): Promise<string> {
    if (activeConversationId) return activeConversationId;
    const created = await createConversation(text.slice(0, 20), settings.activeProvider);
    setActiveConversationId(created.id);
    setConversations((prev) => [created, ...prev]);
    clearDraft(null);
    loadDraftForConversation(created.id);
    return created.id;
  }

  async function beginRun(input: {
    appendUserMessage: boolean;
    baseMessages?: ChatMessage[];
    conversationId: string;
    message: string;
  }) {
    const userMessageId = `local-user-${Date.now()}`;
    const nextMessages = input.baseMessages ?? [
      ...messages,
      ...(input.appendUserMessage
        ? [{ id: userMessageId, role: "user" as const, content: input.message }]
        : []),
    ];

    setToolActivities([]);
    setLastError(null);
    setStatus("submitted");

    const { assistantMessageId, streamId } = await startAssistantStream({
      message: input.message,
      token,
      conversationId: input.conversationId,
    });
    setMessages([...nextMessages, { id: assistantMessageId, role: "assistant", content: "" }]);
    setPreResponseEventsMap((prev) => ({ ...prev, [assistantMessageId]: [] }));

    activeStreamRef.current = {
      assistantMessageId,
      conversationId: input.conversationId,
      streamId,
    };
  }

  async function onSend() {
    const text = prompt.trim();
    if (!text || !token || !getProviderApiKey(currentProvider) || isBusy) return;
    const currentDraftScope = activeConversationId;
    const conversationId = await ensureConversation(text);
    clearDraft(currentDraftScope);
    clearDraft(conversationId);
    setPromptState("");
    await beginRun({
      appendUserMessage: true,
      conversationId,
      message: text,
    });
  }

  async function onAbort() {
    const activeStream = activeStreamRef.current;
    if (!activeStream) return;
    await abortAssistantStream(activeStream.streamId);
  }

  async function onRegenerate() {
    if (
      !activeConversationId ||
      !lastUserMessage ||
      !getProviderApiKey(getConversationProvider(activeConversationId)) ||
      isBusy
    ) {
      return;
    }
    const { index, message } = lastUserMessage;
    const persistedBase = messages.slice(0, index).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    const localBase = messages.slice(0, index + 1);
    await replaceConversationMessages(activeConversationId, persistedBase);
    setMessages(localBase);
    await beginRun({
      appendUserMessage: false,
      baseMessages: localBase,
      conversationId: activeConversationId,
      message: message.content,
    });
  }

  return {
    activeConversationId,
    canAbort,
    canRegenerate,
    canSend,
    conversations,
    isBusy,
    lastError,
    lastAssistantMessageId,
    messages,
    onAbort,
    onDeleteConversation,
    onNewConversation,
    onRegenerate,
    onSaveSettings,
    onSelectConversation,
    onSend,
    prompt,
    refreshConversations,
    setPrompt,
    settings,
    setSettings,
    status,
    token,
    preResponseEventsMap,
    toolActivities,
  };
}

export { EMPTY_SETTINGS, useAssistantController };
