// Reusing the same fetching logic pattern from gateway-client
async function apiRequest(baseUrl, path, options = {}) {
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: { "Content-Type": "application/json", ...options.headers }
        });
        const body = await res.json();
        if (!res.ok) {
            return { ok: false, error: body.error || "request_failed" };
        }
        return { ok: true, data: body };
    }
    catch (err) {
        return { ok: false, error: "network_error", detail: err instanceof Error ? err.message : String(err) };
    }
}
export function createRuntimeClient(baseUrl) {
    return {
        async getSessionState() {
            return apiRequest(baseUrl, "/api/runtime");
        },
        async startSession() {
            return apiRequest(baseUrl, "/api/runtime/start", {
                method: "POST",
                body: "{}"
            });
        }
    };
}
//# sourceMappingURL=runtime-client.js.map