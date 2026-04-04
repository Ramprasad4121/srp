// ---------------------------------------------------------------------------
// Bootstrap loader — resolves initial app state from the gateway
// ---------------------------------------------------------------------------
export async function resolveInitialAppState(client) {
    const result = await client.getBootstrap();
    if (!result.ok) {
        if (result.detail !== undefined) {
            return {
                kind: "error",
                error: result.error,
                detail: result.detail
            };
        }
        return {
            kind: "error",
            error: result.error
        };
    }
    const bootstrap = result.data;
    if (bootstrap.decision === "needs-onboarding" || bootstrap.decision === "needs-providers") {
        return {
            kind: "onboarding",
            bootstrap
        };
    }
    return {
        kind: "ready",
        bootstrap
    };
}
// ---------------------------------------------------------------------------
// Re-bootstrap after setup changes
// ---------------------------------------------------------------------------
export async function refreshBootstrap(client, current) {
    const newState = await resolveInitialAppState(client);
    // If the new bootstrap resolves to "ready" and the user was in onboarding,
    // they successfully completed setup.
    if (newState.kind === "ready" && current.kind === "onboarding") {
        return newState;
    }
    return newState;
}
//# sourceMappingURL=app-state.js.map