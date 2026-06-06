import type { Finding, DebateTranscript } from "./types.ts";
import { clampConfidence } from "./utils.ts";

export function runDynaDebate(findings: Finding[]): { findings: Finding[], transcripts: DebateTranscript[] } {
  const transcripts: DebateTranscript[] = [];
  const updatedFindings = findings.map(finding => {
    let currentConfidence = finding.confidence;
    const rounds: DebateTranscript["rounds"] = [];

    // Round 1: Evidence reachability
    const r1Delta = finding.evidence.some(e => e.excerpt.length > 50) ? 0.08 : -0.18;
    rounds.push({
      attacker: `The vulnerability is reachable because the evidence (${finding.evidence[0]?.file}) shows clear entry points.`,
      defender: r1Delta > 0 ? "The entry points are public, making it reachable." : "The evidence lacks clear public entry points or is protected by guards.",
      judge: r1Delta > 0 ? "Evidence strongly supports reachability." : "Reachability is questionable based on evidence.",
      confidenceDelta: r1Delta
    });
    currentConfidence = clampConfidence(currentConfidence + r1Delta);

    // Round 2: State transition validation
    const r2Delta = finding.attackPath.length >= 4 ? 0.06 : -0.10;
    rounds.push({
      attacker: `The state transition leads to exploitation via: ${finding.attackPath.join(" -> ")}`,
      defender: r2Delta > 0 ? "The state transitions are plausible." : "The attack path is too short or lacks concrete transitions.",
      judge: r2Delta > 0 ? "Attack path is logically sound." : "Attack path is incomplete.",
      confidenceDelta: r2Delta
    });
    currentConfidence = clampConfidence(currentConfidence + r2Delta);

    // Round 3: Severity assessment
    const r3Delta = (finding.severity === "critical" || finding.severity === "high") ? -0.03 : 0.03;
    rounds.push({
      attacker: `The impact is ${finding.severity}, maximizing damage.`,
      defender: r3Delta < 0 ? "High severity claims require higher burden of proof." : "Lower severity claims are more easily accepted.",
      judge: "Adjusting confidence based on severity baseline.",
      confidenceDelta: r3Delta
    });
    currentConfidence = clampConfidence(currentConfidence + r3Delta);

    // Round 4: Economic feasibility
    const r4Delta = finding.impact.includes("profit") || finding.impact.includes("drain") || finding.impact.includes("extract") ? 0.04 : -0.07;
    rounds.push({
      attacker: "The exploit provides clear economic incentives.",
      defender: r4Delta > 0 ? "Profitability is evident." : "The exploit lacks direct economic gain, reducing likelihood of targeted attack.",
      judge: r4Delta > 0 ? "Economic feasibility increases exploit likelihood." : "Lack of clear profit motive decreases likelihood.",
      confidenceDelta: r4Delta
    });
    currentConfidence = clampConfidence(currentConfidence + r4Delta);

    // Round 5: Cross-contract amplification
    const r5Delta = finding.evidence.some(e => e.excerpt.includes("call") || e.excerpt.includes("invoke")) ? 0.05 : -0.02;
    rounds.push({
      attacker: "Cross-contract interactions amplify the risk surface.",
      defender: r5Delta > 0 ? "External interactions introduce complex failure modes." : "The vulnerability is isolated to a single contract.",
      judge: r5Delta > 0 ? "Amplification risk is present." : "Risk is contained.",
      confidenceDelta: r5Delta
    });
    currentConfidence = clampConfidence(currentConfidence + r5Delta);

    let decision: DebateTranscript["decision"] = "threshold_reached";
    if (currentConfidence >= 0.8) decision = "exploit_proven";
    else if (currentConfidence < 0.4) decision = "exploit_disproven";

    transcripts.push({
      findingId: finding.id,
      rounds,
      finalConfidence: currentConfidence,
      decision
    });

    return { ...finding, confidence: currentConfidence };
  });

  return { findings: updatedFindings, transcripts };
}
