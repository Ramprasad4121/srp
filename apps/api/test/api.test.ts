import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createSrpServer, tokensFromEnv } from "../src/server.ts";

const ADMIN = "admin_token_0123456789";
const AUDITOR = "auditor_token_0123456789";
const VIEWER = "viewer_token_0123456789";
let server: Server;
let base = "";
let dir = "";

const ETHER_STORE = `contract EtherStore {
    mapping(address => uint256) public balances;
    function withdraw() public {
        uint256 bal = balances[msg.sender];
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent);
        balances[msg.sender] = 0;
    }
}`;
const AUDIT = { name: "EtherStore", chain: "ethereum", documents: [], sources: [{ path: "EtherStore.sol", language: "solidity", content: ETHER_STORE }] };

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "srp-api-"));
  server = createSrpServer({
    dataFile: join(dir, "state.json"),
    tokens: { [ADMIN]: { subject: "a", role: "admin" }, [AUDITOR]: { subject: "b", role: "auditor" }, [VIEWER]: { subject: "c", role: "viewer" } },
    maxBodyBytes: 64 * 1024,
    heartbeatMs: 50,
    log: () => undefined
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

function call(path: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  return fetch(base + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
}

test("health and capabilities are public; capabilities lists analyzers and detectors", async () => {
  assert.equal((await call("/api/health")).status, 200);
  const caps = await (await call("/api/capabilities")).json();
  assert.equal(caps.schemaVersion, "srp.capabilities/v1");
  assert.ok(caps.analyzers.some((analyzer: { id: string }) => analyzer.id === "srp-anchor"));
  assert.ok(caps.detectors.some((detector: { id: string }) => detector.id === "evm-reentrancy-external-call"));
  assert.ok(Array.isArray(caps.notBuilt) && caps.notBuilt.length > 0);
});

test("auth: no token 401, viewer cannot run audits 403, unknown token 401", async () => {
  assert.equal((await call("/api/audits")).status, 401);
  assert.equal((await call("/api/audits", { method: "POST", token: VIEWER, body: JSON.stringify(AUDIT) })).status, 403);
  // Regression: object prototype keys used to authenticate and pass every role check (Bearer constructor -> admin audit log).
  for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
    assert.equal((await call("/api/audit-log", { token: key })).status, 401, `${key} must not authenticate`);
  }
});

test("bad input returns 400 with details instead of 500", async () => {
  const badJson = await call("/api/audits", { method: "POST", token: AUDITOR, body: "{bad" });
  assert.equal(badJson.status, 400);
  const missing = await call("/api/audits", { method: "POST", token: AUDITOR, body: JSON.stringify({ name: "x" }) });
  assert.equal(missing.status, 400);
  assert.ok((await missing.json()).details.some((detail: string) => /sources must be an array/.test(detail)));
  const badChain = await call("/api/audits", { method: "POST", token: AUDITOR, body: JSON.stringify({ ...AUDIT, chain: "bogus" }) });
  assert.equal(badChain.status, 400);
  const empty = await call("/api/audits", { method: "POST", token: AUDITOR, body: "" });
  assert.equal(empty.status, 400);
});

test("oversized bodies are rejected with 413", async () => {
  const huge = JSON.stringify({ ...AUDIT, sources: [{ path: "a.sol", language: "solidity", content: "x".repeat(100 * 1024) }] });
  assert.equal((await call("/api/audits", { method: "POST", token: AUDITOR, body: huge })).status, 413);
});

test("audit flow: create, fetch, markdown, SARIF, evidence bundle, verify, proofs", async () => {
  const created = await call("/api/audits", { method: "POST", token: AUDITOR, body: JSON.stringify(AUDIT) });
  assert.equal(created.status, 201);
  const report = await created.json();
  assert.equal(report.schemaVersion, "srp.audit/v1");
  const finding = report.findings.find((item: { detector: string }) => item.detector === "evm-reentrancy-external-call");
  assert.ok(finding);
  assert.equal(finding.status, "partial");

  assert.equal((await call(`/api/audits/${report.id}`, { token: VIEWER })).status, 200);
  assert.equal((await call("/api/audits/nope", { token: VIEWER })).status, 404);
  const md = await (await call(`/api/reports/${report.id}.md`, { token: VIEWER })).text();
  assert.match(md, /Residual Unknowns/);
  const sarif = await (await call(`/api/reports/${report.id}.sarif`, { token: VIEWER })).json();
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].results[0].ruleId, "evm-reentrancy-external-call");
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine, 5);

  const bundle = await (await call(`/api/audits/${report.id}/evidence`, { token: VIEWER })).json();
  assert.equal(bundle.schemaVersion, "srp.evidence-bundle/v1");
  const ok = await call("/api/evidence-bundles/verify", { method: "POST", token: VIEWER, body: JSON.stringify(bundle) });
  assert.equal((await ok.json()).valid, true);
  bundle.findings[0].severity = "low";
  const tampered = await call("/api/evidence-bundles/verify", { method: "POST", token: VIEWER, body: JSON.stringify(bundle) });
  assert.equal(tampered.status, 422);

  const badProof = await call(`/api/audits/${report.id}/proofs`, { method: "POST", token: AUDITOR, body: JSON.stringify({ proofs: [{ findingId: "finding_nope", command: "x", passed: true, assertion: "y" }] }) });
  assert.equal(badProof.status, 400);
  const proved = await call(`/api/audits/${report.id}/proofs`, {
    method: "POST",
    token: AUDITOR,
    body: JSON.stringify({ proofs: [{ findingId: finding.id, command: "forge test --match-test test_reenter_withdraw", passed: true, assertion: "attacker drained 10 ETH with 1 ETH deposited" }] })
  });
  assert.equal(proved.status, 200);
  const after = await proved.json();
  assert.equal(after.id, report.id);
  const provenFinding = after.findings.find((item: { id: string }) => item.id === finding.id);
  assert.equal(provenFinding.status, "proven");
  assert.equal(provenFinding.severity, "high");
});

