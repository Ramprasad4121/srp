import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { clientAddress, createSrpServer, trustProxyFromEnv } from "../src/server.ts";

async function withServer(trustProxyHops: number | undefined, fn: (base: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "srp-proxy-"));
  const server = createSrpServer({ dataFile: join(dir, "state.json"), tokens: {}, rateLimitPerMinute: 2, heartbeatMs: 50, log: () => undefined, ...(trustProxyHops === undefined ? {} : { trustProxyHops }) });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}

const hit = (base: string, xff?: string) => fetch(`${base}/api/health`, { headers: xff ? { "x-forwarded-for": xff } : {} }).then((res) => res.status);

test("clientAddress takes the Nth entry from the right and ignores client-controlled entries", () => {
  assert.equal(clientAddress("10.0.0.1", "203.0.113.9", 0), "10.0.0.1");
  assert.equal(clientAddress("10.0.0.1", "203.0.113.9", 1), "203.0.113.9");
  assert.equal(clientAddress("10.0.0.1", "6.6.6.6, 203.0.113.9", 1), "203.0.113.9");
  assert.equal(clientAddress("10.0.0.1", "6.6.6.6, 203.0.113.9, 10.0.0.2", 2), "203.0.113.9");
  assert.equal(clientAddress("10.0.0.1", "203.0.113.9", 2), "10.0.0.1");
  assert.equal(clientAddress("10.0.0.1", undefined, 1), "10.0.0.1");
  assert.equal(clientAddress("10.0.0.1", ["6.6.6.6", "203.0.113.9"], 1), "203.0.113.9");
});

test("SRP_TRUST_PROXY parsing", () => {
  assert.equal(trustProxyFromEnv({}), 0);
  assert.equal(trustProxyFromEnv({ SRP_TRUST_PROXY: "false" }), 0);
  assert.equal(trustProxyFromEnv({ SRP_TRUST_PROXY: "true" }), 1);
  assert.equal(trustProxyFromEnv({ SRP_TRUST_PROXY: "2" }), 2);
  assert.throws(() => trustProxyFromEnv({ SRP_TRUST_PROXY: "yes" }));
  assert.throws(() => trustProxyFromEnv({ SRP_TRUST_PROXY: "-1" }));
});

test("without trust proxy, a spoofed X-Forwarded-For does not escape the rate limit", async () => {
  await withServer(0, async (base) => {
    assert.equal(await hit(base, "1.1.1.1"), 200);
    assert.equal(await hit(base, "2.2.2.2"), 200);
    assert.equal(await hit(base, "3.3.3.3"), 429);
  });
});

test("behind one trusted proxy, each forwarded client gets its own bucket", async () => {
  await withServer(1, async (base) => {
    assert.equal(await hit(base, "198.51.100.1"), 200);
    assert.equal(await hit(base, "198.51.100.1"), 200);
    assert.equal(await hit(base, "198.51.100.1"), 429);
    assert.equal(await hit(base, "198.51.100.2"), 200);
    // A client prepending fake entries is still keyed on the address the proxy saw.
    assert.equal(await hit(base, "9.9.9.9, 198.51.100.1"), 429);
  });
});
