/**
 * Smoke tests: Runtime execution and phase progression
 *
 * Tests the /api/runtime block including session startup, and verifies
 * that the SSE endpoint publishes the running phase events.
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
  return mkdtemp(join(tmpdir(), "srp-runtime-"));
}

/**
 * Captures the first N matching SSE events.
 */
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

test("GET /api/runtime returns empty state initially", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);

    const res = await runtimeApi.getSessionState();
    assert.equal(res.ok, true);
    assert.equal(res.data.hasSession, false);
    assert.equal(res.data.isRunning, false);
    assert.equal(res.data.currentPhase, null);
    assert.deepEqual(res.data.phases, []);
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

test("POST /api/runtime/start begins session and publishes session.started and phase events", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeApi = createRuntimeClient(baseUrl);
    const sseUrl = `${baseUrl}/api/events`;

    // Wait for the first 'session.started' event
    const sessionEventP = captureSseEvents(sseUrl, "session.started", 1);
    
    // Also wait for the first 2 'phase.status.changed' events (e.g. running, then completed)
    const phaseEventsP = captureSseEvents(sseUrl, "phase.status.changed", 2);

    await new Promise((r) => setTimeout(r, 50)); // let headers settle

    const startRes = await runtimeApi.startSession();
    assert.equal(startRes.ok, true);
    assert.equal(startRes.data.hasSession, true);
    assert.equal(startRes.data.isRunning, true);

    const [sessionEvent] = await sessionEventP;
    assert.equal(sessionEvent.type, "session.started");
    assert.ok(typeof sessionEvent.sessionId === "string");
    assert.ok(typeof sessionEvent.runId === "string");

    const phaseEvents = await phaseEventsP;
    assert.equal(phaseEvents.length, 2);
    // The very first phase should transition to "running" then "completed"
    assert.equal(phaseEvents[0].phase, "discovery-docs");
    assert.equal(phaseEvents[0].status, "running");
    assert.equal(phaseEvents[1].phase, "discovery-docs");
    assert.equal(phaseEvents[1].status, "completed");

    // Re-verify the getter
    const pollRes = await runtimeApi.getSessionState();
    assert.equal(pollRes.ok, true);
    assert.equal(pollRes.data.hasSession, true);
    assert.ok(pollRes.data.phases.length > 0);

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
