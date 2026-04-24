import { useEffect, useRef, useState } from "react";
import { AssistantChatHeader } from "@/components/assistant/assistant-chat-header";
import { AssistantComposer } from "@/components/assistant/assistant-composer";
import { AssistantHistoryPanel } from "@/components/assistant/assistant-history-panel";
import { AssistantMessageList } from "@/components/assistant/assistant-message-list";
import { AssistantSettingsDialog } from "@/components/assistant/assistant-settings-dialog";
import { useAssistantController } from "@/lib/assistant/use-assistant-controller";

export function AssistantPage() {
  const [showHistory, setShowHistory] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const controller = useAssistantController();

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [controller.messages, controller.status, shouldAutoScroll]);

  const activeTitle =
    controller.activeConversationId === null
      ? "新对话 (草稿)"
      : controller.conversations.find((item) => item.id === controller.activeConversationId)
          ?.title || "加载中...";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AssistantHistoryPanel
          activeConversationId={controller.activeConversationId}
          conversations={controller.conversations}
          disabled={controller.isBusy}
          onDeleteConversation={controller.onDeleteConversation}
          onNewConversation={controller.onNewConversation}
          onSelectConversation={controller.onSelectConversation}
          open={showHistory}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300">
          <AssistantChatHeader
            activeTitle={activeTitle}
            onOpenSettings={() => setShowSettings(true)}
            onToggleHistory={() => setShowHistory((prev) => !prev)}
            showHistory={showHistory}
          />
          <AssistantMessageList
            bottomRef={messagesBottomRef}
            canRegenerate={controller.canRegenerate}
            isBusy={controller.isBusy}
            lastError={controller.lastError}
            lastAssistantMessageId={controller.lastAssistantMessageId}
            messages={controller.messages}
            onScrollNearBottomChange={setShouldAutoScroll}
            onRegenerate={controller.onRegenerate}
            status={controller.status}
            toolActivities={controller.toolActivities}
          />
          <AssistantComposer
            disabled={!controller.canSend}
            isBusy={controller.isBusy}
            onAbort={controller.onAbort}
            onSend={controller.onSend}
            prompt={controller.prompt}
            setPrompt={controller.setPrompt}
          />
        </div>
      </div>

      <AssistantSettingsDialog
        onOpenChange={setShowSettings}
        onSave={async () => {
          await controller.onSaveSettings(controller.settings);
        }}
        open={showSettings}
        setSettings={controller.setSettings}
        settings={controller.settings}
      />
    </div>
  );
}
