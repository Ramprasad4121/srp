import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createSrpServer } from "../src/server.ts";

let server: Server;
let base = "";
let dir = "";
const pub = (file: string) => new URL(`../../web/public/${file}`, import.meta.url);

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "srp-web-"));
  server = createSrpServer({ dataFile: join(dir, "state.json"), tokens: {}, log: () => undefined });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

test("console shell and assets are served", async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /SRP Console/);
  for (const asset of ["app.js", "styles.css", "mock-data.js"]) {
    assert.match(html, new RegExp(asset.replace(".", "\\.")));
    assert.equal((await fetch(`${base}/${asset}`)).status, 200, asset);
  }
});

test("app.js parses and has every screen", () => {
  const source = readFileSync(pub("app.js"), "utf8");
  new vm.Script(source);
  for (const view of ["overview", "scan", "findings", "finding", "reports", "monitoring", "settings", "tools", "battlechain"]) assert.match(source, new RegExp(`\\b${view}\\(`), view);
});

test("demo data is the sample Vault with three proven high findings", () => {
  const sandbox: { window: { SRP_MOCK?: any } } = { window: {} };
  vm.runInNewContext(readFileSync(pub("mock-data.js"), "utf8"), sandbox);
  const audit = sandbox.window.SRP_MOCK.audits[0];
  assert.equal(audit.schemaVersion, "srp.audit/v1");
  const lines: string[] = Array.from(audit.findings as any[], (f) => `${f.detector}:${f.evidence[0].startLine}:${f.severity}`).sort();
  assert.deepEqual(lines, ["evm-missing-access-control:23:high", "evm-reentrancy-external-call:17:high", "evm-tx-origin-auth:29:high"]);
});

test("UI copy has no em or en dashes", () => {
  for (const file of ["index.html", "app.js", "styles.css"]) assert.doesNotMatch(readFileSync(pub(file), "utf8"), /[\u2013\u2014]/, file);
});
