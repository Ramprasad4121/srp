import {
  completeProviderSetup,
  completeWelcomeStep,
  createInitialSetupState,
  createSetupChecklist,
  createSetupManifest,
  defaultInternetMode,
  defaultSetupDefaults,
  getModelPolicyForMode,
  getNextSetupStep,
  getRuntimeModeDefaults,
  runtimeModes,
  setupSteps,
  summarizeProviderSetup
} from "@srp/config";
import {
  createRecommendedProviderSelections,
  evaluateProviderSetHealth,
  providerCatalog,
  summarizeProviderHealth
} from "@srp/providers";
import { createInternetPolicy, describeInternetPolicy } from "@srp/security";
import type { AppBootstrapResult, RuntimeMode, SetupManifest, SetupStep, RuntimeSessionState } from "@srp/shared-types";

export interface WebNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly supportedModes: readonly RuntimeMode[];
}

export const primaryNavigation: readonly WebNavigationItem[] = [
  { id: "overview", label: "Overview", supportedModes: runtimeModes },
  { id: "audit-flow", label: "Audit Flow", supportedModes: ["auditor", "hybrid"] },
  { id: "protocol-map", label: "Protocol Map", supportedModes: ["auditor", "hybrid"] },
  { id: "contracts", label: "Contracts", supportedModes: ["auditor", "hybrid"] },
  { id: "functions", label: "Functions", supportedModes: ["auditor", "hybrid"] },
  { id: "invariants", label: "Invariants", supportedModes: ["auditor", "hybrid"] },
  { id: "hypotheses", label: "Hypotheses", supportedModes: ["auditor", "hybrid"] },
  { id: "questions", label: "Questions", supportedModes: ["auditor", "hybrid"] },
  { id: "economic-risks", label: "Economic Risks", supportedModes: ["auditor", "hybrid"] },
  { id: "cross-contract-paths", label: "Cross-Contract Paths", supportedModes: ["auditor", "hybrid"] },
  { id: "findings", label: "Findings", supportedModes: ["auditor", "hybrid"] },
  { id: "pocs", label: "PoCs", supportedModes: ["auditor", "hybrid"] },
  { id: "report", label: "Report", supportedModes: ["auditor", "hybrid"] },
  { id: "dev", label: "Developer Workbench", supportedModes: ["developer", "hybrid"] },
  { id: "chat", label: "Chat", supportedModes: runtimeModes },
  { id: "trace", label: "Run Trace", supportedModes: runtimeModes },
  { id: "settings", label: "Settings", supportedModes: runtimeModes }
];

export interface SetupScreenDefinition {
  readonly step: SetupStep;
  readonly title: string;
}

export const setupScreens: readonly SetupScreenDefinition[] = setupSteps.map((step) => ({
  step,
  title: step
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}));

export const webDefaults = {
  defaultInternetMode,
  defaultLandingPage: "overview"
} as const;

export const providerCards = providerCatalog.map((provider) => ({
  kind: provider.kind,
  label: provider.label,
  defaultModel: provider.defaultModel,
  supportsTools: provider.supportsTools
}));

export const internetPolicySummary = describeInternetPolicy(
  createInternetPolicy(defaultSetupDefaults.internetMode, defaultSetupDefaults.approvedDomains)
);

const defaultManifest = createSetupManifest({
  state: createInitialSetupState()
});
const roleReadyManifest = createSetupManifest({
  state: completeWelcomeStep(defaultManifest.state)
});
const providersReadyManifest = createSetupManifest({
  state: completeProviderSetup(roleReadyManifest.state)
});

export const onboardingChecklist = createSetupChecklist(defaultManifest);

export const providerSetupSummary = summarizeProviderSetup(defaultManifest.state.providers);

export const onboardingHero = {
  currentStep: defaultManifest.state.currentStep,
  role: defaultManifest.state.role,
  readyItems: onboardingChecklist.filter((item) => item.complete).length,
  totalItems: onboardingChecklist.length
} as const;

export const onboardingProgression = {
  initialStep: defaultManifest.state.currentStep,
  afterWelcome: roleReadyManifest.state.currentStep,
  afterProviders: providersReadyManifest.state.currentStep,
  nextIncompleteStep: getNextSetupStep(providersReadyManifest)
} as const;

export interface WebOnboardingViewModel {
  readonly currentStep: string;
  readonly nextStep: string;
  readonly readyItems: number;
  readonly totalItems: number;
  readonly providerConfigured: number;
  readonly providerHealthy: number;
  readonly failingProviderKinds: readonly string[];
}

export function createWebOnboardingViewModel(
  manifest: SetupManifest,
  environment: NodeJS.ProcessEnv
): WebOnboardingViewModel {
  const checklist = createSetupChecklist(manifest);
  const providerHealth = summarizeProviderHealth(
    evaluateProviderSetHealth(manifest.state.providers, environment)
  );

  return {
    currentStep: manifest.state.currentStep,
    nextStep: getNextSetupStep(manifest),
    readyItems: checklist.filter((item) => item.complete).length,
    totalItems: checklist.length,
    providerConfigured: providerHealth.configured,
    providerHealthy: providerHealth.healthy,
    failingProviderKinds: providerHealth.failingKinds
  };
}

