import { request } from "@/lib/request/client";
import type { UnifiedRequestPayload, UnifiedResponsePayload } from "@/lib/request/types";

export type ProxyRequestPayload = UnifiedRequestPayload;
export type ProxyResponsePayload = UnifiedResponsePayload;

export async function proxyRequest(payload: ProxyRequestPayload): Promise<ProxyResponsePayload> {
  return request(payload);
}
