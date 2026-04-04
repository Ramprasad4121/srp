import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createGatewayServer } from "../../apps/gateway/dist/index.js";

async function makeFreshRoot() {
  return mkdtemp(join(tmpdir(), "srp-skills-"));
}

test("Gateway exposes skills catalog and individual skill detail", async () => {
  const root = await makeFreshRoot();
  const srv = await createGatewayServer({ port: 0, rootDirectory: root, environment: {} });

  try {
    const baseUrl = `http://127.0.0.1:${srv.port}`;

    const listRes = await fetch(`${baseUrl}/api/skills`);
    assert.equal(listRes.ok, true);
    const skills = await listRes.json();
    assert.ok(Array.isArray(skills));
    assert.ok(skills.length > 0);
    assert.ok(typeof skills[0].id === "string");
    assert.ok(typeof skills[0].name === "string");

    const detailRes = await fetch(`${baseUrl}/api/skills/${skills[0].id}`);
    assert.equal(detailRes.ok, true);
    const detail = await detailRes.json();
    assert.equal(detail.id, skills[0].id);
    assert.ok(typeof detail.content === "string");
  } finally {
    await srv.stop();
    await rm(root, { recursive: true, force: true });
  }
});
