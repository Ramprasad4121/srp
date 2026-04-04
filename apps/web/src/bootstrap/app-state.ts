import type { AppBootstrapResult } from "@srp/shared-types";
import type { GatewayClient } from "../api/gateway-client.js";

// ---------------------------------------------------------------------------
// App shell states — discriminated union
// ---------------------------------------------------------------------------

export interface AppStateLoading {
  readonly kind: "loading";
}

export interface AppStateError {
  readonly kind: "error";
  readonly error: string;
  readonly detail?: string;
}

export interface AppStateOnboarding {
  readonly kind: "onboarding";
  readonly bootstrap: AppBootstrapResult;
}

export interface AppStateReady {
  readonly kind: "ready";
  readonly bootstrap: AppBootstrapResult;
}

export type AppState =
  | AppStateLoading
  | AppStateError
  | AppStateOnboarding
  | AppStateReady;

// ---------------------------------------------------------------------------
// Bootstrap loader — resolves initial app state from the gateway
// ---------------------------------------------------------------------------

export async function resolveInitialAppState(client: GatewayClient): Promise<AppState> {
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

export async function refreshBootstrap(
  client: GatewayClient,
  current: AppState
): Promise<AppState> {
  const newState = await resolveInitialAppState(client);

  // If the new bootstrap resolves to "ready" and the user was in onboarding,
  // they successfully completed setup.
  if (newState.kind === "ready" && current.kind === "onboarding") {
    return newState;
  }

  return newState;
}
