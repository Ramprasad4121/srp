import type { AuditReport, Finding } from "./types.ts";

export function renderAuditReport(report: AuditReport): string {
  const proven = report.findings.filter((finding) => finding.status === "proven").length;
  const coverage = report.coverage;
  const lines = [
    `# ${report.protocol.name} Security Review`,
    "",
    `Generated: ${report.generatedAt}`,
    `Chain: ${report.protocol.chain}`,
    `Schema: ${report.schemaVersion}`,
    "",
    "## Executive Summary",
    "",
    `SRP reviewed ${report.protocol.sources.length} source file(s) and produced ${report.findings.length} evidence-backed finding(s), ${proven} proven by an executed test.`,
    "Findings are static analysis results. A finding is proven only when a locally executed PoC or test result is attached. Unproven high and critical findings are shown at medium with their proposed severity.",
    "",
    "## Coverage",
    "",
    coverage ? `Analyzed ${coverage.analyzedFiles} of ${coverage.files} file(s) (${Math.round(coverage.ratio * 100)}%), ${coverage.functions} function(s) or instruction(s) indexed. Analyzers: ${coverage.analyzers.join(", ")}.` : "Coverage not recorded.",
    "No finding is not the same as no bug. See residual unknowns below.",
    "",
    "## Findings",
    ""
  ];
  if (!report.findings.length) lines.push("No findings.", "");
  for (const finding of report.findings) lines.push(...renderFinding(finding, report), "");
  lines.push("## Residual Unknowns", "");
  if (report.unknowns?.length) lines.push(...report.unknowns.map((unknown) => `- [${unknown.severity}] ${unknown.file}: ${unknown.question} ${unknown.reason}`));
  else lines.push("- None recorded.");
  lines.push("", "## Protocol Intent", "", ...report.intent.securityGuarantees.map((item) => `- ${item}`));
  lines.push("", "## Threat Model", "", ...report.intent.threatModel.abuseCases.map((item) => `- ${item}`));
  return lines.join("\n");
}

function renderFinding(finding: Finding, report: AuditReport): string[] {
  const poc = report.pocResults.find((item) => item.findingId === finding.id);
  const debate = report.debates.find((item) => item.findingId === finding.id);
  return [
    `### ${finding.title}`,
    "",
    `Severity: ${finding.severity}${finding.proposedSeverity && finding.proposedSeverity !== finding.severity ? ` (proposed ${finding.proposedSeverity}, held until proven)` : ""}`,
    `Confidence: ${finding.confidenceBand} (${finding.confidence})`,
    `Status: ${finding.status}`,
    `Detector: ${finding.detector}`,
    "",
    `Impact: ${finding.impact}`,
    "",
    `Attack path: ${finding.attackPath.join(" -> ")}`,
    "",
    `Exploitability: ${finding.exploitability}`,
    "",
    `Remediation: ${finding.remediation}`,
    "",
    "Evidence:",
    ...finding.evidence.map((evidence) => `- ${evidence.file}:${evidence.startLine}-${evidence.endLine} \`${evidence.excerpt}\` (${evidence.kind ?? "observed"}, ${evidence.provider ?? "srp"}): ${evidence.rationale}`),
    ...(finding.context?.facts.length ? ["", "Facts:", ...finding.context.facts.map((fact) => `- ${fact}`)] : []),
    ...(finding.mitigations?.length ? ["", `Mitigations: ${finding.mitigations.join("; ")}`] : []),
    ...(debate ? ["", "Debate:", ...debate.rounds.map((round) => `- Attacker: ${round.attacker} Defender: ${round.defender} Judge: ${round.judge}`)] : []),
    ...(poc ? ["", `Validation: ${poc.classification}${poc.executed ? " (executed)" : " (not executed)"}. Run: \`${poc.command}\``] : []),
    ...(poc?.harness ? ["", "```solidity", poc.harness.trimEnd(), "```"] : [])
  ];
}
