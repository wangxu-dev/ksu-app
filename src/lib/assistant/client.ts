import { ipcInvoke, ipcOn } from "@/lib/ipc";
import {
  ASSISTANT_STREAM_CHUNK_CHANNEL,
  ASSISTANT_STREAM_DONE_CHANNEL,
  ASSISTANT_STREAM_ERROR_CHANNEL,
  ASSISTANT_STREAM_START_CHANNEL,
} from "@/lib/assistant/channels";

type StartPayload = {
  message: string;
  token: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

type StartResponse = { streamId: string };

export async function startAssistantStream(payload: StartPayload): Promise<StartResponse> {
  return ipcInvoke<StartResponse>(ASSISTANT_STREAM_START_CHANNEL, payload);
}

export function onAssistantChunk(
  listener: (payload: { streamId: string; delta: string }) => void,
): () => void {
  return ipcOn(ASSISTANT_STREAM_CHUNK_CHANNEL, (payload) =>
    listener(payload as { streamId: string; delta: string }),
  );
}

export function onAssistantDone(listener: (payload: { streamId: string }) => void): () => void {
  return ipcOn(ASSISTANT_STREAM_DONE_CHANNEL, (payload) =>
    listener(payload as { streamId: string }),
  );
}

export function onAssistantError(
  listener: (payload: { streamId: string; error: string }) => void,
): () => void {
  return ipcOn(ASSISTANT_STREAM_ERROR_CHANNEL, (payload) =>
    listener(payload as { streamId: string; error: string }),
  );
}
