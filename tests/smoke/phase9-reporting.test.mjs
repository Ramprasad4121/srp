/**
 * Smoke tests: Phase-9 Formal Reporting / Document Synthesis
 *
 * Tests that the inference bridge synthesizes a comprehensive report
 * from all previous phases of the methodology.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateFormalReport } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-report-"));
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

test("Inference Bridge computes deterministic mock report from full Context", async () => {
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
      bytesProcessed: 512,
      limitReached: false,
      targetFiles: ["src/Vault.sol"]
    },
    intent: {
      mainContracts: ["VaultCore"],
      interfaceCount: 0,
      draftSummary: "Draft"
    },
    architecture: {
      markdownSummary: "## Arch",
      keyComponents: ["VaultCore"],
      generatedByModel: "Mock"
    },
    invariants: {
      summary: "1 item",
      invariants: [
        {
          id: "INV-001",
          title: "Invar",
          description: "desc",
          category: "General",
          priority: "Low",
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
          title: "VPlan",
          description: "desc",
          coversInvariantIds: ["INV-001"],
          verificationType: "Fuzzing",
          status: "Planned",
          recommendedTool: "Echidna"
        }
      ],
      generatedByModel: "Mock"
    },
    hypotheses: {
      summary: "1 hyp",
      hypotheses: [
        {
          id: "HYP-001",
          title: "Hypo",
          description: "desc",
          attackSurface: "Surface",
          targetComponent: "VaultCore",
          derivedFromInvariantIds: ["INV-001"],
          relatedVerificationIds: ["VP-INV-001"],
          likelihood: "Medium",
          recommendedNextStep: "trace"
        }
      ],
      generatedByModel: "Mock"
    },
    economicAnalysis: {
      summary: "1 eco",
      risks: [
        {
          id: "ECO-001",
          title: "EcoRisk",
          description: "desc",
          impact: "impact",
          severity: "High",
          relevantComponents: ["VaultCore"],
          mitigationStrategy: "mitigate"
        }
      ],
      generatedByModel: "Mock"
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const report = await generateFormalReport(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.equal(report.generatedByModel, "gpt-4-test");
    assert.ok(report.markdownContent.includes("# Formal Security Audit Report"));
    assert.ok(report.markdownContent.includes("## 1. Executive Summary"));
    assert.ok(report.markdownContent.includes("## 2. Architecture Overview"));
    assert.ok(report.markdownContent.includes("INV-001: Invar"));
    assert.ok(report.markdownContent.includes("VP-INV-001: VPlan"));
    assert.ok(report.markdownContent.includes("HYP-001: Hypo"));
    assert.ok(report.markdownContent.includes("ECO-001: EcoRisk"));

  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Phase-9 emits Formal Report directly to runtime status via HTTP and SSE", async () => {
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

    // Re-verify the getter now that Phase 9 (18) completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // Assert Phase 9 (18) succeeded
    assert.ok(pollRes.data.formalReport !== undefined, "Formal report missing");
    assert.ok(pollRes.data.formalReport.markdownContent.includes("# Formal Security Audit Report"));

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
