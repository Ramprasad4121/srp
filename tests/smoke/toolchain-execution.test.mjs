import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-toolchain-"));
}

test("Toolchain runner produces logs and persists artifact in phase 4", async () => {
  const root = await makeFreshRoot();
  process.env.SRP_TOOLCHAIN_MODE = "mock";
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeClient = createRuntimeClient(baseUrl);

    const start = await runtimeClient.startSession();
    assert.equal(start.ok, true);
    assert.ok(start.data.runId);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const runtimeState = await runtimeClient.getSessionState();
    assert.equal(runtimeState.ok, true);
    assert.ok(runtimeState.data.toolchainExecution, "Toolchain execution missing");
    assert.equal(runtimeState.data.toolchainExecution.tool, "mock");
    assert.ok(runtimeState.data.toolchainExecution.logs.includes("Mock execution"));

    const runRes = await fetch(`${baseUrl}/api/runs/${start.data.runId}`);
    const run = await runRes.json();
    const toolchainArtifact = run.artifacts.find((artifact) => artifact.title === "Toolchain Execution");
    assert.ok(toolchainArtifact);
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
    delete process.env.SRP_TOOLCHAIN_MODE;
  }
});