test("SSE streams ready, audit.started, audit.stage, audit.completed and heartbeats", async () => {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/events?token=${VIEWER}`, { signal: controller.signal });
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  const done = (async () => {
    while (!/event: audit\.completed/.test(received) || !/: heartbeat/.test(received)) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      received += decoder.decode(value);
    }
  })();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await call("/api/audits", { method: "POST", token: AUDITOR, body: JSON.stringify(AUDIT) });
  await Promise.race([done, new Promise((resolve) => setTimeout(resolve, 3000))]);
  controller.abort();
  for (const event of ["ready", "audit.started", "audit.stage", "audit.completed"]) assert.match(received, new RegExp(`event: ${event.replace(".", "\\.")}`));
  assert.match(received, /"stage":"discovery"/);
  assert.match(received, /: heartbeat/);
});

test("signals are validated and health survives in the store", async () => {
  const bad = await call("/api/signals", { method: "POST", token: AUDITOR, body: JSON.stringify({ protocol: "V", chain: "ethereum", source: "treasury", metric: "out", value: "lots", threshold: 1 }) });
  assert.equal(bad.status, 400);
  const good = await call("/api/signals", { method: "POST", token: AUDITOR, body: JSON.stringify({ protocol: "V", chain: "ethereum", source: "treasury", metric: "out", value: 500, threshold: 100 }) });
  assert.equal(good.status, 202);
  assert.equal((await good.json()).health.status, "critical");
});

test("audit log is admin only and masks SSE query tokens", async () => {
  assert.equal((await call("/api/audit-log", { token: AUDITOR })).status, 403);
  const body = await (await call("/api/audit-log", { token: ADMIN })).json();
  assert.ok(body.auditLog.length > 0);
  assert.ok(!JSON.stringify(body).includes(VIEWER), "tokens must not be written to the audit log");
});

test("unknown API routes are 404 JSON and path traversal is refused", async () => {
  assert.equal((await call("/api/nope", { token: ADMIN })).status, 404);
  const traversal = await fetch(`${base}/%2e%2e/%2e%2e/package.json`);
  assert.ok([403, 404].includes(traversal.status));
  assert.equal((await fetch(`${base}/`)).status, 200);
});

test("demo tokens are disabled in production unless explicitly allowed", () => {
  assert.ok("srp_demo_admin_token" in tokensFromEnv({ NODE_ENV: "development" }));
  assert.ok(!("srp_demo_admin_token" in tokensFromEnv({ NODE_ENV: "production" })));
  assert.ok("srp_demo_admin_token" in tokensFromEnv({ NODE_ENV: "production", SRP_ALLOW_DEMO_TOKENS: "1" }));
  const configured = tokensFromEnv({ NODE_ENV: "production", SRP_TOKENS: "prod_admin_token_123456:admin:ops" });
  assert.deepEqual(configured, { prod_admin_token_123456: { role: "admin", subject: "ops" } });
  assert.throws(() => tokensFromEnv({ SRP_TOKENS: "short:admin:x" }), /Invalid SRP_TOKENS/);
});

test("container defaults: listens on all interfaces, runs as non-root, demo tokens off", async () => {
  const { readFileSync } = await import("node:fs");
  const dockerfile = readFileSync(new URL("../../../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /ENV HOST=0\.0\.0\.0/, "a container bound to 127.0.0.1 is unreachable through -p");
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /NODE_ENV=production/);
  const k8s = readFileSync(new URL("../../../infra/k8s/deployment.yaml", import.meta.url), "utf8");
  assert.match(k8s, /replicas: 1/, "JSON file store cannot be shared across replicas");
  assert.match(k8s, /SRP_TOKENS/);
});
