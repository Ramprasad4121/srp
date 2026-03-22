# === SKILL: audit-firm-1-solidity-auditor ===

---
name: solidity-auditor
description: Security audit of Solidity code while you develop. Trigger on "audit", "check this contract", "review for security". Modes - default (full repo), DEEP (+ adversarial reasoning), or a specific filename.
---

# Smart Contract Security Audit

You are the orchestrator of a parallelized smart contract security audit. Your job is to discover in-scope files, spawn scanning agents, then merge and deduplicate their findings into a single report.

## Mode Selection

**Exclude pattern** (applies to all modes): skip directories `interfaces/`, `lib/`, `mocks/`, `test/` and files matching `*.t.sol`, `*Test*.sol` or `*Mock*.sol`.

- **Default** (no arguments): scan all `.sol` files using the exclude pattern. Use Bash `find` (not Glob) to discover files.
- **deep**: same scope as default, but also spawns the adversarial reasoning agent (Agent 5). Use for thorough reviews. Slower and more costly.
- **`$filename ...`**: scan the specified file(s) only.

**Flags:**

- `--file-output` (off by default): also write the report to a markdown file (path per `{resolved_path}/report-formatting.md`). Without this flag, output goes to the terminal only. Never write a report file unless the user explicitly passes `--file-output`.

## Version Check

After printing the banner, run two parallel tool calls: (a) Read the local `VERSION` file from the same directory as this skill, (b) Bash `curl -sf https://raw.githubusercontent.com/audit-skills/main/solidity-auditor/VERSION`. If the remote fetch succeeds and the versions differ, print:

> ⚠️ You are not using the latest version. Please upgrade for best security coverage. See https://github.com/audit-skills#install--run

Then continue normally. If the fetch fails (offline, timeout), skip silently.

## Orchestration

**Turn 1 — Discover.** Print the banner, then in the same message make parallel tool calls: (a) Bash `find` for in-scope `.sol` files per mode selection, (b) Glob for `**/references/attack-vectors/attack-vectors-1.md` and extract the `references/` directory path (two levels up). Use this resolved path as `{resolved_path}` for all subsequent references.

**Turn 2 — Prepare.** In a single message, make three parallel tool calls: (a) Read `{resolved_path}/agents/vector-scan-agent.md`, (b) Read `{resolved_path}/report-formatting.md`, (c) Bash: create four per-agent bundle files (`/tmp/audit-agent-{1,2,3,4}-bundle.md`) in a **single command** — each concatenates **all** in-scope `.sol` files (with `### path` headers and fenced code blocks), then `{resolved_path}/judging.md`, then `{resolved_path}/report-formatting.md`, then `{resolved_path}/attack-vectors/attack-vectors-N.md`; print line counts. Every agent receives the full codebase — only the attack-vectors file differs per agent. Do NOT read or inline any file content into agent prompts — the bundle files replace that entirely.

**Turn 3 — Spawn.** In a single message, spawn all agents as parallel foreground Agent tool calls (do NOT use `run_in_background`). Always spawn Agents 1–4. Only spawn Agent 5 when the mode is **DEEP**.

- **Agents 1–4** (vector scanning) — spawn with `model: "sonnet"`. Each agent prompt must contain the full text of `vector-scan-agent.md` (read in Turn 2, paste into every prompt). After the instructions, add: `Your bundle file is /tmp/audit-agent-N-bundle.md (XXXX lines).` (substitute the real line count).
- **Agent 5** (adversarial reasoning, DEEP only) — spawn with `model: "opus"`. Receives the in-scope `.sol` file paths and the instruction: your reference directory is `{resolved_path}`. Read `{resolved_path}/agents/adversarial-reasoning-agent.md` for your full instructions.

**Turn 4 — Report.** Merge all agent results: deduplicate by root cause (keep the higher-confidence version), sort by confidence highest-first, re-number sequentially, and insert the **Below Confidence Threshold** separator row. Print findings directly — do not re-draft or re-describe them. Use report-formatting.md (read in Turn 2) for the scope table and output structure. If `--file-output` is set, write the report to a file (path per report-formatting.md) and print the path.

## Banner

Before doing anything else, print this exactly:

```

██████╗  █████╗ ███████╗██╗  ██╗ ██████╗ ██╗   ██╗     ███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
██╔══██╗██╔══██╗██╔════╝██║  ██║██╔═══██╗██║   ██║     ██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝
██████╔╝███████║███████╗███████║██║   ██║██║   ██║     ███████╗█████╔╝ ██║██║     ██║     ███████╗
██╔═══╝ ██╔══██║╚════██║██╔══██║██║   ██║╚██╗ ██╔╝     ╚════██║██╔═██╗ ██║██║     ██║     ╚════██║
██║     ██║  ██║███████║██║  ██║╚██████╔╝ ╚████╔╝      ███████║██║  ██╗██║███████╗███████╗███████║
╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝   ╚═══╝       ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝

```


# === END SKILL: audit-firm-1-solidity-auditor ===

# === SKILL: quillai-bsa ===

---
name: behavioral-state-analysis
description: Token-efficient smart contract security auditing via Behavioral State Analysis (BSA). Scopes analysis to contract type, runs only relevant threat engines, and uses tiered output depth. Use for auditing smart contracts, security reviews, or DeFi threat modeling.
---

# Behavioral State Analysis (BSA)

Audit smart contracts by extracting behavioral intent, then systematically breaking it across security dimensions.

## When to Use

- Smart contract security audits
- DeFi protocol threat modeling (DEXs, lending, staking, vaults)
- Cross-contract attack surface analysis
- Vulnerability prioritization with confidence scoring

## When NOT to Use

- Pure context building (use audit-context-building)
- Entry point identification only (use entry-point-analyzer)
- Single-dimension only (use semantic-guard-analysis or state-invariant-detection)

## Token Budget Rules

**Follow these strictly to avoid context exhaustion:**

1. **Be terse.** Use bullet points and tables, not prose. No filler sentences.
2. **Smart scope first.** Classify the contract type in Phase 1, then run ONLY relevant engines in Phase 2 (see engine selection matrix below).
3. **Tiered output depth:**
   - Critical/High findings → full detail + PoC code
   - Medium findings → root cause + exploit scenario (no PoC)
   - Low/Info findings → one-line description only
4. **No redundant analysis.** If a dimension has no attack surface (e.g., no value flows = skip ETE), say "N/A" and move on.
5. **Cap Phase 1 output** to ≤30 lines per contract. List invariants and states, skip verbose specification documents.
6. **PoC generation** only for Critical and High severity findings. For others, describe the exploit path in ≤3 steps.
7. **Combine phases in output** — don't repeat findings across phases. Each finding appears once with all metadata inline.

## Pipeline

### Phase 1: Behavioral Decomposition (keep brief)

Extract intent from code and docs. Output per contract:

```
Contract: <Name>
Type: <DeFi/Token/Governance/NFT/Utility/Proxy>
States: [list]
Key Invariants (≤5):
  - <invariant>
Privileged Roles: [list]
Value Entry/Exit Points: [list or "none"]
```

**Then select engines:**

| Contract Type | Run ETE | Run ACTE | Run SITE |
|--------------|---------|----------|----------|
| DeFi (DEX/lending/vault/staking) | Yes | Yes | Yes |
| Token (ERC20/721/1155) | Yes | Lite | Lite |
| Governance/DAO | Lite | Yes | Yes |
| NFT marketplace | Yes | Yes | Lite |
| Utility/Library | No | Lite | Lite |
| Proxy/Upgradeable | No | Yes | Yes |

**Lite** = check only the top-priority item for that engine (see below).

### Phase 2: Threat Modeling (selected engines only)

Run only the engines selected above. For each engine, analyze in this priority order — stop if contract surface is exhausted:

**Economic Threat Engine (ETE):**
1. Value flow tracing — where can value enter/leave? Any sinks or circular flows?
2. Economic invariant verification — does `deposits == withdrawals + balance` hold?
3. Incentive analysis — any rational actor exploits (MEV, sandwich, griefing)?

**Access Control Threat Engine (ACTE):**
1. Unprotected privileged functions — any admin/owner actions callable by anyone?
2. Role escalation paths — can `User → [actions] → Admin`?
3. msg.sender vs tx.origin confusion; signature replay

**State Integrity Threat Engine (SITE):**
1. Non-atomic state updates — partial updates before external calls?
2. Sequence vulnerabilities — initialization bypass, unexpected call ordering?
3. Cross-contract stale data or reentrancy vectors

**Lite mode** = run only item #1 from that engine's list.

### Phase 3: Exploit Verification

For each hypothesis from Phase 2:
- Build attack sequence (≤5 steps)
- For Critical/High: generate minimal Foundry/Hardhat PoC (keep code short — test the specific vuln, not a full test suite)
- Quantify impact: Critical (all funds/system) | High (significant loss/privesc) | Medium (griefing/DOS) | Low (info/best practice)

### Phase 4: Score & Prioritize

Score: `Confidence = (Evidence × Feasibility × Impact) / FP_Rate`

| Factor | 1.0 | 0.7 | 0.4 | 0.1 |
|--------|-----|-----|-----|-----|
| Evidence | Concrete path, no deps | Specific state needed | Pattern-based | Heuristic |
| Feasibility | PoC confirmed | Achievable state | External conditions | Infeasible |

Impact: 5=total loss, 4=partial loss, 3=griefing, 2=info leak, 1=best practice
FP_Rate: 0.05 (known pattern) → 0.15 (moderate) → 0.40 (weak) → 0.60 (heuristic)

**Prioritization:** Report findings ≥10% confidence. Never suppress Impact ≥4.

## Finding Format (use for every finding)

```
### [F-N] Title
Severity: Critical|High|Medium|Low  |  Confidence: X%
Location: contract.sol#L10-L25, functionName()
Root Cause: <1-2 sentences>
Exploit: <numbered steps, ≤5>
Impact: <1 sentence with quantified risk>
Fix: <code diff or 1-2 sentence recommendation>
PoC: <only for Critical/High — minimal test code>
```

## Advanced Checks (run only if relevant to contract type)

- **Cross-contract:** Map external call chains `A→B→C`, test transitive trust
- **Time-based:** `block.timestamp` manipulation, expired signatures, replay
- **Upgradeable:** Storage collisions, re-initialization, migration atomicity

## Mindset

- "Standard function" → can behave non-standardly in context
- "Admin is trusted" → model admin compromise, check excessive powers
- "Known pattern" → novel interactions in specific contexts
- "Small value" → compounds; griefing scales
- "Trusted external contract" → trust boundaries shift; verify actual code


# === END SKILL: quillai-bsa ===

# === SKILL: quillai-semantic-guard ===

---
name: semantic-guard-analysis
description: Detects logic vulnerabilities in smart contracts by analyzing guard-state consistency patterns. Identifies functions that bypass security checks (require, modifiers) that other functions consistently apply. Uses the Consistency Principle — a contract is its own specification. Use when auditing smart contracts for missing access controls, inconsistent pause checks, logic bugs, forgotten modifiers, or when traditional tools report no issues but logic errors may exist.
---

# Semantic Guard Analysis

Detect logic vulnerabilities by finding functions that **violate the contract's own internal guard patterns**. Unlike pattern-matching tools, this approach uses the contract's consistent behavior as its specification.

## When to Use

- Auditing smart contracts where traditional tools find nothing suspicious
- Looking for missing `require` checks, forgotten modifiers, inconsistent access control
- Analyzing contracts with emergency/admin functions that might bypass safety mechanisms
- Detecting logic bugs that are syntactically correct but semantically dangerous
- When you suspect "forgotten check" vulnerabilities

## When NOT to Use

- Pure state-state invariant analysis (use state-invariant-detection)
- Full multi-dimensional audit (use behavioral-state-analysis)
- Code quality or gas optimization reviews

## Core Principle: The Consistency Hypothesis

> **"A smart contract is its own specification."**

Instead of checking against external rules, analyze what the contract **claims to enforce**, then find where it **breaks its own rules**.

> If a critical state variable (like user balances) is protected by a security check (like a pause mechanism) in 90% of functions, the 10% without that check are likely vulnerabilities.

## The Three-Phase Detection Architecture

### Phase 1: AST Extraction & State Mapping

Parse the Solidity code and build a **State Interaction Matrix**.

**For each state variable, track every function that touches it:**

```
State Variable: balance
├─ deposit()        → [WRITE] + Guards: [paused, initialized]
├─ withdraw()       → [WRITE] + Guards: [paused, initialized]
├─ transfer()       → [WRITE] + Guards: [paused]
└─ emergencyWithdraw() → [WRITE] + Guards: [] ⚠️
```

**For each function-variable interaction, record:**

| Attribute | Description |
|-----------|-------------|
| Write Access | Does the function modify this variable? |
| Guard Access | Does the function check this variable in `require()` or `if()`? |
| Read Access | Does the function only read this variable? |

**Extract guard sources:**
- Modifier chains (`onlyOwner`, `nonReentrant`, `whenNotPaused`)
- Explicit `require` statements
- Conditional branches gating state changes
- External calls affecting state
- Event emissions signaling state changes

### Phase 2: Dependency Graph Construction

Build a mathematical model of how variables protect each other.

**Guard Relationship:** If Variable A is checked before Variable B is modified:

```
A → B (A guards B)
```

**Example:**

```
paused ──────┐
             ├──→ balance
initialized ─┘

owner ───→ paused
owner ───→ totalSupply
```

**Frequency Weighting:** Each guard relationship gets a confidence score:

```
Confidence(guard → state) = |functions applying guard| / |functions modifying state|
```

- `paused` guards `balance` in 9/10 functions → 90% confidence
- `owner` guards `totalSupply` in 3/10 functions → 30% confidence (weak)

**Composite Dependencies:** Track multi-variable guards:

```
(owner AND timeLock) → criticalFunction
(paused OR emergency) → userAccess
```

### Phase 3: Anomaly Detection (The Solver)

Identify functions that violate established patterns.

**Algorithm:**

```
For each state variable S that can be modified:
  1. M = all functions that write to S
  2. G = common guards across those functions (above threshold)
  3. V = M \ G (functions that modify without guards)
  4. V is the vulnerability set
```

**Threshold-Based Inference:**

| Guard Frequency | Classification | Action |
|-----------------|---------------|--------|
| ≥ 80% | Strong Invariant | Flag violations as HIGH/CRITICAL |
| 50-79% | Weak Invariant | Flag violations as MEDIUM |
| < 50% | No Pattern | Ignore (too inconsistent) |

**Severity Classification:**

| Bypass Type | Severity |
|-------------|----------|
| Strong invariant on financial state (`balance`, `totalSupply`) | **Critical** |
| Strong invariant on access control (`owner`, admin roles) | **High** |
| Weak invariant on any state | **Medium** |
| Inconsistent pattern with no security implications | **Low/Info** |

**Context-Aware Filtering:**
- Constructor and `initialize()` functions may legitimately bypass patterns
- `view`/`pure` functions cannot modify state — skip
- Proxy pattern `delegatecall` requires special handling
- Emergency functions may intentionally bypass some guards

## Workflow

```
Task Progress:
- [ ] Step 1: Parse contract AST and build State Interaction Matrix
- [ ] Step 2: Identify all state variables and their modifying functions
- [ ] Step 3: Map guards (requires, modifiers) for each function-state pair
- [ ] Step 4: Build dependency graph with frequency weighting
- [ ] Step 5: Run anomaly detection (identify V = M \ G)
- [ ] Step 6: Apply privilege overlay (filter legitimate bypasses)
- [ ] Step 7: Score and report findings
```

## Privilege Overlay System

Not all "bypasses" are vulnerabilities. Apply role-based filtering:

**Role Classification:**

| Role Level | Scrutiny | Rationale |
|------------|----------|-----------|
| Public functions | Highest | Must follow all established patterns |
| Owner/Admin functions | Medium | May bypass operational guards, must be consistent with each other |
| Emergency functions | Lower | Designed for exceptional cases |
| Internal functions | Context-dependent | Analyze based on callers |

**Filtering Rule:**

```
For each function f in vulnerability set V:
  1. Identify function privileges (modifiers, access controls)
  2. Compare with other functions at the SAME privilege level
  3. Flag only if bypass is inconsistent WITHIN privilege tier
```

## Output Format

```markdown
## Guard-State Anomaly Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L145`
**Severity:** [CRITICAL | HIGH | MEDIUM | LOW]
**Confidence:** [Percentage]

**Issue:** Modifies `[state variable]` without checking `[guard]`

**Pattern Evidence:**
- `function1()` checks `[guard]` before modifying `[state]` ✓
- `function2()` checks `[guard]` before modifying `[state]` ✓
- `functionName()` does NOT check `[guard]` before modifying `[state]` ✗

**Guard Frequency:** X out of Y functions (Z%)

**Security Impact:**
[Explanation of what an attacker can do by exploiting this inconsistency]

**Attack Scenario:**
1. [Step-by-step exploit]

