/**
 * Smoke tests: Phase-2 Architecture Provider Bridge
 *
 * Tests that the inference bridge respects mock/fallback environments
 * and correctly injects the Architecture Summary into the session status.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { generateArchitectureSummary, generateProtocolDiagram } from "../../apps/gateway/dist/runtime/providers/inference-bridge.js";
import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-bridge-"));
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

test("Inference Bridge computes deterministic mock safely without keys", async () => {
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
    }
  };

  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test"; // Force test short circuit

  try {
    const arch = await generateArchitectureSummary(context, {
      kind: "openai",
      label: "OpenAI",
      model: "gpt-4-test",
      enabled: true
    });

    assert.ok(arch.markdownSummary.includes("VaultCore"));
    assert.ok(arch.markdownSummary.includes("Foundry"));
    assert.deepEqual(arch.keyComponents, ["VaultCore"]);
    assert.equal(arch.generatedByModel, "gpt-4-test");
  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test("Inference Bridge generates Excalidraw-compatible protocol diagram", async () => {
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
      mainContracts: ["VaultCore", "Treasury"],
      interfaceCount: 1,
      draftSummary: "Draft"
    },
    architecture: {
      markdownSummary: "Architecture",
      keyComponents: ["VaultCore", "Treasury"],
      generatedByModel: "mock"
    }
  };

  const diagram = await generateProtocolDiagram(context, {
    kind: "openai",
    label: "OpenAI",
    model: "gpt-4-test",
    enabled: true
  });

  assert.equal(diagram.type, "excalidraw");
  assert.equal(diagram.version, 2);
  assert.ok(diagram.elements.some((element) => element.type === "rectangle"));
  assert.ok(diagram.elements.some((element) => element.type === "arrow"));
  assert.ok(diagram.elements.some((element) => element.type === "text"));
});

test("Phase-2 emits Architecture Summary directly to runtime status via HTTP and SSE", async () => {
  const root = await makeFreshRoot();
  // Don't setup any files to stay fast. The pipeline handles empty workspaces cleanly.

  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for visual-flow-map completion
    // phases 0-10. index 21 is completion.
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 22);

    await new Promise((r) => setTimeout(r, 50)); 

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);

    const phaseEvents = await phaseEventsP;
    
    // index 21 is visual-flow-map "completed"
    assert.equal(phaseEvents[21].phase, "visual-flow-map");
    assert.equal(phaseEvents[21].status, "completed");

    // Re-verify the getter now that visual-flow-map completed
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    
    // The previous phases completed
    assert.ok(pollRes.data.workspaceAnalysis !== undefined);
    assert.ok(pollRes.data.intentSummary !== undefined);

    // Assert synthesis-actors succeeded
    assert.ok(pollRes.data.architectureSummary !== undefined, "Architecture summary missing");
    
    // Assert visual-flow-map succeeded
    assert.ok(pollRes.data.protocolDiagram !== undefined, "Protocol diagram missing");
    assert.equal(pollRes.data.protocolDiagram.type, "excalidraw");
    assert.ok(pollRes.data.protocolDiagram.elements.length > 0);

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
