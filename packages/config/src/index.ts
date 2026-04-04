import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  ApprovedDomainRule,
  InternetMode,
  ProviderSelection,
  RuntimeMode,
  SetupManifest,
  SetupState,
  SetupStep,
  WorkspaceSelection
} from "@srp/shared-types";

export const runtimeModes: readonly RuntimeMode[] = ["auditor", "developer", "hybrid"];
export const setupSteps: readonly SetupStep[] = [
  "welcome",
  "role-selection",
  "providers",
  "toolchain",
  "skills",
  "workspace",
  "ui-preferences",
  "ready"
];

export const defaultRuntimeMode: RuntimeMode = "hybrid";
export const defaultInternetMode: InternetMode = "local-plus-docs";

export interface ModelPolicy {
  readonly defaultTask: "chat" | "analysis" | "generation";
  readonly fallbackOrder: readonly string[];
}

export interface RuntimeModeDefaults {
  readonly mode: RuntimeMode;
  readonly recommendedProviderKinds: readonly ProviderSelection["kind"][];
  readonly defaultTask: ModelPolicy["defaultTask"];
}

export const defaultModelPolicy: ModelPolicy = {
  defaultTask: "analysis",
  fallbackOrder: ["openai-compatible", "anthropic-compatible", "local-ollama"]
};

export const runtimeModeDefaults: readonly RuntimeModeDefaults[] = [
  {
    mode: "auditor",
    recommendedProviderKinds: ["anthropic", "openai-compatible", "nvidia"],
    defaultTask: "analysis"
  },
  {
    mode: "developer",
    recommendedProviderKinds: ["openai", "openai-compatible", "ollama"],
    defaultTask: "generation"
  },
  {
    mode: "hybrid",
    recommendedProviderKinds: ["openai-compatible", "anthropic", "ollama"],
    defaultTask: "analysis"
  }
] as const;

export interface SetupDefaults {
  readonly role: RuntimeMode;
  readonly internetMode: InternetMode;
  readonly providers: readonly ProviderSelection[];
  readonly workspace: WorkspaceSelection;
  readonly approvedDomains: readonly ApprovedDomainRule[];
}

export const defaultSetupDefaults: SetupDefaults = {
  role: defaultRuntimeMode,
  internetMode: defaultInternetMode,
  providers: [
    {
      kind: "openai-compatible",
      label: "Primary Compatible Endpoint",
      model: "gpt-4.1-mini",
      enabled: true
    }
  ],
  workspace: {
    rootDirectory: ".",
    outputDirectory: ".srp",
    useDockerToolchains: true,
    internetMode: defaultInternetMode
  },
  approvedDomains: [
    { hostname: "docs.openzeppelin.com", reason: "Smart contract library documentation" },
    { hostname: "eips.ethereum.org", reason: "Primary standards and EIP references" },
    { hostname: "docs.soliditylang.org", reason: "Solidity language reference" }
  ]
};

export function createInitialSetupState(
  overrides: Partial<Pick<SetupState, "role" | "providers" | "workspace">> = {}
): SetupState {
  return {
    currentStep: "welcome",
    completedSteps: [],
    role: overrides.role ?? defaultSetupDefaults.role,
    providers: overrides.providers ?? defaultSetupDefaults.providers,
    workspace: overrides.workspace ?? defaultSetupDefaults.workspace
  };
}

export function advanceSetupState(state: SetupState, nextStep: SetupStep): SetupState {
  const completedSteps = state.completedSteps.includes(state.currentStep)
    ? state.completedSteps
    : [...state.completedSteps, state.currentStep];

  return {
    ...state,
    currentStep: nextStep,
    completedSteps
  };
}

export function markSetupStepCompleted(state: SetupState, step: SetupStep): SetupState {
  const completedSteps = state.completedSteps.includes(step)
    ? state.completedSteps
    : [...state.completedSteps, step];

  // Also auto-advance currentStep if the step being completed is the current one
  let currentStep = state.currentStep;
  if (step === state.currentStep) {
    const currentIndex = setupSteps.indexOf(step);
    if (currentIndex !== -1 && currentIndex < setupSteps.length - 1) {
      currentStep = setupSteps[currentIndex + 1]!;
    }
  }

  return {
    ...state,
    currentStep,
    completedSteps
  };
}

