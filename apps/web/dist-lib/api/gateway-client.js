async function apiRequest(baseUrl, path, options = {}) {
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });
        const body = await res.json();
        if (!res.ok) {
            const errBody = body;
            return {
                ok: false,
                error: errBody.error ?? "request_failed",
                detail: errBody.detail ?? `HTTP ${res.status}`
            };
        }
        return { ok: true, data: body };
    }
    catch (err) {
        return {
            ok: false,
            error: "network_error",
            detail: err instanceof Error ? err.message : String(err)
        };
    }
}
// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------
export function createGatewayClient(baseUrl) {
    return {
        /** GET /api/bootstrap */
        async getBootstrap() {
            return apiRequest(baseUrl, "/api/bootstrap");
        },
        /** GET /api/setup */
        async getSetup() {
            return apiRequest(baseUrl, "/api/setup");
        },
        /** POST /api/setup/role */
        async setRole(role) {
            return apiRequest(baseUrl, "/api/setup/role", {
                method: "POST",
                body: JSON.stringify({ role })
            });
        },
        /** POST /api/setup/providers */
        async setProviders(providers) {
            return apiRequest(baseUrl, "/api/setup/providers", {
                method: "POST",
                body: JSON.stringify({ providers })
            });
        },
        /** POST /api/setup/workspace */
        async setWorkspace(patch) {
            return apiRequest(baseUrl, "/api/setup/workspace", {
                method: "POST",
                body: JSON.stringify(patch)
            });
        },
        /** POST /api/setup/complete/welcome */
        async completeWelcome() {
            return apiRequest(baseUrl, "/api/setup/complete/welcome", {
                method: "POST",
                body: "{}"
            });
        },
        /** POST /api/setup/complete/providers */
        async completeProviders() {
            return apiRequest(baseUrl, "/api/setup/complete/providers", {
                method: "POST",
                body: "{}"
            });
        },
        /** POST /api/setup/complete/workspace */
        async completeWorkspace() {
            return apiRequest(baseUrl, "/api/setup/complete/workspace", {
                method: "POST",
                body: "{}"
            });
        }
    };
}
//# sourceMappingURL=gateway-client.js.map