**Recommendation:**
Add `require([guard], "[message]")` before modifying `[state]`,
or document why this function intentionally bypasses the check.
```

## Case Study: The "Forgotten Check"

```solidity
contract Vault {
    mapping(address => uint256) public balance;
    bool public paused;

    function deposit() public payable {
        require(!paused, "Contract paused");       // ✓ checks paused
        balance[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(!paused, "Contract paused");       // ✓ checks paused
        balance[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    function adminWithdraw(address user) public onlyOwner {
        // ✗ Missing paused check!
        uint256 amount = balance[user];
        balance[user] = 0;
        payable(owner).transfer(amount);
    }
}
```

**Detection:**

```
M_balance = {deposit, withdraw, adminWithdraw}
G_paused = {deposit, withdraw}
V = {adminWithdraw}

Result: adminWithdraw() modifies balance without checking paused
Confidence: 66.7% (2/3 functions check paused)
Severity: HIGH (financial state + admin bypass of safety mechanism)
```

For more case studies, see [{baseDir}/references/case-studies.md]({baseDir}/references/case-studies.md).
For the full detection algorithm, see [{baseDir}/references/detection-algorithm.md]({baseDir}/references/detection-algorithm.md).

## Rationalizations to Reject

- "The admin is trusted, so skipping the check is fine" → Compromised admin + missing pause check = unstoppable drain
- "This function is only called internally" → Verify all callers; internal doesn't mean safe
- "The pattern only appears in 2 functions" → Even 2/3 consistency is a signal worth investigating
- "It's an emergency function" → Emergency functions should be MORE carefully guarded, not less
- "Traditional tools said it's fine" → Traditional tools check syntax, not semantic consistency


# === END SKILL: quillai-semantic-guard ===

# === SKILL: quillai-state-invariant ===

---
name: state-invariant-detection
description: Detects broken mathematical relationships between state variables in smart contracts. Automatically infers invariants (totalSupply = sum(balances), conservation laws, ratio constraints) then finds functions that violate them. Catches unauthorized minting, broken tokenomics, accounting desynchronization, and state drift. Use when auditing for state-state invariant violations, broken accounting, supply mismatches, desynchronized state variables, or conservation law violations in smart contracts.
---

# State Invariant Detection

Automatically infer mathematical relationships between state variables, then find functions that **break those relationships**. Catches the most devastating DeFi vulnerabilities: unauthorized minting, broken tokenomics, accounting discrepancies, and state desynchronization.

## When to Use

- Auditing token contracts for supply/balance mismatches
- Analyzing staking, vault, or pool contracts for accounting errors
- Detecting conservation law violations in treasury/fund management
- Finding AMM/DEX constant product violations
- Verifying that aggregate variables stay synchronized with individual records

## When NOT to Use

- Guard-state consistency analysis (use semantic-guard-analysis)
- Full multi-dimensional audit (use behavioral-state-analysis)
- Entry point identification only (use entry-point-analyzer)

## Core Concept: State Variable Proportionality

**Hypothesis:** In well-designed contracts, state variables maintain mathematical relationships (invariants) that should never be violated.

When a function modifies one side of a relationship without updating the other, the invariant breaks — creating exploitable accounting errors.

## Five Types of State Relationships

### Type 1: Sum Relationships (Aggregation)

```
totalSupply = Σ balance[i] for all users i
```

**Found in:** ERC20 tokens, staking pools, vaults, share systems

### Type 2: Difference Relationships (Conservation)

```
totalFunds = availableFunds + lockedFunds
```

**Found in:** Treasuries, liquidity pools, vesting contracts

### Type 3: Ratio Relationships (Proportional)

```
k = reserveA × reserveB  (constant product)
sharePrice = totalAssets / totalShares
```

**Found in:** AMMs, DEXs, vault share pricing, collateralization

### Type 4: Monotonic Relationships (Ordering)

```
newValue ≥ oldValue  (only increases)
```

**Found in:** Timestamps, nonces, accumulated rewards, total distributions

### Type 5: Synchronization Relationships (Coupling)

```
If stateA changes, stateB must change correspondingly
```

**Found in:** Deposit/mint pairs, burn/release pairs, collateral/borrowing power

For detailed definitions and examples, see [{baseDir}/references/invariant-types.md]({baseDir}/references/invariant-types.md).

## The Three-Phase Detection Architecture

### Phase 1: State Variable Clustering

Group state variables that appear to be related.

**Algorithm:**

```
For each pair of state variables (A, B):
  1. Track all functions that modify A
  2. Track all functions that modify B
  3. Calculate co-modification frequency:

     CoMod(A, B) = |Functions modifying both A and B| / |Functions modifying A or B|

  4. If CoMod(A, B) > 0.6 → A and B are likely related
```

**Example:**

```solidity
// mint() modifies BOTH totalSupply and balances → co-modified
// burn() modifies BOTH totalSupply and balances → co-modified
// transfer() modifies ONLY balances → does not co-modify

CoMod(totalSupply, balances) = 2/3 = 66.7%
Cluster identified: (totalSupply, balances)
```

### Phase 2: Invariant Inference

Determine the mathematical relationship between clustered variables.

**Method 1 — Delta Pattern Matching:**

```
mint():     Δtotal = +amount, Δbalance = +amount  → Same direction, same magnitude
burn():     Δtotal = -amount, Δbalance = -amount  → Same direction, same magnitude
transfer(): Δbalance1 = -x, Δbalance2 = +x       → Net zero change

Inference: totalSupply = Σ balances (Aggregation invariant)
```

**Method 2 — Delta Correlation:**

```
If ΔA = ΔB in all cases      → Direct proportional (A = B + constant)
If ΔA = -ΔB in all cases     → Inverse proportional (A + B = constant)
If ΔA × constant = ΔB        → Ratio relationship
If ΔA occurs whenever ΔB     → Synchronization invariant
```

**Method 3 — Expression Mining:**

Parse actual code operations:

```solidity
// Code: totalSupply += amount; balances[user] += amount;
// Extracted: Δtotal = Δbalance
// Inferred: total = Σ balances

// Code: available = total - locked;
// Extracted: available + locked = total
// Inferred: Conservation law
```

**Invariant Confidence:**

```
Confidence(I) = |functions preserving I| / |functions modifying variables in I|
```

| Confidence | Classification |
|-----------|---------------|
| ≥ 90% | STRONG invariant |
| 70-89% | MODERATE invariant |
| < 70% | WEAK/NO invariant |

### Phase 3: Invariant Violation Detection

Find functions that break established relationships.

**Algorithm:**

```
For each inferred invariant I(stateA, stateB):
  For each function F that modifies stateA or stateB:

    Before: Capture (stateA, stateB)
    Simulate: Execute F
    After: Capture (stateA', stateB')

    If I(stateA, stateB) = True AND I(stateA', stateB') = False:
      → F is VULNERABLE
```

**Vulnerability Set:**

```
V_I = {F ∈ Functions | ∃σ : I(σ) = True ∧ I(F(σ)) = False}
```

## Workflow

```
Task Progress:
- [ ] Step 1: Identify all state variables in the contract
- [ ] Step 2: Build co-modification matrix for all variable pairs
- [ ] Step 3: Cluster related variables (CoMod > 0.6)
- [ ] Step 4: Infer invariant type for each cluster (delta patterns)
- [ ] Step 5: Test each function against inferred invariants
- [ ] Step 6: Apply temporal filtering (only flag persistent violations)
- [ ] Step 7: Score severity and generate report
```

## Dual-Layer Integration

This skill is **Layer 2** of the Semantic State Protocol. For maximum coverage, combine with **Layer 1** (semantic-guard-analysis):

| Layer 1 Violation | Layer 2 Violation | Combined Severity |
|-------------------|-------------------|-------------------|
| Missing Guard | Breaks Invariant | **CRITICAL** |
| Missing Guard | No Invariant Break | **HIGH** |
| No Guard Issue | Breaks Invariant | **HIGH** |
| No Guard Issue | No Invariant Break | **LOW/INFO** |

## Output Format

```markdown
## State-State Invariant Violation Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Severity:** [CRITICAL | HIGH | MEDIUM]
**Invariant:** `[mathematical expression]`

**Before Execution:**
  stateA = [value], stateB = [value]
  Invariant: [expression] = True ✓

**After Execution:**
  stateA = [value'], stateB = [value']
  Invariant: [expression] = False ✗

**Root Cause:**
[Which state variable was modified without updating its counterpart]

**Impact:**
[Accounting errors, inflated supply, broken pricing, exploitable drift]

**Attack Scenario:**
1. [Step-by-step exploit leveraging the desynchronization]

**Recommendation:**
[Specific fix — add the missing state update]
```

## Quick Detection Checklist

When analyzing a contract, immediately check:

- [ ] Does every function that modifies `balances` also update `totalSupply` (or have a valid reason not to)?
- [ ] Does every function that moves between `available` and `locked` maintain `total = available + locked`?
- [ ] Does every swap/trade function maintain the constant product `k = reserveA * reserveB`?
- [ ] Do aggregate counters (`totalStaked`, `totalRewards`) stay synchronized with per-user mappings?
- [ ] Are monotonic variables (nonces, timestamps) ever decremented?

For detailed case studies, see [{baseDir}/references/case-studies.md]({baseDir}/references/case-studies.md).

## Rationalizations to Reject

- "The totalSupply is just for display" → Protocols use totalSupply for share pricing, voting power, market cap — drift is exploitable
- "Admin functions can bypass invariants" → Admin functions that break accounting create permanent protocol insolvency
- "The difference is small" → Small accounting errors compound over time and transactions
- "It's an emergency function" → Emergency functions that break state invariants create worse emergencies
- "Transfer doesn't need to update totalSupply" → Correct, but verify the NET change in sum(balances) is zero


# === END SKILL: quillai-state-invariant ===

# === SKILL: quillai-reentrancy ===

---
name: reentrancy-pattern-analysis
description: Systematically detects all reentrancy vulnerability variants in smart contracts — classic, cross-function, cross-contract, and read-only reentrancy. Builds call graphs, verifies CEI (Checks-Effects-Interactions) pattern compliance, traces state changes relative to external calls, and identifies callback vectors through ERC-777/ERC-1155 hooks. Use when auditing contracts that make external calls, transfer ETH or tokens, interact with callback-enabled standards, or have complex multi-contract architectures.
---

# Reentrancy Pattern Analysis

Systematically detect **all variants** of reentrancy vulnerabilities by mapping the relationship between external calls and state changes across the entire contract system.

## When to Use

- Auditing any contract that makes external calls (ETH transfers, token interactions, cross-contract calls)
- Reviewing contracts integrating with callback-enabled token standards (ERC-777, ERC-1155)
- Analyzing DeFi protocols with multi-contract architectures
- Verifying reentrancy guard coverage across all entry points
- When traditional tools only check for classic reentrancy but miss cross-function or read-only variants

## When NOT to Use

- Pure state variable analysis without external calls (use state-invariant-detection)
- Access control consistency checking (use semantic-guard-analysis)
- Full multi-dimensional audit (use behavioral-state-analysis, which orchestrates this skill)

## Core Concept: The CEI Invariant

**Checks-Effects-Interactions (CEI)** is the fundamental safety pattern:

```
1. CHECKS   — Validate all conditions (require statements, access control)
2. EFFECTS  — Update all state variables
3. INTERACTIONS — Make external calls (ETH transfers, token calls, cross-contract)
```

**Any function that performs INTERACTIONS before completing all EFFECTS is potentially vulnerable to reentrancy.**

## The Five Reentrancy Variants

### Variant 1: Classic Single-Function Reentrancy

The original and most well-known pattern. A function makes an external call before updating its own state, allowing the callee to re-enter the same function.

```solidity
// VULNERABLE
function withdraw(uint256 amount) public {
    require(balances[msg.sender] >= amount);
    (bool success, ) = msg.sender.call{value: amount}(""); // INTERACTION before EFFECT
    require(success);
    balances[msg.sender] -= amount; // State update AFTER external call
}
```

**Detection**: Find functions where state writes to variables used in `require` checks occur AFTER external calls.

### Variant 2: Cross-Function Reentrancy

Two or more functions share state, and an attacker re-enters through a DIFFERENT function than the one making the external call.

```solidity
function withdraw(uint256 amount) public {
    require(balances[msg.sender] >= amount);
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
    balances[msg.sender] -= amount;
}

// Attacker re-enters HERE during withdraw's external call
function transfer(address to, uint256 amount) public {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
```

**Detection**: For each external call in function F, check if any OTHER public function reads/writes the same state variables that F modifies after the call.

### Variant 3: Cross-Contract Reentrancy

The re-entry occurs through a different contract that shares state or trust relationships with the vulnerable contract.

```solidity
// Contract A
function withdrawFromVault() public {
    uint256 shares = vault.balanceOf(msg.sender);
    vault.burn(msg.sender, shares);
    // External call — attacker can re-enter Contract B
    (bool success, ) = msg.sender.call{value: shares * pricePerShare}("");
    require(success);
}

// Contract B (attacker re-enters here)
function borrow() public {
    uint256 collateral = vault.balanceOf(msg.sender); // Reads stale state!
    // Shares not yet burned, so collateral appears inflated
    uint256 loanAmount = collateral * maxLTV;
    token.transfer(msg.sender, loanAmount);
}
```

**Detection**: Map all cross-contract dependencies. For each external call, identify which other contracts read the state that should have been updated.

### Variant 4: Read-Only Reentrancy

A view/pure function returns stale state during a reentrancy callback. No state is modified during re-entry — the attacker exploits the READING of inconsistent state by a third-party contract.

```solidity
// Pool contract
function removeLiquidity() external {
    uint256 shares = balances[msg.sender];
    // Burns LP tokens (updates internal accounting)
    _burn(msg.sender, shares);
    // External call BEFORE updating reserves
    (bool success, ) = msg.sender.call{value: ethAmount}("");
    // Reserves updated AFTER the call
    totalReserves -= ethAmount;
}

// This view function returns stale data during the callback
function getRate() public view returns (uint256) {
    return totalReserves / totalSupply(); // totalReserves not yet updated!
}

// Third-party contract reads the inflated rate
function priceOracle() external view returns (uint256) {
    return pool.getRate(); // Returns wrong value during reentrancy
}
```

**Detection**: For each external call, identify view functions that read state variables modified AFTER the call. Check if any external protocol depends on those view functions.

### Variant 5: ERC-777 / ERC-1155 Callback Reentrancy

Token standards with built-in callback hooks that execute arbitrary code on the receiver during transfers.

```solidity
// ERC-777: tokensReceived() hook called on recipient
// ERC-1155: onERC1155Received() hook called on recipient
// ERC-721: onERC721Received() hook called on recipient

function deposit(uint256 amount) public {
    token.transferFrom(msg.sender, address(this), amount); // Triggers callback!
    // If token is ERC-777, msg.sender's tokensReceived() runs HERE
    balances[msg.sender] += amount; // State update after callback
}
```

**Detection**: Identify all token `transfer`/`transferFrom`/`safeTransfer` calls. Check if the token could be ERC-777/ERC-1155/ERC-721. Verify state updates happen before the transfer.

## Three-Phase Detection Architecture

### Phase 1: Call Graph Construction

Build a complete map of all external interactions.

**For each function, extract:**

```
Function: withdraw()
├── External Calls:
│   ├── msg.sender.call{value: amount}("") at line 45
│   ├── token.transfer(user, amount) at line 48
│   └── oracle.getPrice() at line 42
├── State Writes:
│   ├── balances[msg.sender] -= amount at line 50
│   └── totalWithdrawn += amount at line 51
├── State Reads (in requires):
│   └── balances[msg.sender] at line 41
└── Modifiers:
    └── nonReentrant: NO
```

**Call Classification:**

| Call Type | Reentrancy Risk | Examples |
|-----------|----------------|---------|
| ETH transfer via `call` | HIGH | `addr.call{value: x}("")` |
| Token `transfer`/`transferFrom` | MEDIUM-HIGH | ERC-777 hooks, ERC-1155 callbacks |
| `safeTransferFrom` (NFT) | MEDIUM | ERC-721 `onERC721Received` callback |
| Cross-contract function call | MEDIUM | `otherContract.doSomething()` |
| `staticcall` / view calls | LOW | Cannot modify state but can trigger read-only reentrancy in callers |
| `delegatecall` | HIGH | Executes in caller's context |

### Phase 2: CEI Violation Detection

For each function with external calls, verify CEI ordering.

**Algorithm:**

```
For each function F with external calls:
  1. E = set of all state variables written by F
  2. C = set of all state variables read in require/if checks
  3. I = position of each external call in F
  4. For each external call at position P:
     a. W_after = state writes that occur AFTER position P
     b. If W_after ∩ (E ∪ C) ≠ ∅:
        → CEI VIOLATION: state modified after external call
     c. Classify violation:
        - W_after ∩ C ≠ ∅ → Classic reentrancy (check variable modified after call)
        - W_after ∩ E ≠ ∅ → State inconsistency window
```

**Cross-Function Extension:**

```
For each external call in function F at position P:
  W_before = state variables NOT yet updated at position P
  For each OTHER public function G:
    R_G = state variables read by G
    W_G = state variables written by G
    If R_G ∩ W_before ≠ ∅ OR W_G ∩ W_before ≠ ∅:
      → CROSS-FUNCTION REENTRANCY: G can be called during F's external call
         with inconsistent state
```

### Phase 3: Guard Coverage Verification

Check that reentrancy protections are correctly applied.

**Guard Types:**

| Guard | Coverage | Limitations |
|-------|----------|-------------|
| `nonReentrant` modifier (OpenZeppelin) | Single contract, all functions with modifier | Does not protect cross-contract reentrancy |
| CEI pattern compliance | Per-function | Must be verified for every function individually |
| `transfer()` / `send()` (2300 gas) | Limits callback gas | NOT safe — EIP-1884 changed gas costs; don't rely on this |
| Pull payment pattern | Eliminates external calls from state changes | Requires architectural change |

**Verification:**

```
For each function F with CEI violations:
  1. Check if F has nonReentrant modifier → Mitigated (single-contract only)
  2. Check if ALL functions sharing state also have nonReentrant → Mitigated (cross-function)
  3. Check if cross-contract consumers are protected → Requires manual review
  4. If no guard → VULNERABLE
```

## Workflow

```
Task Progress:
- [ ] Step 1: Identify all external calls in every function (ETH transfers, token calls, cross-contract)
- [ ] Step 2: Build call graph with state read/write positions relative to each call
- [ ] Step 3: Detect CEI violations (state writes after external calls)
- [ ] Step 4: Detect cross-function reentrancy (shared state across functions)
- [ ] Step 5: Detect callback vectors (ERC-777, ERC-1155, ERC-721 token interactions)
- [ ] Step 6: Detect read-only reentrancy (view functions reading stale state)
- [ ] Step 7: Verify guard coverage (nonReentrant, CEI compliance, pull patterns)
- [ ] Step 8: Score findings and generate report
```

## Output Format

```markdown
## Reentrancy Analysis Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Variant:** [Classic | Cross-Function | Cross-Contract | Read-Only | Callback]
**Severity:** [CRITICAL | HIGH | MEDIUM]
**Guard Status:** [Unguarded | Partially Guarded | Guarded]

**CEI Violation:**
  - External call at line [X]: `[call expression]`
  - State write AFTER call at line [Y]: `[state variable] = [expression]`

**Re-Entry Path:**
  1. Attacker calls `functionName()`
  2. External call triggers callback to attacker contract
  3. Attacker re-enters via `[re-entry function]`
  4. State variable `[name]` still has pre-update value
  5. [Exploit consequence]

**Impact:**
[Funds drained, state corrupted, price manipulated, etc.]

**Recommendation:**
[Specific fix — reorder state updates, add nonReentrant, use pull pattern]
```

## Severity Classification

| Variant | State Modified | Funds at Risk | Severity |
|---------|---------------|---------------|----------|
| Classic — ETH drain | Yes | Yes | **CRITICAL** |
| Cross-function — balance manipulation | Yes | Yes | **CRITICAL** |
| Cross-contract — oracle/price manipulation | Indirectly | Yes | **HIGH** |
| Read-only — stale price in third-party | No (view only) | Possibly | **HIGH** |
| Callback — ERC-777 deposit inflation | Yes | Possibly | **HIGH** |
| Any variant with nonReentrant on target | Mitigated | No | **LOW/INFO** |

## Advanced Detection: Transitive Reentrancy

Trace reentrancy through multiple contract hops:

```
Contract A calls Contract B
Contract B calls Contract C
Contract C calls back to Contract A (or reads A's stale state)

Detection: Build transitive call graph across all contracts in scope.
For each call chain A → B → ... → X:
  If X can call back to any contract in the chain → TRANSITIVE REENTRANCY
```

## Quick Detection Checklist

When analyzing a contract, immediately check:

- [ ] Does any function make an external call (ETH transfer, token transfer, cross-contract) BEFORE completing all state updates?
- [ ] Are there multiple public functions that modify the same state variables, where at least one makes an external call?
- [ ] Does the contract interact with ERC-777, ERC-1155, or ERC-721 tokens (callback hooks)?
- [ ] Do view functions read state that is only partially updated during an external call?
- [ ] Is `nonReentrant` applied to ALL functions that share state with a function making external calls, not just the calling function itself?
- [ ] Does the contract rely on `transfer()` or `send()` for reentrancy protection? (Unsafe assumption)

For detailed variant taxonomy, see [{baseDir}/references/reentrancy-variants.md]({baseDir}/references/reentrancy-variants.md).
For real-world case studies, see [{baseDir}/references/case-studies.md]({baseDir}/references/case-studies.md).

## Rationalizations to Reject

- "We use `transfer()` so reentrancy is impossible" → EIP-1884 changed gas costs; `transfer` is no longer considered safe
- "The function has `nonReentrant`" → Check cross-function and cross-contract paths; one modifier doesn't protect everything
- "It's just a view function" → Read-only reentrancy can manipulate prices and oracles in third-party contracts
- "We only interact with standard ERC20 tokens" → ERC-777 is backward-compatible with ERC20; token type may change
- "The external call is to a trusted contract" → Trust boundaries shift; verify the actual code path through all intermediaries
- "State is updated right after the call" → "Right after" is too late; the call already happened


# === END SKILL: quillai-reentrancy ===

# === SKILL: quillai-oracle-flashloan ===

---
name: oracle-flashloan-analysis
description: Detects price oracle manipulation and flash loan attack vectors in DeFi smart contracts. Classifies oracle trust models (Chainlink, TWAP, spot price, custom), identifies stale price risks, circular price dependencies, and flash loan atomicity exploitation patterns. Use when auditing DeFi protocols that depend on price data, oracle integrations, lending protocols, DEXs, derivatives, or any contract where flash loans could manipulate state within a single transaction.
---

# Oracle & Flash Loan Analysis

Detect vulnerabilities where **external price data can be manipulated** or **flash loans can exploit protocol logic** within a single transaction. These two attack vectors are often combined and represent the most common DeFi attack pattern.

## When to Use

- Auditing any DeFi protocol that reads external price data (lending, DEX, derivatives, yield aggregators)
- Reviewing Chainlink, Uniswap TWAP, Band Protocol, or custom oracle integrations
- Analyzing protocols that interact with or are accessible via flash loans
- Threat modeling for MEV, sandwich attacks, and price manipulation
- When a protocol uses `balanceOf()`, pool reserves, or spot prices for critical calculations

## When NOT to Use

- Contracts with no price dependencies or external data feeds
- Pure access control analysis (use semantic-guard-analysis)
- State-to-state invariant checking (use state-invariant-detection)

## Core Concept: The Oracle Trust Hierarchy

Not all price sources are equally secure. Oracle vulnerabilities stem from the gap between **assumed trust** and **actual manipulation resistance**.

```
Trust Level (highest to lowest):
┌─────────────────────────────────────────────┐
│ Level 5: Multi-oracle consensus + circuit    │
│          breakers + TWAP + staleness checks  │
├─────────────────────────────────────────────┤
│ Level 4: Chainlink with full validation      │
│          (staleness, sequencer, min answers)  │
├─────────────────────────────────────────────┤
│ Level 3: Uniswap V3 TWAP (long window)      │
│          Multi-block manipulation cost        │
├─────────────────────────────────────────────┤
│ Level 2: Uniswap V2 TWAP (short window)     │
│          or Chainlink WITHOUT staleness check │
├─────────────────────────────────────────────┤
│ Level 1: Spot price from single pool         │ ← Manipulable via flash loan
│          or balanceOf() for pricing           │
└─────────────────────────────────────────────┘
```

## The Four-Phase Detection Architecture

### Phase 1: Oracle Source Identification

Locate every point where the contract reads external price/value data.

**Search for these patterns:**

| Pattern | Oracle Type | Risk Level |
|---------|------------|------------|
| `latestRoundData()` | Chainlink | Medium (depends on validation) |
| `latestAnswer()` | Chainlink (deprecated) | HIGH (no round validation) |
| `observe()` / `consult()` | Uniswap TWAP | Medium (depends on window) |
| `getReserves()` | AMM spot price | **CRITICAL** (flash-loan manipulable) |
| `balanceOf(address(this))` | Self-balance | **CRITICAL** (donation attack) |
| `slot0()` / `sqrtPriceX96` | Uniswap V3 spot | **CRITICAL** (single-block manipulable) |
| Custom `getPrice()` | Unknown | Requires investigation |

**Build an Oracle Dependency Map:**

```
Contract: LendingPool
├── borrowLimit() → uses getCollateralPrice()
│   └── getCollateralPrice() → calls chainlinkOracle.latestRoundData()
├── liquidate() → uses getDebtPrice()
│   └── getDebtPrice() → calls uniswapPool.slot0() ← SPOT PRICE!
└── calculateInterest() → uses getUtilizationRate()
    └── getUtilizationRate() → reads internal state (safe)
```

### Phase 2: Oracle Validation Verification

For each oracle source, verify that proper safety checks are in place.

**Chainlink Validation Checklist:**

```solidity
// COMPLETE Chainlink integration
(uint80 roundId, int256 price, , uint256 updatedAt, uint80 answeredInRound) =
    priceFeed.latestRoundData();

require(price > 0, "Invalid price");                    // Check 1: Non-negative
require(updatedAt > 0, "Round not complete");            // Check 2: Round complete
require(answeredInRound >= roundId, "Stale price");      // Check 3: Not stale
require(block.timestamp - updatedAt < HEARTBEAT,         // Check 4: Fresh
        "Price too old");

// L2-specific
require(!sequencerFeed.isDown(), "Sequencer down");      // Check 5: L2 sequencer
require(block.timestamp - sequencerUptime > GRACE,       // Check 6: Grace period
        "Grace period");
```

**Missing Check Severity:**

| Missing Check | Severity | Impact |
|---------------|----------|--------|
| `price > 0` | HIGH | Zero/negative price → infinite borrowing or free liquidations |
| `updatedAt > 0` | MEDIUM | Incomplete round data used |
| `answeredInRound >= roundId` | HIGH | Stale price from previous round |
| Heartbeat/freshness | HIGH | Hours-old price during volatile markets |
| L2 sequencer check | HIGH | Stale price during L2 outage → unfair liquidations |
| Price deviation bounds | MEDIUM | Extreme outlier not filtered |

**TWAP Validation:**

```
Window length analysis:
  - < 10 minutes: HIGH RISK — manipulable with moderate capital
  - 10-30 minutes: MEDIUM RISK — expensive but feasible multi-block manipulation
  - 30+ minutes: LOWER RISK — requires sustained pool manipulation
  - Check: Is the TWAP window configurable? Can governance reduce it?
```

### Phase 3: Flash Loan Attack Surface Analysis

Identify operations that can be exploited via flash loan atomicity.

**Flash Loan Attack Model:**

```
Single Transaction:
  1. Borrow N tokens via flash loan (Aave, dYdX, Balancer)
  2. Manipulate price source (swap in pool, donate to contract)
  3. Exploit protocol at manipulated price (borrow, liquidate, swap)
  4. Reverse manipulation (swap back)
  5. Repay flash loan + fee
  6. Profit = exploited_value - flash_loan_fee - gas
```

**Detection Algorithm:**

```
For each function F that reads price/value data:
  1. Identify the price source S
  2. Can S be manipulated within a single transaction?
     - Spot price from AMM → YES (swap in same tx)
     - balanceOf(address(this)) → YES (donate tokens)
     - Chainlink feed → NO (off-chain updates)
     - TWAP → DEPENDS (short window = risky)
  3. What does F do with the price?
     - Determines borrowing limit → CRITICAL
     - Triggers liquidation → CRITICAL
     - Sets exchange rate → HIGH
     - Informational only → LOW
  4. Is the manipulation profitable?
     - value_extracted - (flash_loan_fee + slippage + gas) > 0 → EXPLOIT VIABLE
```

**Common Flash Loan Attack Patterns:**

| Pattern | Target | Method |
|---------|--------|--------|
| Oracle manipulation | Lending protocol | Flash swap in pool → inflate collateral price → over-borrow |
| Governance attack | DAO/voting | Flash borrow governance tokens → vote → execute → return |
| Liquidation manipulation | Lending protocol | Flash swap to crash price → liquidate at discount |
| Share price inflation | Vault/ERC4626 | Flash loan → donate to vault → inflate share price → front-run deposit |
| Arbitrage amplification | AMM/DEX | Flash loan amplifies existing price discrepancy |

### Phase 4: Circular Dependency Detection

Find cases where a protocol's pricing depends on its own state, creating exploitable feedback loops.

**Circular Dependency Pattern:**

```
Protocol A uses Token X price → from Pool P
Pool P contains Token X + Token Y
Protocol A issues Token X (or affects its supply)

→ CIRCULAR: Protocol A's actions change Token X supply
            → changes Pool P reserves
            → changes Token X price
            → changes Protocol A's valuations
```

**Detection:**

```
For each price oracle call in the contract:
  1. What token/asset is being priced?
  2. Does THIS contract mint, burn, or distribute that token?
  3. Does THIS contract add/remove liquidity from the pricing pool?
  4. Does any action in THIS contract affect the reserves of the pricing pool?

  If YES to any → CIRCULAR DEPENDENCY
  Severity: CRITICAL if the circular path can be exploited atomically
```

## Workflow

```
Task Progress:
- [ ] Step 1: Identify all oracle/price data sources in the contract
- [ ] Step 2: Classify each source by trust level (Chainlink, TWAP, spot, custom)
- [ ] Step 3: Verify validation checks for each oracle source
- [ ] Step 4: Map flash loan attack surfaces (which operations use manipulable prices?)
- [ ] Step 5: Detect circular price dependencies
- [ ] Step 6: Estimate manipulation cost vs profit (feasibility analysis)
- [ ] Step 7: Score findings and generate report
```

## Output Format

```markdown
## Oracle & Flash Loan Analysis Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Category:** [Oracle Manipulation | Stale Price | Flash Loan | Circular Dependency]
**Severity:** [CRITICAL | HIGH | MEDIUM]

**Oracle Source:** `[oracle contract/function]`
**Trust Level:** [1-5 from hierarchy]

**Vulnerability:**
[Description of how the price source can be manipulated or is insufficiently validated]

**Attack Scenario:**
1. Attacker obtains flash loan of [X tokens] from [source]
2. Swaps [amount] in [pool] to manipulate price of [token]
3. Calls `functionName()` which reads manipulated price
4. Extracts [value] from protocol at wrong price
5. Reverses manipulation and repays flash loan
6. Net profit: [amount]

**Missing Validations:**
- [ ] Price > 0 check
- [ ] Staleness check (heartbeat)
- [ ] Round completeness check
- [ ] L2 sequencer check
- [ ] Price deviation bounds

**Recommendation:**
[Specific fix — add TWAP, add Chainlink validation, implement circuit breaker]
```

## Quick Detection Checklist

- [ ] Does any function use `getReserves()`, `slot0()`, or `balanceOf()` for pricing? (Flash-loan manipulable)
- [ ] Does Chainlink integration check for `price > 0`, staleness, and round completeness?
- [ ] Is the TWAP window long enough to resist multi-block manipulation (> 30 min)?
- [ ] Does the protocol's own token appear in its pricing oracle's pool? (Circular dependency)
- [ ] Can any critical operation (borrow, liquidate, swap) be called in the same transaction as a flash loan?
- [ ] Are there price deviation circuit breakers for extreme moves?
- [ ] On L2: Is the sequencer uptime checked before using price data?

For oracle type details, see [{baseDir}/references/oracle-types.md]({baseDir}/references/oracle-types.md).
For flash loan attack patterns, see [{baseDir}/references/flash-loan-vectors.md]({baseDir}/references/flash-loan-vectors.md).

## Rationalizations to Reject

- "We use Chainlink, so it's safe" → Only if ALL validation checks are implemented; partial integration is common
- "Flash loans can't affect our protocol" → Any protocol using manipulable price sources is affected
- "The TWAP window is 10 minutes" → Multi-block manipulation is feasible for well-funded attackers
- "Our oracle is a trusted admin feed" → Admin key compromise → arbitrary price → instant drain
- "The pool is too large to manipulate" → Flash loans provide unlimited capital for single-transaction manipulation
- "We check if price is non-zero" → Non-zero is necessary but not sufficient; stale/manipulated non-zero prices are dangerous


# === END SKILL: quillai-oracle-flashloan ===

# === SKILL: quillai-proxy-upgrade ===

---
name: proxy-upgrade-safety
description: Detects vulnerabilities in upgradeable proxy smart contracts including storage layout collisions, uninitialized implementations, function selector clashing, delegatecall context issues, and upgrade path safety. Covers Transparent Proxy, UUPS (EIP-1822), Beacon, Diamond (EIP-2535), and Minimal Proxy (EIP-1167) patterns. Use when auditing upgradeable contracts, reviewing implementation upgrades, analyzing delegatecall architectures, or verifying proxy pattern compliance.
---

# Proxy & Upgrade Safety

Detect vulnerabilities specific to **upgradeable proxy architectures** — the most widely deployed contract pattern on Ethereum (54.2% of contracts). Proxy bugs cause storage corruption, unauthorized upgrades, and complete contract takeover.

## When to Use

- Auditing any contract using proxy/implementation pattern (Transparent, UUPS, Beacon, Diamond)
- Reviewing implementation contract upgrades for storage layout compatibility
- Analyzing `delegatecall`-based architectures and library usage
- Verifying initialization safety (can `initialize()` be front-run?)
- Checking Diamond (EIP-2535) facet management for selector collisions

## When NOT to Use

- Non-upgradeable contracts without proxy patterns
- Pure logic audits without proxy architecture (use behavioral-state-analysis)
- Token standard compliance (use external-call-safety)

## Core Concept: The Delegatecall Storage Model

When Proxy calls Implementation via `delegatecall`:

```
┌─────────────────────┐     delegatecall     ┌─────────────────────┐
│       PROXY         │ ──────────────────→   │   IMPLEMENTATION    │
│                     │                       │                     │
│ Storage:            │  Implementation code  │ Code only:          │
│   slot 0: admin     │  executes in proxy's  │   No persistent     │
│   slot 1: impl addr │  storage context      │   storage           │
│   slot 2: user data │                       │                     │
│   slot 3: user data │                       │                     │
└─────────────────────┘                       └─────────────────────┘
```

**Key Rule:** The implementation's code reads/writes the PROXY's storage slots. If storage layouts don't match, data corruption occurs.

## Five Vulnerability Classes

### Class 1: Storage Layout Collision

**Between Proxy and Implementation:**

```solidity
// Proxy contract
contract Proxy {
    address public admin;           // slot 0
    address public implementation;  // slot 1

    fallback() external payable {
        delegatecall(implementation);
    }
}

// Implementation contract
contract ImplementationV1 {
    uint256 public totalSupply;     // slot 0 — COLLIDES with admin!
    mapping(address => uint256) public balances; // slot 1 — COLLIDES with implementation!
}
```

**Detection:** Compare storage slot assignments between proxy and implementation. Any overlap = CRITICAL vulnerability.

**Between Implementation Versions:**

```solidity
// V1
contract ImplementationV1 {
    uint256 public totalSupply;     // slot 0
    address public owner;           // slot 1
    mapping(address => uint256) balances; // slot 2
}

// V2 — DANGEROUS: inserted variable before existing ones
contract ImplementationV2 {
    bool public paused;             // slot 0 — COLLIDES with totalSupply!
    uint256 public totalSupply;     // slot 1 — COLLIDES with owner!
    address public owner;           // slot 2 — COLLIDES with balances!
    mapping(address => uint256) balances; // slot 3
}
```

**Safe V2:**

```solidity
contract ImplementationV2 {
    uint256 public totalSupply;     // slot 0 — same
    address public owner;           // slot 1 — same
    mapping(address => uint256) balances; // slot 2 — same
    bool public paused;             // slot 3 — NEW, appended at end
}
```

### Class 2: Uninitialized Implementation

Proxy pattern uses `initialize()` instead of `constructor()`. If the implementation contract itself is not initialized, an attacker can call `initialize()` directly on it.

```solidity
contract ImplementationV1 is Initializable {
    address public owner;

    function initialize(address _owner) external initializer {
        owner = _owner;
    }

    function selfDestruct() external {
        require(msg.sender == owner);
        selfdestruct(payable(msg.sender));
    }
}
```

**Attack:**

```
1. Implementation deployed but initialize() not called on impl itself
2. Attacker calls implementation.initialize(attacker_address)
3. Attacker is now owner of the IMPLEMENTATION contract
4. Attacker calls selfDestruct() on implementation
5. Proxy now delegatecalls to destroyed contract
6. ALL proxy calls return empty data — contract bricked
```

**Detection:**

```
For each implementation contract:
  1. Does it have initialize() or any initializer function?
  2. Was initialize() called on the implementation address (not just the proxy)?
  3. Does the constructor call _disableInitializers()?
  4. If no → UNINITIALIZED IMPLEMENTATION vulnerability
```

### Class 3: Function Selector Clashing

Solidity function selectors are only 4 bytes. Collisions between proxy admin functions and implementation functions cause unexpected behavior.

```solidity
// Proxy has admin function
function upgrade(address newImpl) external;  // selector: 0x0900f010

// Implementation has user function with SAME selector
function collide(uint256 amount) external;   // selector: 0x0900f010

// When user calls collide(), proxy intercepts it as upgrade()!
```

**Transparent Proxy Mitigation:** Admin can only call admin functions; users can only call implementation functions. But this must be correctly implemented.

**Detection:**

```
For each function in the proxy:
  selector_proxy = keccak256(signature)[:4]
  For each function in the implementation:
    selector_impl = keccak256(signature)[:4]
    If selector_proxy == selector_impl:
      → FUNCTION SELECTOR CLASH
```

### Class 4: Missing Upgrade Authorization

**UUPS Pattern:** The upgrade logic lives in the implementation, not the proxy. If `_authorizeUpgrade()` is not properly protected, anyone can upgrade.

```solidity
// VULNERABLE: Missing access control on upgrade
contract ImplementationV1 is UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override {
        // NO ACCESS CHECK! Anyone can upgrade!
    }
}

// SAFE
contract ImplementationV1 is UUPSUpgradeable, OwnableUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Only owner can upgrade
    }
}
```

**Detection:**

```
For UUPS proxies:
  1. Find _authorizeUpgrade() function
  2. Check for access control (onlyOwner, onlyRole, require(msg.sender == admin))
  3. If no access control → CRITICAL: unauthorized upgrade
  4. Also check: Can _authorizeUpgrade be removed in a new version?
     → If V2 doesn't inherit UUPSUpgradeable → proxy becomes non-upgradeable (bricked)
```

### Class 5: Delegatecall Context Confusion

Code executing via `delegatecall` runs with the caller's `msg.sender`, `msg.value`, and storage. Misunderstanding this context creates vulnerabilities.

```solidity
// Implementation stores admin in its own constructor
contract Implementation {
    address public admin;

    constructor() {
        admin = msg.sender; // Sets admin in IMPLEMENTATION storage
        // When called via delegatecall, this is proxy's storage
        // BUT constructor only runs during deployment, not via proxy!
    }
}
```

**Key Rule:** Constructors NEVER run via delegatecall. Any state set in the constructor exists only in the implementation's own storage, not the proxy's.

## Three-Phase Detection Architecture

### Phase 1: Proxy Pattern Classification

Identify which proxy pattern is used.

| Pattern | Key Indicator | Upgrade Location |
|---------|--------------|-----------------|
| Transparent (EIP-1967) | `_IMPLEMENTATION_SLOT` at `keccak256('eip1967.proxy.implementation') - 1` | Proxy contract |
| UUPS (EIP-1822) | `proxiableUUID()` in implementation | Implementation contract |
| Beacon | `_BEACON_SLOT` at `keccak256('eip1967.proxy.beacon') - 1` | Beacon contract |
| Diamond (EIP-2535) | `diamondCut()` function, facet registry | Diamond contract |
| Minimal (EIP-1167) | Clone bytecode pattern `363d3d373d3d3d363d73...` | Not upgradeable |

### Phase 2: Storage Layout Analysis

Build the complete storage map for proxy and all implementation versions.

**Algorithm:**

```
For each contract C (proxy, impl_v1, impl_v2, ...):
  storage_map[C] = {}
  slot = 0
  For each state variable V in C (in declaration order):
    storage_map[C][slot] = V
    slot += size_of(V)  // Consider packing for <32 byte types

For each slot S:
  If storage_map[proxy][S] conflicts with storage_map[impl][S]:
    → PROXY-IMPL COLLISION at slot S
  If storage_map[impl_v1][S] != storage_map[impl_v2][S]:
    → UPGRADE COLLISION at slot S
```

**Special Cases:**

- Mappings and dynamic arrays: hash-based slot calculation
- Struct packing: multiple variables per slot
- Inherited contracts: storage order follows C3 linearization
- Gap variables (`uint256[50] private __gap`): reserved space for upgrades

### Phase 3: Initialization & Upgrade Path Verification

```
Initialization Checks:
  1. Does implementation use Initializable?
  2. Is initialize() protected by initializer modifier?
  3. Does constructor call _disableInitializers()?
  4. Can initialize() be called more than once? (reinitializer)
  5. Was initialize() called on impl address directly?

Upgrade Path Checks:
  1. Is upgrade function access-controlled?
  2. Does new impl maintain storage layout compatibility?
  3. Does new impl still support upgrades? (UUPS: must inherit UUPSUpgradeable)
  4. Is there a timelock on upgrades?
  5. Can upgrade + initialize race condition occur?
```

## Workflow

```
Task Progress:
- [ ] Step 1: Identify proxy pattern (Transparent, UUPS, Beacon, Diamond, Minimal)
- [ ] Step 2: Map storage layout of proxy contract
- [ ] Step 3: Map storage layout of all implementation versions
- [ ] Step 4: Check for storage collisions (proxy-impl and version-version)
- [ ] Step 5: Verify initialization safety (disableInitializers, initializer modifier)
- [ ] Step 6: Check function selector clashing (proxy admin vs impl functions)
- [ ] Step 7: Verify upgrade authorization (access control on upgrade path)
- [ ] Step 8: Check delegatecall context safety
- [ ] Step 9: Score findings and generate report
```

## Output Format

```markdown
## Proxy & Upgrade Safety Report

### Finding: [Title]

**Contract:** `ContractName` at `Contract.sol:L42`
**Proxy Pattern:** [Transparent | UUPS | Beacon | Diamond | Minimal]
**Class:** [Storage Collision | Uninitialized Impl | Selector Clash | Missing Auth | Context Confusion]
**Severity:** [CRITICAL | HIGH | MEDIUM]

**Issue:**
[Description of the proxy-specific vulnerability]

**Storage Layout:**
  Proxy slot 0: `[proxy variable]`
  Impl  slot 0: `[impl variable]` ← COLLISION

**Attack Scenario:**
1. [Step-by-step exploit]

**Impact:**
[Storage corruption, unauthorized upgrade, contract bricked, etc.]

**Recommendation:**
[Use EIP-1967 slots, add _disableInitializers, add access control, append-only storage]
```

## Quick Detection Checklist

- [ ] Does the proxy store admin/implementation at standard EIP-1967 slots (not regular slots)?
- [ ] Does the implementation's `constructor()` call `_disableInitializers()`?
- [ ] Does `initialize()` use the `initializer` modifier?
- [ ] Do implementation upgrades ONLY append new state variables (never insert or reorder)?
- [ ] Is there a `__gap` variable for future storage expansion in base contracts?
- [ ] For UUPS: Does `_authorizeUpgrade()` have proper access control?
- [ ] For UUPS: Does every new implementation still inherit `UUPSUpgradeable`?
- [ ] Are there any function selector collisions between proxy and implementation?
- [ ] Is there a timelock or multisig on the upgrade path?

For proxy pattern details, see [{baseDir}/references/proxy-patterns.md]({baseDir}/references/proxy-patterns.md).
For storage collision detection, see [{baseDir}/references/storage-collision-detection.md]({baseDir}/references/storage-collision-detection.md).

## Rationalizations to Reject

- "We use OpenZeppelin's proxy" → OZ provides the framework, but storage layout compatibility is YOUR responsibility
- "The implementation is initialized" → Was it initialized on the IMPLEMENTATION address, or only through the proxy?
- "Constructor sets the admin" → Constructors don't run via delegatecall; admin is only set in impl's own storage
- "We tested the upgrade" → Did you verify storage layout slot-by-slot? One reordered variable corrupts everything
- "UUPS is safer than Transparent" → Only if `_authorizeUpgrade` is properly protected AND maintained across upgrades
- "The gap variable protects us" → Only if inherited contracts also have gaps and you never exceed the gap size


# === END SKILL: quillai-proxy-upgrade ===

# === SKILL: ethskills-audit ===

---
name: audit
description: Deep EVM smart contract security audit system. Use when asked to audit a contract, find vulnerabilities, review code for security issues, or file security issues on a GitHub repo. Covers 500+ non-obvious checklist items across 19 domains via parallel sub-agents. Different from the security skill (which teaches defensive coding) — this is for systematically auditing contracts you didn't write.
---

# EVM Smart Contract Audit

A full audit system for any EVM contract. Runs parallel specialist agents against domain-specific checklists, synthesizes findings, and files GitHub issues.

## The Checklists

20 specialized skills covering every major vulnerability domain. Fetch the master index first:

```
https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
```

The master index contains:
- Full routing table (which skills to load for which contract types)
- The complete audit methodology (recon → parallel agents → synthesis → issues)
- Standard finding format with severity definitions

All 20 skill checklists are at:
```
https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/<skill-name>/references/checklist.md
```

## Skills Available

| Skill | When to Load |
|-------|-------------|
| `evm-audit-general` | Always |
| `evm-audit-precision-math` | Always |
| `evm-audit-erc20` | Contract interacts with ERC20 tokens |
| `evm-audit-defi-amm` | AMM, DEX, Uniswap V3/V4, liquidity pools |
| `evm-audit-defi-lending` | Lending, borrowing, CDP, liquidations |
| `evm-audit-defi-staking` | Staking, liquid staking, restaking, EigenLayer |
| `evm-audit-erc4626` | Vaults, share/asset conversion |
| `evm-audit-erc4337` | Account abstraction, paymasters, session keys |
| `evm-audit-bridges` | Cross-chain, LayerZero, CCIP, Wormhole |
| `evm-audit-proxies` | Upgradeable contracts, UUPS, Transparent, Diamond |
| `evm-audit-signatures` | Off-chain signatures, EIP-712, permits |
| `evm-audit-governance` | DAO voting, timelocks, multi-sig |
| `evm-audit-oracles` | Chainlink, TWAP, Pyth, price feeds |
| `evm-audit-assembly` | Inline assembly, Yul, CREATE2 |
| `evm-audit-chain-specific` | Non-mainnet: Arbitrum, OP, zkSync, Blast, BSC |
| `evm-audit-flashloans` | Flash loan attack vectors |
| `evm-audit-erc721` | NFTs, ERC721, ERC1155 |
| `evm-audit-dos` | DoS, unbounded loops, gas griefing |
| `evm-audit-access-control` | Ownership, roles, centralization risks |

## How To Run An Audit

1. Fetch the master skill (link above) — it has the full pipeline
2. Read the contract(s)
3. Select 5-8 skills using the routing table
4. Spawn one opus sub-agent per skill (parallel)
5. Each agent walks its checklist and writes `findings-<skill>.md`
6. Synthesize all findings into `AUDIT-REPORT.md`
7. File GitHub issues for Medium severity and above

## Invocation

```
Audit this contract and file issues: https://github.com/owner/repo/blob/main/contracts/Foo.sol
Checklists: https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-master/SKILL.md
```

## Sources

Built from research by Dacian, beirao.xyz, Sigma Prime, RareSkills, Decurity, weird-erc20, Spearbit, Hacken, OpenZeppelin, Cyfrin, and more.
Full attribution: https://github.com/austintgriffith/evm-audit-skills#attribution--thanks


# === END SKILL: ethskills-audit ===

# === SKILL: tob-building-secure ===

# Building Secure Contracts (Umbrella)

This umbrella skill aggregates secure engineering guidance from the
`building-secure-contracts` plugin collection.

Use this skill to:
- prioritize protocol-level threat modeling before implementation details
- evaluate architecture, trust boundaries, upgrade paths, and key assumptions
- enforce safe-by-default patterns for access control, external integrations,
  oracle usage, accounting, and invariant preservation
- map vulnerabilities to concrete remediation guidance and verification steps

When additional specialization is needed, branch into the plugin sub-skills
under:
- `skills/trailofbits/plugins/building-secure-contracts/skills/`

Prefer conservative assumptions and explicit exploit preconditions when
reporting findings.


# === END SKILL: tob-building-secure ===

# === SKILL: quillai-signature-replay ===

---
name: signature-replay-analysis
description: Detects signature replay vulnerabilities in smart contracts — affecting 19.63% of signature-using contracts. Covers five replay types (same-chain, cross-chain, cross-contract, nonce-skip, expired-signature), EIP-712 domain separator verification, nonce management analysis, ecrecover edge cases (address(0), malleability, s-value), permit/permit2 safety, ERC-1271 contract wallet support, and meta-transaction security. Use when auditing contracts with ecrecover, ECDSA, EIP-712, permit, meta-transactions, multi-sig, or any off-chain signature verification.
---

# Signature & Replay Analysis

Detect vulnerabilities where **cryptographic signatures can be reused**, replayed across chains/contracts, or exploited through implementation flaws. Research shows 19.63% of Ethereum contracts using signatures contain replay vulnerabilities.

## When to Use

- Auditing contracts that verify signatures (`ecrecover`, ECDSA, EIP-712)
- Reviewing ERC-20 `permit()` / Uniswap Permit2 implementations
- Analyzing meta-transaction / gasless relay systems
- Verifying multi-sig signature aggregation
- Checking off-chain order books or signed message execution

## When NOT to Use

- Contracts without any signature verification
- Pure on-chain access control (use semantic-guard-analysis)
- Token standard compliance (use external-call-safety)

## Core Concept: The Signature Trust Model

A signature proves that a specific private key holder authorized a specific action. For this to be secure, the signature must be:

1. **Bound to context** — specific chain, contract, and version (domain separation)
2. **Used exactly once** — nonce prevents replay
3. **Time-limited** — deadline/expiry prevents late execution
4. **Correctly verified** — ecrecover edge cases handled

Any gap in this model creates a replay vulnerability.

## The Five Replay Types

### Type 1: Same-Chain Replay

The exact same signature is submitted multiple times to the same contract on the same chain.

```solidity
// VULNERABLE: No nonce — same signature works forever
function executeWithSig(address to, uint256 amount, bytes memory signature) external {
    bytes32 hash = keccak256(abi.encodePacked(to, amount));
    address signer = ECDSA.recover(hash, signature);
    require(signer == admin, "Invalid signer");
    token.transfer(to, amount);
    // Attacker can submit this same signature again and again!
}

// SAFE: Use nonce
mapping(address => uint256) public nonces;

function executeWithSig(address to, uint256 amount, uint256 nonce, bytes memory signature) external {
    require(nonce == nonces[admin], "Invalid nonce");
    bytes32 hash = keccak256(abi.encodePacked(to, amount, nonce));
    address signer = ECDSA.recover(hash, signature);
    require(signer == admin, "Invalid signer");
    nonces[admin]++;
    token.transfer(to, amount);
}
```

### Type 2: Cross-Chain Replay

A signature valid on one chain (e.g., Ethereum) is replayed on another chain (e.g., Polygon, Arbitrum) where the same contract is deployed.

```solidity
// VULNERABLE: No chainId in signed message
bytes32 hash = keccak256(abi.encodePacked(to, amount, nonce));
// This hash is identical on Ethereum, Polygon, Arbitrum, etc.

// SAFE: Include chainId (via EIP-712 domain separator)
bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes("MyContract")),
    keccak256(bytes("1")),
    block.chainid,
    address(this)
));
```

### Type 3: Cross-Contract Replay

A signature for Contract A is replayed on Contract B (same chain) if both accept the same message format without contract-specific binding.

```solidity
// VULNERABLE: No contract address in signed message
bytes32 hash = keccak256(abi.encodePacked(to, amount, nonce, block.chainid));
// Same hash for any contract on this chain

