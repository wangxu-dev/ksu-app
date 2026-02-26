import { createFileRoute } from "@tanstack/react-router";
import { AssistantPage } from "@/pages/assistant";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
});
