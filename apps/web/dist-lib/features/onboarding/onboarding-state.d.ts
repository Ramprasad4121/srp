import type { AppBootstrapResult, ProviderSelection, RuntimeMode } from "@srp/shared-types";
import type { GatewayClient, SetupResponse } from "../../api/gateway-client.js";
export type OnboardingScreen = "welcome" | "role" | "providers" | "workspace" | "complete";
export interface OnboardingState {
    readonly currentScreen: OnboardingScreen;
    readonly bootstrap: AppBootstrapResult;
    /** Latest setup response from the gateway, if available. */
    readonly setupData: SetupResponse | null;
}
/**
 * Determines the initial onboarding screen from the bootstrap decision.
 */
export declare function deriveInitialOnboardingScreen(bootstrap: AppBootstrapResult): OnboardingScreen;
export declare function createOnboardingState(bootstrap: AppBootstrapResult): OnboardingState;
export declare function submitWelcome(client: GatewayClient, state: OnboardingState): Promise<OnboardingState>;
export declare function submitRole(client: GatewayClient, state: OnboardingState, role: RuntimeMode): Promise<OnboardingState>;
export declare function submitProviders(client: GatewayClient, state: OnboardingState, providers: readonly ProviderSelection[]): Promise<OnboardingState>;
export declare function submitWorkspace(client: GatewayClient, state: OnboardingState, patch: {
    readonly outputDirectory?: string;
    readonly internetMode?: string;
    readonly useDockerToolchains?: boolean;
}): Promise<OnboardingState>;
export declare const onboardingScreenOrder: readonly OnboardingScreen[];
export declare function getOnboardingProgress(screen: OnboardingScreen): number;
export declare function getOnboardingStepNumber(screen: OnboardingScreen): number;
export declare function getOnboardingTotalSteps(): number;
//# sourceMappingURL=onboarding-state.d.ts.map