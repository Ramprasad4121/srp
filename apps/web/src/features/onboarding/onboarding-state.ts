import type { AppBootstrapResult, ProviderSelection, RuntimeMode } from "@srp/shared-types";
import type { GatewayClient, SetupResponse } from "../../api/gateway-client.js";

// ---------------------------------------------------------------------------
// Onboarding step progression
// ---------------------------------------------------------------------------

export type OnboardingScreen =
  | "welcome"
  | "role"
  | "providers"
  | "workspace"
  | "complete";

export interface OnboardingState {
  readonly currentScreen: OnboardingScreen;
  readonly bootstrap: AppBootstrapResult;
  /** Latest setup response from the gateway, if available. */
  readonly setupData: SetupResponse | null;
}

/**
 * Determines the initial onboarding screen from the bootstrap decision.
 */
export function deriveInitialOnboardingScreen(bootstrap: AppBootstrapResult): OnboardingScreen {
  if (bootstrap.decision === "needs-providers") {
    // User already completed basic onboarding but providers are unhealthy
    return "providers";
  }

  const step = bootstrap.onboarding.currentStep;

  switch (step) {
    case "welcome":
      return "welcome";
    case "role-selection":
      return "role";
    case "providers":
      return "providers";
    case "toolchain":
    case "skills":
    case "workspace":
    case "ui-preferences":
      return "workspace";
    case "ready":
      return "complete";
    default:
      return "welcome";
  }
}

export function createOnboardingState(bootstrap: AppBootstrapResult): OnboardingState {
  return {
    currentScreen: deriveInitialOnboardingScreen(bootstrap),
    bootstrap,
    setupData: null
  };
}

// ---------------------------------------------------------------------------
// Onboarding actions — each calls the gateway and returns updated state
// ---------------------------------------------------------------------------

export async function submitWelcome(
  client: GatewayClient,
  state: OnboardingState
): Promise<OnboardingState> {
  const result = await client.completeWelcome();
  if (!result.ok) return state;

  return {
    ...state,
    currentScreen: "role",
    setupData: result.data
  };
}

export async function submitRole(
  client: GatewayClient,
  state: OnboardingState,
  role: RuntimeMode
): Promise<OnboardingState> {
  const result = await client.setRole(role);
  if (!result.ok) return state;

  return {
    ...state,
    currentScreen: "providers",
    setupData: result.data
  };
}

export async function submitProviders(
  client: GatewayClient,
  state: OnboardingState,
  providers: readonly ProviderSelection[]
): Promise<OnboardingState> {
  const setResult = await client.setProviders(providers);
  if (!setResult.ok) return state;

  const completeResult = await client.completeProviders();
  if (!completeResult.ok) {
    return { ...state, setupData: setResult.data };
  }

  return {
    ...state,
    currentScreen: "workspace",
    setupData: completeResult.data
  };
}

export async function submitWorkspace(
  client: GatewayClient,
  state: OnboardingState,
  patch: {
    readonly outputDirectory?: string;
    readonly internetMode?: string;
    readonly useDockerToolchains?: boolean;
  }
): Promise<OnboardingState> {
  const setResult = await client.setWorkspace(patch as Parameters<GatewayClient["setWorkspace"]>[0]);
  if (!setResult.ok) return state;

  const completeResult = await client.completeWorkspace();
  if (!completeResult.ok) {
    return { ...state, setupData: setResult.data };
  }

  return {
    ...state,
    currentScreen: "complete",
    setupData: completeResult.data
  };
}

// ---------------------------------------------------------------------------
// Progression helpers
// ---------------------------------------------------------------------------

export const onboardingScreenOrder: readonly OnboardingScreen[] = [
  "welcome",
  "role",
  "providers",
  "workspace",
  "complete"
];

export function getOnboardingProgress(screen: OnboardingScreen): number {
  const index = onboardingScreenOrder.indexOf(screen);
  return index >= 0 ? index / (onboardingScreenOrder.length - 1) : 0;
}

export function getOnboardingStepNumber(screen: OnboardingScreen): number {
  const index = onboardingScreenOrder.indexOf(screen);
  return index >= 0 ? index + 1 : 1;
}

export function getOnboardingTotalSteps(): number {
  return onboardingScreenOrder.length;
}
