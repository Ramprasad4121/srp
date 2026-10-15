import { runAudit } from "../../../packages/core/src/index.ts";

const report = runAudit({
  name: "SmokeVault",
  chain: "ethereum",
  documents: [{ path: "README.md", kind: "README", content: "Only the governor may upgrade the vault. The vault must remain solvent." }],
  sources: [{
    path: "SmokeVault.sol",
    language: "solidity",
    content: "contract SmokeVault {\n  mapping(address => uint256) balances;\n  function withdraw() external {\n    (bool ok,) = msg.sender.call{value: balances[msg.sender]}(\"\");\n    require(ok);\n    balances[msg.sender] = 0;\n  }\n}"
  }]
});

const reentrancy = report.findings.find((finding) => finding.detector === "evm-reentrancy-external-call");
if (!reentrancy) throw new Error("smoke: expected a reentrancy finding");
if (report.findings.some((finding) => finding.status === "proven")) throw new Error("smoke: nothing was executed, nothing may be proven");
console.log(JSON.stringify({ id: report.id, findings: report.findings.length, coverage: report.coverage.ratio, unknowns: report.unknowns.length }, null, 2));
