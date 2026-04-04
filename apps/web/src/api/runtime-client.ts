import type { RuntimeSessionState } from "@srp/shared-types";
import type { ApiResult } from "./gateway-client.js";

// Reusing the same fetching logic pattern from gateway-client
async function apiRequest<T>(baseUrl: string, path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers }
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: (body.error as string) || "request_failed" };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    return { ok: false, error: "network_error", detail: err instanceof Error ? err.message : String(err) };
  }
}

export function createRuntimeClient(baseUrl: string) {
  return {
    async getSessionState(): Promise<ApiResult<RuntimeSessionState>> {
      return apiRequest<RuntimeSessionState>(baseUrl, "/api/runtime");
    },
    async startSession(): Promise<ApiResult<RuntimeSessionState>> {
      return apiRequest<RuntimeSessionState>(baseUrl, "/api/runtime/start", {
        method: "POST",
        body: "{}"
      });
    }
  } as const;
}

export type RuntimeClient = ReturnType<typeof createRuntimeClient>;
