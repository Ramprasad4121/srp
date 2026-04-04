/**
 * Smoke tests: gateway HTTP layer
 *
 * Starts a real gateway server on a random ephemeral port (port: 0),
 * exercises every API endpoint with fetch, and asserts typed responses.
 * Each test gets its own fresh temp directory so state is fully isolated.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import {
  updateSetupManifest,
  replaceProviderSelections,
  updateSetupRole,
  completeWelcomeStep,
  completeProviderSetup,
  completeWorkspaceSetup,
  updateWorkspaceSelection,
} from "../../packages/config/dist/index.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-http-"));
}

async function makeReadyRoot(role = "auditor") {
  const root = await makeFreshRoot();
  await updateSetupManifest(root, (m) => ({
    ...m,
    state: completeWorkspaceSetup(
      completeProviderSetup(
        completeWelcomeStep(
          updateWorkspaceSelection(
            replaceProviderSelections(updateSetupRole(m.state, role), [
              { kind: "ollama", label: "Ollama", model: "llama3.1:8b", enabled: true },
            ]),
            { outputDirectory: ".srp-test", internetMode: "local-only" }
          )
        )
      )
    ),
  }));
  return root;
}

function apiUrl(port, path) {
  return `http://127.0.0.1:${port}${path}`;
}

async function getJson(port, path) {
  const res = await fetch(apiUrl(port, path));
  const body = await res.json();
  return { status: res.status, body };
}

async function postJson(port, path, payload = {}) {
  const res = await fetch(apiUrl(port, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test 1: GET /api/bootstrap — fresh workspace
// ---------------------------------------------------------------------------

test("GET /api/bootstrap returns needs-onboarding for fresh workspace", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await getJson(srv.port, "/api/bootstrap");
    assert.equal(status, 200);
    assert.equal(body.decision, "needs-onboarding");
    assert.equal(body.initialRoute, "/setup");
    assert.equal(body.onboarding.complete, false);
    assert.equal(typeof body.manifestVersion, "string");
    assert.ok(body.configPath.endsWith(".srp/config/setup.json"));
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: GET /api/bootstrap — complete workspace with Ollama → ready
// ---------------------------------------------------------------------------

test("GET /api/bootstrap returns ready for complete workspace with local provider", async () => {
  const root = await makeReadyRoot("auditor");
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await getJson(srv.port, "/api/bootstrap");
    assert.equal(status, 200);
    assert.equal(body.decision, "ready");
    assert.equal(body.role, "auditor");
    assert.equal(body.initialRoute, "/audit-flow");
    assert.equal(body.onboarding.complete, true);
    assert.equal(body.providers.anyHealthy, true);
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: GET /api/setup — returns manifest and onboarding readiness
// ---------------------------------------------------------------------------

test("GET /api/setup returns manifest with onboarding readiness", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await getJson(srv.port, "/api/setup");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.manifest);
    assert.equal(body.manifest.state.currentStep, "welcome");
    assert.ok(body.onboarding);
    assert.equal(typeof body.onboarding.complete, "boolean");
    assert.equal(typeof body.onboarding.nextStep, "string");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: POST /api/setup/role — updates role
// ---------------------------------------------------------------------------

test("POST /api/setup/role updates the role in the manifest", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/role", { role: "auditor" });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.manifest.state.role, "auditor");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: POST /api/setup/role — invalid role → 400
// ---------------------------------------------------------------------------

test("POST /api/setup/role rejects invalid role with 400", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/role", { role: "superuser" });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid_body");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: POST /api/setup/providers — sets provider list
// ---------------------------------------------------------------------------

test("POST /api/setup/providers updates provider selections", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const providers = [
      { kind: "anthropic", label: "Anthropic", model: "claude-sonnet-4-0", enabled: true },
    ];
    const { status, body } = await postJson(srv.port, "/api/setup/providers", { providers });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.manifest.state.providers[0].kind, "anthropic");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: POST /api/setup/providers — invalid body → 400
// ---------------------------------------------------------------------------

test("POST /api/setup/providers rejects invalid provider list with 400", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/providers", {
      providers: [{ kind: "not-a-real-provider", label: "Bad", model: "m", enabled: true }],
    });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid_body");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: POST /api/setup/workspace — patches workspace fields
// ---------------------------------------------------------------------------

test("POST /api/setup/workspace patches workspace fields", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/workspace", {
      outputDirectory: ".srp-http-test",
      internetMode: "local-plus-docs",
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.manifest.state.workspace.outputDirectory, ".srp-http-test");
    assert.equal(body.manifest.state.workspace.internetMode, "local-plus-docs");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 9: POST /api/setup/workspace — invalid internetMode → 400
// ---------------------------------------------------------------------------

test("POST /api/setup/workspace rejects invalid internetMode with 400", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/workspace", {
      internetMode: "turbo-mode",
    });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid_body");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 10: POST /api/setup/complete/welcome
// ---------------------------------------------------------------------------

test("POST /api/setup/complete/welcome marks welcome step complete", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/complete/welcome");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.manifest.state.completedSteps.includes("welcome"));
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 11: POST /api/setup/complete/providers
// ---------------------------------------------------------------------------

test("POST /api/setup/complete/providers marks providers step complete", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/complete/providers");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.manifest.state.completedSteps.includes("providers"));
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 12: POST /api/setup/complete/workspace
// ---------------------------------------------------------------------------

test("POST /api/setup/complete/workspace marks workspace step complete", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await postJson(srv.port, "/api/setup/complete/workspace");
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.manifest.state.completedSteps.includes("workspace"));
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 13: Full setup flow — role → providers → workspace → complete each step
// ---------------------------------------------------------------------------

test("full setup flow via HTTP advances manifest through all steps", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    await postJson(srv.port, "/api/setup/role", { role: "developer" });
    await postJson(srv.port, "/api/setup/providers", {
      providers: [{ kind: "ollama", label: "Ollama", model: "llama3.1:8b", enabled: true }],
    });
    await postJson(srv.port, "/api/setup/workspace", {
      outputDirectory: ".srp-flow",
      internetMode: "local-only",
    });
    await postJson(srv.port, "/api/setup/complete/welcome");
    await postJson(srv.port, "/api/setup/complete/providers");
    await postJson(srv.port, "/api/setup/complete/workspace");

    const { status, body } = await getJson(srv.port, "/api/bootstrap");
    assert.equal(status, 200);
    assert.equal(body.decision, "ready");
    assert.equal(body.role, "developer");
    assert.equal(body.initialRoute, "/dev");
    assert.equal(body.onboarding.complete, true);
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 14: Unknown route → 404 with structured error
// ---------------------------------------------------------------------------

test("unknown route returns 404 with structured error envelope", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const { status, body } = await getJson(srv.port, "/api/does-not-exist");
    assert.equal(status, 404);
    assert.equal(body.error, "not_found");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 15: CORS OPTIONS preflight → 204
// ---------------------------------------------------------------------------

test("OPTIONS preflight returns 204 with CORS headers", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const res = await fetch(apiUrl(srv.port, "/api/bootstrap"), { method: "OPTIONS" });
    assert.equal(res.status, 204);
    assert.ok(res.headers.get("access-control-allow-origin") === "*");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
