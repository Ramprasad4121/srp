import type { AppBootstrapResult } from "@srp/shared-types";
import type { GatewayClient } from "../api/gateway-client.js";
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
export type AppState = AppStateLoading | AppStateError | AppStateOnboarding | AppStateReady;
export declare function resolveInitialAppState(client: GatewayClient): Promise<AppState>;
export declare function refreshBootstrap(client: GatewayClient, current: AppState): Promise<AppState>;
//# sourceMappingURL=app-state.d.ts.map