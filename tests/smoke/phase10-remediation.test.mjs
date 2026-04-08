/**
 * Smoke tests: Phase-10 Remediation Strategy / Recommendation Engine
 *
 * Tests that the inference bridge synthesizes standard Remediation Actions
 * based on the identified Finding Registry.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateRemediationPlan } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-rem-"));
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

test("Inference Bridge computes deterministic mock remediation plan from Finding Registry", async () => {
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
    findingRegistry: {
      summary: "1 critical finding",
      findings: [
        {
          id: "FIND-001",
          title: "Critical Vulnerability",
          description: "desc",
          severity: "Critical",
          status: "Confirmed",
          targetComponent: "VaultCore",
          impactedInvariantIds: []
        }
      ],
      generatedByModel: "Mock"
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const plan = await generateRemediationPlan(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.equal(plan.generatedByModel, "gpt-4-test");
    assert.ok(plan.summary.includes("targeted remediation steps"));
    assert.equal(plan.actions.length, 1);
    
    const a0 = plan.actions[0];
    assert.equal(a0.relatedFindingId, "FIND-001");
    assert.equal(a0.complexity, "High");

  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Phase-10 emits Remediation Plan directly to runtime status via HTTP and SSE", async () => {
  const root = await makeFreshRoot();
  
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for audit-report completion
    // phases 0-17. index 35 is completion.
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 36);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 35 is audit-report "completed"
    assert.equal(phaseEvents[35].phase, "audit-report");
    assert.equal(phaseEvents[35].status, "completed");

    // Re-verify the getter now that Phase completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Assert Phase 10 (now part of 18) succeeded
    assert.ok(pollRes.data.remediationPlan !== undefined, "Remediation plan missing");
    
    const plan = pollRes.data.remediationPlan;
    assert.ok(plan.actions.length > 0);
    assert.equal(plan.actions[0].id, "REM-FIND-001");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
