/**
 * Smoke tests: Phase-3 Agentic Invariant Generation
 *
 * Tests that the inference bridge respects mock/fallback environments
 * and correctly injects the Invariant Registry into the session status via
 * Phase-3 progression.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateInvariants } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-invariants-"));
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

test("Inference Bridge computes deterministic mock invariants directly from Architecture and Intent", async () => {
  const context = {
    workspace: {
      rootDirectory: "/mock/root",
      isFoundry: true,
      isHardhat: false,
      solidityFileCount: 2,
      solidityFiles: ["src/Vault.sol", "src/interfaces/IVault.sol"],
      topLevelDirectories: ["src"],
      summary: "Mock"
    },
    codebase: {
      filesProcessed: 2,
      bytesProcessed: 1024,
      limitReached: false,
      targetFiles: ["src/Vault.sol", "src/interfaces/IVault.sol"]
    },
    intent: {
      mainContracts: ["VaultCore"],
      interfaceCount: 1,
      draftSummary: "Draft"
    },
    architecture: {
      markdownSummary: "Mock",
      keyComponents: ["VaultCore"],
      generatedByModel: "Mock"
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const registry = await generateInvariants(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.equal(registry.generatedByModel, "gpt-4-test");
    assert.ok(registry.summary.includes("2 source files"));
    assert.equal(registry.invariants.length, 2);
    
    const inv0 = registry.invariants.find(i => i.id === "INV-001");
    assert.ok(inv0 !== undefined);
    assert.equal(inv0.priority, "High");
    assert.ok(inv0.description.includes("VaultCore"));
    assert.deepEqual(inv0.derivedFrom, ["VaultCore"]);

  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Phase-3 emits Invariants Registry directly to runtime status via HTTP and SSE", async () => {
  const root = await makeFreshRoot();
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // phase 0, 1, 2, 3 -> 4 phases * 2 events = 8 events for phase-3 completed
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 8);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 7 is phase-3-invariants "completed"
    assert.equal(phaseEvents[7].phase, "phase-3-invariants");
    assert.equal(phaseEvents[7].status, "completed");

    // Re-verify the getter now that Phase 3 completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Assert all dependencies populated
    assert.ok(pollRes.data.workspaceAnalysis !== undefined);
    assert.ok(pollRes.data.codebaseContext !== undefined);
    assert.ok(pollRes.data.intentSummary !== undefined);
    assert.ok(pollRes.data.architectureSummary !== undefined);

    // Assert Phase 3 succeeded
    assert.ok(pollRes.data.invariantRegistry !== undefined, "Invariant registry missing");
    
    // Because the workspace was empty, architecture returns empty components,
    // which then generates our fallback mock invariant.
    const registry = pollRes.data.invariantRegistry;
    assert.equal(registry.invariants.length, 1);
    
    // The main component should be the fallback one
    assert.equal(registry.invariants[0].id, "INV-GEN-01");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
