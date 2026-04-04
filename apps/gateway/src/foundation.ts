import {
  createSetupChecklist,
  createSetupManifest,
  getNextSetupStep,
  getSetupConfigPath,
  loadOrCreateSetupManifest
} from "@srp/config";
import { evaluateProviderSetHealth, summarizeProviderHealth } from "@srp/providers";

export interface GatewayHealthSnapshot {
  readonly ok: true;
  readonly currentPhase: "phase-0-preparation";
  readonly providerConfigured: boolean;
  readonly setupConfigPath: string;
  readonly nextSetupStep: string;
}

export function createGatewayHealthSnapshot(): GatewayHealthSnapshot {
  const manifest = createSetupManifest();
  const providerHealth = summarizeProviderHealth(
    evaluateProviderSetHealth(manifest.state.providers, process.env)
  );

  return {
    ok: true,
    currentPhase: "phase-0-preparation",
    providerConfigured: providerHealth.configured > 0,
    setupConfigPath: getSetupConfigPath("."),
    nextSetupStep: getNextSetupStep(manifest)
  };
}

export interface GatewayOnboardingSnapshot {
  readonly configPath: string;
  readonly currentStep: string;
  readonly nextStep: string;
  readonly readySteps: number;
  readonly providerHealthHealthy: number;
  readonly providerHealthTotal: number;
  readonly providerHealthFailingKinds: readonly string[];
}

export async function loadGatewayOnboardingSnapshot(
  rootDirectory: string,
  environment: NodeJS.ProcessEnv
): Promise<GatewayOnboardingSnapshot> {
  const manifest = await loadOrCreateSetupManifest(rootDirectory);
  const checklist = createSetupChecklist(manifest);
  const providerHealth = summarizeProviderHealth(
    evaluateProviderSetHealth(manifest.state.providers, environment)
  );

  return {
    configPath: getSetupConfigPath(rootDirectory),
    currentStep: manifest.state.currentStep,
    nextStep: getNextSetupStep(manifest),
    readySteps: checklist.filter((item) => item.complete).length,
    providerHealthHealthy: providerHealth.healthy,
    providerHealthTotal: providerHealth.total,
    providerHealthFailingKinds: providerHealth.failingKinds
  };
}