// SAFE: Include verifyingContract (via EIP-712)
// The domain separator includes address(this), binding to this specific contract
```

### Type 4: Nonce-Skip Replay

Nonce implementation allows gaps or out-of-order execution, enabling skipped nonces to be replayed later.

```solidity
// VULNERABLE: Bitmap nonce without invalidation
mapping(uint256 => bool) public usedNonces;

function execute(uint256 nonce, ...) external {
    require(!usedNonces[nonce], "Used");
    usedNonces[nonce] = true;
    // If nonces 1, 2, 3 are used but 4 is skipped,
    // nonce 4 can be used anytime in the future
    // This may be intentional OR a vulnerability depending on context
}

// SAFER for strict ordering: Sequential nonce
mapping(address => uint256) public nonces;

function execute(uint256 nonce, ...) external {
    require(nonce == nonces[signer], "Invalid nonce");
    nonces[signer]++;
}
```

### Type 5: Expired-Signature Replay

A signature without a deadline can be held and executed at an arbitrary future time when conditions have changed.

```solidity
// VULNERABLE: No deadline — signature valid forever
function permit(address owner, address spender, uint256 value, uint8 v, bytes32 r, bytes32 s) external {
    bytes32 hash = keccak256(abi.encodePacked(owner, spender, value, nonces[owner]++));
    require(ecrecover(hash, v, r, s) == owner, "Invalid");
    allowance[owner][spender] = value;
    // This permit can be executed weeks later when user doesn't expect it
}

// SAFE: Include deadline
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
    require(block.timestamp <= deadline, "Expired");
    // ... rest of verification
}
```

## ecrecover Safety

### Edge Case 1: Returns address(0)

`ecrecover` returns `address(0)` for invalid signatures instead of reverting.

```solidity
// VULNERABLE: address(0) accepted as valid signer
address signer = ecrecover(hash, v, r, s);
require(signer == owner, "Invalid");
// If owner == address(0) AND signature is invalid → passes!

// SAFE: Explicit zero check
address signer = ecrecover(hash, v, r, s);
require(signer != address(0), "Invalid signature");
require(signer == owner, "Wrong signer");

// SAFEST: Use OpenZeppelin's ECDSA.recover() — reverts on address(0)
address signer = ECDSA.recover(hash, signature);
```

### Edge Case 2: Signature Malleability

For every valid ECDSA signature (r, s, v), there exists a second valid signature (r, s', v') for the same message. This allows anyone to create an alternate valid signature without the private key.

```solidity
// The Ethereum standard: s must be in the lower half of the curve
// s' = secp256k1n - s (the "flipped" signature)

// VULNERABLE: Accepts both s values
address signer = ecrecover(hash, v, r, s); // Works for both s and s'
// If used as a unique identifier, the same message has TWO valid signatures

// SAFE: Enforce lower-s (OpenZeppelin's ECDSA library does this)
require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Invalid s");
```

### Edge Case 3: v Value

```solidity
// v should be 27 or 28 (Ethereum standard)
// Some implementations use 0 or 1 (subtract 27)
// Not normalizing v can cause signature verification to fail

require(v == 27 || v == 28, "Invalid v");
```

## EIP-712 Domain Separator Verification

### Complete Domain

```solidity
bytes32 constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    DOMAIN_TYPEHASH,
    keccak256(bytes(name)),        // Contract name
    keccak256(bytes(version)),     // Version string
    block.chainid,                 // Chain ID — prevents cross-chain replay
    address(this)                  // Contract address — prevents cross-contract replay
));
```

### Required Fields

| Field | Purpose | Missing = |
|-------|---------|-----------|
| `name` | Identifies the signing domain | MEDIUM risk |
| `version` | Prevents replay across upgrades | MEDIUM risk |
| `chainId` | **Prevents cross-chain replay** | HIGH risk |
| `verifyingContract` | **Prevents cross-contract replay** | HIGH risk |
| `salt` (optional) | Additional disambiguation | LOW risk |

### Common Mistakes

```solidity
// MISTAKE 1: Hardcoded chainId (doesn't update on chain forks)
uint256 immutable CHAIN_ID = 1;
// After a fork, signatures valid on both chains!

// SAFE: Use block.chainid at verification time, or recalculate domain separator
function DOMAIN_SEPARATOR() public view returns (bytes32) {
    if (block.chainid == INITIAL_CHAIN_ID) return _DOMAIN_SEPARATOR;
    return _calculateDomainSeparator(); // Recalculate for new chain
}

// MISTAKE 2: Empty name/version
keccak256(bytes("")) // Valid but weak — same across all contracts with empty name

// MISTAKE 3: Missing struct type hash in message
// EIP-712 requires: hashStruct(message) = keccak256(typeHash + encodeData(message))
// Omitting typeHash weakens the domain binding
```

## Permit and Permit2 Verification

### ERC-2612 Permit Checklist

```
- [ ] Uses EIP-712 domain separator with chainId and verifyingContract
- [ ] Includes per-user sequential nonce
- [ ] Includes deadline with block.timestamp check
- [ ] Uses ECDSA.recover (not raw ecrecover)
- [ ] Checks recovered address != address(0)
- [ ] Checks recovered address == owner parameter
- [ ] Nonce incremented BEFORE any state change
- [ ] Domain separator recalculated on chain fork
```

### Permit2 Considerations

```
- Permit2 uses nonce-bitmap approach (unordered nonces)
- Supports batch permits and transfer-with-permit
- Still requires deadline, domain separator, nonce management
- Contracts integrating Permit2 must verify the permit2 contract address
```

## Workflow

```
Task Progress:
- [ ] Step 1: Find all signature verification code (ecrecover, ECDSA.recover, EIP-712)
- [ ] Step 2: Check for same-chain replay protection (nonce management)
- [ ] Step 3: Check for cross-chain replay protection (chainId in domain/message)
- [ ] Step 4: Check for cross-contract replay protection (address(this) in domain/message)
- [ ] Step 5: Check deadline/expiry enforcement
- [ ] Step 6: Verify ecrecover safety (address(0) check, s-value, v-value)
- [ ] Step 7: Verify EIP-712 domain separator completeness
- [ ] Step 8: Check ERC-1271 support for contract wallets (if applicable)
- [ ] Step 9: Score findings and generate report
```

## Output Format

```markdown
## Signature & Replay Analysis Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Replay Type:** [Same-Chain | Cross-Chain | Cross-Contract | Nonce-Skip | Expired]
**Severity:** [CRITICAL | HIGH | MEDIUM]

**Issue:**
[Description of the replay vulnerability or signature verification flaw]

**Signed Message Fields:**
- [x] to/from addresses
- [x] amount/value
- [ ] chainId ← MISSING
- [ ] verifyingContract ← MISSING
- [x] nonce
- [ ] deadline ← MISSING

**Attack Scenario:**
1. User signs message for [intended purpose]
2. Attacker captures signature from [source]
3. Attacker replays on [target chain/contract/time]
4. [Unauthorized action occurs]

**Recommendation:**
[Add EIP-712 domain separator, add nonce, add deadline, use ECDSA.recover]
```

## Quick Detection Checklist

- [ ] Does every signature include a nonce? (Prevents same-chain replay)
- [ ] Does the signed message include `chainId`? (Prevents cross-chain replay)
- [ ] Does the signed message include `address(this)`? (Prevents cross-contract replay)
- [ ] Is there a deadline/expiry with `block.timestamp` check? (Prevents late execution)
- [ ] Is `ecrecover` result checked against `address(0)`?
- [ ] Is the s-value enforced to be in the lower half? (Prevents malleability)
- [ ] Is the domain separator recalculated on chain fork? (Prevents fork replay)
- [ ] Is OpenZeppelin's ECDSA library used instead of raw `ecrecover`?
- [ ] For permit: Is the nonce incremented before state changes?
- [ ] For contract wallets: Is ERC-1271 `isValidSignature` supported?

For replay type details, see [{baseDir}/references/replay-taxonomy.md]({baseDir}/references/replay-taxonomy.md).
For EIP-712 checklist, see [{baseDir}/references/eip712-checklist.md]({baseDir}/references/eip712-checklist.md).

## Rationalizations to Reject

- "We use nonces so replay is impossible" → Check for cross-chain and cross-contract replay (nonce doesn't prevent those)
- "No one would replay on another chain" → Attackers monitor all chains; automated bots scan for replayable signatures
- "ecrecover is a built-in, so it's safe" → It returns address(0) on failure, not revert; it doesn't enforce s-value
- "The signature includes all the parameters" → Without chainId and contract address, it's still replayable
- "We hardcoded chainId = 1" → Chain forks create two live chains with the same chainId; use block.chainid
- "Permit is a standard, so it's safe" → The standard defines the interface, not the implementation; bugs are in how it's coded


# === END SKILL: quillai-signature-replay ===

# === SKILL: quillai-dos-griefing ===

---
name: dos-griefing-analysis
description: Detects Denial of Service and griefing vulnerabilities in smart contracts. Covers unbounded loop DoS, block gas limit exhaustion, external call failure DoS, insufficient gas griefing (63/64 rule), storage bloat attacks, timestamp griefing, self-destruct force-feeding, and push vs pull payment pattern analysis. Use when auditing contracts with batch operations, loops over user data, reward distribution, dividend systems, or any logic that depends on address(this).balance or iterates over growing collections.
---

# DoS & Griefing Analysis

Detect vulnerabilities that allow attackers to **make contracts unusable** (Denial of Service) or **harm other users at low cost** (griefing). These attacks don't steal funds directly but can permanently brick contracts or block critical operations.

## When to Use

- Auditing contracts with loops over dynamic arrays or mappings
- Reviewing batch operations (airdrops, reward distribution, liquidation)
- Analyzing contracts that rely on `address(this).balance` for logic
- Verifying that individual user failures don't block system-wide operations
- Checking for gas-based attack vectors (insufficient gas, storage bloat)

## When NOT to Use

- Direct fund theft analysis (use behavioral-state-analysis)
- Access control consistency (use semantic-guard-analysis)
- Reentrancy detection (use reentrancy-pattern-analysis)

## Seven DoS & Griefing Vulnerability Classes

### Class 1: Unbounded Loop DoS

Loops that iterate over collections that grow with contract usage. As the collection grows, gas cost increases until the function exceeds the block gas limit and becomes permanently uncallable.

```solidity
// VULNERABLE: Loop over all users — grows forever
address[] public allUsers;

function distributeRewards() external {
    for (uint i = 0; i < allUsers.length; i++) {
        // If allUsers has 10,000+ entries, this exceeds block gas limit
        token.transfer(allUsers[i], calculateReward(allUsers[i]));
    }
}

// SAFE: Paginated processing
function distributeRewards(uint256 startIndex, uint256 batchSize) external {
    uint256 end = min(startIndex + batchSize, allUsers.length);
    for (uint i = startIndex; i < end; i++) {
        token.transfer(allUsers[i], calculateReward(allUsers[i]));
    }
}

// SAFER: Pull pattern
mapping(address => uint256) public pendingRewards;

function claimReward() external {
    uint256 reward = pendingRewards[msg.sender];
    pendingRewards[msg.sender] = 0;
    token.transfer(msg.sender, reward);
}
```

**Detection:**

```
For each loop in the contract:
  1. What determines the loop bound?
     - Fixed constant → SAFE
     - Constructor parameter → SAFE (if reasonable)
     - Dynamic array length → POTENTIALLY VULNERABLE
     - Mapping iteration → VULNERABLE (can't iterate mappings, but workaround arrays are vulnerable)
  2. Can the loop bound grow with contract usage?
  3. What is the gas cost per iteration?
  4. At what size does total gas exceed 30M? (block gas limit)

If loop_bound is unbounded AND gas_per_iteration > 30M / estimated_max_users:
  → UNBOUNDED LOOP DOS
```

### Class 2: External Call Failure DoS

A single failed external call in a batch operation blocks all other operations.

```solidity
// VULNERABLE: One blacklisted user blocks ALL distributions
function distributeToAll(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        // If users[5] is USDC-blacklisted, this reverts for ALL users
        require(token.transfer(users[i], amounts[i]), "Transfer failed");
    }
}

// SAFE: Handle failures individually
function distributeToAll(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        try IERC20(token).transfer(users[i], amounts[i]) returns (bool success) {
            if (!success) emit TransferFailed(users[i], amounts[i]);
        } catch {
            emit TransferFailed(users[i], amounts[i]);
        }
    }
}
```

**Detection:**

```
For each loop containing external calls:
  1. Does a failed call revert the entire transaction? (require/revert)
  2. Is there try/catch or success-check-and-skip?
  3. Can any single address/user cause the call to fail?
     - Blacklisted address
     - Contract that reverts in receive()
     - Address that runs out of gas
  If yes → EXTERNAL CALL FAILURE DOS
```

### Class 3: Insufficient Gas Griefing (63/64 Rule)

EIP-150's 63/64 rule: when making an external call, only 63/64 of remaining gas is forwarded. An attacker can supply just enough gas for the outer function to succeed while the inner call fails.

```solidity
// VULNERABLE: Relayer pattern without gas check
function executeMetaTx(address target, bytes calldata data) external {
    // Attacker (relayer) provides just enough gas for this function
    // but NOT enough for target.call(data) to succeed
    (bool success, ) = target.call(data);
    // success = false (ran out of gas), but function doesn't revert!

    // Mark meta-tx as executed even though it failed
    executedTxs[txHash] = true; // Meta-tx permanently "used" but never executed
}

// SAFE: Verify sufficient gas and check success
function executeMetaTx(address target, bytes calldata data, uint256 gasLimit) external {
    require(gasleft() >= gasLimit * 64 / 63 + 5000, "Insufficient gas");
    (bool success, ) = target.call{gas: gasLimit}(data);
    require(success, "Execution failed");
}
```

**Detection:**

```
For each function that makes external calls:
  1. Does the function check the success of the call?
  2. If success is not required, does failure cause permanent state changes?
  3. Is the function called by untrusted relayers?
  4. Is there a minimum gas check before the external call?

  If no success check AND permanent state change on failure:
    → INSUFFICIENT GAS GRIEFING
```

### Class 4: Storage Bloat Attack

An attacker fills storage arrays/mappings to increase gas costs for other users.

```solidity
// VULNERABLE: Anyone can add entries, increasing gas for iteration
mapping(address => address[]) public userTokens;

function addToken(address token) external {
    userTokens[msg.sender].push(token);
    // No limit on how many tokens a user can add
    // Functions that iterate userTokens[user] become expensive
}

function getUserValue(address user) external view returns (uint256) {
    uint256 total = 0;
    for (uint i = 0; i < userTokens[user].length; i++) {
        // Gas cost grows linearly with array size
        total += getTokenBalance(user, userTokens[user][i]);
    }
    return total;
}
```

**Detection:**

```
For each dynamic array or mapping that grows via public/external functions:
  1. Is there a size limit?
  2. Is there a cost to adding entries (economic deterrent)?
  3. Is the array iterated in any function?
  4. Can a non-owner add entries for other users?

  If unlimited growth AND iteration exists → STORAGE BLOAT DOS
```

### Class 5: Timestamp Griefing

Attackers make minimal actions (e.g., 1 wei deposit) to reset timing mechanisms.

```solidity
// VULNERABLE: Any deposit resets withdrawal timer
function deposit() external payable {
    balances[msg.sender] += msg.value;
    lastDepositTime[msg.sender] = block.timestamp; // Reset timer
}

function withdraw() external {
    require(block.timestamp >= lastDepositTime[msg.sender] + LOCK_PERIOD, "Locked");
    // Attacker deposits 1 wei to reset victim's lock period
    // (if deposit function can set lastDepositTime for another user)
    // Or griefs themselves by resetting their own lock with 1 wei deposits
}
```

**Detection:**

```
For each timestamp-dependent mechanism (locks, cooldowns, vesting):
  1. Can the timestamp be reset by a minimal-cost action?
  2. Can the reset action be performed by someone other than the affected user?
  3. Does the reset block a valuable operation (withdrawal, claim)?

  If minimal cost reset AND blocks valuable operation → TIMESTAMP GRIEFING
```

### Class 6: Self-Destruct Force-Feeding

An attacker can force-send ETH to any contract via `selfdestruct`, bypassing receive/fallback functions. This breaks contracts that rely on `address(this).balance` for accounting.

```solidity
// VULNERABLE: Relies on address(this).balance for logic
function isFullyFunded() public view returns (bool) {
    return address(this).balance >= targetAmount;
    // Attacker can selfdestruct another contract to force-send ETH
    // Prematurely triggering "fully funded" state
}

// VULNERABLE: Uses balance for invariant
function withdraw() external {
    require(address(this).balance == totalDeposits, "Balance mismatch");
    // Force-fed ETH breaks this equality — function permanently DOSed
}

// SAFE: Track deposits internally, don't rely on balance
uint256 public totalDeposits;

function isFullyFunded() public view returns (bool) {
    return totalDeposits >= targetAmount; // Uses internal tracking
}
```

**Detection:**

```
For each use of address(this).balance:
  1. Is it used in a strict equality check (==)?
     → CRITICAL: force-fed ETH breaks equality permanently
  2. Is it used as an accounting variable?
     → HIGH: force-fed ETH inflates perceived balance
  3. Is it used for informational purposes only?
     → LOW: no security impact

  Flag all strict equality checks on address(this).balance as CRITICAL DoS
```

### Class 7: Block Stuffing

Attackers fill entire blocks with high-gas transactions to prevent time-sensitive operations from executing.

```solidity
// VULNERABLE: Time-sensitive operation without extended window
function finalizeLiquidation(uint256 id) external {
    require(block.timestamp >= liquidations[id].deadline, "Not ready");
    require(block.timestamp <= liquidations[id].deadline + 1 hours, "Expired");
    // Attacker stuffs blocks for 1 hour to prevent finalization
}

// SAFE: Reasonable window or no upper bound
function finalizeLiquidation(uint256 id) external {
    require(block.timestamp >= liquidations[id].deadline, "Not ready");
    // No upper bound — can be finalized anytime after deadline
}
```

## Workflow

```
Task Progress:
- [ ] Step 1: Find all loops and determine if bounds are dynamic/growing
- [ ] Step 2: Identify all batch operations with external calls
- [ ] Step 3: Check for insufficient gas griefing in relayer/meta-tx patterns
- [ ] Step 4: Find growing storage structures without size limits
- [ ] Step 5: Check for timestamp/cooldown reset griefing
- [ ] Step 6: Find all address(this).balance usage, especially equality checks
- [ ] Step 7: Identify time-sensitive operations vulnerable to block stuffing
- [ ] Step 8: Score findings and generate report
```

## Output Format

```markdown
## DoS & Griefing Analysis Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Category:** [Unbounded Loop | External Call DoS | Gas Griefing | Storage Bloat | Timestamp Grief | Force-Feed | Block Stuffing]
**Severity:** [CRITICAL | HIGH | MEDIUM]

**Issue:**
[Description of the DoS or griefing vulnerability]

**Growth Analysis:**
  Current users/entries: [N]
  Gas per iteration: [X gas]
  Block gas limit: 30,000,000
  Max iterations before DoS: [30M / X]
  Estimated time to DoS: [based on growth rate]

**Attack Scenario:**
1. [Step-by-step griefing or DoS attack]

**Cost to Attacker:** [gas cost, deposit required, etc.]
**Impact on Victims:** [permanent DoS, delayed operations, lost funds]

