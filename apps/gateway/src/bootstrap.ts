import {
  buildOnboardingReadiness,
  getSetupConfigPath,
  isOnboardingComplete,
  loadOrCreateSetupManifest
} from "@srp/config";
import { buildProviderHealthBundle } from "@srp/providers";
import type { AppBootstrapResult, BootstrapDecision, RuntimeMode } from "@srp/shared-types";

function deriveBootstrapDecision(
  onboardingComplete: boolean,
  anyHealthyProvider: boolean
): BootstrapDecision {
  if (!onboardingComplete) {
    return "needs-onboarding";
  }
  if (!anyHealthyProvider) {
    return "needs-providers";
  }
  return "ready";
}

function deriveInitialRoute(decision: BootstrapDecision, role: RuntimeMode): string {
  if (decision === "needs-onboarding") {
    return "/setup";
  }
  if (decision === "needs-providers") {
    return "/setup/providers";
  }
  if (role === "auditor") {
    return "/audit-flow";
  }
  if (role === "developer") {
    return "/dev";
  }
  return "/overview";
}

export async function resolveAppBootstrap(
  rootDirectory: string,
  environment: NodeJS.ProcessEnv
): Promise<AppBootstrapResult> {
  const manifest = await loadOrCreateSetupManifest(rootDirectory);
  const onboarding = buildOnboardingReadiness(manifest);
  const providers = buildProviderHealthBundle(manifest.state.providers, environment);
  const decision = deriveBootstrapDecision(isOnboardingComplete(manifest), providers.anyHealthy);
  const initialRoute = deriveInitialRoute(decision, manifest.state.role);

  return {
    manifestVersion: manifest.version,
    manifestUpdatedAt: manifest.updatedAt,
    role: manifest.state.role,
    onboarding,
    providers,
    decision,
    initialRoute,
    configPath: getSetupConfigPath(rootDirectory)
  };
}
