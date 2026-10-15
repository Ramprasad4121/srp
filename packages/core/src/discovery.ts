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
  /** Rule only applies when the same file also matches this pattern. */
  requires?: RegExp;
  /** A file-level guard that fully mitigates the pattern. When present, the rule does not fire. */
  suppressIf?: RegExp;
  /** A file-level guard that weakens but does not rule out the pattern. Lowers confidence and is recorded on the finding. */
  mitigatedBy?: { pattern: RegExp; label: string; penalty: number };
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
    confidence: 0.68,
    mitigatedBy: { pattern: /\bnonReentrant\b|ReentrancyGuard/, label: "Reentrancy guard (nonReentrant / ReentrancyGuard) present in file", penalty: 0.2 }
  },
  {
    id: "evm-oracle-stale-price",
    title: "Chainlink price is used without a freshness check",
    severity: "medium",
    chain: "evm",
    pattern: /latestRoundData\s*\(/,
    suppressIf: /\bupdatedAt\b\s*[<>+-]|[<>]=?\s*\bupdatedAt\b|block\.timestamp\s*-\s*\w*[uU]pdated/,
    evidence: "latestRoundData returns updatedAt, but nothing in this file compares it to block.timestamp.",
    impact: "A stale or frozen feed keeps returning an old price, so loans, mints, and liquidations run on a value the market no longer supports.",
    remediation: "Reject answers where block.timestamp - updatedAt exceeds the feed heartbeat, where answer <= 0, and check the L2 sequencer uptime feed when relevant.",
    confidence: 0.6
  },
  {
    id: "evm-tx-origin-auth",
    title: "Authorization relies on tx.origin",
    severity: "high",
    chain: "evm",
    pattern: /tx\.origin\s*[!=]=|[!=]=\s*tx\.origin/,
    evidence: "tx.origin is the original EOA, not the direct caller, so any contract the owner interacts with can act as the owner.",
    impact: "A malicious contract called by the owner can pass the check and run privileged actions in the owner's name.",
    remediation: "Authorize on msg.sender. Use tx.origin only to block contracts, never to grant rights.",
    confidence: 0.7
  },
  {
    id: "evm-signature-replay",
    title: "Signature is verified without a nonce or used-signature record",
    severity: "high",
    chain: "evm",
    pattern: /ecrecover\s*\(|ECDSA\.(try)?[rR]ecover\s*\(|SignatureChecker\.isValid/,
    suppressIf: /nonce|_useNonce|usedSignatures|usedHashes|usedDigests|isUsed|consumed|executed\s*\[/i,
    evidence: "A signature check with no nonce or replay record lets the same signed payload be submitted more than once.",
    impact: "An attacker can replay a valid signature, or reuse it on another chain or contract, to repeat mints, withdrawals, or swaps.",
    remediation: "Bind every signature to a nonce, deadline, chainId, and verifying contract (EIP-712 domain), hash every field that controls value, and mark digests as used.",
    confidence: 0.6
  },
  {
    id: "evm-erc4626-donation-inflation",
    title: "Vault share price reads raw token balance and can be inflated by donation",
    severity: "high",
    chain: "evm",
    pattern: /balanceOf\s*\(\s*address\s*\(\s*this\s*\)\s*\)/,
    requires: /totalAssets|convertToShares|convertToAssets|previewDeposit|ERC4626/,
    suppressIf: /_decimalsOffset|virtualShares|VIRTUAL_(SHARES|ASSETS)|deadShares|DEAD_SHARES|MIN(IMUM)?_SHARES|INITIAL_SHARES/,
    evidence: "Share accounting reads balanceOf(address(this)), so a direct token transfer moves the exchange rate without minting shares.",
    impact: "The first depositor, or anyone on an empty or thin vault, can donate tokens to round later deposits down to zero shares, or spike convertToAssets for an oracle that reads it.",
    remediation: "Track assets in internal accounting, use virtual shares and assets (OpenZeppelin _decimalsOffset), or burn dead shares on the first deposit. Never feed convertToAssets to an oracle without smoothing.",
    confidence: 0.58
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
      if (rule.requires && !rule.requires.test(source.content)) continue;
      if (rule.suppressIf && rule.suppressIf.test(source.content)) continue;
      const mitigated = rule.mitigatedBy && rule.mitigatedBy.pattern.test(source.content) ? rule.mitigatedBy : undefined;
      const evidence = lineEvidence(source.path, source.content, rule.pattern, rule.evidence);
      if (!evidence) continue;
      const id = stableId("finding", `${rule.id}:${source.path}:${evidence.startLine}:${evidence.excerpt}`);
      const confidence = clampConfidence(rule.confidence + (source.content.length > 1000 ? 0.05 : 0) - (mitigated?.penalty ?? 0));
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
        detector: rule.id,
        ...(mitigated ? { mitigations: [mitigated.label] } : {})
      });
    }
  }
  return dedupe(findings);
}

function buildAttackPath(rule: DetectorRule, family: "evm" | "solana"): string[] {
  if (rule.id.includes("reentrancy")) return ["Attacker deploys receiver", "Receiver enters withdrawal", "External call returns control", "Receiver re-enters before invariant is restored"];
  if (rule.id.includes("signature-replay")) return ["Attacker observes a valid signed payload on-chain or in the mempool", "Attacker resubmits the same signature", "Contract verifies the signer again", "The signed action runs twice"];
  if (rule.id.includes("donation")) return ["Attacker deposits a minimal amount into an empty vault", "Attacker transfers tokens directly to the vault", "Share price jumps without new shares", "Next depositor's shares round down and value moves to the attacker"];
  if (rule.id.includes("tx-origin")) return ["Attacker deploys a contract the owner will call", "Owner calls it", "Contract calls the protocol while tx.origin is the owner", "Privileged action runs for the attacker"];
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
