import type { Evidence, Finding, FindingContext, ProtocolInput, Severity, SourceFile } from "./types.ts";
import { clampConfidence, confidenceBand, evidenceAt, lineEvidence, stableId } from "./utils.ts";
import { checksCaller, enclosingFunction, indexSolidity, matchBrace, stateWrites, stripComments, type SolidityFunction, type SolidityIndex } from "./solidity.ts";
import { discoverAnchor } from "./anchor.ts";

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
  /** Only fire when the match sits in a state-changing (non view/pure), non-library function. */
  stateChangingOnly?: boolean;
}

/**
 * Pattern rules. Matched against source with comments and string contents blanked, so a word in a
 * comment neither triggers nor silences a rule. Function-level reasoning lives in the structural
 * detectors below.
 */
const RULES: DetectorRule[] = [
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
    confidence: 0.6,
    stateChangingOnly: true
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
    id: "evm-oracle-manipulation",
    title: "Price is read from AMM spot reserves and can be moved inside one transaction",
    severity: "high",
    chain: "evm",
    pattern: /\.getReserves\s*\(|\.slot0\s*\(|\.get_dy\s*\(|\.getAmountsOut\s*\(/,
    suppressIf: /\.observe\s*\(|\bconsult\s*\(|OracleLibrary|\btwap\b|TWAP|latestRoundData/,
    evidence: "Spot reserves, slot0, and router quotes reflect the pool state at this instant, which a flash loan can set.",
    impact: "An attacker borrows, skews the pool, triggers the price-sensitive action at the fake price, and repays in the same transaction.",
    remediation: "Use a TWAP (Uniswap v3 observe / OracleLibrary.consult) or a Chainlink feed with freshness checks, and bound deviations between sources.",
    confidence: 0.62
  }
];

const EXTERNAL_CALL = /\.call\s*\{|\.call\s*\.\s*value\s*\(|\.call\s*\(|\.safeTransferFrom\s*\(|\b_safeMint\s*\(|\.functionCallWithValue\s*\(/g;
const PRIVILEGED_STATE = /owner|admin|governor|guardian|implementation|treasury|feeRecipient|oracle|paused|minter|operator/i;
const PRIVILEGED_CALL = /\bselfdestruct\s*\(|\bupgradeTo(AndCall)?\s*\(|\b_setImplementation\s*\(|\b_upgradeTo\w*\s*\(/;

interface ContractInfo { name: string; bases: string[]; functions: Map<string, SolidityFunction[]> }
interface ProjectRegistry { modifiers: Map<string, SolidityFunction[]>; contracts: Map<string, ContractInfo> }
let registry: ProjectRegistry = { modifiers: new Map(), contracts: new Map() };

/** Index every Solidity source together so modifiers and parent contracts resolve across files. */
function buildRegistry(sources: SourceFile[]): ProjectRegistry {
  const reg: ProjectRegistry = { modifiers: new Map(), contracts: new Map() };
  for (const source of sources) {
    if (!isSolidity(source)) continue;
    const index = indexSolidity(source.content);
    for (const fn of index.functions) if (fn.kind === "modifier") reg.modifiers.set(fn.name, [...(reg.modifiers.get(fn.name) ?? []), fn]);
    for (const match of index.code.matchAll(/\b(?:abstract\s+)?(contract|library|interface)\s+([A-Za-z_]\w*)(?:\s+is\s+([^{]+))?\s*\{/g)) {
      const open = (match.index ?? 0) + match[0].length - 1;
      const close = matchBrace(index.code, open);
      const info: ContractInfo = {
        name: match[2] ?? "",
        bases: (match[3] ?? "").replace(/\([^)]*\)/g, "").split(",").map((b) => b.trim()).filter(Boolean),
        functions: new Map()
      };
      for (const fn of index.functions) {
        if (fn.bodyStart > open && fn.bodyStart < close && enclosingContractOpen(index.code, fn.bodyStart) === open) info.functions.set(fn.name, [...(info.functions.get(fn.name) ?? []), fn]);
      }
      reg.contracts.set(info.name, info);
    }
  }
  return reg;
}

function enclosingContractOpen(code: string, offset: number): number {
  let best = -1;
  for (const match of code.matchAll(/\b(?:contract|library|interface)\s+[A-Za-z_]\w*[^{]*\{/g)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    if (open < offset && matchBrace(code, open) > offset) best = open;
  }
  return best;
}

/** A modifier defined in the project counts as a guard only when its body checks the caller. Unknown (imported, not supplied) modifiers are assumed to guard. */
function modifierGuards(name: string): boolean {
  const defs = registry.modifiers.get(name);
  if (!defs?.length) return true;
  return defs.some((def) => checksCaller(def) || (/\brequire\s*\(|\brevert\b/.test(def.body) && /\b(owner|admin|governor|role|authori)/i.test(def.body)));
}

/** "yes": a parent override guards it. "no": every parent resolved and none guards. "unknown": a base is missing from the supplied sources. */
function parentGuard(fnName: string, owner: string | undefined, seen = new Set<string>()): "yes" | "no" | "unknown" {
  const info = owner ? registry.contracts.get(owner) : undefined;
  if (!info) return "unknown";
  let result: "yes" | "no" | "unknown" = "no";
  for (const base of info.bases) {
    if (seen.has(base)) continue;
    seen.add(base);
    const parent = registry.contracts.get(base);
    if (!parent) { result = "unknown"; continue; }
    const impls = parent.functions.get(fnName) ?? [];
    for (const impl of impls) {
      if (accessModifiers(impl).length || checksCaller(impl)) return "yes";
      if (/\bsuper\s*\.\s*\w+\s*\(/.test(impl.body)) {
        const up = parentGuard(fnName, base, seen);
        if (up === "yes") return "yes";
        if (up === "unknown") result = "unknown";
      }
    }
    const up = impls.length ? "no" : parentGuard(fnName, base, seen);
    if (up === "yes") return "yes";
    if (up === "unknown") result = "unknown";
  }
  return result;
}

function ownerOf(fn: SolidityFunction, source: SourceFile): string | undefined {
  const index = indexSolidity(source.content);
  const open = enclosingContractOpen(index.code, fn.bodyStart);
  if (open < 0) return undefined;
  const m = /(?:contract|library|interface)\s+([A-Za-z_]\w*)[^{]*$/.exec(index.code.slice(0, open + 1));
  return m?.[1];
}

export function discoverVulnerabilities(input: ProtocolInput): Finding[] {
  const chainFamily = input.chain === "solana" ? "solana" : "evm";
  registry = buildRegistry(input.sources);
  const findings: Finding[] = [];
  for (const source of input.sources) {
    const stripped = stripComments(source.content);
    for (const rule of RULES) {
      if (rule.chain !== "all" && rule.chain !== chainFamily) continue;
      if (rule.requires && !rule.requires.test(stripped)) continue;
      if (rule.suppressIf && rule.suppressIf.test(stripped)) continue;
      const mitigated = rule.mitigatedBy && rule.mitigatedBy.pattern.test(stripped) ? rule.mitigatedBy : undefined;
      const evidence = rule.stateChangingOnly && isSolidity(source)
        ? stateChangingEvidence(source, stripped, rule)
        : lineEvidence(source.path, source.content, rule.pattern, rule.evidence, stripped, rule.id);
      if (!evidence) continue;
      const confidence = clampConfidence(rule.confidence + (source.content.length > 1000 ? 0.05 : 0) - (mitigated?.penalty ?? 0));
      findings.push(makeFinding({
        detector: rule.id,
        title: rule.title,
        severity: rule.severity,
        impact: rule.impact,
        remediation: rule.remediation,
        confidence,
        evidence: [evidence],
        chain: chainFamily,
        file: source.path,
        mitigations: mitigated ? [mitigated.label] : undefined
      }));
    }
    if (chainFamily === "evm" && isSolidity(source)) findings.push(...structuralEvm(source));
    if (chainFamily === "solana" && isRust(source)) findings.push(...discoverAnchor(source).map((item) => makeFinding({ ...item, chain: "solana", file: source.path })));
  }
  return dedupe(findings);
}

/** First match of the rule that sits in a state-changing, non-library function. Verifying a signature in a view helper cannot be replayed. */
function stateChangingEvidence(source: SourceFile, stripped: string, rule: DetectorRule): Evidence | undefined {
  const index = indexSolidity(source.content);
  const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g");
  for (const match of stripped.matchAll(global)) {
    const fn = enclosingFunction(index, match.index ?? 0);
    if (!fn || fn.inLibrary || fn.mutability === "view" || fn.mutability === "pure") continue;
    return evidenceAt(source.path, source.content, index.lineAt(match.index ?? 0), rule.evidence, "srp-pattern", rule.id, "observed");
  }
  return undefined;
}

export function isSolidity(source: SourceFile): boolean {
  return source.language === "solidity" || source.path.endsWith(".sol");
}

export function isRust(source: SourceFile): boolean {
  return source.language === "rust" || source.path.endsWith(".rs");
}

interface FindingDraft {
  detector: string;
  title: string;
  severity: Severity;
  impact: string;
  remediation: string;
  confidence: number;
  evidence: Evidence[];
  chain: "evm" | "solana";
  file: string;
  mitigations?: string[];
  context?: FindingContext;
  attackPath?: string[];
}

function makeFinding(draft: FindingDraft): Finding {
  const first = draft.evidence[0];
  const id = stableId("finding", `${draft.detector}:${draft.file}:${first?.startLine}:${first?.excerpt}`);
  const confidence = clampConfidence(draft.confidence);
  return {
    id,
    title: draft.title,
    severity: draft.severity,
    proposedSeverity: draft.severity,
    impact: draft.impact,
    likelihood: confidence >= 0.65 ? "Likely when the cited flow is externally reachable." : "Plausible; reachability and guards require validation.",
    attackPath: draft.attackPath ?? buildAttackPath(draft.detector, draft.chain),
    exploitability: "Not proven. Run the generated harness locally and attach the result to prove it.",
    proofOfConcept: draft.chain === "solana"
      ? `Write an anchor test or solana-program-test case against ${draft.file} that passes adversarial accounts and asserts the state change.`
      : `Write a Foundry test against ${draft.file} that runs the attack path and asserts balance or accounting deltas.`,
    remediation: draft.remediation,
    confidence,
    confidenceBand: confidenceBand(confidence),
    evidence: draft.evidence,
    status: "candidate",
    detector: draft.detector,
    ...(draft.mitigations?.length ? { mitigations: draft.mitigations } : {}),
    ...(draft.context ? { context: draft.context } : {})
  };
}

const NON_ACCESS_MODIFIER = /^(nonReentrant|noReentrancy|lock|whenNotPaused|whenPaused|notDelegated|onlyProxy|nonpayable)$/;

/** Modifiers that can restrict who calls. Reentrancy locks and pause switches do not. */
function accessModifiers(fn: SolidityFunction): string[] {
  return fn.modifiers.filter((modifier) => !NON_ACCESS_MODIFIER.test(modifier) && modifierGuards(modifier));
}

function isEntrypoint(fn: SolidityFunction): boolean {
  return fn.kind !== "modifier" && fn.kind !== "constructor" && (fn.visibility === "public" || fn.visibility === "external");
}

function structuralEvm(source: SourceFile): Finding[] {
  const index = indexSolidity(source.content);
  const out: Finding[] = [];
  for (const fn of index.functions) {
    if (fn.kind === "modifier" || fn.mutability === "view" || fn.mutability === "pure") continue;
    const reentrancy = reentrancyFinding(source, index, fn);
    if (reentrancy) out.push(reentrancy);
    const access = accessControlFinding(source, index, fn);
    if (access) out.push(access);
    const delegate = delegatecallFinding(source, index, fn);
    if (delegate) out.push(delegate);
    const arbitrary = arbitraryCallFinding(source, index, fn);
    if (arbitrary) out.push(arbitrary);
  }
  return out;
}

function context(fn: SolidityFunction, facts: string[]): FindingContext {
  return { function: fn.name, visibility: fn.visibility, modifiers: fn.modifiers, facts };
}

/** Checks-effects-interactions: an external call followed, in the same function, by a write to contract state. */
function reentrancyFinding(source: SourceFile, index: SolidityIndex, fn: SolidityFunction): Finding | undefined {
  const calls = [...fn.body.matchAll(EXTERNAL_CALL)].map((match) => fn.bodyStart + (match.index ?? 0));
  if (!calls.length) return undefined;
  const writes = stateWrites(fn, index.stateVariables);
  const firstCall = calls[0] ?? 0;
  // A variable set before the call and restored after it is a lock or execution-context pattern, not a stale-state bug.
  const lateWrite = writes.find((write) => write.offset > firstCall && !writes.some((early) => early.variable === write.variable && early.offset < firstCall));
  if (!lateWrite) return undefined;
  const callLine = index.lineAt(firstCall);
  const writeLine = index.lineAt(lateWrite.offset);
  const guarded = fn.modifiers.some((modifier) => /nonReentrant|noReentrancy|lock/i.test(modifier));
  const reachable = isEntrypoint(fn);
  const restricted = accessModifiers(fn).length > 0 || checksCaller(fn);
  const facts = [
    `${fn.name} is ${fn.visibility}${!reachable ? ", reachable only through other functions" : restricted ? `, restricted (${fn.modifiers.join(", ") || "caller check in body"})` : ", callable by anyone"} (L${fn.startLine})`,
    `external call at L${callLine} hands control to the callee`,
    `state variable ${lateWrite.variable} is written at L${writeLine}, after the call`,
    guarded ? `${fn.name} carries a reentrancy guard modifier (${fn.modifiers.join(", ")})` : `${fn.name} has no reentrancy guard modifier`
  ];
  let confidence = 0.74;
  if (!reachable) confidence -= 0.2;
  if (restricted) confidence -= 0.15;
  if (guarded) confidence -= 0.3;
  return makeFinding({
    detector: "evm-reentrancy-external-call",
    title: `Reentrancy: ${fn.name} writes ${lateWrite.variable} after an external call`,
    severity: "high",
    impact: "The callee can re-enter before state is updated and repeat the flow against stale balances or accounting.",
    remediation: `Move the write to ${lateWrite.variable} before the external call (checks-effects-interactions) and add nonReentrant to value-moving entrypoints.`,
    confidence,
    chain: "evm",
    file: source.path,
    evidence: [
      evidenceAt(source.path, source.content, callLine, "External call transfers control before state is final.", "srp-structural", "evm-reentrancy-external-call", "observed"),
      evidenceAt(source.path, source.content, writeLine, `State write to ${lateWrite.variable} happens after the external call.`, "srp-structural", "evm-reentrancy-external-call", "derived")
    ],
    mitigations: guarded ? [`Function-level reentrancy guard (${fn.modifiers.filter((m) => /nonReentrant|noReentrancy|lock/i.test(m)).join(", ")}) on ${fn.name}`] : undefined,
    context: context(fn, facts),
    attackPath: [
      "Attacker deploys a contract whose receive/fallback or token hook calls back",
      `Attacker calls ${fn.name}`,
      `At L${callLine} control passes to the attacker contract before ${lateWrite.variable} is updated`,
      `Attacker re-enters ${fn.name} and the check passes again against the stale ${lateWrite.variable}`
    ]
  });
}

/** Public state-changing function that sets privileged state or runs a privileged call with no caller check. */
function accessControlFinding(source: SourceFile, index: SolidityIndex, fn: SolidityFunction): Finding | undefined {
  if (!isEntrypoint(fn) && !(fn.name === "_authorizeUpgrade")) return undefined;
  if (accessModifiers(fn).length || checksCaller(fn)) return undefined;
  // An override that defers to super inherits the parent's check. Skip unless every parent resolved and none guards.
  if (/\bsuper\s*\.\s*\w+\s*\(/.test(fn.body) && parentGuard(fn.name, ownerOf(fn, source)) !== "no") return undefined;
  if (fn.name === "_authorizeUpgrade") {
    const line = fn.startLine;
    return makeFinding({
      detector: "evm-unprotected-upgrade",
      title: "UUPS _authorizeUpgrade has no access check",
      severity: "critical",
      impact: "Anyone can upgrade the proxy to their own implementation and take every asset it holds.",
      remediation: "Add onlyOwner (or an equivalent role check) to _authorizeUpgrade.",
      confidence: 0.78,
      chain: "evm",
      file: source.path,
      evidence: [evidenceAt(source.path, source.content, line, "_authorizeUpgrade has no modifier and no msg.sender check.", "srp-structural", "evm-unprotected-upgrade", "observed")],
      context: context(fn, [`_authorizeUpgrade at L${line} has no modifiers`, "body never checks msg.sender"]),
      attackPath: ["Attacker deploys a malicious implementation", "Attacker calls upgradeToAndCall on the proxy", "_authorizeUpgrade accepts", "Proxy now runs attacker code"]
    });
  }
  // Writes keyed by the caller (isOperator[msg.sender][x] = ...) only change the caller's own settings.
  const write = stateWrites(fn, index.stateVariables).find((item) => PRIVILEGED_STATE.test(item.variable) && !/^\w+\[(msg\.sender|_msgSender\(\))\]/.test(item.target));
  const call = fn.body.match(PRIVILEGED_CALL);
  if (!write && !call) return undefined;
  const offset = write ? write.offset : fn.bodyStart + (call?.index ?? 0);
  const line = index.lineAt(offset);
  const what = write ? `writes privileged state ${write.variable}` : `calls ${call?.[0].replace(/\s*\($/, "")}`;
  return makeFinding({
    detector: "evm-missing-access-control",
    title: `Missing access control: ${fn.name} ${what}`,
    severity: "high",
    impact: "Any account can call it and take over ownership, configuration, or funds.",
    remediation: `Restrict ${fn.name} with onlyOwner / AccessControl, or an initializer modifier if it is a one-time setup function.`,
    confidence: /^(init|initialize|setup)/i.test(fn.name) ? 0.72 : 0.68,
    chain: "evm",
    file: source.path,
    evidence: [
      evidenceAt(source.path, source.content, fn.startLine, `${fn.name} is ${fn.visibility} with no modifiers.`, "srp-structural", "evm-missing-access-control", "observed"),
      evidenceAt(source.path, source.content, line, `${fn.name} ${what} without checking msg.sender.`, "srp-structural", "evm-missing-access-control", "derived")
    ],
    context: context(fn, [`${fn.name} is ${fn.visibility} with no modifiers (L${fn.startLine})`, `body never compares msg.sender`, `L${line}: ${what}`]),
    attackPath: ["Attacker finds the unguarded function", `Attacker calls ${fn.name}`, `Contract ${what}`, "Attacker controls the privileged role or asset"]
  });
}

/** delegatecall whose target comes straight from a function parameter. */
function delegatecallFinding(source: SourceFile, index: SolidityIndex, fn: SolidityFunction): Finding | undefined {
  if (!isEntrypoint(fn)) return undefined;
  for (const match of fn.body.matchAll(/([A-Za-z_]\w*)\s*\.delegatecall\s*\(/g)) {
    const target = match[1] ?? "";
    if (!fn.params.includes(target)) continue;
    if (accessModifiers(fn).length || checksCaller(fn)) continue;
    const line = index.lineAt(fn.bodyStart + (match.index ?? 0));
    return makeFinding({
      detector: "evm-arbitrary-delegatecall",
      title: `Arbitrary delegatecall: ${fn.name} delegates to caller-supplied ${target}`,
      severity: "critical",
      impact: "The caller runs any code in this contract's storage context: overwrite owner, drain balances, or selfdestruct.",
      remediation: "Never delegatecall to a user-supplied address. Use an allowlist of audited implementations behind access control.",
      confidence: 0.8,
      chain: "evm",
      file: source.path,
      evidence: [evidenceAt(source.path, source.content, line, `delegatecall target ${target} is a parameter of ${fn.name}.`, "srp-structural", "evm-arbitrary-delegatecall", "observed")],
      context: context(fn, [`${fn.name} is ${fn.visibility} with no access check`, `L${line}: delegatecall to parameter ${target}`]),
      attackPath: ["Attacker deploys a contract that writes storage slot 0", `Attacker calls ${fn.name} with that address`, "Code runs in this contract's storage", "Attacker becomes owner or drains funds"]
    });
  }
  return undefined;
}

/** A call where both the target and the calldata come from the caller (Truster-style). The contract becomes the caller's proxy. */
function arbitraryCallFinding(source: SourceFile, index: SolidityIndex, fn: SolidityFunction): Finding | undefined {
  if (!isEntrypoint(fn) || accessModifiers(fn).length || checksCaller(fn)) return undefined;
  const patterns = [
    /([A-Za-z_]\w*)\s*\.functionCall(?:WithValue)?\s*\(\s*([A-Za-z_]\w*)/g,
    /([A-Za-z_]\w*)\s*\.call(?:\{[^}]*\})?\s*\(\s*([A-Za-z_]\w*)\s*\)/g,
    /Address\.functionCall(?:WithValue)?\s*\(\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)/g
  ];
  for (const pattern of patterns) {
    for (const match of fn.body.matchAll(pattern)) {
      const target = match[1] ?? "";
      const data = match[2] ?? "";
      if (!fn.params.includes(target) || !fn.params.includes(data)) continue;
      const line = index.lineAt(fn.bodyStart + (match.index ?? 0));
      return makeFinding({
        detector: "evm-arbitrary-external-call",
        title: `Arbitrary call: ${fn.name} calls caller-chosen ${target} with caller-chosen ${data}`,
        severity: "critical",
        impact: "The contract makes any call the attacker wants as itself: approve its tokens to the attacker, transfer them, or call privileged functions that trust it.",
        remediation: "Do not forward arbitrary calls. Allowlist targets and selectors, or call a fixed interface method (e.g. a flash loan receiver callback) instead.",
        confidence: 0.78,
        chain: "evm",
        file: source.path,
        evidence: [evidenceAt(source.path, source.content, line, `${target} and ${data} are both parameters of ${fn.name}.`, "srp-structural", "evm-arbitrary-external-call", "observed")],
        context: context(fn, [`${fn.name} is ${fn.visibility} with no access check (L${fn.startLine})`, `L${line}: call target ${target} and calldata ${data} both come from the caller`]),
        attackPath: ["Attacker encodes token.approve(attacker, max) as calldata", `Attacker calls ${fn.name} with target = token`, "Contract approves the attacker as itself", "Attacker pulls the contract's tokens with transferFrom"]
      });
    }
  }
  return undefined;
}

function buildAttackPath(detector: string, family: "evm" | "solana"): string[] {
  if (detector.includes("signature-replay")) return ["Attacker observes a valid signed payload on-chain or in the mempool", "Attacker resubmits the same signature", "Contract verifies the signer again", "The signed action runs twice"];
  if (detector.includes("donation")) return ["Attacker deposits a minimal amount into an empty vault", "Attacker transfers tokens directly to the vault", "Share price jumps without new shares", "Next depositor's shares round down and value moves to the attacker"];
  if (detector.includes("tx-origin")) return ["Attacker deploys a contract the owner will call", "Owner calls it", "Contract calls the protocol while tx.origin is the owner", "Privileged action runs for the attacker"];
  if (detector.includes("oracle-manipulation")) return ["Attacker flash-borrows the pool asset", "Attacker swaps to skew reserves", "Protocol reads the skewed spot price", "Attacker profits and repays in the same transaction"];
  if (detector.includes("oracle")) return ["Feed stops updating or reports an old round", "Protocol reads the stale answer", "Attacker trades against the outdated price", "Protocol accounting moves value incorrectly"];
  if (family === "solana") return ["Attacker prepares substitute accounts", "Instruction receives attacker-controlled account metas", "Program misses canonical validation", "State or authority is redirected"];
  return ["Attacker identifies privileged or state-changing entrypoint", "Attacker satisfies weak preconditions", "Protocol accepts transaction", "Security guarantee is violated"];
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
