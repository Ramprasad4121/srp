import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createGatewayServer } from "../../apps/gateway/dist/index.js";

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-control-plane-"));
}

test("Gateway exposes control-plane summary for team and ops surfaces", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;
    const res = await fetch(`${baseUrl}/api/control-plane`);
    assert.equal(res.ok, true);

    const payload = await res.json();
    assert.ok(payload.skillSupply);
    assert.ok(payload.firstAid);
    assert.ok(payload.updateControl);

    assert.equal(typeof payload.skillSupply.total, "number");
    assert.ok(Array.isArray(payload.skillSupply.categories));
    assert.equal(typeof payload.firstAid.openIncidents, "number");
    assert.ok(Array.isArray(payload.firstAid.incidents));
    assert.equal(payload.updateControl.source, "repo-local");
    assert.equal(typeof payload.updateControl.webDistReady, "boolean");
    assert.ok(Array.isArray(payload.updateControl.notes));
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