export interface ModelsProvidersViewModel {
  readonly role: RuntimeMode;
  readonly defaultTask: string;
  readonly recommendedProviderKinds: readonly string[];
  readonly selectedProviderKinds: readonly string[];
  readonly providerCards: readonly {
    kind: string;
    label: string;
    defaultModel: string;
    supportsTools: boolean;
    recommended: boolean;
    selected: boolean;
  }[];
}

export interface WorkspaceViewModel {
  readonly rootDirectory: string;
  readonly outputDirectory: string;
  readonly useDockerToolchains: boolean;
  readonly internetMode: string;
  readonly internetSummary: string;
}

export function createModelsProvidersViewModel(manifest: SetupManifest): ModelsProvidersViewModel {
  const runtimeDefaults = getRuntimeModeDefaults(manifest.state.role);
  const modelPolicy = getModelPolicyForMode(manifest.state.role);
  const recommendedKinds = createRecommendedProviderSelections(
    runtimeDefaults.recommendedProviderKinds
  ).map((provider) => provider.kind);
  const selectedKinds = manifest.state.providers.filter((provider) => provider.enabled).map((provider) => provider.kind);

  return {
    role: manifest.state.role,
    defaultTask: modelPolicy.defaultTask,
    recommendedProviderKinds: recommendedKinds,
    selectedProviderKinds: selectedKinds,
    providerCards: providerCatalog.map((provider) => ({
      kind: provider.kind,
      label: provider.label,
      defaultModel: provider.defaultModel,
      supportsTools: provider.supportsTools,
      recommended: recommendedKinds.includes(provider.kind),
      selected: selectedKinds.includes(provider.kind)
    }))
  };
}

export function createWorkspaceViewModel(manifest: SetupManifest): WorkspaceViewModel {
  return {
    rootDirectory: manifest.state.workspace.rootDirectory,
    outputDirectory: manifest.state.workspace.outputDirectory,
    useDockerToolchains: manifest.state.workspace.useDockerToolchains,
    internetMode: manifest.state.workspace.internetMode,
    internetSummary: describeInternetPolicy(
      createInternetPolicy(manifest.state.workspace.internetMode, manifest.approvedDomains)
    )
  };
}

// ---------------------------------------------------------------------------
// Navigation bootstrap — web-layer view of an AppBootstrapResult
// ---------------------------------------------------------------------------

export interface NavigationBootstrap {
  /** The route the app shell should navigate to on load. */
  readonly initialRoute: string;
  /** Nav items visible for the current role. */
  readonly visibleNavItems: readonly WebNavigationItem[];
  /** Whether the setup/onboarding flow should be shown instead of the main shell. */
  readonly showOnboarding: boolean;
  /** Onboarding progress 0–1. */
  readonly onboardingProgress: number;
  /** If false the user has no working provider and should be warned. */
  readonly hasWorkingProvider: boolean;
  /** The role string for role-aware rendering. */
  readonly role: string;
}

export interface OverviewViewModel {
  readonly protocolName: string;
  readonly protocolType: string;
  readonly currentPhase: string;
  readonly auditHealth: "healthy" | "at-risk" | "critical";
  readonly runId: string;
  readonly lastUpdated: string;
  readonly valueProposition: string;
  readonly moneyInMoneyOut: string;
  readonly adversarialActors: readonly string[];
  readonly worstCaseOutcome: string;
  readonly metrics: {
    readonly contractsInScope: number;
    readonly externalDependencies: number;
    readonly invariantsExtracted: number;
    readonly openQuestions: number;
    readonly pendingHypotheses: number;
    readonly validatedFindings: number;
  };
}

export function createOverviewViewModel(
  sessionState: RuntimeSessionState,
  manifest: SetupManifest
): OverviewViewModel {
  return {
    protocolName: "Generic Protocol",
    protocolType: "DeFi / Lending",
    currentPhase: sessionState.currentPhase || "Not Started",
    auditHealth: "healthy",
    runId: sessionState.runId || "N/A",
    lastUpdated: new Date().toISOString(),
    valueProposition: manifest.state.workspace.rootDirectory,
    moneyInMoneyOut: "N/A",
    adversarialActors: ["External Attacker", "Governance Admin"],
    worstCaseOutcome: "Complete drain of protocol liquidity.",
    metrics: {
      contractsInScope: sessionState.workspaceAnalysis?.solidityFileCount || 0,
      externalDependencies: 0,
      invariantsExtracted: sessionState.invariantRegistry?.invariants.length || 0,
      openQuestions: 0,
      pendingHypotheses: sessionState.hypothesisRegistry?.hypotheses.length || 0,
      validatedFindings: sessionState.findingRegistry?.findings.length || 0
    }
  };
}

export function deriveNavigationBootstrap(bootstrap: AppBootstrapResult): NavigationBootstrap {
  const visibleNavItems = primaryNavigation.filter((item) =>
    item.supportedModes.includes(bootstrap.role)
  );

  const onboardingProgress =
    bootstrap.onboarding.totalCount > 0
      ? bootstrap.onboarding.completedCount / bootstrap.onboarding.totalCount
      : 0;

  return {
    initialRoute: bootstrap.initialRoute,
    visibleNavItems,
    showOnboarding: bootstrap.decision === "needs-onboarding",
    onboardingProgress,
    hasWorkingProvider: bootstrap.providers.anyHealthy,
    role: bootstrap.role
  };
}

