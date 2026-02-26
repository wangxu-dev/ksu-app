import { ipcInvoke } from "@/lib/ipc";
import { PROXY_REQUEST_CHANNEL } from "@/lib/request/channels";
import type { UnifiedRequestPayload, UnifiedResponsePayload } from "@/lib/request/types";

export async function request(payload: UnifiedRequestPayload): Promise<UnifiedResponsePayload> {
  return ipcInvoke<UnifiedResponsePayload>(PROXY_REQUEST_CHANNEL, payload);
}