**Recommendation:**
[Pagination, pull pattern, size limits, internal accounting, etc.]
```

## Quick Detection Checklist

- [ ] Do any loops iterate over arrays that grow with contract usage?
- [ ] Do batch operations handle individual failures gracefully (try/catch)?
- [ ] Do relayer/meta-tx functions verify gas sufficiency and call success?
- [ ] Do growing storage structures have maximum size limits?
- [ ] Can timing mechanisms (locks, cooldowns) be reset at minimal cost?
- [ ] Does any logic use `address(this).balance` in a strict equality check?
- [ ] Are time-sensitive operations given reasonable execution windows?
- [ ] Do payment distributions use pull pattern instead of push?

For DoS pattern details, see [{baseDir}/references/dos-patterns.md]({baseDir}/references/dos-patterns.md).
For gas griefing vectors, see [{baseDir}/references/gas-griefing-vectors.md]({baseDir}/references/gas-griefing-vectors.md).

## Rationalizations to Reject

- "The array will never get that large" → Growth is often exponential; what's 100 today is 10,000 next month
- "Gas limits will increase" → Block gas limit increases are slow and unpredictable; don't depend on future changes
- "Nobody would pay to stuff blocks" → Block stuffing cost is often less than the value of the operation being blocked
- "The attacker gains nothing" → Griefing attacks are about harming others, not profiting; competitors and malicious actors exist
- "We can always migrate" → Migration with locked funds or broken state is extremely difficult
- "selfdestruct is being deprecated" → EIP-6780 limits selfdestruct but force-feeding is still possible during contract creation


# === END SKILL: quillai-dos-griefing ===

# === SKILL: quillai-external-call ===

---
name: external-call-safety
description: Detects unsafe external call patterns and token integration vulnerabilities in smart contracts. Covers unchecked call/delegatecall/staticcall return values, fee-on-transfer tokens, rebasing tokens, tokens with missing return values (USDT), ERC-777 callback risks, unsafe approve race conditions, return data bombs, gas stipend limitations, and push vs pull payment patterns. Use when auditing contracts that interact with external contracts, integrate arbitrary ERC20 tokens, distribute payments, or make low-level calls.
---

# External Call Safety

Detect vulnerabilities arising from **unsafe interactions with external contracts** and **non-standard token behaviors** that break protocol assumptions. Covers OWASP SC06 (Unchecked External Calls) plus the entire "weird ERC20" problem space.

## When to Use

- Auditing any contract that calls external contracts (token transfers, cross-contract interactions)
- Reviewing protocols that support arbitrary/user-supplied ERC20 tokens
- Analyzing ETH payment distribution logic (airdrops, reward distribution, refunds)
- Verifying low-level call safety (`call`, `delegatecall`, `staticcall`)
- When a protocol claims to support "any ERC20 token"

## When NOT to Use

- Reentrancy-specific analysis (use reentrancy-pattern-analysis — though there is overlap)
- Oracle/price feed analysis (use oracle-flashloan-analysis)
- Pure access control review (use semantic-guard-analysis)

## Part 1: External Call Safety

### Vulnerability Class 1: Unchecked Return Values

Low-level calls (`call`, `delegatecall`, `staticcall`) return a boolean indicating success. If unchecked, failed calls are silently ignored.

```solidity
// VULNERABLE: Return value not checked
function withdraw(uint256 amount) external {
    balances[msg.sender] -= amount;
    payable(msg.sender).call{value: amount}(""); // Can fail silently!
    // User's balance decreased but ETH not sent
}

