import { runAudit } from "../../../packages/core/src/index.ts";

const report = await runAudit({
  name: "SmokeVault",
  chain: "ethereum",
  documents: [{ path: "README.md", kind: "README", content: "Only the governor may upgrade the vault. The vault must remain solvent." }],
  sources: [{ path: "SmokeVault.sol", language: "solidity", content: "contract SmokeVault { function withdraw() external { (bool ok,) = msg.sender.call(\"\"); require(ok); } }" }]
});

console.log(JSON.stringify({ id: report.id, findings: report.findings.length, proven: report.findings.filter((finding) => finding.status === "proven").length }, null, 2));
