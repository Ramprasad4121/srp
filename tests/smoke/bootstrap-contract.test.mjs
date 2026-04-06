/**
 * Smoke tests: AppBootstrapResult contract
 *
 * Tests the full resolveAppBootstrap → deriveNavigationBootstrap →
 * summarizeBootstrapForCli pipeline end-to-end against a real temp directory.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppBootstrap } from "../../apps/gateway/dist/index.js";
import {
  deriveNavigationBootstrap,
} from "../../apps/web/dist/lib-index.js";
import {
  summarizeBootstrapForCli,
  resolveCliBootstrap,
} from "../../apps/cli/dist/index.js";
import {
  updateSetupManifest,
  replaceProviderSelections,
  updateSetupRole,
  completeWelcomeStep,
  completeProviderSetup,
  completeWorkspaceSetup,
  loadOrCreateSetupManifest,
  updateWorkspaceSelection,
} from "../../packages/config/dist/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Env with no API keys set — simulates cold start. */
const EMPTY_ENV = {};

/** Env that satisfies the Ollama (local, no key needed) provider. */
const OLLAMA_ENV = {};

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-bootstrap-"));
}

async function makeCompleteRoot(role = "auditor", providerKind = "ollama") {
  const root = await makeFreshRoot();
  await updateSetupManifest(root, (m) => ({
    ...m,
    state: completeWorkspaceSetup(
      completeProviderSetup(
        completeWelcomeStep(
          updateWorkspaceSelection(
            replaceProviderSelections(updateSetupRole(m.state, role), [
              { kind: providerKind, label: "Ollama", model: "llama3.1:8b", enabled: true },
            ]),
            { outputDirectory: ".srp-test", internetMode: "local-only" }
          )
        )
      )
    ),
  }));
  return root;
}

// ---------------------------------------------------------------------------
// Test 1: fresh workspace → needs-onboarding
// ---------------------------------------------------------------------------