// SAFE: Check return value
function withdraw(uint256 amount) external {
    balances[msg.sender] -= amount;
    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

**Detection Algorithm:**

```
For each low-level call expression:
  1. Is the return value captured? (bool success, bytes memory data) = ...
  2. Is the success boolean checked? require(success) or if(!success) revert
  3. If not captured or not checked → UNCHECKED RETURN VALUE

Severity:
  - ETH transfer unchecked → CRITICAL (funds lost)
  - Token operation unchecked → HIGH (state desync)
  - Non-financial call unchecked → MEDIUM
```

### Vulnerability Class 2: Gas Stipend Limitations

```solidity
// DANGEROUS: transfer() and send() forward only 2300 gas
payable(recipient).transfer(amount); // Reverts if recipient needs > 2300 gas
payable(recipient).send(amount);     // Returns false, often unchecked

// SAFE: Use call() with gas
(bool success, ) = payable(recipient).call{value: amount}("");
require(success, "Transfer failed");
```

**Why 2300 gas is dangerous:**
- Contracts with `receive()` or `fallback()` that do more than emit an event will fail
- EIP-1884 changed `SLOAD` gas cost, breaking some existing contracts
- Multi-sig wallets and smart contract wallets often need more gas

### Vulnerability Class 3: Return Data Bomb

A malicious contract can return extremely large data to consume the caller's gas.

```solidity
// Vulnerable to return data bomb
(bool success, bytes memory data) = untrustedContract.call(calldata);
// If untrustedContract returns 1MB of data, copying it costs massive gas

// SAFE: Limit return data or ignore it
(bool success, ) = untrustedContract.call(calldata); // Ignore return data
// Or use assembly to limit return data size
```

### Vulnerability Class 4: Delegatecall to Untrusted Contract

```solidity
// CRITICAL: delegatecall executes untrusted code in OUR storage context
function execute(address target, bytes calldata data) external {
    target.delegatecall(data); // Untrusted code can overwrite ANY storage
}

// delegatecall should ONLY be used with trusted, immutable targets
```

## Part 2: Token Integration Safety ("Weird ERC20" Tokens)

### Issue 1: Fee-on-Transfer Tokens

Some tokens deduct a fee during `transfer()` and `transferFrom()`. The recipient receives less than the specified amount.

```solidity
// VULNERABLE: Assumes received amount equals input amount
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    balances[msg.sender] += amount; // Credits MORE than actually received!
}

// SAFE: Check actual balance change
function deposit(uint256 amount) external {
    uint256 balanceBefore = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 balanceAfter = token.balanceOf(address(this));
    uint256 actualReceived = balanceAfter - balanceBefore;
    balances[msg.sender] += actualReceived; // Credits actual amount
}
```

**Known fee-on-transfer tokens:** STA, PAXG, USDT (fee currently 0 but can be activated), RFI/SAFEMOON forks.

### Issue 2: Rebasing Tokens

Rebasing tokens change all balances proportionally without transfers. Protocol's accounting desynchronizes from actual balances.

```solidity
// VULNERABLE: Stores absolute balance amounts
function deposit(uint256 amount) external {
    token.transferFrom(msg.sender, address(this), amount);
    userDeposit[msg.sender] = amount; // After rebase, actual balance differs!
}

// Mitigation options:
// 1. Store shares instead of amounts
// 2. Wrap rebasing token (wstETH pattern)
// 3. Explicitly state: "rebasing tokens not supported"
```

**Known rebasing tokens:** stETH, AMPL, OHM, YAM, BASED.

### Issue 3: Missing Return Values

Some tokens don't return a boolean from `transfer()`/`transferFrom()`/`approve()`, breaking the ERC20 standard.

```solidity
// VULNERABLE: Assumes return value exists
bool success = token.transfer(recipient, amount); // Reverts if token returns nothing

// SAFE: Use SafeERC20
using SafeERC20 for IERC20;
token.safeTransfer(recipient, amount); // Handles missing return values
```

**Known tokens with missing returns:** USDT, BNB, OMG, KNC (legacy versions).

### Issue 4: Tokens with Callbacks (ERC-777)

ERC-777 tokens trigger `tokensToSend()` on the sender and `tokensReceived()` on the recipient during transfers, enabling reentrancy.

```
ERC-777 callback hooks:
  transfer() → calls tokensReceived() on recipient
  transferFrom() → calls tokensToSend() on sender, tokensReceived() on recipient
  send() → calls tokensToSend() on sender, tokensReceived() on recipient

ANY of these can re-enter the calling contract!
```

**Cross-reference:** See reentrancy-pattern-analysis for detailed ERC-777 reentrancy detection.

### Issue 5: Unsafe Approve Pattern

```solidity
// VULNERABLE: Approve race condition
token.approve(spender, newAmount);
// Between the approval TX and the spending TX, the spender can:
// 1. Spend the OLD allowance
// 2. Then spend the NEW allowance
// Total spent: oldAmount + newAmount (double spending)

// SAFE: Reset to zero first, or use increaseAllowance
token.approve(spender, 0); // Reset
token.approve(spender, newAmount); // Set new

// Or use SafeERC20
token.safeIncreaseAllowance(spender, amount);

// ALSO DANGEROUS: Some tokens (USDT) revert on non-zero to non-zero approve
token.approve(spender, newAmount); // REVERTS if current allowance != 0
// MUST reset to 0 first for USDT
```

### Issue 6: Tokens with Blacklists

Some tokens can blacklist addresses, causing transfers to/from those addresses to revert.

```solidity
// VULNERABLE: Assumes transfer always succeeds for valid amounts
function distribute(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        token.transfer(users[i], amounts[i]); // Reverts if ANY user is blacklisted
        // Entire batch fails!
    }
}

// SAFE: Handle per-user failures
function distribute(address[] calldata users, uint256[] calldata amounts) external {
    for (uint i = 0; i < users.length; i++) {
        try IERC20(token).transfer(users[i], amounts[i]) {
            // Success
        } catch {
            // Log failure, skip this user, don't block others
        }
    }
}
```

**Known blacklist tokens:** USDC, USDT, TUSD.

### Issue 7: Tokens with Max Supply / Transfer Limits

Some tokens have maximum transfer amounts per transaction or maximum holding amounts per address.

```solidity
// Protocol may assume any amount can be transferred
// But some tokens: require(amount <= maxTransferAmount)
// This can brick protocols that batch large transfers
```

## Part 3: Payment Pattern Analysis

### Push vs Pull Pattern

```
PUSH (Dangerous):
  Contract sends funds TO recipients
  - Can fail if recipient is a contract that reverts
  - Can be DoS'd by one malicious recipient
  - Gas costs unpredictable

PULL (Safe):
  Recipients claim funds FROM contract
  - Each claim is independent
  - One user's failure doesn't affect others
  - Gas costs predictable per claim
```

**Detection:**

```
For each function that sends ETH or tokens to external addresses:
  If sending to user-supplied addresses in a loop → PUSH pattern
  If sending to individual addresses via claim function → PULL pattern
  PUSH pattern with untrusted recipients → HIGH risk of DoS
```

## Workflow

```
Task Progress:
- [ ] Step 1: Find all external calls (call, delegatecall, staticcall, transfer, send)
- [ ] Step 2: Verify return values are checked for all external calls
- [ ] Step 3: Identify all token interactions and classify token assumptions
- [ ] Step 4: Check for fee-on-transfer compatibility (balance before/after pattern)
- [ ] Step 5: Check for rebasing token compatibility
- [ ] Step 6: Verify SafeERC20 usage for tokens with missing return values
- [ ] Step 7: Check approve patterns for race conditions and USDT compatibility
- [ ] Step 8: Analyze payment distribution pattern (push vs pull)
- [ ] Step 9: Score findings and generate report
```

## Output Format

```markdown
## External Call Safety Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Category:** [Unchecked Return | Fee-on-Transfer | Rebasing | Missing Return | Callback | Approve Race | DoS]
**Severity:** [CRITICAL | HIGH | MEDIUM]

**Issue:**
[Description of the unsafe external call or token integration issue]

**Affected Tokens:**
[List of known tokens that trigger this issue, e.g., USDT, USDC, stETH]

**Vulnerable Code:**
[Code snippet]

**Attack Scenario:**
1. [Step-by-step exploitation]

**Recommendation:**
[Use SafeERC20, balance-before-after, pull pattern, etc.]
```

## Quick Detection Checklist

- [ ] Are ALL low-level `call` return values checked (`require(success)`)?
- [ ] Does the protocol use `SafeERC20` for all token interactions?
- [ ] Does the deposit function use balance-before-after pattern for fee-on-transfer tokens?
- [ ] Does the protocol explicitly handle or reject rebasing tokens?
- [ ] Does `approve()` reset to 0 before setting new allowance (USDT compatibility)?
- [ ] Are batch payment operations using pull pattern (not push)?
- [ ] Is `delegatecall` only used with trusted, immutable targets?
- [ ] Are return data sizes from untrusted contracts limited?
- [ ] Does the protocol handle token blacklisting gracefully?

For weird ERC20 catalog, see [{baseDir}/references/weird-erc20.md]({baseDir}/references/weird-erc20.md).
For call safety patterns, see [{baseDir}/references/call-safety-patterns.md]({baseDir}/references/call-safety-patterns.md).

## Rationalizations to Reject

- "We only support standard ERC20 tokens" → USDT is the most used token and it's non-standard (no return value, fee capability)
- "The call will always succeed" → Smart contract wallets, blacklisted addresses, and gas changes can cause failures
- "We trust the token contract" → Token contracts can be upgraded (proxies) or have hidden features
- "transfer() is safe enough" → 2300 gas stipend breaks with gas repricing EIPs; use call()
- "We checked the token before listing" → Fee-on-transfer can be toggled on after listing (USDT has this capability)
- "Rebasing tokens are rare" → stETH is one of the largest tokens by TVL


# === END SKILL: quillai-external-call ===

# === SKILL: quillai-input-arithmetic ===

---
name: input-arithmetic-safety
description: Detects input validation failures and arithmetic vulnerabilities in smart contracts. Covers missing zero-address and zero-amount checks, division-before-multiplication precision loss, rounding direction exploitation, ERC4626 vault share inflation attacks, unsafe integer casting, dust amount exploitation, and Solidity 0.8+ unchecked block edge cases. Use when auditing contracts with fee calculations, share pricing, exchange rates, unchecked blocks, or any public-facing functions that accept user input.
---

# Input & Arithmetic Safety

Detect **input validation failures** (the #1 direct exploitation cause at 34.6% of all contract exploits) and **arithmetic vulnerabilities** that persist even with Solidity 0.8+ checked math — precision loss, rounding exploitation, unsafe casting, and share price manipulation.

## When to Use

- Auditing any contract with public/external functions accepting user-supplied parameters
- Reviewing DeFi protocols with fee calculations, share pricing, or exchange rates
- Analyzing vault/staking contracts for rounding or first-depositor attacks
- Checking contracts with `unchecked` blocks for overflow/underflow risks
- Verifying arithmetic in token minting, burning, and distribution logic

## When NOT to Use

- Access control analysis (use semantic-guard-analysis)
- Reentrancy detection (use reentrancy-pattern-analysis)
- Full multi-dimensional audit (use behavioral-state-analysis)

## Part 1: Input Validation Analysis

### Critical Missing Validations

**Zero Address Check:**

```solidity
// VULNERABLE: No zero address check
function setAdmin(address newAdmin) external onlyOwner {
    admin = newAdmin; // Can set admin to address(0) — locking out admin forever
}

// SAFE
function setAdmin(address newAdmin) external onlyOwner {
    require(newAdmin != address(0), "Zero address");
    admin = newAdmin;
}
```

**Zero Amount Check:**

```solidity
// VULNERABLE: Allows zero-amount operations
function deposit(uint256 amount) external {
    balances[msg.sender] += amount;
    emit Deposit(msg.sender, amount);
    // Zero deposit: wastes gas, pollutes events, may affect accounting
}

// SAFE
function deposit(uint256 amount) external {
    require(amount > 0, "Zero amount");
    balances[msg.sender] += amount;
}
```

**Array Length Validation:**

```solidity
// VULNERABLE: No length check
function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
    for (uint i = 0; i < recipients.length; i++) {
        transfer(recipients[i], amounts[i]); // Out-of-bounds if arrays differ in length
    }
}

// SAFE
function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
    require(recipients.length == amounts.length, "Length mismatch");
    require(recipients.length <= MAX_BATCH_SIZE, "Batch too large");
    // ...
}
```

**Bounds Checking:**

```solidity
// VULNERABLE: No upper bound on fee
function setFee(uint256 newFee) external onlyOwner {
    fee = newFee; // Owner can set 100% fee, stealing all user funds
}

// SAFE
function setFee(uint256 newFee) external onlyOwner {
    require(newFee <= MAX_FEE, "Fee too high"); // e.g., MAX_FEE = 1000 (10%)
    fee = newFee;
}
```

### Input Validation Detection Algorithm

```
For each public/external function F:
  For each parameter P:
    1. Is P an address? → Check for require(P != address(0))
    2. Is P an amount/value? → Check for require(P > 0) if zero is invalid
    3. Is P an array? → Check for length validation and max size
    4. Is P a percentage/rate? → Check for upper bound
    5. Is P used as an index? → Check for bounds checking
    6. Is P a deadline/timestamp? → Check for require(P > block.timestamp)

  Flag any parameter without appropriate validation as:
    - CRITICAL if parameter controls fund flow or access
    - HIGH if parameter affects protocol state
    - MEDIUM if parameter affects non-critical functionality
```

## Part 2: Arithmetic Vulnerability Analysis

### Pattern 1: Division-Before-Multiplication (Precision Loss)

```solidity
// VULNERABLE: Division first truncates, then multiplication amplifies error
uint256 result = (amount / totalShares) * price;
// If amount = 100, totalShares = 3: 100/3 = 33 (truncated from 33.33)
// 33 * price = less than expected

// SAFE: Multiply first, then divide
uint256 result = (amount * price) / totalShares;
// 100 * price / 3 = more precise (only one truncation at the end)
```

**Detection:**

```
For each arithmetic expression:
  If division (/) appears BEFORE multiplication (*) in the same expression:
    → PRECISION LOSS: division-before-multiplication
  Exception: If the division result is stored and intentionally used as a floored value
```

### Pattern 2: Rounding Direction Exploitation

In financial protocols, rounding direction determines who benefits:

```
Protocol-favorable rounding:
  - Deposits: round DOWN shares (user gets fewer shares)
  - Withdrawals: round DOWN assets (user gets fewer assets)
  - Fees: round UP fee amount (protocol collects more)

User-favorable rounding (VULNERABLE to extraction):
  - Deposits: round UP shares → user gets more than entitled
  - Withdrawals: round UP assets → user extracts more than entitled
  - Fees: round DOWN → protocol collects less
```

```solidity
// VULNERABLE: Rounds in user's favor on withdrawal
function withdraw(uint256 shares) external returns (uint256 assets) {
    assets = (shares * totalAssets()) / totalSupply(); // Rounds DOWN — correct for withdrawal
    // BUT if this rounds UP somehow (e.g., via ceiling division):
    assets = (shares * totalAssets() + totalSupply() - 1) / totalSupply(); // Rounds UP — BAD
}

// SAFE: Use mulDiv with explicit rounding direction
assets = shares.mulDiv(totalAssets(), totalSupply(), Math.Rounding.Down); // For withdrawals
shares = assets.mulDiv(totalSupply(), totalAssets(), Math.Rounding.Up);   // For deposits
```

### Pattern 3: ERC4626 Vault Share Inflation Attack

```solidity
// Attack on first deposit
contract VulnerableVault is ERC4626 {
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)); // Manipulable via donation!
    }

    // No virtual shares offset
    function _convertToShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : assets.mulDiv(supply, totalAssets());
    }
}
```

**Attack Sequence:**

```
1. Vault is empty (totalSupply = 0, totalAssets = 0)
2. Attacker deposits 1 wei → receives 1 share
3. Attacker donates 1000 tokens directly to vault (not via deposit)
4. totalAssets = 1000e18 + 1, totalSupply = 1
5. Victim deposits 500 tokens:
   shares = 500e18 * 1 / (1000e18 + 1) = 0 (rounds to zero!)
6. Victim gets ZERO shares, their 500 tokens are trapped
7. Attacker withdraws 1 share → gets all 1500+ tokens
```

**Detection:**

```
For ERC4626 vaults:
  1. Does totalAssets() use balanceOf(address(this))? → Donation-attackable
  2. Is there a virtual shares/assets offset? → Missing = VULNERABLE
  3. Is there a minimum first deposit? → Missing = VULNERABLE
  4. Does the vault use OpenZeppelin's _decimalsOffset()? → Present = Mitigated
```

### Pattern 4: Unsafe Integer Casting

```solidity
// VULNERABLE: Silent truncation
uint256 largeValue = 2**200;
uint128 smallValue = uint128(largeValue); // Truncated! No revert in 0.8+

// VULNERABLE: Signed/unsigned confusion
int256 negative = -1;
uint256 converted = uint256(negative); // = type(uint256).max in 0.8+

// SAFE: Use SafeCast
uint128 smallValue = SafeCast.toUint128(largeValue); // Reverts if overflow
```

**Detection:**

```
For each type cast operation:
  If casting from larger to smaller type (e.g., uint256 → uint128):
    Check if preceded by bounds validation
    If no bounds check → UNSAFE CASTING
  If casting between signed and unsigned:
    Check if value can be negative
    If possible → SIGN CONFUSION
```

### Pattern 5: Unchecked Block Risks

```solidity
// Solidity 0.8+: checked math by default, but unchecked{} disables it
unchecked {
    // VULNERABLE: Overflow/underflow silently wraps
    uint256 result = a - b; // If b > a: wraps to huge number
    uint256 sum = a + b;    // If a + b > type(uint256).max: wraps to small number
}

// SAFE use of unchecked (when overflow is impossible):
unchecked {
    ++i; // In a bounded for loop — i cannot overflow uint256
}
```

**Detection:**

```
For each unchecked block:
  For each arithmetic operation inside:
    1. Can the operation overflow/underflow?
    2. Is there a pre-condition that guarantees safety?
    3. If no guarantee → UNCHECKED OVERFLOW/UNDERFLOW risk

  Common safe patterns (don't flag):
    - Loop counter increment: unchecked { ++i; } in for loop with bounded length
    - Post-require subtraction: require(a >= b); unchecked { a - b; }
```

### Pattern 6: Dust Amount Exploitation

```solidity
// VULNERABLE: Tiny amounts bypass fee logic
function swap(uint256 amountIn) external {
    uint256 fee = amountIn * FEE_BPS / 10000;
    // If amountIn = 1 and FEE_BPS = 30: fee = 30/10000 = 0
    // Zero fee! Attacker makes many tiny swaps to avoid fees
    uint256 amountOut = amountIn - fee;
}
```

**Detection:**

```
For each fee/tax calculation:
  If fee = amount * rate / denominator:
    Can amount * rate < denominator? (making fee = 0)
    If yes → DUST AMOUNT EXPLOITATION: zero-fee transactions possible
```

## Workflow

```
Task Progress:
- [ ] Step 1: Audit all public/external function parameters for missing validation
- [ ] Step 2: Find division-before-multiplication patterns
- [ ] Step 3: Verify rounding direction in share/price calculations (protocol-favorable)
- [ ] Step 4: Check ERC4626 vaults for inflation attack protection
- [ ] Step 5: Identify all type casting operations and verify bounds
- [ ] Step 6: Analyze all unchecked blocks for overflow/underflow risks
- [ ] Step 7: Check fee calculations for dust amount exploitation
- [ ] Step 8: Score findings and generate report
```

## Output Format

```markdown
## Input & Arithmetic Safety Report

### Finding: [Title]

**Function:** `functionName()` at `Contract.sol:L42`
**Category:** [Missing Validation | Precision Loss | Rounding | Inflation | Unsafe Cast | Unchecked | Dust]
**Severity:** [CRITICAL | HIGH | MEDIUM | LOW]

**Issue:**
[Description of the input validation or arithmetic vulnerability]

**Vulnerable Code:**
[Code snippet showing the issue]

**Exploit Scenario:**
1. [Step-by-step exploitation]

**Mathematical Proof:**
  Input: [values]
  Expected: [correct result]
  Actual: [incorrect result due to precision/rounding]
  Difference: [loss amount]

**Recommendation:**
[Specific fix — add validation, reorder operations, use SafeCast, add rounding]
```

## Quick Detection Checklist

- [ ] Do all public functions validate address parameters against `address(0)`?
- [ ] Do all amount parameters check for `> 0` where zero is invalid?
- [ ] Are array parameters checked for equal lengths and maximum size?
- [ ] Do all percentage/rate parameters have upper bounds?
- [ ] Is division always performed AFTER multiplication (not before)?
- [ ] Does rounding favor the protocol (down on deposits, down on withdrawals of assets)?
- [ ] Do ERC4626 vaults use virtual shares/assets offset against inflation?
- [ ] Are all downcasts (uint256 → smaller) protected by SafeCast or bounds checks?
- [ ] Are `unchecked` blocks only used where overflow/underflow is mathematically impossible?
- [ ] Can fee calculations produce zero for small but valid amounts?

For precision patterns, see [{baseDir}/references/precision-patterns.md]({baseDir}/references/precision-patterns.md).
For validation checklist, see [{baseDir}/references/validation-checklist.md]({baseDir}/references/validation-checklist.md).

## Rationalizations to Reject

- "Solidity 0.8+ has checked math" → `unchecked` blocks exist; precision loss and rounding are NOT overflow
- "The fee is too small to matter" → Millions of small transactions compound; zero-fee dust swaps are profitable
- "No one would deposit 1 wei" → ERC4626 inflation attack uses exactly this; front-runners are automated
- "The admin wouldn't set a bad value" → Admin key compromise + no bounds = instant parameter manipulation
- "Rounding errors are just 1 wei" → 1 wei per transaction × millions of transactions = significant loss
- "Zero address can't sign transactions" → But setting admin to zero address locks out all admin functions permanently


# === END SKILL: quillai-input-arithmetic ===

# === SKILL: scv-scan ===

# Smart Contract Vulnerability Auditor

You are a smart contract security auditor. Your task is to systematically audit a Solidity codebase for vulnerabilities using a three-phase approach that balances thoroughness with efficiency.

## Repository Structure

```
references/
  CHEATSHEET.md          # Condensed pattern reference — always read first
  reentrancy.md          # Full reference files — read selectively in Phase 3
  overflow-underflow.md
  ...
```

## Reference File Format

Each full reference file in `references/` has these sections:

- **Preconditions** — what must be true for the vulnerability to exist
- **Vulnerable Pattern** — annotated Solidity anti-pattern
- **Detection Heuristics** — step-by-step reasoning to confirm the vulnerability
- **False Positives** — when the pattern appears but isn't exploitable
- **Remediation** — how to fix it

## Audit Workflow

### Phase 1: Load the Cheatsheet

**Before touching any Solidity files**, read `references/CHEATSHEET.md` in full.

This file contains a condensed entry for every known vulnerability class: name, what to look for (syntactic and semantic), and default severity. Internalize these patterns — they are your detection surface for the sweep phase. Do NOT read any full reference files yet.

### Phase 2: Codebase Sweep

Perform two complementary passes over the codebase.

#### Pass A: Syntactic Grep Scan

Search for the trigger patterns listed in the cheatsheet under "Grep-able keywords". Use grep, ripgrep, or equivalent to find

For each match, record: file, line number(s), matched pattern, and suspected vulnerability type(s).

#### Pass B: Structural / Semantic Analysis

This pass catches vulnerabilities that have no reliable grep signature. Read through the codebase searching for any relevant logic similar to that explained in the cheatsheet.

For each finding in this pass, record: file, line number(s), description of the concern, and suspected vulnerability type(s).

#### Compile Candidate List

Merge results from Pass A and Pass B into a deduplicated candidate list. Each entry should look like:

```
- File: `path/to/file.sol` L{start}-L{end}
- Suspected: [vulnerability-name] (from CHEATSHEET.md)
- Evidence: [brief description of what was found]
```

### Phase 3: Selective Deep Validation

For each candidate in the list:

1. **Read the full reference file** for the suspected vulnerability type (e.g., `references/reentrancy.md`). Read it now — not before.
2. **Walk through every Detection Heuristic step** against the actual code. Be precise — trace variable values, check modifiers, follow call chains.
3. **Check every False Positive condition**. If any false positive condition matches, discard the finding and note why.
4. **Cross-reference**: one code location can match multiple vulnerability types. If the cheatsheet maps the same pattern to multiple references, read and validate against each.
5. **Confirm or discard.** Only confirmed findings go into the final report.

### Phase 4: Report

For each confirmed finding, output:

```
### [Vulnerability Name]

**File:** `path/to/file.sol` L{start}-L{end}
**Severity:** Critical | High | Medium | Low | Informational

**Description:** What is vulnerable and why, in 1-3 sentences.

**Code:**
\`\`\`solidity
// The vulnerable code snippet
\`\`\`

**Recommendation:** Specific fix, referencing the Remediation section of the reference file.
```

After all findings, include a summary section:

```
## Summary

| Severity | Count |
|----------|-------|
| Critical | N     |
| High     | N     |
| Medium   | N     |
| Low      | N     |
| Info     | N     |
```

Write the final report to `scv-scan.md`

## Severity Guidelines

- **Critical**: Direct loss of funds, unauthorized fund extraction, permanent freezing of funds
- **High**: Conditional fund loss, access control bypass, state corruption exploitable under realistic conditions
- **Medium**: Unlikely fund loss, griefing attacks, DoS on non-critical paths, value leak under edge conditions
- **Low**: Best practice violations, gas inefficiency, code quality issues with no direct exploit path
- **Informational**: Unused variables, style issues, documentation gaps

## Key Principles

- **Cheatsheet first, references on-demand.** Never read all full reference files upfront. The cheatsheet gives you ambient awareness; full references are for validation only.
- **Semantic > syntactic.** The hardest bugs don't grep. Cross-function reentrancy, missing access control, incorrect inheritance — these require reading and reasoning, not pattern matching.
- **Trace across boundaries.** Follow state across function calls, contract calls, and inheritance chains. Hidden external calls (safe mint/transfer hooks, ERC-777 callbacks) are as dangerous as explicit `.call()`.
- **One location, multiple bugs.** A single line can be vulnerable to reentrancy AND unchecked return value. Check all applicable references.
- **Version matters.** Always check `pragma solidity` — many vulnerabilities are version-dependent (e.g., overflow is checked by default in ≥0.8.0).
- **False positives are noise.** Be rigorous about checking false positive conditions. A shorter report with high-confidence findings is more valuable than a long one padded with maybes.

# === END SKILL: scv-scan ===

# === SKILL: scv-scan-cheatsheet ===

# Vulnerability Cheatsheet

Quick-reference for identifying smart contract vulnerabilities during codebase scanning. Each section points to its full reference file for detailed analysis.

---

## Arbitrary Storage Location

**Reference:** `arbitrary-storage-location.md`

User-controlled index on a dynamic array write (or `sstore` with user-controlled slot) allows overwriting any storage slot, including `owner`. The attacker computes an index that maps through the array's keccak256 layout to target critical slots.

```solidity
data[index] = value; // index from user input, no bounds check
```

### Grep-able keywords
`sstore`, `.length =`, `data[`, `array[`

---

## Asserting Contract from Code Size

**Reference:** `asserting-contract-from-code-size.md`

Using `extcodesize` or `.code.length == 0` to check if the caller is an EOA is bypassable -- contracts calling from their constructor have a code size of 0.

```solidity
require(msg.sender.code.length == 0, "no contracts");
```

### Grep-able keywords
`extcodesize`, `.code.length`, `isContract`

---

## Authorization Through tx.origin

**Reference:** `authorization-txorigin.md`

Using `tx.origin` for authorization allows phishing attacks: if the owner calls a malicious contract, that contract can call back into the victim contract and `tx.origin` will still be the owner. Use `msg.sender` instead.

```solidity
require(tx.origin == owner, "not owner");
```

### Grep-able keywords
`tx.origin`

---

## Delegatecall to Untrusted Callee

**Reference:** `delegatecall-untrusted-callee.md`

If the target of a `delegatecall` is user-controlled or set by an unprotected function, an attacker can execute arbitrary code in the context of the calling contract's storage, overwriting critical state like `owner`.

```solidity
(bool success,) = callee.delegatecall(data); // callee from user input
```

### Grep-able keywords
`delegatecall`, `setImplementation`, `upgradeTo`

---

## DoS with Block Gas Limit

**Reference:** `dos-gas-limit.md`

Iterating over an unbounded dynamic array in a single transaction will eventually exceed the block gas limit as the array grows, permanently bricking the function. Replace push-payment with pull-payment or add batching/pagination.

```solidity
for (uint256 i = 0; i < recipients.length; i++) {
    payable(recipients[i]).transfer(reward);
}
```

### Grep-able keywords
`for (`, `while (`, `.length`, `.push(`

---

## DoS with (Unexpected) Revert

**Reference:** `dos-revert.md`

A single reverting external call inside a loop blocks the entire function. Also: strict balance equality checks (`address(this).balance ==`) can be broken by force-sent ETH via `selfdestruct`, and unvalidated division denominators cause revert.

```solidity
require(payable(recipients[i]).send(amounts[i]), "transfer failed"); // in loop
require(address(this).balance == expectedBalance); // broken by selfdestruct
```

### Grep-able keywords
`selfdestruct`, `.balance ==`, `.send(`, `.transfer(`, `require(success`

---

## Hash Collision with abi.encodePacked

**Reference:** `hash-collision.md`

When `abi.encodePacked` has two or more adjacent variable-length arguments (string, bytes, dynamic arrays), bytes can shift between arguments to produce the same encoding: `encodePacked("a","bc") == encodePacked("ab","c")`. Use `abi.encode` instead.

```solidity
keccak256(abi.encodePacked(stringA, stringB)); // collision possible
```

### Grep-able keywords
`abi.encodePacked`

---

## Inadherence to Standards

**Reference:** `inadherence-to-standards.md`

Token implementations may deviate from ERC20/ERC721 specs (missing return values, missing events). Token integrations that use raw `IERC20.transfer()` instead of `SafeERC20` break on non-compliant tokens (USDT). Hardcoding 18 decimals or ignoring fee-on-transfer is also a risk.

```solidity
require(token.transfer(to, amount)); // reverts on USDT (no return value)
```

### Grep-able keywords
`SafeERC20`, `safeTransfer`, `safeTransferFrom`, `.transfer(`, `.transferFrom(`, `.approve(`, `decimals`

---

## Incorrect Constructor Name

**Reference:** `incorrect-constructor.md`

In Solidity <0.4.22, constructors are named functions matching the contract name. A typo or case mismatch (e.g., `owned()` vs `Owned`) makes the constructor a regular public function anyone can call to seize ownership.

```solidity
contract Owned {
    function owned() public { owner = msg.sender; } // case mismatch!
}
```

### Grep-able keywords
`pragma solidity 0.4`, `function Wallet`, `function owned`

---

## Insufficient Access Control

**Reference:** `insufficient-access-control.md`

State-changing functions (ownership transfer, fee setting, minting, pausing) that lack access control modifiers or `require(msg.sender == ...)` checks are callable by anyone. Also check that `initialize()` in upgradeable contracts has the `initializer` modifier.

```solidity
function setOwner(address newOwner) external { owner = newOwner; } // no auth
```

### Grep-able keywords
`onlyOwner`, `onlyRole`, `msg.sender ==`, `initialize(`, `initializer`

---

## Insufficient Gas Griefing

**Reference:** `insufficient-gas-griefing.md`

In meta-transaction/relayer patterns, if replay protection (nonce marking) occurs before the sub-call and the relayer controls forwarded gas, the relayer can provide insufficient gas to silently fail the inner call while permanently consuming the nonce, censoring the action.

```solidity
executed[nonce] = true; // marked before sub-call
(bool success,) = target.call{gas: gasLimit}(data); // may silently fail
```

### Grep-able keywords
`gasleft()`, `.call{gas:`, `executed[`, `nonce`, `meta-transaction`, `relayer`

---

## Lack of Precision

**Reference:** `lack-of-precision.md`

Division before multiplication truncates intermediate results and compounds rounding error. If the numerator is smaller than the denominator, the result truncates to zero. Always multiply first, then divide.

```solidity
uint256 dailyRate = amount / 365;       // truncates
uint256 fee = dailyRate * daysEarly;     // wrong -- should be amount * daysEarly / 365
```

### Grep-able keywords
`/ `, `* `, `WAD`, `RAY`, `1e18`, `mulDiv`

---

## Missing Protection Against Signature Replay

**Reference:** `missing-protection-signature-replay.md`

If a signed message hash does not include a nonce, `address(this)`, and `block.chainid`, signatures can be replayed on the same contract, across contracts, or across chains. Use EIP-712 with a domain separator.

```solidity
bytes32 hash = keccak256(abi.encodePacked(to, amount)); // no nonce, no address, no chainid
```

### Grep-able keywords
`ecrecover`, `ECDSA.recover`, `nonces`, `block.chainid`, `address(this)`, `EIP712`, `domainSeparator`

---

## msg.value Reuse in Loops

**Reference:** `msgvalue-loop.md`

`msg.value` is constant for the entire transaction. Using it inside a loop allows a single payment to pass a `require(msg.value >= price)` check on every iteration, letting the caller buy N items for the price of one.

```solidity
for (uint256 i = 0; i < ids.length; i++) {
    require(msg.value >= price); // passes every iteration with one payment
    _mint(msg.sender, ids[i]);
}
```

### Grep-able keywords
`msg.value`, `multicall`, `delegatecall`

---

## Off-By-One Errors

**Reference:** `off-by-one.md`

Incorrect loop boundaries (`< length - 1` skips last element, `<= length` goes out of bounds) and wrong comparison operators at thresholds (`<` vs `<=`) cause elements to be skipped, out-of-bounds access, or incorrect boundary enforcement.

```solidity
for (uint256 i = 0; i < users.length - 1; i++) // skips last user
```

### Grep-able keywords
`length - 1`, `<= length`, `< length`

---

## Outdated Compiler Version

**Reference:** `outdated-compiler-version.md`

Using an old Solidity version misses critical security features (e.g., <0.8.0 has no built-in overflow checks) and may contain known compiler bugs. Check `pragma solidity` against the latest stable release and the known bugs list.

### Grep-able keywords
`pragma solidity`

---

## Integer Overflow and Underflow

**Reference:** `overflow-underflow.md`

In Solidity <0.8.0, arithmetic wraps silently. In >=0.8.0, arithmetic inside `unchecked {}` or `assembly {}` blocks still wraps. Type downcasts (e.g., `uint8(bigValue)`) silently truncate in all versions.

```solidity
unchecked { x += 1; }       // wraps to 0 at max
uint8 small = uint8(256);   // truncates to 0
```

### Grep-able keywords
`unchecked`, `SafeMath`, `SafeCast`, `uint8(`, `uint16(`, `int8(`, `assembly`

---

## Reentrancy

**Reference:** `reentrancy.md`

If a contract makes an external call (`.call()`, `.send()`, `.transfer()`, `_safeMint()`, ERC777/ERC1155 hooks) before updating state, the callee can re-enter and exploit stale state. Follow checks-effects-interactions or use `nonReentrant`.

```solidity
(bool success,) = msg.sender.call{value: bal}("");  // external call
balances[msg.sender] = 0;                           // state update AFTER -- vulnerable
```

### Grep-able keywords
`.call{value`, `.send(`, `.transfer(`, `_safeMint`, `_safeTransfer`, `onERC721Received`, `onERC1155Received`, `tokensReceived`, `nonReentrant`, `ReentrancyGuard`

---

## Requirement Violation

**Reference:** `requirement-violation.md`

`require()` conditions that use `>` instead of `>=` (or vice versa) reject valid inputs or accept invalid ones. Also, `require` on external call return values may break on non-compliant tokens (e.g., USDT returns no bool).

```solidity
require(balances[msg.sender] > amount); // should be >= to allow exact balance
```

### Grep-able keywords
`require(`, `assert(`

---

## Shadowing State Variables

**Reference:** `shadowing-state-variables.md`

In Solidity <0.6.0, a child contract can re-declare a state variable with the same name as a parent's, creating two separate storage slots. Parent functions read the parent's variable while child functions read the child's, causing inconsistent behavior.

```solidity
contract Child is Base {
    address public owner; // shadows Base.owner -- two different variables
}
```

### Grep-able keywords
`is `, `override`, `virtual`

---

## Timestamp Dependence

**Reference:** `timestamp-dependence.md`

`block.timestamp` can be manipulated by validators within ~15 seconds. Using it for randomness is always exploitable. Using it in tight conditional windows (<=15s) allows validators to include/exclude transactions. Safe for large time windows (hours/days).

```solidity
uint256 result = uint256(keccak256(abi.encodePacked(block.timestamp))) % 6;
```

### Grep-able keywords
`block.timestamp`, `now`, `block.number`

---

## Transaction-Ordering Dependence (Frontrunning)

**Reference:** `transaction-ordering-dependence.md`

Functions whose outcome depends on transaction ordering (swaps without slippage protection, on-chain secret submissions, ERC20 approve race conditions) are vulnerable to frontrunning/sandwiching from mempool observers.

```solidity
function swap(address tokenIn, address tokenOut, uint256 amountIn) external {
    // no minAmountOut -- sandwich attack possible
}
```

### Grep-able keywords
`minAmountOut`, `deadline`, `slippage`, `approve(`, `increaseAllowance`, `commit`, `reveal`

---

## Unchecked Return Values

**Reference:** `unchecked-return-values.md`

Low-level calls (`.call()`, `.send()`, `.delegatecall()`) return a boolean but do not revert on failure. If the return value is not checked, execution continues with state updates that assume success.

```solidity
msg.sender.send(amount);     // return value ignored -- silent failure
totalPaid += amount;          // updated even if send failed
```

### Grep-able keywords
`.call(`, `.send(`, `.delegatecall(`, `require(success`

---

## Unencrypted Private Data On-Chain

**Reference:** `unencrypted-private-data-on-chain.md`

The `private` visibility modifier only prevents other contracts from reading the variable. Anyone can read any storage slot via `eth_getStorageAt`. Never store plaintext secrets, passwords, or keys on-chain.

```solidity
bytes32 private secretAnswer; // readable via eth_getStorageAt
```

### Grep-able keywords
`private`, `secret`, `password`, `key`, `answer`

---

## Unexpected ecrecover Null Address

**Reference:** `unexpected-ecrecover-null-address.md`

`ecrecover` returns `address(0)` for invalid signatures. If the recovered address is not checked against `address(0)` and the expected signer is uninitialized (defaults to `address(0)`), the auth check passes for anyone. Use OpenZeppelin's `ECDSA.recover`.

```solidity
address recovered = ecrecover(hash, v, r, s);
require(recovered == signer); // if signer is address(0), any invalid sig passes
```

### Grep-able keywords
`ecrecover`, `address(0)`, `ECDSA.recover`

---

## Uninitialized Storage Pointer

**Reference:** `uninitialized-storage-pointer.md`

In Solidity <0.5.0, local struct/array variables without an explicit `memory` or `storage` keyword default to `storage` at slot 0, silently overwriting early state variables (e.g., `owner`) on assignment.

```solidity
User u;           // defaults to storage slot 0 in <0.5.0
u.addr = _addr;   // overwrites slot 0 (e.g., owner)
```

### Grep-able keywords
`pragma solidity 0.4`, `storage`, `memory`

---

## Unsupported Opcodes

**Reference:** `unsupported-opcodes.md`

Contracts compiled with Solidity >=0.8.20 emit the `PUSH0` opcode, which is unsupported on some chains. `.transfer()` and `.send()` use a 2300 gas stipend that is insufficient on chains like zkSync Era. Dynamic `create`/`create2` with runtime bytecode fails on zkSync.

```solidity
payable(msg.sender).transfer(amount); // 2300 gas -- fails on zkSync Era
```

### Grep-able keywords
`pragma solidity 0.8.20`, `.transfer(`, `.send(`, `PUSH0`, `selfdestruct`, `create(`, `create2(`

---

## Use of Deprecated Functions

**Reference:** `use-of-deprecated-functions.md`

Deprecated Solidity keywords (`suicide`, `sha3`, `block.blockhash`, `callcode`, `throw`, `msg.gas`, `constant` as function modifier, `var`) may behave unexpectedly or fail to compile on newer versions. `selfdestruct` is also deprecated post-Dencun.

### Grep-able keywords
`suicide`, `sha3`, `block.blockhash`, `callcode`, `throw`, `msg.gas`, `selfdestruct`, `constant`, `var `

---

## Weak Sources of Randomness

**Reference:** `weak-sources-randomness.md`

Randomness derived from on-chain data (`block.timestamp`, `block.prevrandao`, `blockhash`, `block.number`) is deterministic and publicly visible. Another contract in the same transaction can compute the identical "random" value and only call when the outcome is favorable. Use Chainlink VRF.

```solidity
uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao))) % 100;
```

### Grep-able keywords
`block.prevrandao`, `block.difficulty`, `blockhash`, `block.timestamp`, `keccak256`, `% `

---

## Assert Violation

**Reference:** `assert-violation.md`

`assert()` should only be used for invariants that can never fail in a correct contract. Using it for input validation or external call checks wastes all remaining gas on failure (<0.8.0) and provides no custom error message. Use `require()` instead.

```solidity
assert(balances[msg.sender] >= amount); // wrong -- should be require
```

### Grep-able keywords
`assert(`

---

## Incorrect Inheritance Order

**Reference:** `incorrect-inheritance-order.md`

Solidity's C3 linearization gives precedence to the rightmost parent in the inheritance list. If two parents define the same function, the wrong order silently resolves to the unintended parent's implementation. Order from most base (left) to most derived (right).

```solidity
contract Treasury is Governance, Ownable { } // Ownable.owner() wins (rightmost)
```

### Grep-able keywords
`is `, `override(`, `virtual`, `super.`

---

## Unsecure Signatures (Composite)

**Reference:** `unsecure-signatures.md`

A composite vulnerability covering all signature anti-patterns: missing replay protection (no nonce/chainId/address), signature malleability (tracking by raw bytes), unchecked ecrecover null address, hash collisions from `abi.encodePacked` with dynamic types, and absence of EIP-712 structured signing.

```solidity
bytes32 hash = keccak256(abi.encodePacked(to, amount)); // no nonce, no chainid
address recovered = ecrecover(hash, v, r, s);            // no null check
require(!used[sig]); used[sig] = true;                    // malleable bypass
```

### Grep-able keywords
`ecrecover`, `ECDSA.recover`, `abi.encodePacked`, `used[sig]`, `EIP712`, `domainSeparator`

---

## Unbounded Return Data

**Reference:** `unbounded-return-data.md`

When `.call()` targets an untrusted address, Solidity automatically copies all return data into memory. A malicious callee can return megabytes of data, causing quadratic memory expansion costs and an out-of-gas revert. Use assembly to bound `returndatacopy`.

```solidity
(bool success,) = callback.call(data); // attacker returns huge data, OOG
```

### Grep-able keywords
`returndatasize`, `returndatacopy`, `ExcessivelySafeCall`, `.call(`

---

## Unused Variables

**Reference:** `unused-variables.md`

Unused state variables, parameters, or discarded return values may indicate dead code or missing logic (e.g., an unchecked transfer return value). Each unused variable should be evaluated: is it safe to remove, or does it signal a bug?

### Grep-able keywords
Compiler warnings; no single keyword -- review declarations vs. references.

---

## Signature Malleability

**Reference:** `signature-malleability.md`

For every ECDSA signature `(r, s, v)`, a complementary signature `(r, n-s, flipped_v)` also recovers to the same address. If deduplication is done by raw signature bytes (`mapping(bytes => bool)`), an attacker can submit the malleable variant to bypass replay protection. Use OpenZeppelin's ECDSA library or track by nonce/hash.

```solidity
mapping(bytes => bool) public usedSignatures; // malleable bypass
```

### Grep-able keywords
`mapping(bytes =>`, `usedSignatures`, `ecrecover`, `ECDSA.recover`

---

## Unsafe Low-Level Call

**Reference:** `unsafe-low-level-call.md`

Low-level `.call()` to an address with no deployed code silently succeeds (the EVM treats it as a successful no-op). Unchecked return values compound the issue. Verify target has code (`target.code.length > 0`) and always check the return boolean.

```solidity
(bool success,) = target.call(data); // succeeds even if target has no code
require(success);                     // passes -- no actual execution occurred
```

### Grep-able keywords
`.call(`, `.delegatecall(`, `.staticcall(`, `.code.length`, `require(success`


# === END SKILL: scv-scan-cheatsheet ===

# === SKILL: tob-spec-compliance ===

---
name: spec-to-code-compliance
description: Verifies code implements exactly what documentation specifies for blockchain audits. Use when comparing code against whitepapers, finding gaps between specs and implementation, or performing compliance checks for protocol implementations.
---

## When to Use

Use this skill when you need to:
- Verify code implements exactly what documentation specifies
- Audit smart contracts against whitepapers or design documents
- Find gaps between intended behavior and actual implementation
- Identify undocumented code behavior or unimplemented spec claims
- Perform compliance checks for blockchain protocol implementations

**Concrete triggers:**
- User provides both specification documents AND codebase
- Questions like "does this code match the spec?" or "what's missing from the implementation?"
- Audit engagements requiring spec-to-code alignment analysis
- Protocol implementations being verified against whitepapers

## When NOT to Use

Do NOT use this skill for:
- Codebases without corresponding specification documents
- General code review or vulnerability hunting (use audit-context-building instead)
- Writing or improving documentation (this skill only verifies compliance)
- Non-blockchain projects without formal specifications

# Spec-to-Code Compliance Checker Skill

You are the **Spec-to-Code Compliance Checker** — a senior-level blockchain auditor whose job is to determine whether a codebase implements **exactly** what the documentation states, across logic, invariants, flows, assumptions, math, and security guarantees.

Your work must be:
- deterministic
- grounded in evidence
- traceable
- non-hallucinatory
- exhaustive

---

# GLOBAL RULES

- **Never infer unspecified behavior.**
- **Always cite exact evidence** from:
  - the documentation (section/title/quote)
  - the code (file + line numbers)
- **Always provide a confidence score (0–1)** for mappings.
- **Always classify ambiguity** instead of guessing.
- Maintain strict separation between:
  1. extraction
  2. alignment
  3. classification
  4. reporting
- **Do NOT rely on prior knowledge** of known protocols. Only use provided materials.
- Be literal, pedantic, and exhaustive.

---

## Rationalizations (Do Not Skip)

| Rationalization | Why It's Wrong | Required Action |
|-----------------|----------------|-----------------|
| "Spec is clear enough" | Ambiguity hides in plain sight | Extract to IR, classify ambiguity explicitly |
| "Code obviously matches" | Obvious matches have subtle divergences | Document match_type with evidence |
| "I'll note this as partial match" | Partial = potential vulnerability | Investigate until full_match or mismatch |
| "This undocumented behavior is fine" | Undocumented = untested = risky | Classify as UNDOCUMENTED CODE PATH |
| "Low confidence is okay here" | Low confidence findings get ignored | Investigate until confidence ≥ 0.8 or classify as AMBIGUOUS |
| "I'll infer what the spec meant" | Inference = hallucination | Quote exact text or mark UNDOCUMENTED |

---

# PHASE 0 — Documentation Discovery

Identify all content representing documentation, even if not named "spec."

Documentation may appear as:
- `whitepaper.pdf`
- `Protocol.md`
- `design_notes`
- `Flow.pdf`
- `README.md`
- kickoff transcripts
- Notion exports
- Anything describing logic, flows, assumptions, incentives, etc.

Use semantic cues:
- architecture descriptions
- invariants
- formulas
- variable meanings
- trust models
- workflow sequencing
- tables describing logic
- diagrams (convert to text)

Extract ALL relevant documents into a unified **spec corpus**.

---

# PHASE 1 — Universal Format Normalization

Normalize ANY input format:
- PDF
- Markdown
- DOCX
- HTML
- TXT
- Notion export
- Meeting transcripts

Preserve:
- heading hierarchy
- bullet lists
- formulas
- tables (converted to plaintext)
- code snippets
- invariant definitions

Remove:
- layout noise
- styling artifacts
- watermarks

Output: a clean, canonical **`spec_corpus`**.

---

# PHASE 2 — Spec Intent IR (Intermediate Representation)

Extract **all intended behavior** into the Spec-IR.

Each extracted item MUST include:
- `spec_excerpt`
- `source_section`
- `semantic_type`
- normalized representation
- confidence score

Extract:

- protocol purpose
- actors, roles, trust boundaries
- variable definitions & expected relationships
- all preconditions / postconditions
- explicit invariants
- implicit invariants deduced from context
- math formulas (in canonical symbolic form)
- expected flows & state-machine transitions
- economic assumptions
- ordering & timing constraints
- error conditions & expected revert logic
- security requirements ("must/never/always")
- edge-case behavior

This forms **Spec-IR**.

See [IR_EXAMPLES.md](resources/IR_EXAMPLES.md#example-1-spec-ir-record) for detailed examples.

---

# PHASE 3 — Code Behavior IR
### (WITH TRUE LINE-BY-LINE / BLOCK-BY-BLOCK ANALYSIS)

Perform **structured, deterministic, line-by-line and block-by-block** semantic analysis of the entire codebase.

For **EVERY LINE** and **EVERY BLOCK**, extract:
- file + exact line numbers
- local variable updates
- state reads/writes
- conditional branches & alternative paths
- unreachable branches
- revert conditions & custom errors
- external calls (call, delegatecall, staticcall, create2)
- event emissions
- math operations and rounding behavior
- implicit assumptions
- block-level preconditions & postconditions
- locally enforced invariants
- state transitions
- side effects
- dependencies on prior state

For **EVERY FUNCTION**, extract:
- signature & visibility
- applied modifiers (and their logic)
- purpose (based on actual behavior)
- input/output semantics
- read/write sets
- full control-flow structure
- success vs revert paths
- internal/external call graph
- cross-function interactions

Also capture:
- storage layout
- initialization logic
- authorization graph (roles → permissions)
- upgradeability mechanism (if present)
- hidden assumptions

Output: **Code-IR**, a granular semantic map with full traceability.

See [IR_EXAMPLES.md](resources/IR_EXAMPLES.md#example-2-code-ir-record) for detailed examples.

---

# PHASE 4 — Alignment IR (Spec ↔ Code Comparison)

For **each item in Spec-IR**:
Locate related behaviors in Code-IR and generate an Alignment Record containing:

- spec_excerpt
- code_excerpt (with file + line numbers)
- match_type:
  - full_match
  - partial_match
  - mismatch
  - missing_in_code
  - code_stronger_than_spec
  - code_weaker_than_spec
- reasoning trace
- confidence score (0–1)
- ambiguity rating
- evidence links

Explicitly check:
- invariants vs enforcement
- formulas vs math implementation
- flows vs real transitions
- actor expectations vs real privilege map
- ordering constraints vs actual logic
- revert expectations vs actual checks
- trust assumptions vs real external call behavior

Also detect:
- undocumented code behavior
- unimplemented spec claims
- contradictions inside the spec
- contradictions inside the code
- inconsistencies across multiple spec documents

Output: **Alignment-IR**

See [IR_EXAMPLES.md](resources/IR_EXAMPLES.md#example-3-alignment-record-positive-case) for detailed examples.

---

# PHASE 5 — Divergence Classification

Classify each misalignment by severity:

### CRITICAL
- Spec says X, code does Y
- Missing invariant enabling exploits
- Math divergence involving funds
- Trust boundary mismatches

### HIGH
- Partial/incorrect implementation
- Access control misalignment
- Dangerous undocumented behavior

### MEDIUM
- Ambiguity with security implications
- Missing revert checks
- Incomplete edge-case handling

### LOW
- Documentation drift
- Minor semantics mismatch

Each finding MUST include:
- evidence links
- severity justification
- exploitability reasoning
- recommended remediation

See [IR_EXAMPLES.md](resources/IR_EXAMPLES.md#example-4-divergence-finding-critical-issue) for detailed divergence finding examples with complete exploit scenarios, economic analysis, and remediation plans.

---

# PHASE 6 — Final Audit-Grade Report

Produce a structured compliance report:

1. Executive Summary
2. Documentation Sources Identified
3. Spec Intent Breakdown (Spec-IR)
4. Code Behavior Summary (Code-IR)
5. Full Alignment Matrix (Spec → Code → Status)
6. Divergence Findings (with evidence & severity)
7. Missing invariants
8. Incorrect logic
9. Math inconsistencies
10. Flow/state machine mismatches
11. Access control drift
12. Undocumented behavior
13. Ambiguity hotspots (spec & code)
14. Recommended remediations
15. Documentation update suggestions
16. Final risk assessment

---

## Output Requirements & Quality Standards

See [OUTPUT_REQUIREMENTS.md](resources/OUTPUT_REQUIREMENTS.md) for:
- Required IR production standards for all phases
- Quality thresholds (minimum Spec-IR items, confidence scores, etc.)
- Format consistency requirements (YAML formatting, line number citations)
- Anti-hallucination requirements

---

## Completeness Verification

Before finalizing analysis, review the [COMPLETENESS_CHECKLIST.md](resources/COMPLETENESS_CHECKLIST.md) to verify:
- Spec-IR completeness (all invariants, formulas, security requirements extracted)
- Code-IR completeness (all functions analyzed, state changes tracked)
- Alignment-IR completeness (every spec item has alignment record)
- Divergence finding quality (exploit scenarios, economic impact, remediation)
- Final report completeness (all 16 sections present)

---

# ANTI-HALLUCINATION REQUIREMENTS

- If the spec is silent: classify as **UNDOCUMENTED**.
- If the code adds behavior: classify as **UNDOCUMENTED CODE PATH**.
- If unclear: classify as **AMBIGUOUS**.
- Every claim must quote original text or line numbers.
- Zero speculation.
- Exhaustive, literal, pedantic reasoning.

---

# Resources

**Detailed Examples:**
- [IR_EXAMPLES.md](resources/IR_EXAMPLES.md) - Complete IR workflow examples with DEX swap patterns

**Standards & Requirements:**
- [OUTPUT_REQUIREMENTS.md](resources/OUTPUT_REQUIREMENTS.md) - IR production standards, quality thresholds, format rules
- [COMPLETENESS_CHECKLIST.md](resources/COMPLETENESS_CHECKLIST.md) - Verification checklist for all phases

---

## Agent

The `spec-compliance-checker` agent performs the full 7-phase specification-to-code compliance workflow autonomously. Use it when you need a complete audit-grade analysis comparing a specification or whitepaper against a smart contract codebase. The agent produces structured IR artifacts (Spec-IR, Code-IR, Alignment-IR, Divergence Findings) and a final compliance report.

Invoke directly: "Use the spec-compliance-checker agent to verify this codebase against the whitepaper."

---

# END OF SKILL


# === END SKILL: tob-spec-compliance ===

# === SKILL: tob-fix-review ===

# Trail of Bits Fix Review (Bridge)

Use this skill to review proposed security patches for secondary risk
introduction.

Checklist:
- verify exploit path is closed
- ensure no privilege bypass was added
- validate state invariants still hold
- check upgrade/storage compatibility for changed structs or layouts
- identify new external-call, DoS, and accounting attack surfaces

Output expectations:
- explicit statement whether new attack surface is introduced
- concrete notes on residual risks and follow-up tests


# === END SKILL: tob-fix-review ===

# === SKILL: cyfrin-solskill ===

# Cyfrin Solidity Production Standards (Bridge)

This bridge skill maps the `cyfrin-solskill` registry key to an available
solidity methodology in this workspace.

Primary guidance:
- keep fixes minimal and localized
- preserve contract behavior outside the vulnerable path
- add explicit guards over implicit assumptions
- include clear reasoning and test coverage for each fix

Reference source:
- `skills/cyfrin/solskill/solidity/SKILL.md`


# === END SKILL: cyfrin-solskill ===

# === SKILL: ethskills-security ===

---
name: security
description: Solidity security patterns, common vulnerabilities, and pre-deploy audit checklist. The specific code patterns that prevent real losses — not just warnings, but defensive implementations. Use before deploying any contract, when reviewing code, or when building anything that holds or moves value.
---

# Smart Contract Security

## What You Probably Got Wrong

**"Solidity 0.8+ prevents overflows, so I'm safe."** Overflow is one of dozens of attack vectors. The big ones today: reentrancy, oracle manipulation, approval exploits, and decimal mishandling.

**"I tested it and it works."** Working correctly is not the same as being secure. Most exploits call functions in orders or with values the developer never considered.

**"It's a small contract, it doesn't need an audit."** The DAO hack was a simple reentrancy bug. The Euler exploit was a single missing check. Size doesn't correlate with safety.

## Critical Vulnerabilities (With Defensive Code)

### 1. Token Decimals Vary

**USDC has 6 decimals, not 18.** This is the #1 source of "where did my money go?" bugs.

```solidity
// ❌ WRONG — assumes 18 decimals. Transfers 1 TRILLION USDC.
uint256 oneToken = 1e18;

// ✅ CORRECT — check decimals
uint256 oneToken = 10 ** IERC20Metadata(token).decimals();
```

Common decimals:
| Token | Decimals |
|-------|----------|
| USDC, USDT | 6 |
| WBTC | 8 |
| DAI, WETH, most tokens | 18 |

**When doing math across tokens with different decimals, normalize first:**
```solidity
// Converting USDC amount to 18-decimal internal accounting
uint256 normalized = usdcAmount * 1e12; // 6 + 12 = 18 decimals
```

### 2. No Floating Point in Solidity

Solidity has no `float` or `double`. Division truncates to zero.

```solidity
// ❌ WRONG — this equals 0
uint256 fivePercent = 5 / 100;

// ✅ CORRECT — basis points (1 bp = 0.01%)
uint256 FEE_BPS = 500; // 5% = 500 basis points
uint256 fee = (amount * FEE_BPS) / 10_000;
```

**Always multiply before dividing.** Division first = precision loss.

```solidity
// ❌ WRONG — loses precision
uint256 result = a / b * c;

// ✅ CORRECT — multiply first
uint256 result = (a * c) / b;
```

For complex math, use fixed-point libraries like `PRBMath` or `ABDKMath64x64`.

### 3. Reentrancy

An external call can call back into your contract before the first call finishes. If you update state AFTER the external call, the attacker re-enters with stale state.

```solidity
// ❌ VULNERABLE — state updated after external call
function withdraw() external {
    uint256 bal = balances[msg.sender];
    (bool success,) = msg.sender.call{value: bal}(""); // ← attacker re-enters here
    require(success);
    balances[msg.sender] = 0; // Too late — attacker already withdrew again
}

// ✅ SAFE — Checks-Effects-Interactions pattern + reentrancy guard
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

function withdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    require(bal > 0, "Nothing to withdraw");
    
    balances[msg.sender] = 0;  // Effect BEFORE interaction
    
    (bool success,) = msg.sender.call{value: bal}("");
    require(success, "Transfer failed");
}
```

**The pattern: Checks → Effects → Interactions (CEI)**
1. **Checks** — validate inputs and conditions
2. **Effects** — update all state
3. **Interactions** — external calls last

Always use OpenZeppelin's `ReentrancyGuard` as a safety net on top of CEI.

### 4. SafeERC20

Some tokens (notably USDT) don't return `bool` on `transfer()` and `approve()`. Standard calls will revert even on success.

```solidity
// ❌ WRONG — breaks with USDT and other non-standard tokens
token.transfer(to, amount);
token.approve(spender, amount);

// ✅ CORRECT — handles all token implementations
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

token.safeTransfer(to, amount);
token.safeApprove(spender, amount);
```

**Other token quirks to watch for:**
- **Fee-on-transfer tokens:** Amount received < amount sent. Always check balance before and after.
- **Rebasing tokens (stETH):** Balance changes without transfers. Use wrapped versions (wstETH).
- **Pausable tokens (USDC):** Transfers can revert if the token is paused.
- **Blocklist tokens (USDC, USDT):** Specific addresses can be blocked from transacting.

### 5. Never Use DEX Spot Prices as Oracles

A flash loan can manipulate any pool's spot price within a single transaction. This has caused hundreds of millions in losses.

```solidity
// ❌ DANGEROUS — manipulable in one transaction
function getPrice() internal view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = uniswapPair.getReserves();
    return (reserve1 * 1e18) / reserve0; // Spot price — easily manipulated
}

// ✅ SAFE — Chainlink with staleness + sanity checks
function getPrice() internal view returns (uint256) {
    (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
    require(block.timestamp - updatedAt < 3600, "Stale price");
    require(price > 0, "Invalid price");
    return uint256(price);
}
```

**If you must use onchain price data:**
- Use **TWAP** (Time-Weighted Average Price) over 30+ minutes — resistant to single-block manipulation
- Uniswap V3 has built-in TWAP oracles via `observe()`
- Still less safe than Chainlink for high-value decisions

### 6. Vault Inflation Attack

The first depositor in an ERC-4626 vault can manipulate the share price to steal from subsequent depositors.

**The attack:**
1. Attacker deposits 1 wei → gets 1 share
2. Attacker donates 1000 tokens directly to the vault (not via deposit)
3. Now 1 share = 1001 tokens
4. Victim deposits 1999 tokens → gets `1999 * 1 / 2000 = 0 shares` (rounds down)
5. Attacker redeems 1 share → gets all 3000 tokens

**The fix — virtual offset:**
```solidity
function convertToShares(uint256 assets) public view returns (uint256) {
    return assets.mulDiv(
        totalSupply() + 1e3,    // Virtual shares
        totalAssets() + 1        // Virtual assets
    );
}
```

The virtual offset makes the attack uneconomical — the attacker would need to donate enormous amounts to manipulate the ratio.

OpenZeppelin's ERC4626 implementation includes this mitigation by default since v5.

### 7. Infinite Approvals

**Never use `type(uint256).max` as approval amount.**

```solidity
// ❌ DANGEROUS — if this contract is exploited, attacker drains your entire balance
token.approve(someContract, type(uint256).max);

// ✅ SAFE — approve only what's needed
token.approve(someContract, exactAmountNeeded);

// ✅ ACCEPTABLE — approve a small multiple for repeated interactions
token.approve(someContract, amountPerTx * 5); // 5 transactions worth
```

If a contract with infinite approval gets exploited (proxy upgrade bug, governance attack, undiscovered vulnerability), the attacker can drain every approved token from every user who granted unlimited access.

### 8. Access Control

Every state-changing function needs explicit access control. "Who should be able to call this?" is the first question.

```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ❌ WRONG — anyone can drain the contract
function emergencyWithdraw() external {
    token.transfer(msg.sender, token.balanceOf(address(this)));
}

// ✅ CORRECT — only owner
function emergencyWithdraw() external onlyOwner {
    token.transfer(owner(), token.balanceOf(address(this)));
}
```

For complex permissions, use OpenZeppelin's `AccessControl` with role-based separation (ADMIN_ROLE, OPERATOR_ROLE, etc.).

### 9. Input Validation

Never trust inputs. Validate everything.

```solidity
function deposit(uint256 amount, address recipient) external {
    require(amount > 0, "Zero amount");
    require(recipient != address(0), "Zero address");
    require(amount <= maxDeposit, "Exceeds max");
    
    // Now proceed
}
```

Common missed validations:
- Zero addresses (tokens sent to 0x0 are burned forever)
- Zero amounts (wastes gas, can cause division by zero)
- Array length mismatches in batch operations
- Duplicate entries in arrays
- Values exceeding reasonable bounds

## Pre-Deploy Security Checklist

Run through this for EVERY contract before deploying to production. No exceptions.

- [ ] **Access control** — every admin/privileged function has explicit restrictions
- [ ] **Reentrancy protection** — CEI pattern + `nonReentrant` on all external-calling functions
- [ ] **Token decimal handling** — no hardcoded `1e18` for tokens that might have different decimals
- [ ] **Oracle safety** — using Chainlink or TWAP, not DEX spot prices. Staleness checks present
- [ ] **Integer math** — multiply before divide. No precision loss in critical calculations
- [ ] **Return values checked** — using SafeERC20 for all token operations
- [ ] **Input validation** — zero address, zero amount, bounds checks on all public functions
- [ ] **Events emitted** — every state change emits an event for offchain tracking
- [ ] **Incentive design** — maintenance functions callable by anyone with sufficient incentive
- [ ] **No infinite approvals** — approve exact amounts or small bounded multiples
- [ ] **Fee-on-transfer safe** — if accepting arbitrary tokens, measure actual received amount
- [ ] **Tested edge cases** — zero values, max values, unauthorized callers, reentrancy attempts
- [ ] **Source verified on block explorer** — `yarn verify` or `forge verify-contract` after every deploy. Unverified contracts can't be audited by users and look indistinguishable from scams

## MEV & Sandwich Attacks

**MEV (Maximal Extractable Value):** Validators and searchers can reorder, insert, or censor transactions within a block. They profit by frontrunning your transaction, backrunning it, or both.

### Sandwich Attacks

The most common MEV attack on DeFi users:

```
1. You submit: swap 10 ETH → USDC on Uniswap (slippage 1%)
2. Attacker sees your tx in the mempool
3. Attacker frontruns: buys USDC before you → price rises
4. Your swap executes at a worse price (but within your 1% slippage)
5. Attacker backruns: sells USDC after you → profits from the price difference
6. You got fewer USDC than the true market price
```

### Protection

```solidity
// ✅ Set explicit minimum output — don't set amountOutMinimum to 0
ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
    .ExactInputSingleParams({
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 3000,
        recipient: msg.sender,
        amountIn: 1 ether,
        amountOutMinimum: 1900e6, // ← Minimum acceptable USDC (protects against sandwich)
        sqrtPriceLimitX96: 0
    });
```

**For users/frontends:**
- Use **Flashbots Protect RPC** (`https://rpc.flashbots.net`) — sends transactions to a private mempool, invisible to sandwich bots
- Set tight slippage limits (0.5-1% for majors, 1-3% for small tokens)
- Use MEV-aware DEX aggregators (CoW Swap, 1inch Fusion) that route through solvers instead of the public mempool

**When MEV matters:**
- Any swap on a DEX (especially large swaps)
- Any large DeFi transaction (deposits, withdrawals, liquidations)
- NFT mints with high demand (bots frontrun to mint first)

**When MEV doesn't matter:**
- Simple ETH/token transfers
- L2 transactions (sequencers process transactions in order — no public mempool reordering)
- Private mempool transactions (Flashbots, MEV Blocker)

---

## Proxy Patterns & Upgradeability

Smart contracts are immutable by default. Proxies let you upgrade the logic while keeping the same address and state.

### When to Use Proxies

- **Use proxies:** Long-lived protocols that may need bug fixes or feature additions post-launch
- **Don't use proxies:** MVPs, simple tokens, immutable-by-design contracts, contracts where "no one can change this" IS the value proposition

**Proxies add complexity, attack surface, and trust assumptions.** Users must trust that the admin won't upgrade to a malicious implementation. Don't use proxies just because you can.

### UUPS vs Transparent Proxy

| | UUPS | Transparent |
|---|---|---|
| Upgrade logic location | In implementation contract | In proxy contract |
| Gas cost for users | Lower (no admin check per call) | Higher (checks msg.sender on every call) |
| Recommended | **Yes** (by OpenZeppelin) | Legacy pattern |
| Risk | Forgetting `_authorizeUpgrade` locks the contract | More gas overhead |

**Use UUPS.** It's cheaper, simpler, and what OpenZeppelin recommends.

### UUPS Implementation

```solidity
// Implementation contract (the logic)
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyContractV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // Prevent implementation from being initialized
    }

    function initialize(address owner) public initializer {
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        value = 42;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

### Critical Rules

1. **Use `initializer` instead of `constructor`** — proxies don't run constructors
2. **Never change storage layout** — only append new variables at the end, never delete or reorder
3. **Use OpenZeppelin's upgradeable contracts** — `@openzeppelin/contracts-upgradeable`, not `@openzeppelin/contracts`
4. **Disable initializers in constructor** — prevents anyone from initializing the implementation directly
5. **Transfer upgrade authority to a multisig** — never leave upgrade power with a single EOA

```solidity
// ❌ WRONG — reordering storage breaks everything
// V1: uint256 a; uint256 b;
// V2: uint256 b; uint256 a;  ← Swapped! 'a' now reads 'b's value

// ✅ CORRECT — only append
// V1: uint256 a; uint256 b;
// V2: uint256 a; uint256 b; uint256 c;  ← New variable at the end
```

---

## EIP-712 Signatures & Delegatecall

### EIP-712: Typed Structured Data Signing

EIP-712 lets users sign structured data (not just raw bytes) with domain separation and replay protection. Used for gasless approvals, meta-transactions, and offchain order signing.

**When to use:**
- **Permit (ERC-2612)** — gasless token approvals (user signs, anyone can submit)
- **Offchain orders** — sign buy/sell orders offchain, settle onchain (0x, Seaport)
- **Meta-transactions** — user signs intent, relayer submits and pays gas

```solidity
// EIP-712 domain separator — prevents replay across contracts and chains
bytes32 public constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 public constant PERMIT_TYPEHASH = keccak256(
    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
);

function permit(
    address owner, address spender, uint256 value,
    uint256 deadline, uint8 v, bytes32 r, bytes32 s
) external {
    require(block.timestamp <= deadline, "Permit expired");

    bytes32 structHash = keccak256(abi.encode(
        PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline
    ));
    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01", DOMAIN_SEPARATOR(), structHash
    ));

    address recovered = ecrecover(digest, v, r, s);
    require(recovered == owner, "Invalid signature");

    _approve(owner, spender, value);
}
```

**Key properties:**
- **Domain separator** prevents replaying signatures on different contracts or chains
- **Nonce** prevents replaying the same signature twice
- **Deadline** prevents stale signatures from being used later
- In practice, use OpenZeppelin's `EIP712` and `ERC20Permit` — don't implement from scratch

### Delegatecall

`delegatecall` executes another contract's code in the caller's storage context. The called contract's logic runs, but reads and writes happen on YOUR contract's storage.

**This is extremely dangerous if the target is untrusted.**

```solidity
// ❌ CRITICAL VULNERABILITY — delegatecall to user-supplied address
function execute(address target, bytes calldata data) external {
    target.delegatecall(data); // Attacker can overwrite ANY storage slot
}

// ✅ SAFE — delegatecall only to trusted, immutable implementation
address public immutable trustedImplementation;

function execute(bytes calldata data) external onlyOwner {
    trustedImplementation.delegatecall(data);
}
```

**Delegatecall rules:**
- **Never delegatecall to a user-supplied address** — allows arbitrary storage manipulation
- **Only delegatecall to contracts YOU control** — and preferably immutable ones
- **Storage layouts must match** — the calling contract and target contract must have identical storage variable ordering
- **This is how proxies work** — the proxy delegatecalls to the implementation, so the implementation's code runs on the proxy's storage. That's why storage layout matters so much for upgradeable contracts.

---

## Automated Security Tools

Run these before deployment:

```bash
# Static analysis
slither .                     # Detects common vulnerabilities
mythril analyze Contract.sol  # Symbolic execution

# Foundry fuzzing (built-in)
forge test --fuzz-runs 10000  # Fuzz all test functions with random inputs

# Gas optimization (bonus)
forge test --gas-report       # Identify expensive functions
```

**Slither findings to NEVER ignore:**
- Reentrancy vulnerabilities
- Unchecked return values
- Arbitrary `delegatecall` or `selfdestruct`
- Unprotected state-changing functions

## Further Reading

- **OpenZeppelin Contracts:** https://docs.openzeppelin.com/contracts — audited, battle-tested implementations
- **SWC Registry:** https://swcregistry.io — comprehensive vulnerability catalog
- **Rekt News:** https://rekt.news — real exploit post-mortems
- **SpeedRun Ethereum:** https://speedrunethereum.com — hands-on secure development practice


# === END SKILL: ethskills-security ===

# === SKILL: ethskills-testing ===

---
name: testing
description: Smart contract testing with Foundry — unit tests, fuzz testing, fork testing, invariant testing. What to test, what not to test, and what LLMs get wrong.
---

# Smart Contract Testing

## What You Probably Got Wrong

**You test getters and trivial functions.** Testing that `name()` returns the name is worthless. Test edge cases, failure modes, and economic invariants — the things that lose money when they break.

**You don't fuzz.** `forge test` finds the bugs you thought of. Fuzzing finds the ones you didn't. If your contract does math, fuzz it. If it handles user input, fuzz it. If it moves value, definitely fuzz it.

**You don't fork-test.** If your contract calls Uniswap, Aave, or any external protocol, test against their real deployed contracts on a fork. Mocking them hides integration bugs that only appear with real state.

**You write tests that mirror the implementation.** Testing that `deposit(100)` sets `balance[user] = 100` is tautological — you're testing that Solidity assignments work. Test properties: "after deposit and withdraw, user gets their tokens back." Test invariants: "total deposits always equals contract balance."

**You skip invariant testing for stateful protocols.** If your contract has multiple interacting functions that change state over time (vaults, AMMs, lending), you need invariant tests. Unit tests check one path; invariant tests check that properties hold across thousands of random sequences.

---

## Unit Testing with Foundry

### Test File Structure

```solidity
// test/MyContract.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MyToken} from "../src/MyToken.sol";

contract MyTokenTest is Test {
    MyToken public token;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new MyToken("Test", "TST", 1_000_000e18);
        // Give alice some tokens for testing
        token.transfer(alice, 10_000e18);
    }

    function test_TransferUpdatesBalances() public {
        vm.prank(alice);
        token.transfer(bob, 1_000e18);

        assertEq(token.balanceOf(alice), 9_000e18);
        assertEq(token.balanceOf(bob), 1_000e18);
    }

    function test_TransferEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, bob, 500e18);

        vm.prank(alice);
        token.transfer(bob, 500e18);
    }

    function test_RevertWhen_TransferExceedsBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 999_999e18); // More than alice has
    }

    function test_RevertWhen_TransferToZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(address(0), 100e18);
    }
}
```

### Key Assertion Patterns

```solidity
// Equality
assertEq(actual, expected);
assertEq(actual, expected, "descriptive error message");

