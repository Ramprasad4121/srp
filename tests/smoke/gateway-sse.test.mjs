/**
 * Smoke tests: Gateway Server-Sent Events (SSE) flow
 *
 * Tests that the SSE endpoint /api/events properly publishes events
 * when setup/bootstrap states mutate via HTTP actions.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createGatewayClient } from "../../apps/web/dist/api/gateway-client.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-sse-"));
}

/**
 * Poor man's SSE client for Node.js tests.
 * Resolves with the first relevant event payload matching the target type.
 */
function waitForSseEvent(url, targetEventType) {
  return new Promise((resolve, reject) => {
    let rawData = "";

    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        req.destroy();
        return reject(new Error(`Failed to connect to SSE: HTTP ${res.statusCode}`));
      }

      res.on("data", (chunk) => {
        rawData += chunk.toString("utf8");

        // Note: this is a very naive SSE parser looking for data: {...}\n\n
        const parts = rawData.split("\n\n");
        if (parts.length > 1) {
          // We have complete messages
          for (let i = 0; i < parts.length - 1; i++) {
            const frame = parts[i].trim();
            if (frame.startsWith("data: ")) {
              const jsonStr = frame.substring("data: ".length);
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === targetEventType) {
                  req.destroy(); // cleanup
                  resolve(event);
                  return;
                }
              } catch (e) {
                // ignore invalid json chunks
              }
            }
          }
          // keep remainder
          rawData = parts[parts.length - 1];
        }
      });

      res.on("error", reject);
    });

    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Test 1: Full end-to-end SSE push on setup change
// ---------------------------------------------------------------------------

test("SSE publishes setup.updated when a setup step is completed", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const sseUrl = `${baseUrl}/api/events`;

    const client = createGatewayClient(baseUrl);

    // 1. Kick off background Promise waiting for the particular SSE
    const setupEventP = waitForSseEvent(sseUrl, "setup.updated");

    // Give the poor man's client a moment to connect and establish headers
    await new Promise((r) => setTimeout(r, 50));

    // 2. Perform a state mutation action
    const apiRes = await client.completeWelcome();
    assert.equal(apiRes.ok, true);

    // 3. Await the event arrival
    const event = await setupEventP;
    
    assert.equal(event.type, "setup.updated");
    assert.ok(typeof event.emittedAt === "string");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

test("SSE publishes bootstrap.updated when setup is finalized", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const sseUrl = `${baseUrl}/api/events`;
    const client = createGatewayClient(baseUrl);

    const bootstrapEventP = waitForSseEvent(sseUrl, "bootstrap.updated");

    await new Promise((r) => setTimeout(r, 50));

    // Mutate to the end stage
    const apiRes = await client.completeWorkspace();
    assert.equal(apiRes.ok, true);

    const event = await bootstrapEventP;
    
    assert.equal(event.type, "bootstrap.updated");
    assert.ok(typeof event.emittedAt === "string");

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

test("SSE publishes artifact.created during runtime execution", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const sseUrl = `${baseUrl}/api/events`;
    const runtimeClient = createRuntimeClient(baseUrl);

    const artifactEventP = waitForSseEvent(sseUrl, "artifact.created");

    await new Promise((r) => setTimeout(r, 50));

    const startRes = await runtimeClient.startSession();
    assert.equal(startRes.ok, true);

    const event = await artifactEventP;
    assert.equal(event.type, "artifact.created");
    assert.ok(typeof event.artifactId === "string");
    assert.ok(typeof event.artifactTitle === "string");
    assert.ok(typeof event.artifactKind === "string");
    assert.ok(typeof event.phase === "string");
    assert.ok(typeof event.emittedAt === "string");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
