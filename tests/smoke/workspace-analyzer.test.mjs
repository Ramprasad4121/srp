/**
 * Smoke tests: Local Workspace Analyzer & Runtime integration
 *
 * Tests the standalone workspace analyzer and its integration into
 * the runtime Phase-0-Preparation pipeline.
 */

import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { analyzeWorkspace } from "../../apps/gateway/dist/runtime/analyzers/workspace-analyzer.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-analyzer-"));
}

async function setupFakeWorkspace(root) {
  // Foundry marker
  await writeFile(join(root, "foundry.toml"), "[profile.default]\nsrc = 'src'");
  
  // Dirs
  await mkdir(join(root, "src"));
  await mkdir(join(root, "test"));
  await mkdir(join(root, "node_modules")); // should ignore
  await mkdir(join(root, "node_modules", "nested")); 
  await mkdir(join(root, "artifacts")); // should ignore
  
  // Files
  await writeFile(join(root, "src", "Token.sol"), "// fake sol");
  await writeFile(join(root, "src", "Registry.sol"), "// fake sol");
  await writeFile(join(root, "test", "Token.t.sol"), "// fake sol test");
  
  // Ignore these
  await writeFile(join(root, "node_modules", "nested", "Dep.sol"), "// ignored");
  await writeFile(join(root, "artifacts", "Output.sol"), "// ignored");
  await writeFile(join(root, "src", "README.md"), "# docs");
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("Workspace Analyzer cleanly discovers .sol files and frameworks", async () => {
  const root = await makeFreshRoot();
  try {
    await setupFakeWorkspace(root);
    
    const analysis = await analyzeWorkspace(root);
    
    assert.equal(analysis.isFoundry, true);
    assert.equal(analysis.isHardhat, false);
    assert.equal(analysis.solidityFileCount, 3);
    assert.equal(analysis.solidityFiles.length, 3);

    // Normalize paths for cross-platform assert
    const files = analysis.solidityFiles.map(f => f.replace(/\\/g, '/')).sort();
    assert.deepEqual(files, [
      "src/Registry.sol",
      "src/Token.sol",
      "test/Token.t.sol"
    ]);

    assert.ok(analysis.topLevelDirectories.includes("src"));
    assert.ok(analysis.topLevelDirectories.includes("test"));
    assert.ok(!analysis.topLevelDirectories.includes("node_modules"));
    
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Runtime execution injects workspaceAnalysis automatically", async () => {
  const root = await makeFreshRoot();
  await setupFakeWorkspace(root);
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for the first phase-0 completion
    // The sequence is running -> completed
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 2);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    assert.equal(phaseEvents[1].phase, "phase-0-preparation");
    assert.equal(phaseEvents[1].status, "completed");

    // Re-verify the getter now that Phase 0 completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Asserts workspace analysis attached properly
    assert.ok(pollRes.data.workspaceAnalysis !== undefined);
    assert.equal(pollRes.data.workspaceAnalysis.isFoundry, true);
    assert.equal(pollRes.data.workspaceAnalysis.solidityFileCount, 3);
    assert.ok(pollRes.data.workspaceAnalysis.summary.includes("3 Solidity file(s)"));

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
