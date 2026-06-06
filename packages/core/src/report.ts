import type { AuditReport, Finding } from "./types.ts";

export function renderAuditReport(report: AuditReport): string {
  const lines = [
    `# ${report.protocol.name} Security Review`,
    "",
    `Generated: ${report.generatedAt}`,
    `Chain: ${report.protocol.chain}`,
    "",
    "## Executive Summary",
    "",
    `SRP reviewed ${report.protocol.sources.length} source file(s) and produced ${report.findings.length} evidence-backed finding(s). High severity issues are not finalized unless PoC validation proves exploitability.`,
    "",
    "## Findings",
    ""
  ];
  for (const finding of report.findings) lines.push(...renderFinding(finding), "");
  lines.push("## Protocol Intent", "", ...report.intent.securityGuarantees.map((item) => `- ${item}`));
  lines.push("", "## Threat Model", "", ...report.intent.threatModel.abuseCases.map((item) => `- ${item}`));
  return lines.join("\n");
}

function renderFinding(finding: Finding): string[] {
  return [
    `### ${finding.title}`,
    "",
    `Severity: ${finding.severity}`,
    `Confidence: ${finding.confidenceBand} (${finding.confidence})`,
    `Status: ${finding.status}`,
    "",
    `Impact: ${finding.impact}`,
    "",
    `Likelihood: ${finding.likelihood}`,
    "",
    `Attack path: ${finding.attackPath.join(" -> ")}`,
    "",
    `Exploitability: ${finding.exploitability}`,
    "",
    `Proof of concept: ${finding.proofOfConcept}`,
    "",
    `Remediation: ${finding.remediation}`,
    "",
    "Evidence:",
    ...finding.evidence.map((evidence) => `- ${evidence.file}:${evidence.startLine}-${evidence.endLine}: ${evidence.rationale}`)
  ];
}
