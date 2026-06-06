import type { AuditReport, Finding } from "./types.ts";

export function renderAuditReport(report: AuditReport): string {
  const critical = report.findings.filter(f => f.severity === "critical").length;
  const high = report.findings.filter(f => f.severity === "high").length;
  const medium = report.findings.filter(f => f.severity === "medium").length;
  const low = report.findings.filter(f => f.severity === "low").length;
  const info = report.findings.filter(f => f.severity === "informational").length;

  let md = `# Security Audit Report: ${report.protocol.name}\n\n`;
  md += `**Date:** ${new Date(report.generatedAt).toLocaleDateString()}\n`;
  md += `**Chain:** ${report.protocol.chain}\n`;
  md += `**Report ID:** ${report.id}\n\n`;

  md += `## Executive Summary\n\n`;
  md += `This report presents the findings of the Security Reasoning Protocol (SRP) automated audit of the ${report.protocol.name} protocol. The analysis included intent extraction, vulnerability discovery, DynaDebate risk assessment, and Proof of Concept validation.\n\n`;

  md += `### Severity Summary\n\n`;
  md += `| Severity | Count |\n`;
  md += `| :--- | :--- |\n`;
  md += `| Critical | ${critical} |\n`;
  md += `| High | ${high} |\n`;
  md += `| Medium | ${medium} |\n`;
  md += `| Low | ${low} |\n`;
  md += `| Informational | ${info} |\n\n`;

  md += `### Risk Matrix\n\n`;
  md += `The overall risk of the protocol is determined by the combination of severity and confidence of the findings. The SRP system identified **${report.findings.length}** potential vulnerabilities.\n\n`;

  md += `## Scope\n\n`;
  md += `The following sources were analyzed:\n\n`;
  for (const doc of report.protocol.documents) {
    md += `- Document: \`${doc.path}\` (${doc.kind})\n`;
  }
  for (const src of report.protocol.sources) {
    md += `- Source: \`${src.path}\` (${src.language})\n`;
  }
  md += `\n`;

  md += `## Methodology\n\n`;
  md += `The SRP analysis methodology consists of:\n`;
  md += `1.  **Intent Extraction**: Natural language processing of documentation and source code to identify assumptions, guarantees, boundaries, and threat models.\n`;
  md += `2.  **Discovery Engine**: Pattern-based vulnerability detection tailored for EVM and Solana primitives.\n`;
  md += `3.  **DynaDebate**: A multi-round risk assessment debate to refine the confidence score based on reachability, state transitions, economic feasibility, and amplification risks.\n`;
  md += `4.  **PoC Validation**: Generation and classification of Proof of Concept exploit scenarios.\n\n`;

  md += `## Protocol Intent & Architecture\n\n`;
  md += `### Security Guarantees\n`;
  for (const g of report.intent.securityGuarantees) md += `- ${g}\n`;
  md += `\n### Assumptions\n`;
  for (const a of report.intent.assumptions) md += `- ${a}\n`;
  md += `\n### Trust Boundaries\n`;
  for (const b of report.intent.trustBoundaries) md += `- ${b}\n`;
  md += `\n### DeFi Primitives Detected\n`;
  for (const p of report.intent.defiPrimitives) md += `- ${p}\n`;
  md += `\n`;

  md += `## Threat Model\n\n`;
  md += `**Actors:** ${report.intent.threatModel.actors.join(", ") || "None identified"}\n\n`;
  md += `**Assets:** ${report.intent.threatModel.assets.join(", ") || "None identified"}\n\n`;
  md += `**Entrypoints:** ${report.intent.threatModel.entrypoints.join(", ") || "None identified"}\n\n`;
  md += `**Abuse Cases:**\n`;
  for (const ac of report.intent.threatModel.abuseCases) md += `- ${ac}\n`;
  md += `\n`;

  md += `## Detailed Findings\n\n`;

  const sortedFindings = [...report.findings].sort((a, b) => {
    const sevMap = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };
    if (sevMap[a.severity] !== sevMap[b.severity]) return sevMap[b.severity] - sevMap[a.severity];
    return b.confidence - a.confidence;
  });

  for (let i = 0; i < sortedFindings.length; i++) {
    const f = sortedFindings[i];
    md += `### [${f.severity.toUpperCase()}] ${i + 1}. ${f.title}\n\n`;
    md += `**ID:** \`${f.id}\` | **Confidence:** ${(f.confidence * 100).toFixed(0)}% (${f.confidenceBand}) | **Status:** ${f.status.toUpperCase()}\n\n`;

    md += `#### Impact\n${f.impact}\n\n`;
    md += `#### Likelihood\n${f.likelihood}\n\n`;

    md += `#### Attack Path\n`;
    for (let j = 0; j < f.attackPath.length; j++) {
      md += `${j + 1}. ${f.attackPath[j]}\n`;
    }
    md += `\n`;

    md += `#### Evidence\n`;
    for (const ev of f.evidence) {
      md += `File: \`${ev.file}\` (Lines ${ev.startLine}-${ev.endLine})\n`;
      md += `\`\`\`solidity\n${ev.excerpt}\n\`\`\`\n`;
      md += `*Rationale: ${ev.rationale}*\n\n`;
    }

    md += `#### Remediation\n${f.remediation}\n\n`;

    const debate = report.debates.find(d => d.findingId === f.id);
    if (debate) {
      md += `#### DynaDebate Summary\n`;
      md += `Final Decision: **${debate.decision}**\n\n`;
    }
  }

  if (sortedFindings.length === 0) {
    md += `*No vulnerabilities were discovered during this analysis.*\n\n`;
  }

  md += `## Disclaimer\n\n`;
  md += `This automated report is generated by the Security Reasoning Protocol (SRP). It is not a substitute for a manual security audit by experienced human professionals. Automated tools may produce false positives and false negatives. Please verify all findings before taking action.\n`;

  return md;
}