export function updateSetupRole(state: SetupState, role: RuntimeMode): SetupState {
  return {
    ...state,
    role
  };
}

export function upsertProviderSelection(
  state: SetupState,
  provider: ProviderSelection
): SetupState {
  const existingIndex = state.providers.findIndex((entry) => entry.kind === provider.kind);

  if (existingIndex === -1) {
    return {
      ...state,
      providers: [...state.providers, provider]
    };
  }

  return {
    ...state,
    providers: state.providers.map((entry, index) => (index === existingIndex ? provider : entry))
  };
}

export function replaceProviderSelections(
  state: SetupState,
  providers: readonly ProviderSelection[]
): SetupState {
  return {
    ...state,
    providers: [...providers]
  };
}

export function updateWorkspaceSelection(
  state: SetupState,
  workspace: Partial<WorkspaceSelection>
): SetupState {
  return {
    ...state,
    workspace: {
      ...state.workspace,
      ...workspace
    }
  };
}

export function getRuntimeModeDefaults(mode: RuntimeMode): RuntimeModeDefaults {
  const defaults = runtimeModeDefaults.find((entry) => entry.mode === mode);
  if (!defaults) {
    throw new Error(`Unknown runtime mode: ${mode}`);
  }
  return defaults;
}

export function getModelPolicyForMode(mode: RuntimeMode): ModelPolicy {
  const defaults = getRuntimeModeDefaults(mode);

  return {
    defaultTask: defaults.defaultTask,
    fallbackOrder: defaults.recommendedProviderKinds
  };
}

export const defaultSetupConfigRelativePath = join(".srp", "config", "setup.json");

export interface SetupChecklistItem {
  readonly step: SetupStep;
  readonly complete: boolean;
  readonly reason: string;
}

export interface ProviderSetupSummary {
  readonly enabledCount: number;
  readonly readyCount: number;
  readonly missingProviderKinds: readonly string[];
}

export function createSetupManifest(
  overrides: Partial<Pick<SetupManifest, "approvedDomains" | "state" | "version">> = {}
): SetupManifest {
  return {
    version: overrides.version ?? "1",
    updatedAt: new Date().toISOString(),
    approvedDomains: overrides.approvedDomains ?? defaultSetupDefaults.approvedDomains,
    state: overrides.state ?? createInitialSetupState()
  };
}

export function getSetupConfigPath(rootDirectory: string): string {
  return join(rootDirectory, defaultSetupConfigRelativePath);
}

export async function loadSetupManifest(rootDirectory: string): Promise<SetupManifest | null> {
  const path = getSetupConfigPath(rootDirectory);

  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as SetupManifest;
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;
    if (maybeNodeError.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveSetupManifest(
  rootDirectory: string,
  manifest: SetupManifest
): Promise<string> {
  const path = getSetupConfigPath(rootDirectory);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return path;
}

export async function loadOrCreateSetupManifest(rootDirectory: string): Promise<SetupManifest> {
  const existing = await loadSetupManifest(rootDirectory);
  if (existing) {
    return existing;
  }

  const manifest = createSetupManifest();
  await saveSetupManifest(rootDirectory, manifest);
  return manifest;
}

export async function updateSetupManifest(
  rootDirectory: string,
  updater: (manifest: SetupManifest) => SetupManifest
): Promise<SetupManifest> {
  const current = await loadOrCreateSetupManifest(rootDirectory);
  const updated = {
    ...updater(current),
    updatedAt: new Date().toISOString()
  };
  await saveSetupManifest(rootDirectory, updated);
  return updated;
}

export async function persistSetupRole(
  rootDirectory: string,
  role: RuntimeMode
): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: updateSetupRole(manifest.state, role)
  }));
}

export async function persistProviderSelections(
  rootDirectory: string,
  providers: readonly ProviderSelection[]
): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: replaceProviderSelections(manifest.state, providers)
  }));
}

export async function persistWorkspaceSelection(
  rootDirectory: string,
  workspace: Partial<WorkspaceSelection>
): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: updateWorkspaceSelection(manifest.state, workspace)
  }));
}

export async function persistWelcomeCompleted(rootDirectory: string): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: completeWelcomeStep(manifest.state)
  }));
}

export async function persistProviderSetupCompleted(rootDirectory: string): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: completeProviderSetup(manifest.state)
  }));
}

