/**
 * Smoke tests: Phase-11 Chat Section
 *
 * Tests that the gateway handles conversation lifecycle, message ingestion,
 * and artifact-grounded response generation.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { createGatewayServer } from "../../apps/gateway/dist/index.js";
import { createRuntimeClient } from "../../apps/web/dist/api/runtime-client.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-chat-"));
}

async function apiRequest(baseUrl, path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: { "Content-Type": "application/json" }
    };

    const req = http.request(`${baseUrl}${path}`, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, data: null });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("Phase-11 Chat: Conversation Lifecycle", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;

    // 1. List initially empty
    const listRes = await apiRequest(baseUrl, "/api/chat/conversations");
    assert.equal(listRes.ok, true);
    assert.equal(listRes.data.length, 0);

    // 2. Create conversation
    const createRes = await apiRequest(baseUrl, "/api/chat/conversations", "POST", {
      title: "Test Audit Discussion"
    });
    assert.equal(createRes.status, 201);
    assert.ok(createRes.data.id.startsWith("conv_"));
    assert.equal(createRes.data.title, "Test Audit Discussion");

    const convId = createRes.data.id;

    // 3. Get detail
    const detailRes = await apiRequest(baseUrl, `/api/chat/conversations/${convId}`);
    assert.equal(detailRes.ok, true);
    assert.equal(detailRes.data.id, convId);
    assert.equal(detailRes.data.messages.length, 0);

    // 4. Add message and get response
    const msgRes = await apiRequest(baseUrl, `/api/chat/conversations/${convId}/messages`, "POST", {
      content: "What findings have we identified so far?"
    });
    assert.equal(msgRes.status, 201);
    assert.equal(msgRes.data.userMessage.role, "user");
    assert.equal(msgRes.data.assistantMessage.role, "assistant");
    assert.ok(msgRes.data.assistantMessage.content.includes("finding registry"));

    // 5. Verify conversation now has messages
    const finalRes = await apiRequest(baseUrl, `/api/chat/conversations/${convId}`);
    assert.equal(finalRes.data.messages.length, 2);

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});

test("Phase-11 Chat: Response Grounding (Mock)", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });
  
  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const runtimeClient = createRuntimeClient(baseUrl);

    const startRes = await runtimeClient.startSession();
    assert.equal(startRes.ok, true);
    assert.ok(typeof startRes.data.runId === "string");

    await new Promise((resolve) => setTimeout(resolve, 800));

    const createRes = await apiRequest(baseUrl, "/api/chat/conversations", "POST", {
      title: "Protocol Context Check",
      runId: startRes.data.runId
    });
    const convId = createRes.data.id;

    const res = await apiRequest(baseUrl, `/api/chat/conversations/${convId}/messages`, "POST", {
      content: "Tell me about the architecture."
    });
    assert.equal(res.ok, true);
    assert.ok(res.data.assistantMessage.content.includes("architecture mapping"));
    assert.ok(Array.isArray(res.data.assistantMessage.citations));
    assert.ok(res.data.assistantMessage.citations.length > 0);
    assert.ok(res.data.assistantMessage.citations[0].artifactId);

  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