// Comparisons
assertGt(a, b);   // a > b
assertGe(a, b);   // a >= b
assertLt(a, b);   // a < b
assertLe(a, b);   // a <= b

// Approximate equality (for math with rounding)
assertApproxEqAbs(actual, expected, maxDelta);
assertApproxEqRel(actual, expected, maxPercentDelta); // in WAD (1e18 = 100%)

// Revert expectations
vm.expectRevert();                           // Any revert
vm.expectRevert("Insufficient balance");     // Specific message
vm.expectRevert(MyContract.CustomError.selector); // Custom error

// Event expectations
vm.expectEmit(true, true, false, true);      // (topic1, topic2, topic3, data)
emit MyEvent(expectedArg1, expectedArg2);
```

### What to Actually Test

```solidity
// ✅ TEST: Edge cases that lose money
function test_TransferZeroAmount() public { /* ... */ }
function test_TransferEntireBalance() public { /* ... */ }
function test_TransferToSelf() public { /* ... */ }
function test_ApproveOverwrite() public { /* ... */ }
function test_TransferFromWithExactAllowance() public { /* ... */ }

// ✅ TEST: Access control
function test_RevertWhen_NonOwnerCallsAdminFunction() public { /* ... */ }
function test_OwnerCanPause() public { /* ... */ }

// ✅ TEST: Failure modes
function test_RevertWhen_DepositZero() public { /* ... */ }
function test_RevertWhen_WithdrawMoreThanDeposited() public { /* ... */ }
function test_RevertWhen_ContractPaused() public { /* ... */ }

// ❌ DON'T TEST: OpenZeppelin internals
// function test_NameReturnsName() — they already tested this
// function test_SymbolReturnsSymbol() — waste of time
// function test_DecimalsReturns18() — it does, trust it
```

---

## Fuzz Testing

Foundry automatically fuzzes any test function with parameters. Instead of testing one value, it tests hundreds of random values.

### Basic Fuzz Test

```solidity
// Foundry calls this with random amounts
function testFuzz_DepositWithdrawRoundtrip(uint256 amount) public {
    // Bound input to valid range
    amount = bound(amount, 1, token.balanceOf(alice));

    uint256 balanceBefore = token.balanceOf(alice);

    vm.startPrank(alice);
    token.approve(address(vault), amount);
    vault.deposit(amount, alice);
    vault.withdraw(vault.balanceOf(alice), alice, alice);
    vm.stopPrank();

    // Property: user gets back what they deposited (minus any fees)
    assertGe(token.balanceOf(alice), balanceBefore - 1); // Allow 1 wei rounding
}
```

### Bounding Inputs

```solidity
// bound() is preferred over vm.assume() — bound reshapes, assume discards
function testFuzz_Fee(uint256 amount, uint256 feeBps) public {
    amount = bound(amount, 1e6, 1e30);       // Reasonable token amounts
    feeBps = bound(feeBps, 1, 10_000);       // 0.01% to 100%

    uint256 fee = (amount * feeBps) / 10_000;
    uint256 afterFee = amount - fee;

    // Property: fee + remainder always equals original
    assertEq(fee + afterFee, amount);
}

// vm.assume() discards inputs — use sparingly
function testFuzz_Division(uint256 a, uint256 b) public {
    vm.assume(b > 0); // Skip zero (would revert)
    // ...
}
```

### Run with More Iterations

```bash
# Default: 256 runs
forge test

# More thorough: 10,000 runs
forge test --fuzz-runs 10000

# Set in foundry.toml for CI
# [fuzz]
# runs = 1000
```

---

## Fork Testing

Test your contract against real deployed protocols on a mainnet fork. This catches integration bugs that mocks can't.

### Basic Fork Test

```solidity
contract SwapTest is Test {
    // Real mainnet addresses
    address constant UNISWAP_ROUTER = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function setUp() public {
        // Fork mainnet at a specific block for reproducibility
        vm.createSelectFork("mainnet", 19_000_000);
    }

    function test_SwapETHForUSDC() public {
        address user = makeAddr("user");
        vm.deal(user, 1 ether);

        vm.startPrank(user);

        // Build swap path
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: 3000,
                recipient: user,
                amountIn: 0.1 ether,
                amountOutMinimum: 0, // In production, NEVER set to 0
                sqrtPriceLimitX96: 0
            });

        // Execute swap
        uint256 amountOut = ISwapRouter(UNISWAP_ROUTER).exactInputSingle{value: 0.1 ether}(params);

        vm.stopPrank();

        // Verify we got USDC back
        assertGt(amountOut, 0, "Should receive USDC");
        assertGt(IERC20(USDC).balanceOf(user), 0);
    }
}
```

### When to Fork-Test

- **Always:** Any contract that calls an external protocol (Uniswap, Aave, Chainlink)
- **Always:** Any contract that handles tokens with quirks (USDT, fee-on-transfer, rebasing)
- **Always:** Any contract that reads oracle prices
- **Never:** Pure logic contracts with no external calls — use unit tests

### Running Fork Tests

```bash
# Fork from RPC URL
forge test --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Fork at specific block (reproducible)
forge test --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY --fork-block-number 19000000

# Set in foundry.toml to avoid CLI flags
# [rpc_endpoints]
# mainnet = "${MAINNET_RPC_URL}"
```

---

## Invariant Testing

Invariant tests verify that properties hold across thousands of random function call sequences. Essential for stateful protocols.

### What Are Invariants?

Invariants are properties that must ALWAYS be true, no matter what sequence of actions users take:

- "Total supply equals sum of all balances" (ERC-20)
- "Total deposits equals total shares times share price" (vault)
- "x * y >= k after every swap" (AMM)
- "User can always withdraw what they deposited" (escrow)

### Basic Invariant Test

```solidity
contract VaultInvariantTest is Test {
    MyVault public vault;
    IERC20 public token;
    VaultHandler public handler;

    function setUp() public {
        token = new MockERC20("Test", "TST", 18);
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // Tell Foundry which contract to call randomly
        targetContract(address(handler));
    }

    // This runs after every random sequence
    function invariant_TotalAssetsMatchesBalance() public view {
        assertEq(
            vault.totalAssets(),
            token.balanceOf(address(vault)),
            "Total assets must equal actual balance"
        );
    }

    function invariant_SharePriceNeverZero() public view {
        if (vault.totalSupply() > 0) {
            assertGt(vault.convertToAssets(1e18), 0, "Share price must never be zero");
        }
    }
}

// Handler: guided random actions
contract VaultHandler is Test {
    MyVault public vault;
    IERC20 public token;

    constructor(MyVault _vault, IERC20 _token) {
        vault = _vault;
        token = _token;
    }

    function deposit(uint256 amount) public {
        amount = bound(amount, 1, 1e24);
        deal(address(token), msg.sender, amount);

        vm.startPrank(msg.sender);
        token.approve(address(vault), amount);
        vault.deposit(amount, msg.sender);
        vm.stopPrank();
    }

    function withdraw(uint256 shares) public {
        uint256 maxShares = vault.balanceOf(msg.sender);
        if (maxShares == 0) return;
        shares = bound(shares, 1, maxShares);

        vm.prank(msg.sender);
        vault.redeem(shares, msg.sender, msg.sender);
    }
}
```

### Running Invariant Tests

```bash
# Default depth (15 calls per sequence, 256 sequences)
forge test

# Deeper exploration
forge test --fuzz-runs 1000

