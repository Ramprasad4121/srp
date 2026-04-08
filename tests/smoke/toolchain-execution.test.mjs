import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-toolchain-"));
}

function captureSseEvents(url, targetEventType, maxCount) {
  return new Promise((resolve, reject) => {
    let rawData = "";
    const captured = [];

    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        req.destroy();
        return reject(new Error(`Failed to connect to SSE: HTTP ${res.statusCode}`));
      }

      res.on("data", (chunk) => {
        rawData += chunk.toString("utf8");

        const parts = rawData.split("\n\n");
        if (parts.length > 1) {
          for (let i = 0; i < parts.length - 1; i++) {
            const frame = parts[i].trim();
            if (frame.startsWith("data: ")) {
              const jsonStr = frame.substring("data: ".length);
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === targetEventType) {
                  captured.push(event);
                  if (captured.length >= maxCount) {
                    req.destroy();
                    resolve(captured);
                    return;
                  }
                }
              } catch (e) {}
            }
          }
          rawData = parts[parts.length - 1];
        }
      });

      res.on("error", reject);
    });

    req.on("error", reject);
  });
}

test("Toolchain runner produces logs and persists artifact in audit-setup phase", async () => {
  const root = await makeFreshRoot();
  process.env.SRP_TOOLCHAIN_MODE = "mock";
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeClient = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for audit-setup completion
    // phases 0-12. index 25 is completion.
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 26);

    const start = await runtimeClient.startSession();
    assert.equal(start.ok, true);
    assert.ok(start.data.runId);

    await phaseEventsP;

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
