import {
  buildOnboardingReadiness,
  createCanonicalRouteRegistry,
  deriveInitialRouteFromIdentity,
  getSetupConfigPath,
  isOnboardingComplete,
  loadOrCreateSetupManifest
} from "@srp/config";
import { buildProviderHealthBundle } from "@srp/providers";
import type { AppBootstrapResult, BootstrapDecision, RuntimeMode } from "@srp/shared-types";
import { PersistenceManager } from "./runtime/persistence-manager.js";

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

function deriveInitialRoute(
  decision: BootstrapDecision,
  role: RuntimeMode,
  identity: import("@srp/shared-types").SetupIdentity
): string {
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
  if (role === "hybrid") {
    return "/overview";
  }
  return deriveInitialRouteFromIdentity(identity);
}

export async function resolveAppBootstrap(
  rootDirectory: string,
  environment: NodeJS.ProcessEnv
): Promise<AppBootstrapResult> {
  const manifest = await loadOrCreateSetupManifest(rootDirectory);
  const persistence = new PersistenceManager(rootDirectory, manifest.state.workspace.outputDirectory);
  await persistence.init();
  const projectMemory = await persistence.loadOrCreateProjectMemory(manifest.state.identity);
  const onboarding = buildOnboardingReadiness(manifest);
  const providers = buildProviderHealthBundle(manifest.state.providers, environment);
  const decision = deriveBootstrapDecision(isOnboardingComplete(manifest), providers.anyHealthy);
  const routes = createCanonicalRouteRegistry(manifest.state.identity);
  const initialRoute = deriveInitialRoute(decision, manifest.state.role, manifest.state.identity);

  return {
    manifestVersion: manifest.version,
    manifestUpdatedAt: manifest.updatedAt,
    role: manifest.state.role,
    identity: manifest.state.identity,
    projectMemory,
    onboarding,
    providers,
    decision,
    initialRoute,
    routes,
    configPath: getSetupConfigPath(rootDirectory)
  };
}
