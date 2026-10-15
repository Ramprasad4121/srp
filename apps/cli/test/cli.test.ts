import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli.ts";

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

before(() => {
  dir = mkdtempSync(join(tmpdir(), "srp-cli-"));
  // A Foundry project: src/ is scanned; test/, lib/ and out/ are not by default.
  mkdirSync(join(dir, "foundry", "src"), { recursive: true });
  mkdirSync(join(dir, "foundry", "test"), { recursive: true });
  mkdirSync(join(dir, "foundry", "lib", "dep"), { recursive: true });
  writeFileSync(join(dir, "foundry", "foundry.toml"), "[profile.default]\n");
  writeFileSync(join(dir, "foundry", "README.md"), "The vault must remain solvent.");
  writeFileSync(join(dir, "foundry", "src", "EtherStore.sol"), ETHER_STORE);
  writeFileSync(join(dir, "foundry", "test", "Attack.t.sol"), "contract Attack { function exec(address t, bytes calldata d) external { t.delegatecall(d); } }");
  writeFileSync(join(dir, "foundry", "lib", "dep", "Dep.sol"), "contract Dep { function exec(address t, bytes calldata d) external { t.delegatecall(d); } }");
  // A clean project.
  mkdirSync(join(dir, "clean"), { recursive: true });
  writeFileSync(join(dir, "clean", "Safe.sol"), "contract Safe { uint256 x; function set(uint256 v) external { x = v; } }");
  // An Anchor project.
  mkdirSync(join(dir, "anchor", "programs", "vault", "src"), { recursive: true });
  writeFileSync(join(dir, "anchor", "Anchor.toml"), "[programs.localnet]\n");
  writeFileSync(join(dir, "anchor", "programs", "vault", "src", "lib.rs"), "use anchor_lang::prelude::*;\n#[derive(Accounts)]\npub struct W<'info> {\n    authority: AccountInfo<'info>,\n}\n");
});
after(() => rmSync(dir, { recursive: true, force: true }));

async function run(...args: string[]) {
  let out = "";
  let err = "";
  const code = await main(args, { out: (value) => { out += value; }, err: (value) => { err += value; } });
  return { code, out, err };
}

test("scan: zero-config Foundry project finds the bug, skips test/ and lib/, exits 1 at --fail-on high", async () => {
  const result = await run("scan", join(dir, "foundry"));
  assert.equal(result.code, 1);
  assert.match(result.out, /HIGH\s+src\/EtherStore\.sol:5/);
  assert.doesNotMatch(result.out, /Attack\.t\.sol|Dep\.sol/);
  assert.match(result.out, /static leads, not proofs/);
});

test("scan: --fail-on critical passes when the worst finding is high; clean project exits 0", async () => {
  assert.equal((await run("scan", join(dir, "foundry"), "--fail-on", "critical")).code, 0);
  const clean = await run("scan", join(dir, "clean"));
  assert.equal(clean.code, 0);
  assert.match(clean.out, /No findings\. That is not proof of safety/);
});

test("scan: --include-tests picks up test files", async () => {
  const result = await run("scan", join(dir, "foundry"), "--include-tests", "--format", "summary");
  const summary = JSON.parse(result.out);
  assert.ok(summary.findings.some((finding: { detector: string }) => finding.detector === "evm-arbitrary-delegatecall"));
});

test("scan: Anchor.toml switches to Solana automatically", async () => {
  const summary = JSON.parse((await run("scan", join(dir, "anchor"), "--format", "summary")).out);
  assert.equal(summary.chain, "solana");
  assert.equal(summary.findings[0].detector, "solana-missing-signer");
});

test("scan: json, summary, sarif and md formats, and --out", async () => {
  const report = JSON.parse((await run("scan", join(dir, "foundry"), "--format", "json")).out);
  assert.equal(report.schemaVersion, "srp.audit/v1");
  const summary = JSON.parse((await run("scan", join(dir, "foundry"), "--format", "summary")).out);
  assert.equal(summary.schemaVersion, "srp.summary/v1");
  assert.equal(summary.findings[0].location, "src/EtherStore.sol:5");
  const sarif = JSON.parse((await run("scan", join(dir, "foundry"), "--format", "sarif")).out);
  assert.equal(sarif.version, "2.1.0");
  assert.match((await run("scan", join(dir, "foundry"), "--format", "md")).out, /forge-std\/Test\.sol/);
  const outFile = join(dir, "report.sarif");
  await run("scan", join(dir, "foundry"), "--format", "sarif", "--out", outFile);
  assert.equal(JSON.parse(readFileSync(outFile, "utf8")).version, "2.1.0");
});

test("usage errors exit 2 with a message", async () => {
  assert.equal((await run("scan", join(dir, "nope"))).code, 2);
  assert.equal((await run("scan", join(dir, "foundry"), "--format", "xml")).code, 2);
  assert.equal((await run("scan", join(dir, "foundry"), "--chain", "bogus")).code, 2);
  assert.equal((await run("scan", join(dir, "foundry"), "--fail-on", "huge")).code, 2);
  assert.equal((await run("bogus")).code, 2);
  assert.equal((await run("explain", "nope")).code, 2);
});

test("doctor, explain, verify-bundle, help", async () => {
  const doctor = JSON.parse((await run("doctor", "--json")).out);
  assert.equal(doctor.schemaVersion, "srp.capabilities/v1");
  assert.match((await run("explain", "solana-missing-signer")).out, /Authority account is not required to sign/);
  assert.match((await run("help")).out, /srp scan/);
});
