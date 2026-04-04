/**
 * Smoke tests: Phase-1 Intent Builder (Codebase Context)
 *
 * Tests the bounded file reader, intent summary heuristics, and
 * the injection into the phase-1-intent runtime state.
 */

import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { analyzeWorkspace } from "../../apps/gateway/dist/runtime/analyzers/workspace-analyzer.js";
import { buildCodebaseContext } from "../../apps/gateway/dist/runtime/analyzers/codebase-context.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-intent-"));
}

async function setupFakeWorkspace(root) {
  await mkdir(join(root, "src"));
  await mkdir(join(root, "interfaces"));
  
  await writeFile(join(root, "src", "Vault.sol"), `
    pragma solidity ^0.8.0;
    contract Vault {
      // some logic
    }
  `);

  await writeFile(join(root, "src", "Utils.sol"), `
    pragma solidity ^0.8.0;
    library Utils {
    }
  `);

  await writeFile(join(root, "interfaces", "IVault.sol"), `
    pragma solidity ^0.8.0;
    interface IVault {
    }
  `);

  await writeFile(join(root, "foundry.toml"), "[profile.default]");
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

test("Intent builder extracts heuristic codebase contexts from analysis output", async () => {
  const root = await makeFreshRoot();
  try {
    await setupFakeWorkspace(root);
    
    // First stage
    const analysis = await analyzeWorkspace(root);
    assert.equal(analysis.solidityFileCount, 3);

    // Second stage
    const result = await buildCodebaseContext(analysis);
    
    const sum = result.summary;
    assert.equal(sum.filesProcessed, 3);
    assert.ok(sum.bytesProcessed > 0);
    assert.equal(sum.limitReached, false);
    assert.equal(sum.targetFiles.length, 3);

    const int = result.intent;
    assert.equal(int.interfaceCount, 1);
    assert.deepEqual(int.mainContracts, ["Vault"]);
    assert.ok(int.draftSummary.includes("revolve around: Vault"));
    assert.ok(int.draftSummary.includes("interfaces with 1"));
    assert.ok(int.draftSummary.includes("Foundry framework constraints"));
    
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Runtime execution injects codebaseContext and intentSummary successfully", async () => {
  const root = await makeFreshRoot();
  await setupFakeWorkspace(root);
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for the first phase-1 completion
    // The sequence is phase 0 (run, comp) -> phase 1 (run, comp)
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 4);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 3 is phase-1-intent "completed"
    assert.equal(phaseEvents[3].phase, "phase-1-intent");
    assert.equal(phaseEvents[3].status, "completed");

    // Re-verify the getter now that Phase 1 completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    assert.ok(pollRes.data.workspaceAnalysis !== undefined, "Workspace analysis missing");
    assert.ok(pollRes.data.codebaseContext !== undefined, "Codebase context missing");
    assert.ok(pollRes.data.intentSummary !== undefined, "Intent summary missing");

    assert.equal(pollRes.data.intentSummary.interfaceCount, 1);
    assert.deepEqual(pollRes.data.intentSummary.mainContracts, ["Vault"]);

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
