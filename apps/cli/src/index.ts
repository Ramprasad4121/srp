import {
  completeProviderSetup,
  completeWelcomeStep,
  createSetupChecklist,
  createSetupManifest,
  createWelcomeMessage,
  defaultModelPolicy,
  defaultRuntimeMode,
  getSetupConfigPath,
  getNextSetupStep,
  loadOrCreateSetupManifest,
  setupSteps,
} from "@srp/config";
import { createPhaseStatusChangedEvent, createSessionStartedEvent } from "@srp/events";
import { resolveAppBootstrap } from "@srp/gateway";
import {
  createDefaultProviderSelection,
  evaluateProviderSetHealth,
  summarizeProviderHealth
} from "@srp/providers";
import { canBrowseInternet, createInternetPolicy } from "@srp/security";
import type { AppBootstrapResult } from "@srp/shared-types";

export interface CliBootstrapSummary {
  readonly mode: string;
  readonly defaultModelTask: string;
  readonly eventType: string;
  readonly setupSteps: readonly string[];
  readonly firstPhaseEventType: string;
  readonly providerKind: string;
  readonly internetEnabled: boolean;
  readonly setupConfigPath: string;
  readonly setupReadySteps: number;
  readonly nextSetupStep: string;
  readonly welcomeMessage: string;
  readonly providerSetupStep: string;
  readonly providerHealthConfigured: number;
  readonly providerHealthFailingKinds: readonly string[];
}

export function createCliBootstrapSummary(): CliBootstrapSummary {
  const event = createSessionStartedEvent({
    projectId: "workspace",
    runId: "bootstrap-run",
    sessionId: "bootstrap-session"
  });
  const firstPhaseEvent = createPhaseStatusChangedEvent({
    projectId: "workspace",
    runId: "bootstrap-run",
    phase: "discovery-docs",
    status: "running"
  });
  const provider = createDefaultProviderSelection("openai-compatible");
  const internetPolicy = createInternetPolicy("local-plus-docs", [
    { hostname: "docs.openzeppelin.com", reason: "Trusted docs" }
  ]);
  const manifest = createSetupManifest({
    state: completeWelcomeStep(createSetupManifest().state)
  });
  const checklist = createSetupChecklist(manifest);
  const providerReadyState = completeProviderSetup(manifest.state);

  return {
    mode: defaultRuntimeMode,
    defaultModelTask: defaultModelPolicy.defaultTask,
    eventType: event.type,
    setupSteps,
    firstPhaseEventType: firstPhaseEvent.type,
    providerKind: provider.kind,
    internetEnabled: canBrowseInternet(internetPolicy),
    setupConfigPath: getSetupConfigPath("."),
    setupReadySteps: checklist.filter((item) => item.complete).length,
    nextSetupStep: getNextSetupStep(manifest),
    welcomeMessage: createWelcomeMessage(manifest),
    providerSetupStep: providerReadyState.currentStep,
    providerHealthConfigured: 0,
    providerHealthFailingKinds: []
  };
}

export interface CliOnboardingSnapshot {
  readonly configPath: string;
  readonly currentStep: string;
  readonly nextStep: string;
  readonly readySteps: number;
  readonly providerHealthConfigured: number;
  readonly providerHealthTotal: number;
  readonly failingProviderKinds: readonly string[];
}

export async function loadCliOnboardingSnapshot(
  rootDirectory: string,
  environment: NodeJS.ProcessEnv
): Promise<CliOnboardingSnapshot> {
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
    providerHealthConfigured: providerHealth.configured,
    providerHealthTotal: providerHealth.total,
    failingProviderKinds: providerHealth.failingKinds
  };
}

// ---------------------------------------------------------------------------
// Bootstrap contract adapter for the CLI
// ---------------------------------------------------------------------------

export interface CliBootstrapView {
  readonly decision: string;
  readonly role: string;
  readonly initialRoute: string;
  readonly onboardingComplete: boolean;
  readonly onboardingStep: string;
  readonly onboardingProgress: string;
  readonly providerTotal: number;
  readonly providerHealthy: number;
  readonly anyHealthy: boolean;
  readonly failingKinds: readonly string[];
  readonly configPath: string;
}

export function summarizeBootstrapForCli(bootstrap: AppBootstrapResult): CliBootstrapView {
  const { onboarding, providers } = bootstrap;
  const pct = onboarding.totalCount > 0
    ? `${Math.round((onboarding.completedCount / onboarding.totalCount) * 100)}%`
    : "0%";

  return {
    decision: bootstrap.decision,
    role: bootstrap.role,
    initialRoute: bootstrap.initialRoute,
    onboardingComplete: onboarding.complete,
    onboardingStep: onboarding.currentStep,
    onboardingProgress: pct,
    providerTotal: providers.total,
    providerHealthy: providers.healthy,
    anyHealthy: providers.anyHealthy,
    failingKinds: providers.failingKinds,
    configPath: bootstrap.configPath
  };
}

export async function resolveCliBootstrap(
  rootDirectory: string,
  environment: NodeJS.ProcessEnv
): Promise<CliBootstrapView> {
  const bootstrap = await resolveAppBootstrap(rootDirectory, environment);
  return summarizeBootstrapForCli(bootstrap);
}

