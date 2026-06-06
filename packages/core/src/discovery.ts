import type { Finding, ProtocolInput, Severity } from "./types.ts";
import { clampConfidence, confidenceBand, lineEvidence, stableId } from "./utils.ts";

interface DetectorRule {
  id: string;
  title: string;
  severity: Severity;
  chain: "evm" | "solana" | "all";
  pattern: RegExp;
  evidence: string;
  impact: string;
  remediation: string;
  confidence: number;
}

const RULES: DetectorRule[] = [
  {
    id: "evm-reentrancy-external-call",
    title: "External value transfer can execute before state is proven safe",
    severity: "high",
    chain: "evm",
    pattern: /\.call\s*\{|\.call\s*\(|transfer\s*\(|send\s*\(/,
    evidence: "External calls transfer control to an untrusted receiver and require checks-effects-interactions or a lock.",
    impact: "An attacker-controlled receiver can re-enter vulnerable flows and drain or corrupt accounting state.",
    remediation: "Move all state updates before external calls and add a reentrancy guard on value-moving entrypoints.",
    confidence: 0.68
  },
  {
    id: "evm-upgrade-admin",
    title: "Upgrade path requires explicit authorization and delay controls",
    severity: "high",
    chain: "evm",
    pattern: /upgradeTo|upgradeToAndCall|delegatecall|implementation/,
    evidence: "Upgrade-related primitives can replace protocol logic and must be protected by governance controls.",
    impact: "A compromised or misconfigured upgrade authority can replace implementation logic and seize protocol assets.",
    remediation: "Restrict upgrades to a timelocked multisig or governance executor and emit complete upgrade audit logs.",
    confidence: 0.62
  },
  {
    id: "evm-oracle-manipulation",
    title: "Price-sensitive logic depends on oracle data",
    severity: "medium",
    chain: "evm",
    pattern: /latestRoundData|getPrice|price|oracle|twap/i,
    evidence: "Oracle-consuming paths require freshness, bounds, and manipulation resistance checks.",
    impact: "Manipulated prices can cause incorrect minting, liquidation, collateral valuation, or reward distribution.",
    remediation: "Validate freshness, decimals, sequencer state, min/max bounds, and use manipulation-resistant aggregation.",
    confidence: 0.52
  },
  {
    id: "solana-pda-validation",
    title: "Program derived account validation is security critical",
    severity: "high",
    chain: "solana",
    pattern: /Pubkey::find_program_address|create_program_address|seeds|bump/i,
    evidence: "PDA derivation and bump checks define authority over Solana account state.",
    impact: "Missing seed, bump, or owner validation can let attackers substitute accounts and redirect authority.",
    remediation: "Validate seeds, bump, owner, signer requirements, executable flags, and canonical account addresses.",
    confidence: 0.64
  },
  {
    id: "solana-cpi-boundary",
    title: "Cross-program invocation requires strict program and account validation",
    severity: "high",
    chain: "solana",
    pattern: /invoke_signed|invoke\(|CpiContext|AccountInfo/i,
    evidence: "CPI allows external program execution with provided account metas.",
    impact: "Unvalidated program IDs or writable accounts can redirect execution or mutate unintended state.",
    remediation: "Pin allowed program IDs, validate all account owners, signer flags, mutability, and PDA seeds before CPI.",
    confidence: 0.66
  },
  {
    id: "access-control",
    title: "Privileged operation requires enforceable authorization",
    severity: "medium",
    chain: "all",
    pattern: /onlyOwner|require\(.*owner|hasRole|admin|authority|governor/i,
    evidence: "Privileged branches determine who may change protocol state or parameters.",
    impact: "Weak access control enables unauthorized parameter changes, pausing, upgrades, or asset movement.",
    remediation: "Use explicit role checks, least privilege, two-step transfers, and operational monitoring for privileged calls.",
    confidence: 0.5
  }
];

export function discoverVulnerabilities(input: ProtocolInput): Finding[] {
  const chainFamily = input.chain === "solana" ? "solana" : "evm";
  const findings: Finding[] = [];
  for (const source of input.sources) {
    for (const rule of RULES) {
      if (rule.chain !== "all" && rule.chain !== chainFamily) continue;
      const evidence = lineEvidence(source.path, source.content, rule.pattern, rule.evidence);
      if (!evidence) continue;
      const id = stableId("finding", `${rule.id}:${source.path}:${evidence.startLine}:${evidence.excerpt}`);
      const confidence = clampConfidence(rule.confidence + (source.content.length > 1000 ? 0.05 : 0));
      findings.push({
        id,
        title: rule.title,
        severity: rule.severity,
        impact: rule.impact,
        likelihood: confidence >= 0.65 ? "Likely when the cited flow is externally reachable." : "Plausible; reachability and guards require validation.",
        attackPath: buildAttackPath(rule, chainFamily),
        exploitability: "Requires call graph and state validation before final severity assignment.",
        proofOfConcept: buildPocSketch(rule, source.path),
        remediation: rule.remediation,
        confidence,
        confidenceBand: confidenceBand(confidence),
        evidence: [evidence],
        status: "candidate",
        detector: rule.id
      });
    }
  }
  return dedupe(findings);
}

function buildAttackPath(rule: DetectorRule, family: "evm" | "solana"): string[] {
  if (rule.id.includes("reentrancy")) return ["Attacker deploys receiver", "Receiver enters withdrawal", "External call returns control", "Receiver re-enters before invariant is restored"];
  if (rule.id.includes("oracle")) return ["Attacker influences price source", "Protocol reads manipulated price", "Attacker executes price-sensitive action", "Protocol accounting moves value incorrectly"];
  if (family === "solana") return ["Attacker prepares substitute accounts", "Instruction receives attacker-controlled account metas", "Program misses canonical validation", "State or authority is redirected"];
  return ["Attacker identifies privileged or state-changing entrypoint", "Attacker satisfies weak preconditions", "Protocol accepts transaction", "Security guarantee is violated"];
}

function buildPocSketch(rule: DetectorRule, file: string): string {
  if (rule.chain === "solana") return `Create a Solana program-test case that supplies adversarial accounts against ${file} and asserts account ownership or authority drift.`;
  return `Create a Foundry test that forks target state, calls the vulnerable path in ${file}, and asserts balance or accounting deltas.`;
}

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.detector}:${finding.evidence[0]?.file}:${finding.evidence[0]?.startLine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
