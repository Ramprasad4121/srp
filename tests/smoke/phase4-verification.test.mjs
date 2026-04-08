/**
 * Smoke tests: Phase-4 Mock Fuzzing/Verification Plan Generation
 *
 * Tests that the inference bridge synthesizes standard Verification Action
 * Plans mapped from the earlier formulated Invariants Registry, verifying the 
 * deterministic logic offline logic routing.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateVerificationPlan } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-verif-"));
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

test("Inference Bridge computes deterministic mock verification plan directly from Invariants", async () => {
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
        },
        {
          id: "INV-002",
          title: "Value Inflow Limits",
          description: "desc2",
          category: "Accounting",
          priority: "Medium",
          derivedFrom: ["VaultCore"],
          suggestedVerification: "formal"
        }
      ],
      generatedByModel: "Mock"
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const plan = await generateVerificationPlan(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.equal(plan.generatedByModel, "gpt-4-test");
    assert.ok(plan.summary.includes("2 verification actions"));
    assert.equal(plan.items.length, 2);
    
    const vp0 = plan.items.find(i => i.id === "VP-INV-001");
    assert.ok(vp0 !== undefined);
    assert.equal(vp0.verificationType, "Fuzzing");
    assert.equal(vp0.status, "Planned");
    assert.deepEqual(vp0.coversInvariantIds, ["INV-001"]);

  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Phase-4 emits Verification Plan directly to runtime status via HTTP and SSE", async () => {
  const root = await makeFreshRoot();
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for synthesis-invariants completion
    // phases 0-9. index 19 is completion.
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 20);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 19 is synthesis-invariants "completed"
    assert.equal(phaseEvents[19].phase, "synthesis-invariants");
    assert.equal(phaseEvents[19].status, "completed");

    // Re-verify the getter now that Phase completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Assert all dependencies populated
    assert.ok(pollRes.data.workspaceAnalysis !== undefined);
    assert.ok(pollRes.data.invariantRegistry !== undefined);

    // Assert Phase 4 (now part of 10) succeeded
    assert.ok(pollRes.data.verificationPlan !== undefined, "Verification plan missing");
    
    const plan = pollRes.data.verificationPlan;
    assert.ok(plan.items.length > 0);
    
    const vp = plan.items[0];
    assert.ok(vp.id.startsWith("VP-INV-"));
    assert.equal(vp.verificationType, "Fuzzing");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
