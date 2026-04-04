/**
 * Smoke tests: Phase-7 Cross-Contract Path Analysis
 *
 * Tests that the inference bridge synthesizes standard Cross-Contract Paths
 * based on the identified Architecture and key components.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateCrossContractAnalysis } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-ccc-"));
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

test("Inference Bridge computes deterministic mock cross-contract paths from Architecture", async () => {
  const context = {
    workspace: {
      rootDirectory: "/mock/root",
      isFoundry: true,
      isHardhat: false,
      solidityFileCount: 2,
      solidityFiles: ["src/Vault.sol", "src/VaultRoot.sol"],
      topLevelDirectories: ["src"],
      summary: "Mock"
    },
    codebase: {
      filesProcessed: 2,
      bytesProcessed: 1024,
      limitReached: false,
      targetFiles: ["src/Vault.sol", "src/VaultRoot.sol"]
    },
    intent: {
      mainContracts: ["VaultRoot", "Vault"],
      interfaceCount: 1,
      draftSummary: "Draft"
    },
    architecture: {
      markdownSummary: "Mock",
      keyComponents: ["VaultRoot", "Vault"],
      generatedByModel: "Mock"
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const analysis = await generateCrossContractAnalysis(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.equal(analysis.generatedByModel, "gpt-4-test");
    assert.ok(analysis.summary.includes("cross-contract execution paths"));
    assert.equal(analysis.paths.length, 2);
    
    const p0 = analysis.paths[0];
    assert.equal(p0.id, "PATH-001");
    assert.ok(p0.steps.length >= 2);
    assert.equal(p0.steps[1].contract, "VaultRoot");

  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Phase-7 emits Cross-Contract Analysis directly to runtime status via HTTP and SSE", async () => {
  const root = await makeFreshRoot();
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // phase 0, 1, 2, 3, 4, 5, 6, 7 -> 8 phases * 2 events = 16 events for phase-7 completed
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 16);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 15 is phase-7-cross-contract-paths "completed"
    assert.equal(phaseEvents[15].phase, "phase-7-cross-contract-paths");
    assert.equal(phaseEvents[15].status, "completed");

    // Re-verify the getter now that Phase 7 completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Assert Phase 7 succeeded
    assert.ok(pollRes.data.crossContractAnalysis !== undefined, "Cross-contract analysis missing");
    
    // Because the workspace was empty, it falls back to the generic fallback path
    const analysis = pollRes.data.crossContractAnalysis;
    assert.ok(analysis.paths.length > 0);
    const p0 = analysis.paths[0];
    assert.equal(p0.id, "PATH-GEN-01");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