export async function persistWorkspaceSetupCompleted(rootDirectory: string): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: completeWorkspaceSetup(manifest.state)
  }));
}

export function summarizeProviderSetup(
  providers: readonly ProviderSelection[]
): ProviderSetupSummary {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const readyProviders = enabledProviders.filter((provider) => provider.model.trim().length > 0);

  return {
    enabledCount: enabledProviders.length,
    readyCount: readyProviders.length,
    missingProviderKinds: enabledProviders
      .filter((provider) => provider.model.trim().length === 0)
      .map((provider) => provider.kind)
  };
}

export function createSetupChecklist(manifest: SetupManifest): readonly SetupChecklistItem[] {
  const providerSummary = summarizeProviderSetup(manifest.state.providers);

  return [
    {
      step: "welcome",
      complete: true,
      reason: "Setup manifest exists"
    },
    {
      step: "role-selection",
      complete: manifest.state.role.length > 0,
      reason: `Role set to ${manifest.state.role}`
    },
    {
      step: "providers",
      complete: providerSummary.enabledCount > 0 && providerSummary.readyCount > 0,
      reason:
        providerSummary.enabledCount > 0
          ? `${providerSummary.readyCount}/${providerSummary.enabledCount} providers ready`
          : "No providers enabled"
    },
    {
      step: "toolchain",
      complete: true,
      reason: "Toolchain checks not implemented yet (skipped)"
    },
    {
      step: "skills",
      complete: true,
      reason: "Skill setup not implemented yet (skipped)"
    },
    {
      step: "workspace",
      complete: manifest.state.completedSteps.includes("workspace"),
      reason: `Outputs at ${manifest.state.workspace.outputDirectory}`
    },
    {
      step: "ui-preferences",
      complete: true,
      reason: "Default UI preferences available"
    },
    {
      step: "ready",
      complete:
        manifest.state.completedSteps.includes("providers") &&
        manifest.state.completedSteps.includes("workspace"),
      reason: "Requires providers and workspace completion"
    }
  ];
}

export function getNextSetupStep(manifest: SetupManifest): SetupStep {
  const nextIncomplete = createSetupChecklist(manifest).find((item) => !item.complete);
  return nextIncomplete?.step ?? "ready";
}

export function createWelcomeMessage(manifest: SetupManifest): string {
  return `SRP setup is in ${manifest.state.currentStep}. Role: ${manifest.state.role}.`;
}

export function completeWelcomeStep(state: SetupState): SetupState {
  return markSetupStepCompleted(advanceSetupState(state, "role-selection"), "welcome");
}

export function completeProviderSetup(state: SetupState): SetupState {
  return markSetupStepCompleted(advanceSetupState(state, "workspace"), "providers");
}

export function completeWorkspaceSetup(state: SetupState): SetupState {
  return markSetupStepCompleted(advanceSetupState(state, "ready"), "workspace");
}

// ---------------------------------------------------------------------------
// Onboarding readiness helpers (consumed by the bootstrap contract)
// ---------------------------------------------------------------------------

/**
 * The minimum steps that must be complete for the app to be considered
 * past the first-time setup gate.
 */
const REQUIRED_COMPLETE_STEPS: readonly SetupStep[] = ["providers", "workspace"];

export function isOnboardingComplete(manifest: SetupManifest): boolean {
  return REQUIRED_COMPLETE_STEPS.every((step) =>
    manifest.state.completedSteps.includes(step)
  );
}

export interface OnboardingReadinessSummary {
  readonly complete: boolean;
  readonly currentStep: SetupStep;
  readonly nextStep: SetupStep;
  readonly completedCount: number;
  readonly totalCount: number;
  readonly incompleteSteps: readonly SetupStep[];
}

export function buildOnboardingReadiness(manifest: SetupManifest): OnboardingReadinessSummary {
  const checklist = createSetupChecklist(manifest);
  const incompleteSteps = checklist
    .filter((item) => !item.complete)
    .map((item) => item.step);

  return {
    complete: isOnboardingComplete(manifest),
    currentStep: manifest.state.currentStep,
    nextStep: getNextSetupStep(manifest),
    completedCount: checklist.filter((item) => item.complete).length,
    totalCount: checklist.length,
    incompleteSteps
  };
}
