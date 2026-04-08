/**
 * Smoke tests: Phase-5 Attack Simulation / Hypothesis Generation
 *
 * Tests that the inference bridge synthesizes standard Attack Hypotheses
 * mapped from the earlier formulated Invariants and Verification Plan.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateHypotheses } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-hyp-"));
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

test("Inference Bridge computes deterministic mock hypotheses from Invariants and Verification Plan", async () => {
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
    },
    invariants: {
      summary: "2 items",
      invariants: [
        {
          id: "INV-001",
          title: "State Transition Integrity",
          description: "desc",
          category: "Access Control",
          priority: "High",
          derivedFrom: ["VaultCore"],
          suggestedVerification: "fuzz"
        }
      ],
      generatedByModel: "Mock"
    },
    verificationPlan: {
      summary: "1 item",
      items: [
        {
          id: "VP-INV-001",
          title: "Echidna Access Control Bounds",
          description: "desc",
          coversInvariantIds: ["INV-001"],
          verificationType: "Fuzzing",
          status: "Planned",
          recommendedTool: "Echidna"
        }
      ],
      generatedByModel: "Mock"
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const registry = await generateHypotheses(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.equal(registry.generatedByModel, "gpt-4-test");
    assert.ok(registry.summary.includes("1 attack hypotheses"));
    assert.equal(registry.hypotheses.length, 1);
    
    const h0 = registry.hypotheses[0];
    assert.equal(h0.targetComponent, "VaultCore");
    assert.equal(h0.likelihood, "Medium");
    assert.deepEqual(h0.derivedFromInvariantIds, ["INV-001"]);
    assert.deepEqual(h0.relatedVerificationIds, ["VP-INV-001"]);

  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Phase-5 emits Hypothesis Registry directly to runtime status via HTTP and SSE", async () => {
  const root = await makeFreshRoot();
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for audit-hunt completion
    // phases 0-14. index 29 is completion.
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 30);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 29 is audit-hunt "completed"
    assert.equal(phaseEvents[29].phase, "audit-hunt");
    assert.equal(phaseEvents[29].status, "completed");

    // Re-verify the getter now that Phase completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Assert Phase 5 (now part of 15) succeeded
    assert.ok(pollRes.data.hypothesisRegistry !== undefined, "Hypothesis registry missing");
    
    const registry = pollRes.data.hypothesisRegistry;
    assert.ok(registry.hypotheses.length > 0);
    const h0 = registry.hypotheses[0];
    assert.equal(h0.id, "HYP-001");
    assert.equal(h0.likelihood, "Medium");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
