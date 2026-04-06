import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import test from "node:test";
import assert from "node:assert/strict";

import { createCliBootstrapSummary, loadCliOnboardingSnapshot } from "../../apps/cli/dist/index.js";
import {
  createGatewayHealthSnapshot,
  loadGatewayOnboardingSnapshot
} from "../../apps/gateway/dist/index.js";
import { createWorkerBootstrapArtifact } from "../../apps/worker/dist/index.js";
import {
  completeProviderSetup,
  completeWelcomeStep,
  createInitialSetupState,
  createSetupManifest,
  getModelPolicyForMode,
  getNextSetupStep,
  getRuntimeModeDefaults,
  loadOrCreateSetupManifest,
  loadSetupManifest,
  persistProviderSelections,
  persistProviderSetupCompleted,
  replaceProviderSelections,
  markSetupStepCompleted,
  persistSetupRole,
  persistWelcomeCompleted,
  persistWorkspaceSelection,
  persistWorkspaceSetupCompleted,
  updateSetupManifest,
  updateSetupRole,
  updateWorkspaceSelection,
  saveSetupManifest
} from "../../packages/config/dist/index.js";
import {
  createModelsProvidersViewModel,
  createWebOnboardingViewModel,
  createWorkspaceViewModel,
  internetPolicySummary,
  onboardingChecklist,
  onboardingHero,
  onboardingProgression,
  primaryNavigation,
  providerCards,
  providerSetupSummary,
  setupScreens,
  webDefaults
} from "../../apps/web/dist/lib-index.js";

test("monorepo foundation packages compose cleanly", () => {
  const cliSummary = createCliBootstrapSummary();
  const gatewaySnapshot = createGatewayHealthSnapshot();
  const artifact = createWorkerBootstrapArtifact();

  assert.equal(cliSummary.mode, "hybrid");
  assert.equal(cliSummary.eventType, "session.started");
  assert.equal(cliSummary.firstPhaseEventType, "phase.status.changed");
  assert.equal(cliSummary.providerKind, "openai-compatible");
  assert.equal(cliSummary.internetEnabled, true);
  assert.equal(cliSummary.setupConfigPath, ".srp/config/setup.json");
  assert.equal(cliSummary.nextSetupStep, "workspace");
  assert.match(cliSummary.welcomeMessage, /SRP setup is in role-selection/);
  assert.equal(cliSummary.providerSetupStep, "workspace");
  assert.equal(cliSummary.providerHealthConfigured, 0);
  assert.equal(gatewaySnapshot.ok, true);
  assert.equal(gatewaySnapshot.currentPhase, "discovery-docs");
  assert.equal(typeof gatewaySnapshot.providerConfigured, "boolean");
  assert.equal(gatewaySnapshot.setupConfigPath, ".srp/config/setup.json");
  assert.equal(gatewaySnapshot.nextSetupStep, "workspace");
  assert.equal(artifact.kind, "report");
  assert.ok(primaryNavigation.some((item) => item.id === "chat"));
  assert.equal(setupScreens.at(-1)?.step, "ready");
  assert.equal(webDefaults.defaultInternetMode, "local-plus-docs");
  assert.ok(providerCards.some((provider) => provider.kind === "nvidia"));
  assert.equal(internetPolicySummary, "Local artifacts plus trusted documentation");
  assert.equal(onboardingHero.currentStep, "welcome");
  assert.equal(providerSetupSummary.enabledCount, 1);
  assert.equal(onboardingChecklist[0]?.step, "welcome");
  assert.equal(onboardingProgression.afterWelcome, "role-selection");
  assert.equal(onboardingProgression.afterProviders, "workspace");
  assert.equal(onboardingProgression.nextIncompleteStep, "workspace");
});