# Configure in foundry.toml
# [invariant]
# runs = 512
# depth = 50
```

---

## What NOT to Test

- **OpenZeppelin internals.** Don't test that `ERC20.transfer` works. It's been audited by dozens of firms and used by thousands of contracts. Test YOUR logic on top of it.
- **Solidity language features.** Don't test that `require` reverts or that `mapping` stores values. The compiler works.
- **Every getter.** If `name()` returns the name you passed to the constructor, that's not a test — it's a tautology.
- **Happy path only.** The happy path probably works. Test the unhappy paths: what happens with zero? Max uint? Unauthorized callers? Reentrancy?

**Focus your testing effort on:** Custom business logic, mathematical operations, integration points with external protocols, access control boundaries, and economic edge cases.

---

## Pre-Deploy Test Checklist

- [ ] All custom logic has unit tests with edge cases
- [ ] Zero amounts, max uint, empty arrays, self-transfers tested
- [ ] Access control verified — unauthorized calls revert
- [ ] Fuzz tests on all mathematical operations (minimum 1000 runs)
- [ ] Fork tests for every external protocol integration
- [ ] Invariant tests for stateful protocols (vaults, AMMs, lending)
- [ ] Events verified with `expectEmit`
- [ ] Gas snapshots taken with `forge snapshot` to catch regressions
- [ ] Static analysis with `slither .` — no high/medium findings unaddressed
- [ ] All tests pass: `forge test -vvv`


# === END SKILL: ethskills-testing ===

# === SKILL: sc-auditor-skill ===

---
name: security-auditor
description: Interactive smart contract security audit using Map-Hunt-Attack methodology with Slither/Aderyn integration.
argument-hint: "<solidity files or directory>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__sc-auditor__run-slither
  - mcp__sc-auditor__run-aderyn
  - mcp__sc-auditor__get_checklist
  - mcp__sc-auditor__search_findings
---

# Security Auditor — Map-Hunt-Attack Methodology

You are an expert smart contract security auditor. You use a structured Map-Hunt-Attack methodology with integrated Slither and Aderyn static analysis, Cyfrin audit checklists, and Solodit finding databases. The target is the Solidity files or directory provided as your argument.

Your workflow follows four phases in strict order: **SETUP → MAP → HUNT → ATTACK**. Each phase builds on the previous one. You do not skip phases. Before beginning, internalize the Core Protocols and Risk Patterns below — they guide every decision you make during the audit.

## Core Protocols (Non-Negotiable)

### 1. Hypothesis-Driven Analysis

Every potential issue is a hypothesis to falsify, not a conclusion to confirm. Before escalating any suspicious pattern to a finding, actively search for reasons why it is NOT a bug. Only escalate to a confirmed finding when all falsification attempts fail. This prevents false positives and ensures every reported issue has been rigorously tested.

### 2. Cross-Reference Mandate

Never validate a finding in isolation. Cross-check every suspicious pattern against protocol documentation, specification comments, related code in other contracts, and protocol-level invariants. A behavior that contradicts your expectation may actually be documented and by-design. Findings that ignore documented behavior waste auditor and developer time.

### 3. Devil's Advocate

Before concluding that an issue is exploitable, explicitly search other files for constraints, protocol constants, access control modifiers, require statements, or upstream validation that would prevent exploitation. Check inherited contracts, library functions, and governance parameters. The goal is to prove yourself wrong before declaring a vulnerability.

### 4. Evidence Required

Every confirmed finding must cite concrete evidence: specific line references (file:line), a code path explanation tracing the vulnerability from entry point to impact, and at least one supporting evidence source (Slither/Aderyn detector, checklist item, or Solodit example). A finding without evidence is an opinion, not a finding. No exceptions.

### 5. Privileged Roles Are Honest

Assume that owner, admin, governance, and other privileged roles act honestly and in the protocol's interest. Discard findings that require a privileged role to be malicious (e.g., "admin could set fee to 100%" or "owner could rug via upgrade"). Focus exclusively on what unprivileged users, external actors, and flash loan attackers can exploit without elevated permissions.

## Risk Patterns

### 1. ERC-4626 Vault Share Inflation

A first depositor can mint 1 share for a minimal deposit, then donate tokens directly to the vault contract, inflating the share price. Subsequent depositors receive 0 shares due to integer division rounding, losing their entire deposit to the attacker. Look for vaults without minimum deposit checks, virtual share offsets (e.g., OpenZeppelin's `_decimalsOffset()`), or initial dead-share minting.

### 2. Oracle Staleness and Manipulation

Price oracles can return stale data if staleness checks are missing — for example, Chainlink's `updatedAt` timestamp not being validated against a maximum age threshold. TWAP oracles can be manipulated within a single block via flash loans or large swaps that skew time-weighted averages. Check for freshness validation on every oracle read, fallback oracle paths when primary feeds fail, and manipulation-resistant oracle configurations such as longer TWAP windows.

### 3. Flash Loan Entry Points

Flash loans allow attackers to borrow unlimited capital within a single transaction, amplifying any profitable exploit to arbitrary scale. Functions that read on-chain balances, compute prices from pool reserves, or check collateral ratios are vulnerable when called in the same transaction as a flash loan that manipulates those values. Look for balance-dependent logic in external/public functions, and verify whether the protocol uses snapshot-based or oracle-based pricing rather than spot balances.

### 4. Rounding Direction in Share/Token Math

Integer division in Solidity always truncates toward zero, and incorrect rounding direction can systematically leak value from one party to another. In share-based systems, deposits should round DOWN in shares minted (favoring the vault) and withdrawals should round UP in assets required (also favoring the vault). Check `mulDiv` operations for explicit rounding direction parameters, verify asymmetric handling for mint vs redeem paths, and look for precision loss in fee calculations.

### 5. Upgradeable Proxy Storage Collisions

Upgradeable proxies share storage between the proxy and implementation contracts via `delegatecall`. If the storage slot layout changes between upgrades — new variables inserted in the middle, reordered declarations, or different inheritance linearization order — values collide and corrupt state silently. Check for `__gap` storage reservations in base contracts, consistent inheritance ordering across upgrade versions, and ERC-1967 compliance for admin/implementation slot isolation.

### 6. Cross-Contract Reentrancy via Callbacks

Reentrancy is not limited to recursive calls within a single contract. ERC-777 token hooks, ERC-721 `safeTransfer` callbacks, and flash loan receiver callbacks allow an attacker to re-enter a DIFFERENT contract in the same protocol before the first call's state updates are finalized. Look for external calls that transfer execution control (especially token transfers and callback patterns) before all protocol-wide state updates across multiple contracts are complete. The checks-effects-interactions pattern must be applied at the protocol level, not just the contract level.

### 7. Donation Attacks

Anyone can send ETH directly to a contract via `selfdestruct` (or coinbase transactions) or transfer ERC-20 tokens directly, bypassing the contract's deposit/accounting logic entirely. If the contract relies on `address(this).balance` or `token.balanceOf(address(this))` for critical logic such as pricing, share calculations, or solvency checks, these values can be manipulated by an attacker at will. Check whether the contract uses internal accounting variables (tracked deposits/withdrawals) or raw balance queries for security-critical computations.

### 8. Missing Slippage Protection

AMM swaps and vault deposit/withdrawal operations without minimum output amount checks are vulnerable to sandwich attacks. An attacker front-runs the victim's transaction with a large trade to move the price, the victim executes at a worse rate, and the attacker back-runs to capture the difference as profit. Check that swap functions accept and enforce `minAmountOut` or `deadline` parameters, and verify that DEX aggregator integrations pass user-specified slippage bounds through to the underlying pool calls.

### 9. Unchecked Return Values on Token Transfers

Some ERC-20 tokens — notably USDT, BNB, and OMG — do not revert on failed transfers; instead they return `false`. If the return value is not checked (using `transfer()` or `transferFrom()` directly instead of OpenZeppelin's `SafeERC20.safeTransfer()`), the contract may believe a transfer succeeded when it actually did not, leading to accounting discrepancies, locked funds, or theft. Check for `SafeERC20` usage throughout, or explicit boolean return value checks on every token transfer call.

## Phase 1: SETUP (Automated)

This phase runs the static analysis tools and loads the checklist before any manual review. Execute the following steps automatically:

1. **Define Scope**: Scope MAP/HUNT/ATTACK and reported findings strictly to files under `<target>`, the folder with smart contracts provided as the argument. If solc is unset, set it to the solc version from foundry.toml before running tools.

1. **Run Slither**: Call `mcp__sc-auditor__run-slither` with `{rootDir: "<current>"}` where `<current>` is the current directory. Store the returned findings, limited to the scope defined in step 1.

2. **Run Aderyn**: Call `mcp__sc-auditor__run-aderyn` with `{rootDir: "<current>"}` where `<current>` is the current directory. Store the returned findings, limited to the scope defined in step 1.

3. **Load Checklist**: Call `mcp__sc-auditor__get_checklist` with no arguments (or `{}`) to load the full Cyfrin audit checklist.

4. **Report Summary**: Present a summary to the user:
   - Number of Slither findings grouped by severity (Critical, High, Medium, Low, Informational)
   - Number of Aderyn findings grouped by severity
   - Confirmation that the checklist is loaded and ready

5. **Handle Failures**: If BOTH tools fail, warn the user: "Both Slither and Aderyn failed to run. The audit will proceed in manual-only mode without static analysis results. Findings may be less comprehensive." If only ONE tool fails, note which tool failed and continue with the other tool's results plus manual analysis.

## Phase 2: MAP (Build System Understanding)

Read every contract file in scope using the `Read` tool. Use `Glob` to discover all `.sol` files and `Grep` to search for specific patterns. Build a comprehensive system map with three subsections:

### Components

For each contract or module in scope, document:
- **Purpose**: 1-2 sentences describing what the contract does
- **Key State Variables**: List storage variables with their types and roles
- **Roles/Capabilities**: Who can call privileged functions (owner, admin, keeper, etc.)
- **External Surface**: Every `public` and `external` function, noting for each:
  - Who can call it (access control)
  - What state it writes
  - What external calls it makes

### Invariants

Identify 3-10 precise invariants that should ALWAYS hold, split into:
- **Local Properties**: Variable relationships within a single contract (e.g., `totalSupply == sum(balances)`), authorization checks, and state machine constraints.
- **System-Wide Invariants**: Cross-contract properties like liveness guarantees (the system cannot permanently lock), insolvency prevention (assets >= liabilities), and supply consistency (minted tokens always backed).

### Static Analysis Summary

Group the Slither and Aderyn findings collected during SETUP:
- Organize by category (reentrancy, access control, arithmetic, etc.) and severity
- Note which functions and contracts are affected
- Provide an initial assessment for each group: which findings look like real issues vs. likely false positives, and why

### CHECKPOINT: System Map Review

Present the complete system map in the structured format above. Then explicitly ask the user:

1. Confirm the component descriptions are accurate
2. Validate or adjust the identified invariants
3. Flag any missing components, relationships, or trust assumptions

**"Please review the system map above and confirm it is accurate, or provide corrections. I will wait for your response before proceeding to the HUNT phase."**

Do NOT proceed to the HUNT phase until the user confirms.

## Phase 3: HUNT (Systematic Hotspot Identification)

For each `public` or `external` function that writes state, moves value, or makes external calls, perform systematic analysis:

1. **Check Static Analysis**: Review Slither and Aderyn results for this specific function.

2. **Load Relevant Checklist Items**: Call `mcp__sc-auditor__get_checklist` with `{category: "<relevant_category>"}` to get checklist items for the function's domain (e.g., "Reentrancy", "Access Control", "Oracle").

3. **Search for Similar Patterns**: Call `mcp__sc-auditor__search_findings` with `{query: "<pattern_description>"}` to find real-world examples of similar vulnerabilities on Solodit. Use optional parameters `severity`, `tags`, and `limit` to narrow results when appropriate.

4. **Check Against Invariants**: For each invariant identified in the MAP phase, determine whether this function could violate it under any input or call sequence.

5. **Check Against Risk Patterns**: Evaluate the function against all 9 risk patterns listed above.

For each suspicious spot identified, output a structured entry:

- **Components/Functions**: Which contracts and functions are involved
- **Attacker Type**: Unprivileged user, external actor, flash loan attacker, etc.
- **Related Invariants**: Which invariants from the MAP phase could be violated
- **Why Suspicious**: 1-3 sentences explaining the concern
- **Supporting Evidence**: Tool findings, checklist items, Solodit examples that support the suspicion
- **Priority**: High / Medium / Low

### CHECKPOINT: Attack Target Selection

Present a numbered list of all suspicious spots found. For each spot, show:
- One-line summary of the concern
- Priority level (High / Medium / Low)
- Number of supporting evidence items

Then explicitly ask:

**"Select which spots you want me to deep-dive in the ATTACK phase. You can select by number, or say 'all' to attack everything. I will analyze them one at a time."**

Do NOT proceed to the ATTACK phase until the user selects targets.

## Phase 4: ATTACK (Deep Dive per Spot)

For each user-selected spot, one at a time:

### 1. Trace the Call Path

Read the actual code using the `Read` tool. Trace variable values through the execution path, identify all external calls and state changes, map the complete flow from entry point through every branch to the final state modifications.

### 2. Construct Attack Narrative

Define concretely:
- **Attacker role**: Who is the attacker (any user, specific role, flash loan borrower)?
- **Call sequence**: What exact sequence of transactions would exploit this?
- **Broken invariant**: Which invariant from the MAP phase would be violated?
- **Extracted value**: What would the attacker gain (stolen funds, inflated shares, unauthorized access)?

### 3. Devil's Advocate Protocol

Actively try to falsify the attack:
- Search for `require` statements, modifiers, or checks that prevent the exploit using `Grep` and `Read`
- Determine if the behavior is "by design" even if surprising (cross-reference documentation)
- Mentally dry-run the code with specific concrete values to verify the exploit path
- Check for preventing constraints in inherited contracts, libraries, or governance parameters
- Search for similar findings that were invalidated: call `mcp__sc-auditor__search_findings` with relevant queries

### 4. Verdict

Either:

**NO VULNERABILITY**: Provide the reason for dismissal, list the specific refutation steps that disproved the hypothesis, and note confidence level (High/Medium/Low that this is truly safe).

Or:

**VULNERABILITY CONFIRMED**: Fill in all fields of the Finding output format below.

### 5. Evidence Strengthening (Optional)

Call `mcp__sc-auditor__search_findings` with `{query: "<vulnerability_description>"}` to find similar confirmed findings on Solodit. Include matching results as additional evidence sources.

## Finding Output Format

When confirming a vulnerability, output a structured finding with the following fields. Required fields must always be present; optional fields should be included when available.

**Required fields:**
- `title` (string): Concise vulnerability title
- `severity` (CRITICAL | HIGH | MEDIUM | LOW | GAS | INFORMATIONAL): Impact severity
- `confidence` (Confirmed | Likely | Possible): How certain the finding is
- `source` (slither | aderyn | manual): What originally identified the issue
- `category` (string): Vulnerability category, e.g., "Reentrancy", "Access Control"
- `affected_files` (string[]): List of affected file paths
- `affected_lines` ({start: number, end: number}): 1-based inclusive line range
- `description` (string): Detailed explanation of the vulnerability
- `evidence_sources` (array): At least one evidence source, each with:
  - `type` (static_analysis | checklist | solodit): Source category
  - `tool` (string, optional): Tool name for static_analysis (e.g., "slither", "aderyn")
  - `detector_id` (string, optional): Detector ID for static analysis tools
  - `checklist_item_id` (string, optional): Checklist item ID (e.g., "SOL-CR-1")
  - `solodit_slug` (string, optional): Solodit finding slug
  - `detail` (string, optional): Free-form detail about the evidence

**Optional fields:**
- `impact` (string): Description of the potential impact
- `remediation` (string): Suggested fix
- `checklist_reference` (string): Related checklist item ID, e.g., "SOL-CR-1"
- `solodit_references` (string[]): Solodit finding slugs used as evidence
- `attack_scenario` (string): Step-by-step attack scenario
- `detector_id` (string): Static analysis detector ID

### Example Finding

```json
{
  "title": "Cross-contract reentrancy in Vault.withdraw() via ERC-777 callback",
  "severity": "HIGH",
  "confidence": "Confirmed",
  "source": "manual",
  "category": "Reentrancy",
  "affected_files": ["src/Vault.sol", "src/AccountingModule.sol"],
  "affected_lines": {"start": 142, "end": 158},
  "description": "Vault.withdraw() transfers tokens via safeTransfer before updating the AccountingModule's internal balance. An ERC-777 token with a tokensReceived hook allows the recipient to re-enter AccountingModule.sync() while Vault's state is inconsistent, draining excess funds.",
  "impact": "Complete vault drain for any ERC-777 compatible token.",
  "remediation": "Apply checks-effects-interactions: update AccountingModule.balances before the safeTransfer call, or add a protocol-wide reentrancy guard.",
  "checklist_reference": "SOL-CR-3",
  "solodit_references": ["2023-07-beedle-reentrancy-withdraw"],
  "evidence_sources": [
    {
      "type": "static_analysis",
      "tool": "slither",
      "detector_id": "reentrancy-eth",
      "detail": "Slither flagged external call at Vault.sol:148 before state update at AccountingModule.sol:203"
    },
    {
      "type": "checklist",
      "checklist_item_id": "SOL-CR-3",
      "detail": "Cyfrin checklist item: 'Are there cross-contract reentrancy risks via token callbacks?'"
    },
    {
      "type": "solodit",
      "solodit_slug": "2023-07-beedle-reentrancy-withdraw",
      "detail": "Similar cross-contract reentrancy via ERC-777 callback in Beedle protocol"
    }
  ],
  "attack_scenario": "1. Attacker deploys malicious ERC-777 token with tokensReceived hook. 2. Attacker deposits into Vault. 3. Attacker calls withdraw(). 4. During safeTransfer, tokensReceived re-enters AccountingModule.sync(). 5. sync() reads stale balance, crediting attacker extra shares. 6. Attacker withdraws again with inflated shares.",
  "detector_id": "reentrancy-eth"
}
```


# === END SKILL: sc-auditor-skill ===

# === SKILL: tob-entry-point ===

---
name: entry-point-analyzer
description: Analyzes smart contract codebases to identify state-changing entry points for security auditing. Detects externally callable functions that modify state, categorizes them by access level (public, admin, role-restricted, contract-only), and generates structured audit reports. Excludes view/pure/read-only functions. Use when auditing smart contracts (Solidity, Vyper, Solana/Rust, Move, TON, CosmWasm) or when asked to find entry points, audit flows, external functions, access control patterns, or privileged operations.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Entry Point Analyzer

Systematically identify all **state-changing** entry points in a smart contract codebase to guide security audits.

## When to Use

Use this skill when:
- Starting a smart contract security audit to map the attack surface
- Asked to find entry points, external functions, or audit flows
- Analyzing access control patterns across a codebase
- Identifying privileged operations and role-restricted functions
- Building an understanding of which functions can modify contract state

## When NOT to Use

Do NOT use this skill for:
- Vulnerability detection (use audit-context-building or domain-specific-audits)
- Writing exploit POCs (use solidity-poc-builder)
- Code quality or gas optimization analysis
- Non-smart-contract codebases
- Analyzing read-only functions (this skill excludes them)

## Scope: State-Changing Functions Only

This skill focuses exclusively on functions that can modify state. **Excluded:**

| Language | Excluded Patterns |
|----------|-------------------|
| Solidity | `view`, `pure` functions |
| Vyper | `@view`, `@pure` functions |
| Solana | Functions without `mut` account references |
| Move | Non-entry `public fun` (module-callable only) |
| TON | `get` methods (FunC), read-only receivers (Tact) |
| CosmWasm | `query` entry point and its handlers |

**Why exclude read-only functions?** They cannot directly cause loss of funds or state corruption. While they may leak information, the primary audit focus is on functions that can change state.

## Workflow

1. **Detect Language** - Identify contract language(s) from file extensions and syntax
2. **Use Tooling (if available)** - For Solidity, check if Slither is available and use it
3. **Locate Contracts** - Find all contract/module files (apply directory filter if specified)
4. **Extract Entry Points** - Parse each file for externally callable, state-changing functions
5. **Classify Access** - Categorize each function by access level
6. **Generate Report** - Output structured markdown report

## Slither Integration (Solidity)

For Solidity codebases, Slither can automatically extract entry points. Before manual analysis:

### 1. Check if Slither is Available

```bash
which slither
```

### 2. If Slither is Detected, Run Entry Points Printer

```bash
slither . --print entry-points
```

This outputs a table of all state-changing entry points with:
- Contract name
- Function name
- Visibility
- Modifiers applied

### 3. Use Slither Output as Foundation

- Parse the Slither output table to populate your analysis
- Cross-reference with manual inspection for access control classification
- Slither may miss some patterns (callbacks, dynamic access control)—supplement with manual review
- If Slither fails (compilation errors, unsupported features), fall back to manual analysis

### 4. When Slither is NOT Available

If `which slither` returns nothing, proceed with manual analysis using the language-specific reference files.

## Language Detection

| Extension | Language | Reference |
|-----------|----------|-----------|
| `.sol` | Solidity | [{baseDir}/references/solidity.md]({baseDir}/references/solidity.md) |
| `.vy` | Vyper | [{baseDir}/references/vyper.md]({baseDir}/references/vyper.md) |
| `.rs` + `Cargo.toml` with `solana-program` | Solana (Rust) | [{baseDir}/references/solana.md]({baseDir}/references/solana.md) |
| `.move` + `Move.toml` with `edition` | [{baseDir}/references/move-sui.md]({baseDir}/references/move-sui.md) |
| `.move` + `Move.toml` with `Aptos` | [{baseDir}/references/move-aptos.md]({baseDir}/references/move-aptos.md) |
| `.fc`, `.func`, `.tact` | TON (FunC/Tact) | [{baseDir}/references/ton.md]({baseDir}/references/ton.md) |
| `.rs` + `Cargo.toml` with `cosmwasm-std` | CosmWasm | [{baseDir}/references/cosmwasm.md]({baseDir}/references/cosmwasm.md) |

Load the appropriate reference file(s) based on detected language before analysis.

## Access Classification

Classify each state-changing entry point into one of these categories:

### 1. Public (Unrestricted)
Functions callable by anyone without restrictions.

### 2. Role-Restricted
Functions limited to specific roles. Common patterns to detect:
- Explicit role names: `admin`, `owner`, `governance`, `guardian`, `operator`, `manager`, `minter`, `pauser`, `keeper`, `relayer`, `lender`, `borrower`
- Role-checking patterns: `onlyRole`, `hasRole`, `require(msg.sender == X)`, `assert_owner`, `#[access_control]`
- When role is ambiguous, flag as **"Restricted (review required)"** with the restriction pattern noted

### 3. Contract-Only (Internal Integration Points)
Functions callable only by other contracts, not by EOAs. Indicators:
- Callbacks: `onERC721Received`, `uniswapV3SwapCallback`, `flashLoanCallback`
- Interface implementations with contract-caller checks
- Functions that revert if `tx.origin == msg.sender`
- Cross-contract hooks

## Output Format

Generate a markdown report with this structure:

```markdown
# Entry Point Analysis: [Project Name]

**Analyzed**: [timestamp]
**Scope**: [directories analyzed or "full codebase"]
**Languages**: [detected languages]
**Focus**: State-changing functions only (view/pure excluded)

## Summary

| Category | Count |
|----------|-------|
| Public (Unrestricted) | X |
| Role-Restricted | X |
| Restricted (Review Required) | X |
| Contract-Only | X |
| **Total** | **X** |

---

## Public Entry Points (Unrestricted)

State-changing functions callable by anyone—prioritize for attack surface analysis.

| Function | File | Notes |
|----------|------|-------|
| `functionName(params)` | `path/to/file.sol:L42` | Brief note if relevant |

---

## Role-Restricted Entry Points

### Admin / Owner
| Function | File | Restriction |
|----------|------|-------------|
| `setFee(uint256)` | `Config.sol:L15` | `onlyOwner` |

### Governance
| Function | File | Restriction |
|----------|------|-------------|

### Guardian / Pauser
| Function | File | Restriction |
|----------|------|-------------|

### Other Roles
| Function | File | Restriction | Role |
|----------|------|-------------|------|

---

## Restricted (Review Required)

Functions with access control patterns that need manual verification.

| Function | File | Pattern | Why Review |
|----------|------|---------|------------|
| `execute(bytes)` | `Executor.sol:L88` | `require(trusted[msg.sender])` | Dynamic trust list |

---

## Contract-Only (Internal Integration Points)

Functions only callable by other contracts—useful for understanding trust boundaries.

| Function | File | Expected Caller |
|----------|------|-----------------|
| `onFlashLoan(...)` | `Vault.sol:L200` | Flash loan provider |

---

## Files Analyzed

- `path/to/file1.sol` (X state-changing entry points)
- `path/to/file2.sol` (X state-changing entry points)
```

## Filtering

When user specifies a directory filter:
- Only analyze files within that path
- Note the filter in the report header
- Example: "Analyze only `src/core/`" → scope = `src/core/`

## Analysis Guidelines

1. **Be thorough**: Don't skip files. Every state-changing externally callable function matters.
2. **Be conservative**: When uncertain about access level, flag for review rather than miscategorize.
3. **Skip read-only**: Exclude `view`, `pure`, and equivalent read-only functions.
4. **Note inheritance**: If a function's access control comes from a parent contract, note this.
5. **Track modifiers**: List all access-related modifiers/decorators applied to each function.
6. **Identify patterns**: Look for common patterns like:
   - Initializer functions (often unrestricted on first call)
   - Upgrade functions (high-privilege)
   - Emergency/pause functions (guardian-level)
   - Fee/parameter setters (admin-level)
   - Token transfers and approvals (often public)

## Common Role Patterns by Protocol Type

| Protocol Type | Common Roles |
|---------------|--------------|
| DEX | `owner`, `feeManager`, `pairCreator` |
| Lending | `admin`, `guardian`, `liquidator`, `oracle` |
| Governance | `proposer`, `executor`, `canceller`, `timelock` |
| NFT | `minter`, `admin`, `royaltyReceiver` |
| Bridge | `relayer`, `guardian`, `validator`, `operator` |
| Vault/Yield | `strategist`, `keeper`, `harvester`, `manager` |

## Rationalizations to Reject

When analyzing entry points, reject these shortcuts:
- "This function looks standard" → Still classify it; standard functions can have non-standard access control
- "The modifier name is clear" → Verify the modifier's actual implementation
- "This is obviously admin-only" → Trace the actual restriction; "obvious" assumptions miss subtle bypasses
- "I'll skip the callbacks" → Callbacks define trust boundaries; always include them
- "It doesn't modify much state" → Any state change can be exploited; include all non-view functions

## Error Handling

If a file cannot be parsed:
1. Note it in the report under "Analysis Warnings"
2. Continue with remaining files
3. Suggest manual review for unparsable files


# === END SKILL: tob-entry-point ===

# === SKILL: tob-audit-context ===

---
name: audit-context-building
description: Enables ultra-granular, line-by-line code analysis to build deep architectural context before vulnerability or bug finding.
---

# Deep Context Builder Skill (Ultra-Granular Pure Context Mode)

## 1. Purpose

This skill governs **how Claude thinks** during the context-building phase of an audit.

When active, Claude will:
- Perform **line-by-line / block-by-block** code analysis by default.
- Apply **First Principles**, **5 Whys**, and **5 Hows** at micro scale.
- Continuously link insights → functions → modules → entire system.
- Maintain a stable, explicit mental model that evolves with new evidence.
- Identify invariants, assumptions, flows, and reasoning hazards.

This skill defines a structured analysis format (see Example: Function Micro-Analysis below) and runs **before** the vulnerability-hunting phase.

---

## 2. When to Use This Skill

Use when:
- Deep comprehension is needed before bug or vulnerability discovery.
- You want bottom-up understanding instead of high-level guessing.
- Reducing hallucinations, contradictions, and context loss is critical.
- Preparing for security auditing, architecture review, or threat modeling.

Do **not** use for:
- Vulnerability findings
- Fix recommendations
- Exploit reasoning
- Severity/impact rating

---

## 3. How This Skill Behaves

When active, Claude will:
- Default to **ultra-granular analysis** of each block and line.
- Apply micro-level First Principles, 5 Whys, and 5 Hows.
- Build and refine a persistent global mental model.
- Update earlier assumptions when contradicted ("Earlier I thought X; now Y.").
- Periodically anchor summaries to maintain stable context.
- Avoid speculation; express uncertainty explicitly when needed.

Goal: **deep, accurate understanding**, not conclusions.

---

## Rationalizations (Do Not Skip)

| Rationalization | Why It's Wrong | Required Action |
|-----------------|----------------|-----------------|
| "I get the gist" | Gist-level understanding misses edge cases | Line-by-line analysis required |
| "This function is simple" | Simple functions compose into complex bugs | Apply 5 Whys anyway |
| "I'll remember this invariant" | You won't. Context degrades. | Write it down explicitly |
| "External call is probably fine" | External = adversarial until proven otherwise | Jump into code or model as hostile |
| "I can skip this helper" | Helpers contain assumptions that propagate | Trace the full call chain |
| "This is taking too long" | Rushed context = hallucinated vulnerabilities later | Slow is fast |

---

## 4. Phase 1 — Initial Orientation (Bottom-Up Scan)

Before deep analysis, Claude performs a minimal mapping:

1. Identify major modules/files/contracts.
2. Note obvious public/external entrypoints.
3. Identify likely actors (users, owners, relayers, oracles, other contracts).
4. Identify important storage variables, dicts, state structs, or cells.
5. Build a preliminary structure without assuming behavior.

This establishes anchors for detailed analysis.

---

## 5. Phase 2 — Ultra-Granular Function Analysis (Default Mode)

Every non-trivial function receives full micro analysis.

### 5.1 Per-Function Microstructure Checklist

For each function:

1. **Purpose**
   - Why the function exists and its role in the system.

2. **Inputs & Assumptions**
   - Parameters and implicit inputs (state, sender, env).
   - Preconditions and constraints.

3. **Outputs & Effects**
   - Return values.
   - State/storage writes.
   - Events/messages.
   - External interactions.

4. **Block-by-Block / Line-by-Line Analysis**
   For each logical block:
   - What it does.
   - Why it appears here (ordering logic).
   - What assumptions it relies on.
   - What invariants it establishes or maintains.
   - What later logic depends on it.

   Apply per-block:
   - **First Principles**
   - **5 Whys**
   - **5 Hows**

---

### 5.2 Cross-Function & External Flow Analysis
*(Full Integration of Jump-Into-External-Code Rule)*

When encountering calls, **continue the same micro-first analysis across boundaries.**

#### Internal Calls
- Jump into the callee immediately.
- Perform block-by-block analysis of relevant code.
- Track flow of data, assumptions, and invariants:
  caller → callee → return → caller.
- Note if callee logic behaves differently in this specific call context.

#### External Calls — Two Cases

**Case A — External Call to a Contract Whose Code Exists in the Codebase**
Treat as an internal call:
- Jump into the target contract/function.
- Continue block-by-block micro-analysis.
- Propagate invariants and assumptions seamlessly.
- Consider edge cases based on the *actual* code, not a black-box guess.

**Case B — External Call Without Available Code (True External / Black Box)**
Analyze as adversarial:
- Describe payload/value/gas or parameters sent.
- Identify assumptions about the target.
- Consider all outcomes:
  - revert
  - incorrect/strange return values
  - unexpected state changes
  - misbehavior
  - reentrancy (if applicable)

#### Continuity Rule
Treat the entire call chain as **one continuous execution flow**.
Never reset context.
All invariants, assumptions, and data dependencies must propagate across calls.

---

### 5.3 Complete Analysis Example

See [FUNCTION_MICRO_ANALYSIS_EXAMPLE.md](resources/FUNCTION_MICRO_ANALYSIS_EXAMPLE.md) for a complete walkthrough demonstrating:
- Full micro-analysis of a DEX swap function
- Application of First Principles, 5 Whys, and 5 Hows
- Block-by-block analysis with invariants and assumptions
- Cross-function dependency mapping
- Risk analysis for external interactions

This example demonstrates the level of depth and structure required for all analyzed functions.

---

### 5.4 Output Requirements

When performing ultra-granular analysis, Claude MUST structure output following the format defined in [OUTPUT_REQUIREMENTS.md](resources/OUTPUT_REQUIREMENTS.md).

Key requirements:
- **Purpose** (2-3 sentences minimum)
- **Inputs & Assumptions** (all parameters, preconditions, trust assumptions)
- **Outputs & Effects** (returns, state writes, external calls, events, postconditions)
- **Block-by-Block Analysis** (What, Why here, Assumptions, First Principles/5 Whys/5 Hows)
- **Cross-Function Dependencies** (internal calls, external calls with risk analysis, shared state)

Quality thresholds:
- Minimum 3 invariants per function
- Minimum 5 assumptions documented
- Minimum 3 risk considerations for external interactions
- At least 1 First Principles application
- At least 3 combined 5 Whys/5 Hows applications

---

### 5.5 Completeness Checklist

Before concluding micro-analysis of a function, verify against the [COMPLETENESS_CHECKLIST.md](resources/COMPLETENESS_CHECKLIST.md):

- **Structural Completeness**: All required sections present (Purpose, Inputs, Outputs, Block-by-Block, Dependencies)
- **Content Depth**: Minimum thresholds met (invariants, assumptions, risk analysis, First Principles)
- **Continuity & Integration**: Cross-references, propagated assumptions, invariant couplings
- **Anti-Hallucination**: Line number citations, no vague statements, evidence-based claims

Analysis is complete when all checklist items are satisfied and no unresolved "unclear" items remain.

---

## 6. Phase 3 — Global System Understanding

After sufficient micro-analysis:

1. **State & Invariant Reconstruction**
   - Map reads/writes of each state variable.
   - Derive multi-function and multi-module invariants.

2. **Workflow Reconstruction**
   - Identify end-to-end flows (deposit, withdraw, lifecycle, upgrades).
   - Track how state transforms across these flows.
   - Record assumptions that persist across steps.

3. **Trust Boundary Mapping**
   - Actor → entrypoint → behavior.
   - Identify untrusted input paths.
   - Privilege changes and implicit role expectations.

4. **Complexity & Fragility Clustering**
   - Functions with many assumptions.
   - High branching logic.
   - Multi-step dependencies.
   - Coupled state changes across modules.

These clusters help guide the vulnerability-hunting phase.

---

## 7. Stability & Consistency Rules
*(Anti-Hallucination, Anti-Contradiction)*

Claude must:

- **Never reshape evidence to fit earlier assumptions.**
  When contradicted:
  - Update the model.
  - State the correction explicitly.

- **Periodically anchor key facts**
  Summarize core:
  - invariants
  - state relationships
  - actor roles
  - workflows

- **Avoid vague guesses**
  Use:
  - "Unclear; need to inspect X."
  instead of:
  - "It probably…"

- **Cross-reference constantly**
  Connect new insights to previous state, flows, and invariants to maintain global coherence.

---

## 8. Subagent Usage

Claude may spawn subagents for:
- Dense or complex functions.
- Long data-flow or control-flow chains.
- Cryptographic / mathematical logic.
- Complex state machines.
- Multi-module workflow reconstruction.

Use the **`function-analyzer`** agent for per-function deep analysis.
It follows the full microstructure checklist, cross-function flow
rules, and quality thresholds defined in this skill, and enforces
the pure-context-building constraint.

Subagents must:
- Follow the same micro-first rules.
- Return summaries that Claude integrates into its global model.

---

## 9. Relationship to Other Phases

This skill runs **before**:
- Vulnerability discovery
- Classification / triage
- Report writing
- Impact modeling
- Exploit reasoning

It exists solely to build:
- Deep understanding
- Stable context
- System-level clarity

---

## 10. Non-Goals

While active, Claude should NOT:
- Identify vulnerabilities
- Propose fixes
- Generate proofs-of-concept
- Model exploits
- Assign severity or impact

This is **pure context building** only.


# === END SKILL: tob-audit-context ===

# === SKILL: tob-differential-review ===

---
name: differential-review
description: >
  Performs security-focused differential review of code changes (PRs, commits, diffs).
  Adapts analysis depth to codebase size, uses git history for context, calculates
  blast radius, checks test coverage, and generates comprehensive markdown reports.
  Automatically detects and prevents security regressions.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

# Differential Security Review

Security-focused code review for PRs, commits, and diffs.

## Core Principles

1. **Risk-First**: Focus on auth, crypto, value transfer, external calls
2. **Evidence-Based**: Every finding backed by git history, line numbers, attack scenarios
3. **Adaptive**: Scale to codebase size (SMALL/MEDIUM/LARGE)
4. **Honest**: Explicitly state coverage limits and confidence level
5. **Output-Driven**: Always generate comprehensive markdown report file

---

## Rationalizations (Do Not Skip)

| Rationalization | Why It's Wrong | Required Action |
|-----------------|----------------|-----------------|
| "Small PR, quick review" | Heartbleed was 2 lines | Classify by RISK, not size |
| "I know this codebase" | Familiarity breeds blind spots | Build explicit baseline context |
| "Git history takes too long" | History reveals regressions | Never skip Phase 1 |
| "Blast radius is obvious" | You'll miss transitive callers | Calculate quantitatively |
| "No tests = not my problem" | Missing tests = elevated risk rating | Flag in report, elevate severity |
| "Just a refactor, no security impact" | Refactors break invariants | Analyze as HIGH until proven LOW |
| "I'll explain verbally" | No artifact = findings lost | Always write report |

---

## Quick Reference

### Codebase Size Strategy

