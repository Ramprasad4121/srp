/**
 * Smoke tests: Web client and onboarding progression
 *
 * Tests the apps/web API client, bootstrap state machine, and onboarding
 * state progression against a real gateway server.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createGatewayClient } from "../../apps/web/dist/api/gateway-client.js";
import { resolveInitialAppState, refreshBootstrap } from "../../apps/web/dist/bootstrap/app-state.js";
import {
  createOnboardingState,
  submitWelcome,
  submitRole,
  submitProviders,
  submitWorkspace
} from "../../apps/web/dist/features/onboarding/onboarding-state.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-web-"));
}

// ---------------------------------------------------------------------------
// Test 1: Full end-to-end web client flow
// ---------------------------------------------------------------------------

test("Web app state machine progresses from onboarding to ready via client", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const client = createGatewayClient(baseUrl);

    // Initial load decisions
    let appState = await resolveInitialAppState(client);
    assert.equal(appState.kind, "onboarding");
    if (appState.kind !== "onboarding") return;

    // Create onboarding session
    let onboarding = createOnboardingState(appState.bootstrap);
    assert.equal(onboarding.currentScreen, "welcome");

    // 1. Welcome -> Role
    onboarding = await submitWelcome(client, onboarding);
    assert.equal(onboarding.currentScreen, "role");
    assert.ok(onboarding.setupData !== null);
    assert.ok(onboarding.setupData.manifest.state.completedSteps.includes("welcome"));

    // 2. Role -> Providers
    onboarding = await submitRole(client, onboarding, "developer");
    assert.equal(onboarding.currentScreen, "providers");
    assert.equal(onboarding.setupData.manifest.state.role, "developer");

    // 3. Providers -> Workspace
    onboarding = await submitProviders(client, onboarding, [
      { kind: "ollama", label: "Ollama", model: "llama3.1:8b", enabled: true }
    ]);
    assert.equal(onboarding.currentScreen, "workspace");
    assert.ok(onboarding.setupData.manifest.state.completedSteps.includes("providers"));

    // 4. Workspace -> Complete
    onboarding = await submitWorkspace(client, onboarding, {
      outputDirectory: ".srp-test",
      internetMode: "local-plus-docs",
      useDockerToolchains: true
    });
    assert.equal(onboarding.currentScreen, "complete");
    assert.ok(onboarding.setupData.manifest.state.completedSteps.includes("workspace"));

    // Final reload
    appState = await refreshBootstrap(client, appState);
    assert.equal(appState.kind, "ready");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
