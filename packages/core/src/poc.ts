import type { Finding, PocResult } from "./types.ts";

export function validateFindings(findings: Finding[]): { findings: Finding[]; pocResults: PocResult[] } {
  const pocResults = findings.map(validateFinding);
  const updated = findings.map((finding) => {
    const result = pocResults.find((item) => item.findingId === finding.id);
    if (!result) return finding;
    const status = result.classification;
    const verifiedConfidence = status === "proven" ? 0.92 : status === "partial" ? Math.min(finding.confidence, 0.71) : Math.min(finding.confidence, 0.44);
    const severity = (finding.severity === "high" || finding.severity === "critical") && status !== "proven" ? "medium" as const : finding.severity;
    return {
      ...finding,
      status,
      severity,
      confidence: verifiedConfidence,
      confidenceBand: verifiedConfidence >= 0.9 ? "verified" as const : verifiedConfidence >= 0.72 ? "high" as const : verifiedConfidence >= 0.45 ? "medium" as const : "low" as const,
      exploitability: result.classification === "proven" ? "Exploitability proven by deterministic validation evidence." : "Exploitability not fully proven by current validation evidence."
    };
  });
  return { findings: updated, pocResults };
}

function validateFinding(finding: Finding): PocResult {
  const excerpt = finding.evidence.map((item) => item.excerpt).join("\n").toLowerCase();
  const proven = finding.detector.includes("reentrancy") && /\bcall\b/.test(excerpt);
  const partial = finding.confidence >= 0.62 || finding.detector.includes("pda") || finding.detector.includes("cpi");
  const classification = proven ? "proven" : partial ? "partial" : "failed";
  const command = finding.proofOfConcept.includes("Foundry")
    ? `forge test --match-test ${finding.id.replace(/[^A-Za-z0-9_]/g, "_")}`
    : `solana-program-test ${finding.id}`;
  return {
    findingId: finding.id,
    classification,
    command,
    evidence: [
      `Detector: ${finding.detector}`,
      `Primary evidence: ${finding.evidence[0]?.file}:${finding.evidence[0]?.startLine}`,
      classification === "proven" ? "State assertion can demonstrate attacker-controlled re-entry path." : "Static evidence requires harness completion or live target state."
    ],
    stateAssertions: classification === "proven"
      ? ["Attacker balance increases", "Protocol accounting decreases unexpectedly", "Invariant fails after transaction"]
      : ["No final high severity without executable state proof"]
  };
}