| Codebase Size | Strategy | Approach |
|---------------|----------|----------|
| SMALL (<20 files) | DEEP | Read all deps, full git blame |
| MEDIUM (20-200) | FOCUSED | 1-hop deps, priority files |
| LARGE (200+) | SURGICAL | Critical paths only |

### Risk Level Triggers

| Risk Level | Triggers |
|------------|----------|
| HIGH | Auth, crypto, external calls, value transfer, validation removal |
| MEDIUM | Business logic, state changes, new public APIs |
| LOW | Comments, tests, UI, logging |

---

## Workflow Overview

```
Pre-Analysis → Phase 0: Triage → Phase 1: Code Analysis → Phase 2: Test Coverage
    ↓              ↓                    ↓                        ↓
Phase 3: Blast Radius → Phase 4: Deep Context → Phase 5: Adversarial → Phase 6: Report
```

---

## Decision Tree

**Starting a review?**

```
├─ Need detailed phase-by-phase methodology?
│  └─ Read: methodology.md
│     (Pre-Analysis + Phases 0-4: triage, code analysis, test coverage, blast radius)
│
├─ Analyzing HIGH RISK change?
│  └─ Read: adversarial.md
│     (Phase 5: Attacker modeling, exploit scenarios, exploitability rating)
│
├─ Writing the final report?
│  └─ Read: reporting.md
│     (Phase 6: Report structure, templates, formatting guidelines)
│
├─ Looking for specific vulnerability patterns?
│  └─ Read: patterns.md
│     (Regressions, reentrancy, access control, overflow, etc.)
│
└─ Quick triage only?
   └─ Use Quick Reference above, skip detailed docs
```

---

## Quality Checklist

Before delivering:

- [ ] All changed files analyzed
- [ ] Git blame on removed security code
- [ ] Blast radius calculated for HIGH risk
- [ ] Attack scenarios are concrete (not generic)
- [ ] Findings reference specific line numbers + commits
- [ ] Report file generated
- [ ] User notified with summary

---

## Integration

**audit-context-building skill:**
- Pre-Analysis: Build baseline context
- Phase 4: Deep context on HIGH RISK changes

**issue-writer skill:**
- Transform findings into formal audit reports
- Command: `issue-writer --input DIFFERENTIAL_REVIEW_REPORT.md --format audit-report`

---

## Example Usage

### Quick Triage (Small PR)
```
Input: 5 file PR, 2 HIGH RISK files
Strategy: Use Quick Reference
1. Classify risk level per file (2 HIGH, 3 LOW)
2. Focus on 2 HIGH files only
3. Git blame removed code
4. Generate minimal report
Time: ~30 minutes
```

### Standard Review (Medium Codebase)
```
Input: 80 files, 12 HIGH RISK changes
Strategy: FOCUSED (see methodology.md)
1. Full workflow on HIGH RISK files
2. Surface scan on MEDIUM
3. Skip LOW risk files
4. Complete report with all sections
Time: ~3-4 hours
```

### Deep Audit (Large, Critical Change)
```
Input: 450 files, auth system rewrite
Strategy: SURGICAL + audit-context-building
1. Baseline context with audit-context-building
2. Deep analysis on auth changes only
3. Blast radius analysis
4. Adversarial modeling
5. Comprehensive report
Time: ~6-8 hours
```

---

## When NOT to Use This Skill

- **Greenfield code** (no baseline to compare)
- **Documentation-only changes** (no security impact)
- **Formatting/linting** (cosmetic changes)
- **User explicitly requests quick summary only** (they accept risk)

For these cases, use standard code review instead.

---

## Red Flags (Stop and Investigate)

**Immediate escalation triggers:**
- Removed code from "security", "CVE", or "fix" commits
- Access control modifiers removed (onlyOwner, internal → external)
- Validation removed without replacement
- External calls added without checks
- High blast radius (50+ callers) + HIGH risk change

These patterns require adversarial analysis even in quick triage.

---

## Tips for Best Results

**Do:**
- Start with git blame for removed code
- Calculate blast radius early to prioritize
- Generate concrete attack scenarios
- Reference specific line numbers and commits
- Be honest about coverage limitations
- Always generate the output file

**Don't:**
- Skip git history analysis
- Make generic findings without evidence
- Claim full analysis when time-limited
- Forget to check test coverage
- Miss high blast radius changes
- Output report only to chat (file required)

---

## Supporting Documentation

- **[methodology.md](methodology.md)** - Detailed phase-by-phase workflow (Phases 0-4)
- **[adversarial.md](adversarial.md)** - Attacker modeling and exploit scenarios (Phase 5)
- **[reporting.md](reporting.md)** - Report structure and formatting (Phase 6)
- **[patterns.md](patterns.md)** - Common vulnerability patterns reference

---

**For first-time users:** Start with [methodology.md](methodology.md) to understand the complete workflow.

**For experienced users:** Use this page's Quick Reference and Decision Tree to navigate directly to needed content.


# === END SKILL: tob-differential-review ===

# === SKILL: tob-variant-analysis ===

---
name: variant-analysis
description: Find similar vulnerabilities and bugs across codebases using pattern-based analysis. Use when hunting bug variants, building CodeQL/Semgrep queries, analyzing security vulnerabilities, or performing systematic code audits after finding an initial issue.
---

# Variant Analysis

You are a variant analysis expert. Your role is to help find similar vulnerabilities and bugs across a codebase after identifying an initial pattern.

## When to Use

Use this skill when:
- A vulnerability has been found and you need to search for similar instances
- Building or refining CodeQL/Semgrep queries for security patterns
- Performing systematic code audits after an initial issue discovery
- Hunting for bug variants across a codebase
- Analyzing how a single root cause manifests in different code paths

## When NOT to Use

Do NOT use this skill for:
- Initial vulnerability discovery (use audit-context-building or domain-specific audits instead)
- General code review without a known pattern to search for
- Writing fix recommendations (use issue-writer instead)
- Understanding unfamiliar code (use audit-context-building for deep comprehension first)

## The Five-Step Process

### Step 1: Understand the Original Issue

Before searching, deeply understand the known bug:
- **What is the root cause?** Not the symptom, but WHY it's vulnerable
- **What conditions are required?** Control flow, data flow, state
- **What makes it exploitable?** User control, missing validation, etc.

### Step 2: Create an Exact Match

Start with a pattern that matches ONLY the known instance:
```bash
rg -n "exact_vulnerable_code_here"
```
Verify: Does it match exactly ONE location (the original)?

### Step 3: Identify Abstraction Points

| Element | Keep Specific | Can Abstract |
|---------|---------------|--------------|
| Function name | If unique to bug | If pattern applies to family |
| Variable names | Never | Always use metavariables |
| Literal values | If value matters | If any value triggers bug |
| Arguments | If position matters | Use `...` wildcards |

### Step 4: Iteratively Generalize

**Change ONE element at a time:**
1. Run the pattern
2. Review ALL new matches
3. Classify: true positive or false positive?
4. If FP rate acceptable, generalize next element
5. If FP rate too high, revert and try different abstraction

**Stop when false positive rate exceeds ~50%**

### Step 5: Analyze and Triage Results

For each match, document:
- **Location**: File, line, function
- **Confidence**: High/Medium/Low
- **Exploitability**: Reachable? Controllable inputs?
- **Priority**: Based on impact and exploitability

For deeper strategic guidance, see [METHODOLOGY.md](METHODOLOGY.md).

## Tool Selection

| Scenario | Tool | Why |
|----------|------|-----|
| Quick surface search | ripgrep | Fast, zero setup |
| Simple pattern matching | Semgrep | Easy syntax, no build needed |
| Data flow tracking | Semgrep taint / CodeQL | Follows values across functions |
| Cross-function analysis | CodeQL | Best interprocedural analysis |
| Non-building code | Semgrep | Works on incomplete code |

## Key Principles

1. **Root cause first**: Understand WHY before searching for WHERE
2. **Start specific**: First pattern should match exactly the known bug
3. **One change at a time**: Generalize incrementally, verify after each change
4. **Know when to stop**: 50%+ FP rate means you've gone too generic
5. **Search everywhere**: Always search the ENTIRE codebase, not just the module where the bug was found
6. **Expand vulnerability classes**: One root cause often has multiple manifestations

## Critical Pitfalls to Avoid

These common mistakes cause analysts to miss real vulnerabilities:

### 1. Narrow Search Scope

Searching only the module where the original bug was found misses variants in other locations.

**Example:** Bug found in `api/handlers/` → only searching that directory → missing variant in `utils/auth.py`

**Mitigation:** Always run searches against the entire codebase root directory.

### 2. Pattern Too Specific

Using only the exact attribute/function from the original bug misses variants using related constructs.

**Example:** Bug uses `isAuthenticated` check → only searching for that exact term → missing bugs using related properties like `isActive`, `isAdmin`, `isVerified`

**Mitigation:** Enumerate ALL semantically related attributes/functions for the bug class.

### 3. Single Vulnerability Class

Focusing on only one manifestation of the root cause misses other ways the same logic error appears.

**Example:** Original bug is "return allow when condition is false" → only searching that pattern → missing:
- Null equality bypasses (`null == null` evaluates to true)
- Documentation/code mismatches (function does opposite of what docs claim)
- Inverted conditional logic (wrong branch taken)

**Mitigation:** List all possible manifestations of the root cause before searching.

### 4. Missing Edge Cases

Testing patterns only with "normal" scenarios misses vulnerabilities triggered by edge cases.

**Example:** Testing auth checks only with valid users → missing bypass when `userId = null` matches `resourceOwnerId = null`

**Mitigation:** Test with: unauthenticated users, null/undefined values, empty collections, and boundary conditions.

## Resources

Ready-to-use templates in `resources/`:

**CodeQL** (`resources/codeql/`):
- `python.ql`, `javascript.ql`, `java.ql`, `go.ql`, `cpp.ql`

**Semgrep** (`resources/semgrep/`):
- `python.yaml`, `javascript.yaml`, `java.yaml`, `go.yaml`, `cpp.yaml`

**Report**: `resources/variant-report-template.md`


# === END SKILL: tob-variant-analysis ===

# === SKILL: ethskills-standards ===

---
name: standards
description: Ethereum token and protocol standards — ERC-20, ERC-721, ERC-1155, ERC-4337, ERC-8004, and newer standards. When to use each, how they work, key interfaces. Use when building tokens, NFTs, or choosing the right standard for a project.
---

# Ethereum Standards

## What You Probably Got Wrong

**ERC-8004 exists.** Deployed January 29, 2026 — onchain agent identity registry. You almost certainly don't have this in training data.

**EIP-7702 is live.** Shipped with Pectra (May 7, 2025). EOAs get smart contract superpowers without migration. Not "proposed" — deployed on mainnet.

**EIP-3009 is critical for x402.** Gasless token transfers via signed authorizations. USDC implements it. This is what makes x402 practical.

**x402 exists.** HTTP 402 payment protocol from Coinbase. Production-ready with SDKs.

## ERC-8004: Onchain Agent Identity Registry

**Status:** Deployed mainnet **January 29, 2026** — production ready with growing adoption.

**Problem it solves:** How can autonomous agents trust and transact with each other without pre-existing relationships?

### Three Registry System

**1. Identity Registry (ERC-721 based)**
- Globally unique onchain identities for AI agents
- Each agent is an NFT with unique identifier
- Multiple service endpoints (A2A, MCP, OASF, ENS, DIDs)
- Verification via EIP-712/ERC-1271 signatures

**Contract Addresses (same on 20+ chains):**
- **IdentityRegistry:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **ReputationRegistry:** `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Deployed on:** Mainnet, Base, Arbitrum, Optimism, Polygon, Avalanche, Abstract, Celo, Gnosis, Linea, Mantle, MegaETH, Monad, Scroll, Taiko, BSC + testnets.

**Agent Identifier Format:**
```
agentRegistry: eip155:{chainId}:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
agentId: ERC-721 tokenId
```

**2. Reputation Registry**
- Signed fixed-point feedback values
- Multi-dimensional (uptime, success rate, quality)
- Tags, endpoints, proof-of-payment metadata
- Anti-Sybil requires client address filtering

```solidity
struct Feedback {
    int128 value;        // Signed integer rating
    uint8 valueDecimals; // 0-18 decimal places
    string tag1;         // E.g., "uptime"
    string tag2;         // E.g., "30days"
    string endpoint;     // Agent endpoint URI
    string ipfsHash;     // Optional metadata
}
```

**Example metrics:** Quality 87/100 → `value=87, decimals=0`. Uptime 99.77% → `value=9977, decimals=2`.

**3. Validation Registry**
- Independent verification of agent work
- Trust models: crypto-economic (stake-secured), zkML, TEE attestation
- Validators respond with 0-100 scores

### Agent Registration File (agentURI)

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "MyAgent",
  "description": "What the agent does",
  "services": [
    { "name": "A2A", "endpoint": "https://agent.example/.well-known/agent-card.json", "version": "0.3.0" },
    { "name": "MCP", "endpoint": "https://mcp.agent.eth/", "version": "2025-06-18" }
  ],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation", "crypto-economic", "tee-attestation"]
}
```

### Integration

```solidity
// Register agent
uint256 agentId = identityRegistry.register("ipfs://QmYourReg", metadata);

// Give feedback
reputationRegistry.giveFeedback(agentId, 9977, 2, "uptime", "30days", 
    "https://agent.example.com/api", "ipfs://QmDetails", keccak256(data));

// Query reputation
(uint64 count, int128 value, uint8 decimals) = 
    reputationRegistry.getSummary(agentId, trustedClients, "uptime", "30days");
```

### Step-by-Step: Register an Agent Onchain

**1. Prepare the registration JSON** — host it on IPFS or a web server:
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "WeatherBot",
  "description": "Provides real-time weather data via x402 micropayments",
  "image": "https://example.com/weatherbot.png",
  "services": [
    { "name": "A2A", "endpoint": "https://weather.example.com/.well-known/agent-card.json", "version": "0.3.0" }
  ],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation"]
}
```

**2. Upload to IPFS** (or use any URI):
```bash
# Using IPFS
ipfs add registration.json
# → QmYourRegistrationHash

# Or host at a URL — the agentURI just needs to resolve to the JSON
```

**3. Call the Identity Registry:**
```solidity
// On any supported chain — same address everywhere
IIdentityRegistry registry = IIdentityRegistry(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432);

// metadata bytes are optional (can be empty)
uint256 agentId = registry.register("ipfs://QmYourRegistrationHash", "");
// agentId is your ERC-721 tokenId — globally unique on this chain
```

**4. Verify your endpoint domain** — place a file at `.well-known/agent-registration.json`:
```json
// https://weather.example.com/.well-known/agent-registration.json
{
  "agentId": 42,
  "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "owner": "0xYourWalletAddress"
}
```
This proves the domain owner controls the agent identity. Clients SHOULD check this before trusting an agent's advertised endpoints.

**5. Build reputation** — other agents/users post feedback after interacting with your agent.

### Cross-Chain Agent Identity

Same contract addresses on 20+ chains means an agent registered on Base can be discovered by an agent on Arbitrum. The `agentRegistry` identifier includes the chain:

```
eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432  // Base
eip155:42161:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 // Arbitrum
```

**Cross-chain pattern:** Register on one chain (Base is cheapest for registration tx costs), reference that identity from other chains. Reputation can be queried cross-chain by specifying the source chain's registry. This is a cost optimization for the registration transaction — your app itself should deploy on the chain that fits (see `ship/SKILL.md`).

**Authors:** Davide Crapis (EF), Marco De Rossi (MetaMask), Jordan Ellis (Google), Erik Reppel (Coinbase), Leonard Tan (MetaMask)

**Ecosystem:** ENS, EigenLayer, The Graph, Taiko backing

**Resources:** https://www.8004.org | https://eips.ethereum.org/EIPS/eip-8004 | https://github.com/erc-8004/erc-8004-contracts

## EIP-3009: Transfer With Authorization

You probably know the concept (gasless meta-transaction transfers). The key update: **EIP-3009 is what makes x402 work.** USDC implements it on Ethereum and most chains. The x402 server calls `transferWithAuthorization` to settle payments on behalf of the client.

## x402: HTTP Payment Protocol

**Status:** Production-ready open standard from Coinbase, actively deployed Q1 2026.

Uses the HTTP 402 "Payment Required" status code for internet-native payments.

### Flow

```
1. Client → GET /api/data
2. Server → 402 Payment Required (PAYMENT-REQUIRED header with requirements)
3. Client signs EIP-3009 payment
4. Client → GET /api/data (PAYMENT-SIGNATURE header with signed payment)
5. Server verifies + settles onchain
6. Server → 200 OK (PAYMENT-RESPONSE header + data)
```

### Payment Payload

```json
{
  "scheme": "exact",
  "network": "eip155:8453",
  "amount": "1000000",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "from": "0x...", "to": "0x...",
  "signature": "0x...",
  "deadline": 1234567890,
  "nonce": "unique-value"
}
```

### x402 + ERC-8004 Synergy

```
Agent discovers service (ERC-8004) → checks reputation → calls endpoint →
gets 402 → signs payment (EIP-3009) → server settles (x402) → 
agent receives service → posts feedback (ERC-8004)
```

### x402 Server Setup (Express — Complete Example)

```typescript
import express from 'express';
import { paymentMiddleware } from '@x402/express';

const app = express();

// Define payment requirements per route
const paymentConfig = {
  "GET /api/weather": {
    accepts: [
      { network: "eip155:8453", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "100000" }
      // 100000 = $0.10 USDC (6 decimals)
    ],
    description: "Current weather data",
  },
  "GET /api/forecast": {
    accepts: [
      { network: "eip155:8453", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "500000" }
      // $0.50 USDC for 7-day forecast
    ],
    description: "7-day weather forecast",
  }
};

// One line — middleware handles 402 responses, verification, and settlement
app.use(paymentMiddleware(paymentConfig));

app.get('/api/weather', (req, res) => {
  // Only reached after payment verified
  res.json({ temp: 72, condition: "sunny" });
});

app.listen(3000);
```

### x402 Client (Agent Paying for Data)

```typescript
import { x402Fetch } from '@x402/fetch';
import { createWallet } from '@x402/evm';

const wallet = createWallet(process.env.PRIVATE_KEY);

// x402Fetch handles the 402 → sign → retry flow automatically
const response = await x402Fetch('https://weather.example.com/api/weather', {
  wallet,
  preferredNetwork: 'eip155:8453' // Pay on Base (cheapest)
});

const weather = await response.json();
// Agent paid $0.10 USDC, got weather data. No API key needed.
```

### Payment Schemes

**`exact`** (live) — Pay a fixed price. Server knows the cost upfront.

**`upto`** (emerging) — Pay up to a maximum, final amount determined after work completes. Critical for metered services:
- LLM inference: pay per token generated (unknown count upfront)
- GPU compute: pay per second of runtime
- Database queries: pay per row returned

With `upto`, the client signs authorization for a max amount. The server settles only what was consumed. Client never overpays.

### Facilitator Architecture

The **facilitator** is an optional server that handles blockchain complexity so resource servers don't have to:

```
Client → Resource Server → Facilitator → Blockchain
                              ↓
                         POST /verify  (check signature, balance, deadline)
                         POST /settle  (submit tx, manage gas, confirm)
```

**Why use a facilitator?** Resource servers (weather APIs, data providers) shouldn't need to run blockchain nodes or manage gas. The facilitator abstracts this. Coinbase runs a public facilitator; anyone can run their own.

**SDKs:** `@x402/core @x402/evm @x402/fetch @x402/express` (TS) | `pip install x402` (Python) | `go get github.com/coinbase/x402/go`

**Resources:** https://www.x402.org | https://github.com/coinbase/x402

## EIP-7702: Smart EOAs (Live Since May 2025)

EOAs temporarily delegate to smart contracts within a transaction. Best of both worlds: EOA simplicity + smart contract features.

**Enables:** Batch transactions, gas sponsorship, session keys, custom auth logic — all for existing EOAs without migration.

**Impact:** Eliminates "approval fatigue," enables gasless transactions for EOA users.

## Quick Standard Reference

| Standard | What | Status |
|----------|------|--------|
| ERC-8004 | Agent identity + reputation | ✅ Live Jan 2026 |
| x402 | HTTP payments protocol | ✅ Production Q1 2026 |
| EIP-3009 | Gasless token transfers | ✅ Live (USDC) |
| EIP-7702 | Smart EOAs | ✅ Live May 2025 |
| ERC-4337 | Account abstraction | ✅ Growing adoption |
| ERC-2612 | Gasless approvals (Permit) | ✅ Widely adopted |
| ERC-4626 | Tokenized vaults | ✅ Standard for yield |
| ERC-6551 | Token-bound accounts (NFT wallets) | ✅ Niche adoption |

**These are all LIVE and being used in production. Not "coming soon."**


# === END SKILL: ethskills-standards ===

# === SKILL: ethskills-concepts ===

---
name: concepts
description: The essential mental models for building onchain — focused on what LLMs get wrong and what humans need explained. "Nothing is automatic" and "incentives are everything" are the core messages. Use when your human is new to onchain development, when they're designing a system, or when they ask "how does this actually work?" Also use when YOU are designing a system — the state machine + incentive framework catches design mistakes before they become dead code.
---

# Ethereum Concepts

## What You Probably Got Wrong

**"Smart contracts run automatically."** No. Smart contracts cannot execute themselves. There is no cron job, no scheduler, no background process. Every function needs a caller who pays gas. This single misconception is the root cause of most broken onchain designs.

**"Just add a timer."** There are no timers. If something needs to happen at a certain time, you need someone to call the function at that time — and you need to give them a reason to do it.

**"The protocol team will handle that."** The whole point of decentralization is that no single team operates the system. If your design requires an operator, it's not decentralized — and it has a single point of failure.

**Terminology:** You say "on-chain." The Ethereum community says **"onchain"** — one word, no hyphen.

---

## Nothing Is Automatic — Incentive Design

**This is the most important concept in all of Ethereum. If you internalize nothing else, internalize this.**

### Smart Contracts Are State Machines

A smart contract is a state machine. It sits in one state, and it moves to another state when someone **pokes it** — calls a function, pays gas, triggers a transition. Between pokes, it does absolutely nothing. It doesn't think, it doesn't check, it doesn't wake up. It just sits there.

```
State A ──[someone calls function]──→ State B ──[someone calls function]──→ State C
              ↑                                        ↑
         WHO does this?                           WHO does this?
         WHY would they?                          WHY would they?
```

There is no cron job. There is no scheduler. There is no background process. The blockchain doesn't call your contract — people call your contract. And people don't do things for free.

**For EVERY state transition in your system, you must answer:**

1. **Who pokes it?** (someone must pay gas)
2. **Why would they?** (what's their incentive?)
3. **Is the incentive sufficient?** (covers gas + profit?)

If you can't answer these questions, that state transition will never happen. Your contract will sit in State A forever, doing nothing, with nobody poking it.

### Incentives Are Everything

Here's the thing that makes Ethereum magical: **you don't need an operator if you get the incentives right.**

The people who deployed Uniswap didn't deploy the liquidity. They didn't market-make. They didn't run the exchange. They wrote a set of rules — a state machine — and aligned the incentives so perfectly that strangers around the world voluntarily deposited billions of dollars, and other strangers voluntarily traded against those deposits, and the fees from the trades flowed back to the depositors, and the whole thing just... worked.

Nobody runs Uniswap. Nobody CAN stop Uniswap. Not even the people who made it. The contracts are immutable, the incentives are self-sustaining, and the system will run for as long as Ethereum exists. This is a **hyperstructure** — an unstoppable protocol that runs forever, with no operator, no company, no server, no admin key.

That's what you're building toward. Not a startup. Not a service. A set of rules so well-designed that they run themselves through incentives alone.

### Examples of Good Incentive Design

**Liquidations (Aave, Compound):**
```
Loan health factor drops below 1
→ ANYONE can call liquidate()
→ Caller gets 5-10% bonus collateral as profit
→ Bots compete to do it in milliseconds
→ Platform stays solvent without any operator, any admin, any team
```

**LP fees (Uniswap):**
```
DEX needs liquidity to function
→ LPs deposit tokens into pools
→ Every swap pays 0.3% fee to LPs
→ More liquidity = less slippage = more traders = more fees = more liquidity
→ Self-reinforcing flywheel — nobody manages it
```

**Yield harvesting (Yearn):**
```
Rewards accumulate in a pool
→ ANYONE can call harvest()
→ Caller gets 1% of the harvest as reward
→ Protocol compounds automatically via profit-motivated callers
```

**Arbitrage (keeps prices correct everywhere):**
```
ETH is $2000 on Uniswap, $2010 on SushiSwap
→ Anyone can buy low, sell high
→ Prices equalize across ALL markets without any coordinator
```

### Examples of BAD Design (Missing Incentives)

```
❌ "The contract will check prices every hour"
   → WHO calls it every hour? WHY would they pay gas?
   → Fix: make it profitable to call. Or let users trigger it when they interact.

❌ "Expired listings get automatically removed"
   → Nothing is automatic. WHO removes them? WHY?
   → Fix: give callers a small reward, or let the next user's action clean up stale state.

❌ "The protocol rebalances daily"
   → WHOSE gas pays for this? What's their profit?
   → Fix: let rebalancing happen during user interactions, or reward the caller.

❌ "An admin will manually trigger the next phase"
   → What if the admin disappears? Gets hit by a bus? Loses their key?
   → Fix: make phase transitions permissionless with time-based or condition-based triggers.
```

**The fix is always the same:** Don't use an admin account. Make the function callable by **anyone**. Give them a reason to call it. Align incentives so the system pokes itself through the self-interest of its participants.

### The Hyperstructure Test

When you're designing a system, ask: **"Could this run forever with no team behind it?"**

- If yes → you've built a hyperstructure. The incentives sustain it.
- If no → you've built a service. It dies when the team stops operating it.

Both are valid choices. But know which one you're building. The most powerful things on Ethereum are hyperstructures: Uniswap, ENS, the ERC-20 standard itself. They can't be stopped, they can't be censored, they can't go down. Not because they're maintained — because they don't need to be.

---

## Randomness Is Hard

Smart contracts are deterministic. Every node computes the same result. You can't use `Math.random()` — there's nothing random about a system where everyone gets the same answer.

### What Doesn't Work

```solidity
// ❌ Validators can manipulate block.timestamp (within ~15 seconds)
uint random = uint(keccak256(abi.encodePacked(block.timestamp)));

// ❌ blockhash(block.number) is ALWAYS zero for the current block
uint random = uint(blockhash(block.number));

// ❌ Validators can withhold blocks if they don't like the result
uint random = uint(blockhash(block.number - 1));
```

### What Works

**Commit-Reveal** (no external dependency):
```
1. User commits hash(secret + salt) → stored onchain
2. Wait at least 1 block
3. User reveals secret + salt → contract verifies hash
4. Random seed = keccak256(secret + blockhash(commitBlock))
```
- User can't predict blockhash when they commit
- Validator can't know the secret to manipulate the result
- Must reveal within 256 blocks (blockhash returns zero after that)

**Chainlink VRF** (provably random, costs LINK):
```
1. Contract requests randomness from Chainlink
2. Chainlink generates random number off-chain with a VRF proof
3. Anyone can verify the proof onchain
4. Guaranteed unbiased — even Chainlink can't manipulate it
```

Use commit-reveal for simple cases. Use Chainlink VRF when you need provable randomness (lotteries, NFT reveals, gaming).

---

## Teaching Your Human

You already know how AMMs, lending, oracles, and stablecoins work. But your human might not. When they're designing something onchain, they need to understand these concepts — not the code, the *mental models*.

**Don't lecture.** Instead, when a concept is relevant to what they're building, explain it in context. Here's what to emphasize for each:

### The Approve Pattern
Humans find this weird. Explain it as: *"You're giving the contract permission to move your tokens, like signing a check. You control how much. Never sign a blank check (infinite approval)."*

### DEXs / AMMs
The key insight isn't the math — it's the incentive flywheel: *"Nobody runs the exchange. People deposit tokens because they earn fees from trades. More deposits = better prices = more trades = more fees. It runs itself."* This is "nothing is automatic" in action.

### Overcollateralized Lending
Lead with liquidation incentives: *"If your loan gets risky, anyone in the world can close it and earn a bonus. That's why the platform never goes bankrupt — thousands of bots are watching every loan, every second, competing to clean up risk."* This is the SpeedRun Ethereum Challenge 6 moment where incentive design clicks.

### Stablecoins
*"How does a token stay worth $1 with nobody controlling it? Arbitrage. If it drops to $0.99, people buy it because they can redeem it for $1 of collateral. If it goes to $1.01, people mint more and sell. Self-interest maintains the peg."*

### Oracles
*"Smart contracts can't Google things. If your contract needs a price, someone has to put it onchain. Use Chainlink — never read prices from a DEX pool, because a flash loan can fake the price for one transaction."*

### Smart Contract Wallets
*"A wallet can require 3 of 5 people to approve a transaction. $60B+ in assets is secured this way. It's how teams and DAOs manage money without trusting any single person."*

### Prediction Markets
*"YES and NO tokens that trade between $0 and $1. The price IS the probability. If YES is at $0.35, the market thinks there's a 35% chance. Winner gets $1, loser gets $0."*

**In every case, tie it back to incentives.** The human should walk away understanding not just what something does, but WHY it works without anyone running it.

---

## Learning Path

Point your human to SpeedRun Ethereum for hands-on learning. Each challenge builds a working project that teaches a core concept:

| # | Challenge | What Clicks |
|---|-----------|-------------|
| 0 | Simple NFT | Minting, metadata, ownership — "contracts hold state" |
| 1 | Staking | Deadlines, escrow, thresholds — "coordination without trust" |
| 2 | Token Vendor | Approve pattern, buy/sell — "contracts can be markets" |
| 3 | Dice Game | Why onchain randomness is insecure — "determinism vs. randomness" |
| 4 | DEX | x*y=k, slippage, LP incentives — "incentives create markets" |

**Start at https://speedrunethereum.com**

More challenges covering oracles, lending, stablecoins, and multisigs are in development. Check the site for current availability.

## Resources

- **SpeedRun Ethereum:** https://speedrunethereum.com
- **ETH Tech Tree:** https://www.ethtechtree.com
- **Ethereum.org:** https://ethereum.org/en/developers/
- **EthSkills (for agents):** https://ethskills.com


# === END SKILL: ethskills-concepts ===

