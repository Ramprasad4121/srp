import test from "node:test";
import assert from "node:assert/strict";
import { runAudit, RuntimeSecurityLayer } from "../src/index.ts";

test("EVM audit produces evidence-backed validated findings", () => {
  const report = runAudit({
    name: "Vault",
    chain: "ethereum",
    documents: [{ path: "README.md", kind: "README", content: "Only the governor may upgrade the vault. The vault must remain solvent." }],
    sources: [{
      path: "Vault.sol",
      language: "solidity",
      content: `contract Vault {
        function withdraw() external {
          (bool ok,) = msg.sender.call("");
          require(ok);
        }
      }`
    }]
  });

  assert.equal(report.protocol.name, "Vault");
  assert.ok(report.intent.threatModel.assets.length >= 1);
  assert.ok(report.findings.length >= 1);
  assert.ok(report.findings.every((finding) => finding.evidence.length > 0));
  assert.ok(report.findings.some((finding) => finding.status === "proven"));
});

test("Solana audit identifies account validation attack surfaces", () => {
  const report = runAudit({
    name: "StakeProgram",
    chain: "solana",
    documents: [{ path: "docs.md", kind: "DOCS", content: "Rewards distributed must not exceed accrued rewards." }],
    sources: [{
      path: "lib.rs",
      language: "rust",
      content: `pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let signer = Pubkey::find_program_address(&[b"vault"], ctx.program_id);
        invoke_signed(&ix, accounts, &[&[b"vault"]])?;
        Ok(())
      }`
    }]
  });

  assert.ok(report.intent.invariants.some((invariant) => invariant.toLowerCase().includes("reward")));
  assert.ok(report.findings.some((finding) => finding.detector.includes("pda")));
  assert.ok(report.findings.some((finding) => finding.detector.includes("cpi")));
  assert.ok(report.pocResults.every((result) => ["partial", "proven", "failed"].includes(result.classification)));
});

test("runtime security layer stores incidents and computes health", () => {
  const layer = new RuntimeSecurityLayer();
  assert.equal(layer.ingest({ protocol: "Vault", chain: "ethereum", source: "treasury", metric: "outflow_usd", value: 10, threshold: 100 }), undefined);
  const incident = layer.ingest({ protocol: "Vault", chain: "ethereum", source: "treasury", metric: "outflow_usd", value: 1000, threshold: 100 });
  assert.equal(incident?.severity, "high");
  assert.equal(layer.list().length, 1);
  assert.equal(layer.health("Vault").status, "critical");
});