test("setup manifest persists to disk and reloads cleanly", async () => {
  const root = await mkdtemp(join(tmpdir(), "srp-config-"));

  try {
    const initialState = markSetupStepCompleted(createInitialSetupState(), "providers");
    const manifest = createSetupManifest({
      state: {
        ...initialState,
        completedSteps: [...initialState.completedSteps, "workspace"]
      }
    });

    const savedPath = await saveSetupManifest(root, manifest);
    const loadedManifest = await loadSetupManifest(root);

    assert.match(savedPath, /\.srp\/config\/setup\.json$/);
    assert.ok(loadedManifest);
    assert.equal(loadedManifest?.state.completedSteps.includes("providers"), true);
    assert.equal(loadedManifest?.state.completedSteps.includes("workspace"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("setup workflow mutations update role, providers, workspace, and next step", () => {
  const roleUpdated = updateSetupRole(createInitialSetupState(), "auditor");
  const providersUpdated = replaceProviderSelections(roleUpdated, [
    {
      kind: "nvidia",
      label: "NVIDIA",
      model: "meta/llama-3.1-70b-instruct",
      enabled: true
    }
  ]);
  const workspaceUpdated = updateWorkspaceSelection(providersUpdated, {
    outputDirectory: ".srp-dev",
    internetMode: "local-plus-approved-web"
  });
  const afterWelcome = completeWelcomeStep(workspaceUpdated);
  const afterProviders = completeProviderSetup(afterWelcome);

  const manifest = createSetupManifest({
    state: markSetupStepCompleted(afterProviders, "workspace")
  });

  assert.equal(workspaceUpdated.role, "auditor");
  assert.equal(workspaceUpdated.providers[0]?.kind, "nvidia");
  assert.equal(workspaceUpdated.workspace.outputDirectory, ".srp-dev");
  assert.equal(afterWelcome.currentStep, "role-selection");
  assert.equal(afterProviders.currentStep, "workspace");
  assert.equal(getNextSetupStep(manifest), "ready");
  assert.equal(getRuntimeModeDefaults("developer").defaultTask, "generation");
  assert.equal(getModelPolicyForMode("auditor").defaultTask, "analysis");
});

test("load-or-create setup and onboarding snapshots work against workspace state", async () => {
  const root = await mkdtemp(join(tmpdir(), "srp-onboarding-"));

  try {
    const createdManifest = await loadOrCreateSetupManifest(root);
    assert.equal(createdManifest.state.currentStep, "welcome");

    await updateSetupManifest(root, (manifest) => ({
      ...manifest,
      state: completeProviderSetup(
        completeWelcomeStep(
          updateWorkspaceSelection(
            replaceProviderSelections(updateSetupRole(manifest.state, "developer"), [
              {
                kind: "ollama",
                label: "Ollama",
                model: "llama3.1:8b",
                enabled: true
              }
            ]),
            {
              outputDirectory: ".srp-workspace"
            }
          )
        )
      )
    }));

    const cliSnapshot = await loadCliOnboardingSnapshot(root, process.env);
    const gatewaySnapshot = await loadGatewayOnboardingSnapshot(root, process.env);
    const persistedManifest = await loadSetupManifest(root);
    assert.ok(persistedManifest);
    const webViewModel = createWebOnboardingViewModel(persistedManifest, process.env);
    const modelsProvidersViewModel = createModelsProvidersViewModel(persistedManifest);
    const workspaceViewModel = createWorkspaceViewModel(persistedManifest);

    assert.equal(cliSnapshot.configPath.endsWith(".srp/config/setup.json"), true);
    assert.equal(cliSnapshot.currentStep, "workspace");
    assert.equal(cliSnapshot.providerHealthTotal, 1);
    assert.equal(gatewaySnapshot.providerHealthHealthy, 1);
    assert.equal(webViewModel.currentStep, "workspace");
    assert.equal(webViewModel.providerHealthy, 1);
    assert.equal(modelsProvidersViewModel.role, "developer");
    assert.ok(modelsProvidersViewModel.recommendedProviderKinds.includes("openai"));
    assert.equal(workspaceViewModel.outputDirectory, ".srp-workspace");
    assert.match(workspaceViewModel.internetSummary, /trusted documentation/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("persisted onboarding actions update setup manifest step by step", async () => {
  const root = await mkdtemp(join(tmpdir(), "srp-actions-"));

  try {
    await loadOrCreateSetupManifest(root);
    await persistSetupRole(root, "auditor");
    await persistProviderSelections(root, [
      {
        kind: "anthropic",
        label: "Anthropic",
        model: "claude-sonnet-4-0",
        enabled: true
      }
    ]);
    await persistWorkspaceSelection(root, {
      outputDirectory: ".srp-audit",
      internetMode: "local-plus-docs"
    });
    await persistWelcomeCompleted(root);
    await persistProviderSetupCompleted(root);
    await persistWorkspaceSetupCompleted(root);

    const manifest = await loadSetupManifest(root);
    assert.ok(manifest);
    assert.equal(manifest.state.role, "auditor");
    assert.equal(manifest.state.providers[0]?.kind, "anthropic");
    assert.equal(manifest.state.workspace.outputDirectory, ".srp-audit");
    assert.equal(manifest.state.completedSteps.includes("welcome"), true);
    assert.equal(manifest.state.completedSteps.includes("providers"), true);
    assert.equal(manifest.state.completedSteps.includes("workspace"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