test("fresh workspace resolves to needs-onboarding decision", async () => {
  const root = await makeFreshRoot();
  try {
    const result = await resolveAppBootstrap(root, EMPTY_ENV);

    assert.equal(result.decision, "needs-onboarding");
    assert.equal(result.initialRoute, "/setup");
    assert.equal(result.onboarding.complete, false);
    assert.ok(result.onboarding.incompleteSteps.length > 0);
    assert.equal(typeof result.manifestVersion, "string");
    assert.equal(typeof result.manifestUpdatedAt, "string");
    assert.ok(result.configPath.endsWith(".srp/config/setup.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: complete workspace with Ollama (local, no key) → ready
// ---------------------------------------------------------------------------

test("complete workspace with local provider resolves to ready", async () => {
  const root = await makeCompleteRoot("auditor", "ollama");
  try {
    const result = await resolveAppBootstrap(root, OLLAMA_ENV);

    assert.equal(result.decision, "ready");
    assert.equal(result.role, "auditor");
    assert.equal(result.initialRoute, "/audit-flow");
    assert.equal(result.onboarding.complete, true);
    assert.equal(result.providers.anyHealthy, true);
    assert.ok(result.providers.healthyKinds.includes("ollama"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: complete workspace with cloud provider but no env key → needs-providers
// ---------------------------------------------------------------------------

test("complete workspace with missing API key resolves to needs-providers", async () => {
  const root = await makeFreshRoot();
  try {
    await updateSetupManifest(root, (m) => ({
      ...m,
      state: completeWorkspaceSetup(
        completeProviderSetup(
          completeWelcomeStep(
            replaceProviderSelections(updateSetupRole(m.state, "auditor"), [
              { kind: "anthropic", label: "Anthropic", model: "claude-sonnet-4-0", enabled: true },
            ])
          )
        )
      ),
    }));

    const result = await resolveAppBootstrap(root, EMPTY_ENV);

    assert.equal(result.decision, "needs-providers");
    assert.equal(result.initialRoute, "/setup/providers");
    assert.equal(result.onboarding.complete, true);
    assert.equal(result.providers.anyHealthy, false);
    assert.ok(result.providers.failingKinds.includes("anthropic"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: developer role routing
// ---------------------------------------------------------------------------

test("ready developer workspace routes to /dev", async () => {
  const root = await makeCompleteRoot("developer", "ollama");
  try {
    const result = await resolveAppBootstrap(root, OLLAMA_ENV);

    assert.equal(result.decision, "ready");
    assert.equal(result.role, "developer");
    assert.equal(result.initialRoute, "/dev");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: hybrid role routing
// ---------------------------------------------------------------------------

test("ready hybrid workspace routes to /overview", async () => {
  const root = await makeCompleteRoot("hybrid", "ollama");
  try {
    const result = await resolveAppBootstrap(root, OLLAMA_ENV);

    assert.equal(result.decision, "ready");
    assert.equal(result.role, "hybrid");
    assert.equal(result.initialRoute, "/overview");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: deriveNavigationBootstrap — web layer consumes bootstrap result
// ---------------------------------------------------------------------------

test("deriveNavigationBootstrap produces correct web navigation from bootstrap result", async () => {
  const root = await makeCompleteRoot("auditor", "ollama");
  try {
    const bootstrap = await resolveAppBootstrap(root, OLLAMA_ENV);
    const nav = deriveNavigationBootstrap(bootstrap);

    assert.equal(nav.initialRoute, "/audit-flow");
    assert.equal(nav.showOnboarding, false);
    assert.equal(nav.hasWorkingProvider, true);
    assert.equal(nav.role, "auditor");
    assert.ok(nav.onboardingProgress > 0);
    assert.ok(nav.visibleNavItems.some((item) => item.id === "audit-flow"));
    assert.ok(nav.visibleNavItems.some((item) => item.id === "chat"));
    // developer-only items should not appear for auditor
    assert.ok(!nav.visibleNavItems.some((item) => item.id === "dev"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: onboarding → showOnboarding = true in web layer
// ---------------------------------------------------------------------------

test("deriveNavigationBootstrap sets showOnboarding=true for fresh workspace", async () => {
  const root = await makeFreshRoot();
  try {
    const bootstrap = await resolveAppBootstrap(root, EMPTY_ENV);
    const nav = deriveNavigationBootstrap(bootstrap);

    assert.equal(nav.showOnboarding, true);
    assert.equal(nav.hasWorkingProvider, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: summarizeBootstrapForCli — CLI view of a bootstrap result
// ---------------------------------------------------------------------------

test("summarizeBootstrapForCli produces correct CLI view", async () => {
  const root = await makeCompleteRoot("auditor", "ollama");
  try {
    const bootstrap = await resolveAppBootstrap(root, OLLAMA_ENV);
    const view = summarizeBootstrapForCli(bootstrap);

    assert.equal(view.decision, "ready");
    assert.equal(view.role, "auditor");
    assert.equal(view.initialRoute, "/audit-flow");
    assert.equal(view.onboardingComplete, true);
    assert.equal(view.anyHealthy, true);
    assert.match(view.onboardingProgress, /\d+%/);
    assert.ok(view.configPath.endsWith(".srp/config/setup.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 9: resolveCliBootstrap — end-to-end through CLI entry point
// ---------------------------------------------------------------------------

test("resolveCliBootstrap returns correct CLI view end-to-end", async () => {
  const root = await makeCompleteRoot("developer", "ollama");
  try {
    const view = await resolveCliBootstrap(root, OLLAMA_ENV);

    assert.equal(view.decision, "ready");
    assert.equal(view.role, "developer");
    assert.equal(view.initialRoute, "/dev");
    assert.equal(view.onboardingComplete, true);
    assert.equal(view.anyHealthy, true);
    assert.equal(view.providerTotal, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 10: OnboardingReadiness structure is fully populated
// ---------------------------------------------------------------------------

test("AppBootstrapResult.onboarding has all required fields", async () => {
  const root = await makeFreshRoot();
  try {
    const result = await resolveAppBootstrap(root, EMPTY_ENV);
    const { onboarding } = result;

    assert.equal(typeof onboarding.complete, "boolean");
    assert.equal(typeof onboarding.currentStep, "string");
    assert.equal(typeof onboarding.nextStep, "string");
    assert.equal(typeof onboarding.completedCount, "number");
    assert.equal(typeof onboarding.totalCount, "number");
    assert.ok(Array.isArray(onboarding.incompleteSteps));
    assert.ok(onboarding.totalCount > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
