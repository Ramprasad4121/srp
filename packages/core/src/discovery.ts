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
  },
  {
    id: "evm-flash-loan-attack",
    title: "Flash loan interaction surface detected",
    severity: "high",
    chain: "evm",
    pattern: /flashLoan|flashBorrow|IFlashLoanReceiver|executeOperation|receiveFlashLoan/i,
    evidence: "Flash loan callbacks execute within an atomic transaction with borrowed capital.",
    impact: "Flash loans can amplify oracle manipulation, governance attacks, or exploit price-sensitive logic with zero-capital risk.",
    remediation: "Add reentrancy protection, use time-weighted average prices, implement cooldown periods for sensitive operations.",
    confidence: 0.58
  },
  {
    id: "evm-unchecked-return",
    title: "Low-level call return value may not be checked",
    severity: "medium",
    chain: "evm",
    pattern: /\.(call|delegatecall|staticcall)\s*\(/,
    evidence: "Low-level calls return a boolean success flag that must be validated.",
    impact: "Silent failure of external calls can leave contract state inconsistent and funds locked.",
    remediation: "Always check return values of low-level calls or use SafeCall wrappers that revert on failure.",
    confidence: 0.55
  },
  {
    id: "evm-front-running",
    title: "Transaction ordering sensitivity detected",
    severity: "medium",
    chain: "evm",
    pattern: /deadline|slippage|minAmount|amountOutMin/i,
    evidence: "Parameters controlling transaction execution bounds indicate MEV-sensitive operations.",
    impact: "MEV bots can sandwich transactions for profit extraction, causing users to receive worse execution prices.",
    remediation: "Use commit-reveal schemes, enforce tight deadlines, require minimum output amounts, and consider private mempools.",
    confidence: 0.48
  },
  {
    id: "evm-integer-overflow",
    title: "Unchecked arithmetic block may cause overflow",
    severity: "medium",
    chain: "evm",
    pattern: /unchecked\s*\{/,
    evidence: "Unchecked blocks bypass Solidity 0.8+ overflow protection for gas optimization.",
    impact: "Integer overflow or underflow can corrupt accounting state, mint excess tokens, or bypass balance checks.",
    remediation: "Minimize unchecked blocks, add explicit bounds validation, and use SafeMath for critical accounting.",
    confidence: 0.42
  },
  {
    id: "evm-tx-origin",
    title: "tx.origin used for authorization is spoofable",
    severity: "high",
    chain: "evm",
    pattern: /tx\.origin/,
    evidence: "tx.origin returns the externally-owned account that initiated the transaction chain.",
    impact: "tx.origin can be spoofed through intermediate contract calls, enabling phishing attacks on authorized users.",
    remediation: "Replace tx.origin with msg.sender for all authorization checks. Never use tx.origin for access control.",
    confidence: 0.72
  },
  {
    id: "evm-selfdestruct",
    title: "selfdestruct can destroy contract and force-send ETH",
    severity: "critical",
    chain: "evm",
    pattern: /selfdestruct|suicide/,
    evidence: "selfdestruct permanently removes contract code and forcibly sends remaining ETH to a target.",
    impact: "Contract destruction breaks all dependent protocols, and force-sent ETH can corrupt balance-dependent logic.",
    remediation: "Remove selfdestruct entirely. Use withdrawal patterns and pausable contracts for emergency scenarios.",
    confidence: 0.78
  },
  {
    id: "evm-timestamp-dependence",
    title: "Block timestamp used in security-sensitive logic",
    severity: "low",
    chain: "evm",
    pattern: /block\.timestamp|block\.number/,
    evidence: "Block timestamps and numbers are partially controlled by miners/validators.",
    impact: "Miners can manipulate timestamps within bounds to influence time-dependent outcomes.",
    remediation: "Avoid tight timestamp constraints for critical logic. Use block numbers for ordering and allow timestamp tolerance.",
    confidence: 0.38
  },
  {
    id: "evm-uninitialized-storage",
    title: "Potential uninitialized storage pointer",
    severity: "medium",
    chain: "evm",
    pattern: /storage\s+\w+/,
    evidence: "Storage variables that are declared but not explicitly initialized may overlap with other state slots.",
    impact: "Uninitialized storage pointers can reference arbitrary slots, corrupting critical protocol state.",
    remediation: "Always explicitly initialize storage variables. Use memory for temporary data structures.",
    confidence: 0.50
  },
  {
    id: "solana-account-owner",
    title: "Account owner validation is missing or insufficient",
    severity: "critical",
    chain: "solana",
    pattern: /AccountInfo|account_info|next_account_info/i,
    evidence: "Solana programs receive accounts as input and must verify their owner program.",
    impact: "Attacker can pass accounts owned by different programs, hijacking state or redirecting funds.",
    remediation: "Verify account.owner matches the expected program ID for every account used in instruction processing.",
    confidence: 0.70
  },
  {
    id: "solana-signer-check",
    title: "Signer verification may be missing for authority accounts",
    severity: "high",
    chain: "solana",
    pattern: /is_signer|Signer<|SignerSeeds/i,
    evidence: "Signer verification ensures that the account holder authorized the transaction.",
    impact: "Missing signer checks allow anyone to invoke privileged instructions without authorization.",
    remediation: "Always verify is_signer is true for authority accounts. Use Anchor's Signer constraint where applicable.",
    confidence: 0.65
  },
  {
    id: "solana-arithmetic",
    title: "Arithmetic operations may overflow or panic",
    severity: "medium",
    chain: "solana",
    pattern: /checked_add|checked_sub|checked_mul|overflow|saturating/i,
    evidence: "Rust arithmetic operations can panic on overflow in debug mode or wrap in release mode.",
    impact: "Integer overflow in token calculations can mint excess tokens, corrupt balances, or cause program panics.",
    remediation: "Use checked_add, checked_sub, checked_mul for all arithmetic. Handle None results gracefully.",
    confidence: 0.45
  },
  {
    id: "evm-centralization-risk",
    title: "Single-owner governance creates centralization risk",
    severity: "medium",
    chain: "evm",
    pattern: /Ownable|onlyOwner|transferOwnership/,
    evidence: "Single-owner patterns concentrate control in one address with no checks or delays.",
    impact: "Compromised owner key can drain funds, pause protocol, or upgrade to malicious implementation.",
    remediation: "Use multi-sig wallets, timelocks, and on-chain governance for all privileged operations.",
    confidence: 0.52
  },
  {
    id: "evm-reentrancy-read-only",
    title: "Read-only reentrancy risk in view functions",
    severity: "medium",
    chain: "evm",
    pattern: /view.*external|pure.*external/,
    evidence: "View functions reading shared state can return stale values during reentrancy.",
    impact: "Read-only reentrancy can manipulate price feeds and oracle calculations in same-block attacks.",
    remediation: "Apply reentrancy guards even on view functions that read state shared with state-changing functions.",
    confidence: 0.48
  },
  {
    id: "solana-type-confusion",
    title: "Account type confusion through unsafe deserialization",
    severity: "high",
    chain: "solana",
    pattern: /AccountDeserialize|try_from_slice|deserialize/i,
    evidence: "Account deserialization without discriminator validation can interpret wrong account types.",
    impact: "Deserializing the wrong account type can corrupt program state, bypass access controls, or drain funds.",
    remediation: "Add 8-byte discriminator checks before deserialization. Validate account types match expected structure.",
    confidence: 0.60
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
  if (rule.id.includes("reentrancy-external")) return ["Attacker deploys receiver contract", "Receiver enters withdrawal function", "External call returns control to attacker", "Receiver re-enters before invariant is restored", "Protocol state is corrupted"];
  if (rule.id.includes("reentrancy-read-only")) return ["Attacker initiates state-changing transaction", "During callback, attacker calls view function", "View function returns stale pre-update values", "Dependent protocol uses stale price data", "Attacker profits from price discrepancy"];
  if (rule.id.includes("oracle")) return ["Attacker influences price source via flash loan", "Protocol reads manipulated spot price", "Attacker executes price-sensitive action at wrong price", "Protocol accounting moves value incorrectly"];
  if (rule.id.includes("flash-loan")) return ["Attacker borrows large capital via flash loan", "Attacker manipulates protocol state with borrowed funds", "Attacker extracts value from manipulated state", "Attacker repays flash loan in same transaction"];
  if (rule.id.includes("tx-origin")) return ["Attacker deploys phishing contract", "Authorized user interacts with phishing contract", "Phishing contract calls target with user's tx.origin", "Target grants attacker access using tx.origin check"];
  if (rule.id.includes("selfdestruct")) return ["Attacker gains access to selfdestruct function", "Contract code is permanently destroyed", "Dependent protocols lose access to functionality", "Force-sent ETH corrupts balance-dependent logic"];
  if (rule.id.includes("front-running")) return ["Attacker monitors mempool for pending transactions", "Attacker front-runs with higher gas price", "Original transaction executes at worse price", "Attacker back-runs to capture profit"];
  if (rule.id.includes("upgrade")) return ["Attacker compromises upgrade authority key", "Attacker proposes malicious implementation", "Upgrade executes without timelock delay", "All protocol funds are redirectable"];
  if (rule.id.includes("centralization")) return ["Single owner key is compromised or coerced", "Attacker executes privileged functions", "Protocol parameters are changed maliciously", "User funds are at risk without governance protection"];
  if (rule.id.includes("account-owner")) return ["Attacker creates account under different program", "Instruction receives attacker-controlled account", "Program skips owner validation", "Attacker redirects authority or drains funds"];
  if (rule.id.includes("type-confusion")) return ["Attacker creates account with matching data layout", "Program deserializes without discriminator check", "Wrong account type is interpreted as valid", "Program state is corrupted or bypassed"];
  if (rule.id.includes("signer")) return ["Attacker prepares unsigned instruction", "Program does not verify signer flag", "Unauthorized transaction is processed", "Attacker modifies privileged state"];
  if (family === "solana") return ["Attacker prepares substitute accounts", "Instruction receives attacker-controlled account metas", "Program misses canonical validation", "State or authority is redirected"];
  return ["Attacker identifies privileged or state-changing entrypoint", "Attacker satisfies weak preconditions", "Protocol accepts transaction", "Security guarantee is violated"];
}

function buildPocSketch(rule: DetectorRule, file: string): string {
  if (rule.chain === "solana") return `Create a Solana program-test case that supplies adversarial accounts against ${file} and asserts account ownership or authority drift.`;
  if (rule.id.includes("flash-loan")) return `Create a Foundry test that uses a flash loan to manipulate state in ${file}, then asserts accounting invariant violation.`;
  if (rule.id.includes("reentrancy")) return `Create a Foundry test with a malicious receiver contract that re-enters ${file} and asserts balance drain.`;
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
