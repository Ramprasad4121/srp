/**
 * Smoke tests: Phase-8 Finding Verification / Final Triage
 *
 * Tests that the inference bridge synthesizes standard Findings
 * by triaging previous analytical outputs (hypotheses, risks).
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateFindingRegistry } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-find-"));
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

test("Inference Bridge computes deterministic mock findings from Hypotheses and Risks", async () => {
  const context = {
    workspace: {
      rootDirectory: "/mock/root",
      isFoundry: true,
      isHardhat: false,
      solidityFileCount: 1,
      solidityFiles: ["src/Vault.sol"],
      topLevelDirectories: ["src"],
      summary: "Mock"
    },
    codebase: {
      filesProcessed: 1,
      bytesProcessed: 1024,
      limitReached: false,
      targetFiles: ["src/Vault.sol"]
    },
    intent: {
      mainContracts: ["VaultCore"],
      interfaceCount: 0,
      draftSummary: "Draft"
    },
    architecture: {
      markdownSummary: "Mock",
      keyComponents: ["VaultCore"],
      generatedByModel: "Mock"
    },
    hypotheses: {
      summary: "1 high likelihood",
      hypotheses: [
        {
          id: "HYP-001",
          title: "Critical Breach",
          description: "desc",
          attackSurface: "Surface",
          targetComponent: "VaultCore",
          derivedFromInvariantIds: ["INV-001"],
          relatedVerificationIds: [],
          likelihood: "High",
          recommendedNextStep: "mitigate"
        }
      ],
      generatedByModel: "Mock"
    },
    economicAnalysis: {
      summary: "1 critical risk",
      risks: [
        {
          id: "ECO-001",
          title: "Oracle Manip",
          description: "desc",
          impact: "impact",
          severity: "Critical",
          relevantComponents: ["VaultCore"],
          mitigationStrategy: "strategy"
        }
      ],
      generatedByModel: "Mock"
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const registry = await generateFindingRegistry(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.equal(registry.generatedByModel, "gpt-4-test");
    assert.ok(registry.summary.includes("security findings"));
    assert.equal(registry.findings.length, 2);
    
    const f0 = registry.findings[0];
    assert.equal(f0.id, "FIND-001");
    assert.equal(f0.severity, "High"); // from high likelihood hyp
    assert.equal(f0.status, "Confirmed");

    const f1 = registry.findings[1];
    assert.equal(f1.id, "FIND-002");
    assert.equal(f1.severity, "Critical"); // from critical eco risk
    assert.equal(f1.status, "Confirmed");

  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Phase-8 emits Findings Registry directly to runtime status via HTTP and SSE", async () => {
  const root = await makeFreshRoot();
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for audit-verify completion
    // phases 0-16. index 33 is completion.
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 34);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 33 is audit-verify "completed"
    assert.equal(phaseEvents[33].phase, "audit-verify");
    assert.equal(phaseEvents[33].status, "completed");

    // Re-verify the getter now that Phase completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Assert Phase 8 (now part of 17) succeeded
    assert.ok(pollRes.data.findingRegistry !== undefined, "Finding registry missing");
    
    const registry = pollRes.data.findingRegistry;
    assert.ok(registry.findings.length > 0);
    assert.equal(registry.findings[0].id, "FIND-001");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
