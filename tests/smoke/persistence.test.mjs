import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { PersistenceManager } from "../../apps/gateway/dist/runtime/persistence-manager.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-persistence-"));
}

test("PersistenceManager stores and retrieves runs and artifacts", async () => {
  const root = await makeFreshRoot();
  const pm = new PersistenceManager(root, ".srp");
  await pm.init();

  const runId = "run_123";
  const projectId = "proj_abc";
  const sessionId = "sess_456";

  await pm.createRun(runId, projectId, sessionId);
  
  const payload = { hello: "world" };
  const meta = await pm.saveArtifact(runId, projectId, "phase-0-preparation", "note", "Test Art", payload);

  assert.equal(meta.runId, runId);
  assert.equal(meta.title, "Test Art");

  const run = await pm.getRun(runId);
  assert.equal(run?.runId, runId);
  assert.equal(run?.artifacts.length, 1);
  assert.equal(run?.artifacts[0].artifactId, meta.artifactId);

  const retrievedPayload = await pm.getArtifact(runId, meta.artifactId);
  assert.deepEqual(retrievedPayload, payload);

  const runs = await pm.listRuns();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].runId, runId);

  await rm(root, { recursive: true, force: true });
});

test("Gateway exposes run history and artifact APIs", async () => {
  const root = await makeFreshRoot();
  
  // Setup a fake config.json so startSession doesn't fail
  await PersistenceManager.prototype.init.call({ runsDir: join(root, ".srp", "runs") });
  const configPath = join(root, ".srp", "config.json");
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(root, ".srp"), { recursive: true });
  await writeFile(configPath, JSON.stringify({
    state: {
      providers: [],
      workspace: { outputDirectory: ".srp" }
    }
  }));

  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);

    // Start a session to generate a run
    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);
    const startedRunId = startRes.data.runId;
    if (typeof startedRunId !== "string") {
      throw new Error("Runtime start did not return a runId");
    }
    
    // Give it a moment to init the run
    await new Promise(r => setTimeout(r, 300));

    // List runs
    const runsRes = await fetch(`${baseUrl}/api/runs`);
    const runs = await runsRes.json();
    assert.ok(Array.isArray(runs));
    assert.ok(runs.length >= 1);

    const runId = startedRunId;

    // Get specific run
    const runRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    const run = await runRes.json();
    assert.equal(run.runId, runId);

    // Wait for early pipeline activity
    await new Promise(r => setTimeout(r, 700));
    
    const runUpdateRes = await fetch(`${baseUrl}/api/runs/${runId}`);
    const runUpdate = await runUpdateRes.json();
    
    if (runUpdate.artifacts.length > 0) {
      const artId = runUpdate.artifacts[0].artifactId;
      const artRes = await fetch(`${baseUrl}/api/runs/${runId}/artifacts/${artId}`);
      const payload = await artRes.json();
      assert.ok(payload !== null);
    }

    const eventsRes = await fetch(`${baseUrl}/api/runs/${runId}/events`);
    assert.equal(eventsRes.ok, true);
    const events = await eventsRes.json();
    assert.ok(Array.isArray(events));
    assert.ok(events.length >= 2);
    assert.ok(events.some((event) => event.type === "session.started"));
    assert.ok(events.some((event) => event.type === "phase.status.changed"));
    assert.ok(events.some((event) => event.type === "artifact.created"));

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
