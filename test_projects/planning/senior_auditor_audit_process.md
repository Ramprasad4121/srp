# The Complete Smart Contract Audit Methodology

## The Fundamental Truth First

Most auditors read code looking for bugs. That's wrong.

You read code looking for **broken promises**. The protocol made promises to its users. Your job is to find every possible way those promises can be broken — by attackers, by market conditions, by edge cases the developer never imagined.

If you internalize this, your audit quality doubles immediately.

---

## Phase 0 — Pre-Audit Mental Preparation (2 hours)

Before touching the codebase, answer these questions in writing:

**1. What is this protocol's core value proposition?**
One sentence. If you can't write it in one sentence, you don't understand it yet.

*Bad: "SecondSwap is a vesting token marketplace that allows users to buy and sell vesting tokens with various features"*
*Good: "SecondSwap lets holders sell locked/vesting tokens at a discount to buyers who wait for the vesting schedule"*

**2. Where does the money come from and where does it go?**
Draw this before reading any code. Follow the ETH/tokens.

**3. Who are the adversarial actors?**
- External attacker (no prior interaction)
- Malicious user (has funds deposited)
- Malicious admin (compromised owner key)
- Malicious token (fee-on-transfer, rebasing, ERC777 hook)
- Malicious oracle (stale, manipulated price)
- MEV bot (sandwicher, frontrunner)

**4. What is the worst possible outcome?**
Total loss of funds? Permanent DoS? Governance takeover? Price manipulation?

Write your threat model before you see the code. This prevents anchoring bias — where you only find bugs you were looking for.

---

## Phase 1 — Reconnaissance (Day 1, 4-6 hours)

### 1.1 Read Everything That Isn't Code

**Order matters:**

1. README — understand the stated purpose
2. Whitepaper or docs — understand the design decisions
3. Previous audit reports — understand what was already found. More importantly, understand what the previous auditors *missed*
4. GitHub Issues and PRs — developers discuss bugs in plain English here. This is gold
5. Discord/Telegram — what do users complain about? Complaints are bug signals
6. Similar protocols — what bugs were found in similar systems?

**Note everything that sounds like a security guarantee:**
- "Users can always withdraw their funds"
- "The oracle cannot be manipulated in a single block"
- "Admin cannot steal user funds"

These are invariants. Write them down. You will test every single one.

### 1.2 The Scope Map

Create this document first:

```
SCOPE MAP
─────────────────────────────────────────

Contracts in scope:
├── Core.sol          (892 lines) — main protocol logic
├── Vault.sol         (341 lines) — fund custody
├── Oracle.sol        (156 lines) — price feeds
└── TokenWrapper.sol  (203 lines) — ERC20 wrapper

Contracts NOT in scope but called:
├── Chainlink AggregatorV3 — external oracle
├── Uniswap V3 Pool — used for TWAP
└── USDC (FiatTokenV2) — payment token

Privileged addresses:
├── owner: can pause, set fees, upgrade
├── manager: can set risk parameters
└── keeper: can trigger liquidations

Total value at risk: $XXM TVL
Audit period: 7 days
```

---

## Phase 2 — Architecture Understanding (Day 1-2)

### 2.1 The Trust Boundary Map

This is the single most important diagram you will draw.

Every external call is a trust boundary. At every trust boundary, ask: **What if the thing I'm calling is malicious or broken?**

```
┌─────────────────────────────────────────────────────────────┐
│  TRUSTED ZONE (our contracts)                               │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  Core    │───▶│  Vault   │───▶│  Router  │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│       │                                │                    │
└───────┼────────────────────────────────┼────────────────────┘
        │ TRUST BOUNDARY                 │ TRUST BOUNDARY
        ▼                                ▼
┌──────────────┐                ┌──────────────────┐
│  Chainlink   │                │  Uniswap V3 Pool │
│  (external)  │                │  (external)      │
└──────────────┘                └──────────────────┘
        │
        │ Questions at this boundary:
        │ - Is the price stale? (check updatedAt)
        │ - Can it return 0?
        │ - Can it return negative?
        │ - Is the feed for the right token?
        │ - What happens during a Chainlink circuit breaker?
```

For **every** external call, document:
- What data comes back
- What happens if it reverts
- What happens if it returns unexpected values (0, MAX_UINT, negative)
- Who controls the thing being called

### 2.2 The Value Flow Diagram

Draw money flowing through the system. Every entry point and exit point.

```
ENTRY POINTS (money comes in):
  deposit(amount)   → Vault.sol:deposit()
  buy(orderId)      → Core.sol:buy()

VALUE STORED:
  Vault: user deposits (USDC)
  Core: locked vesting tokens

EXIT POINTS (money goes out):
  withdraw(amount)  → Vault.sol:withdraw()
  sell(orderId)     → Core.sol:sell()
  claim(vestId)     → Core.sol:claim()
  emergencyWithdraw → Core.sol:emergencyWithdraw()  ← ALWAYS check this

PRIVILEGED EXTRACTION:
  collectFees()     → only owner
  setFeeRate()      → owner can change to 100%? ← CHECK THIS
```

**Rule:** If there are more exit points than entry points that you can see, something is wrong. If there are exit points only an admin can call, that's a potential rug vector.

### 2.3 The State Variable Map

Before reading functions, read ALL state variables and understand what each tracks:

```
STATE VARIABLES — Core.sol

// Accounting
mapping(address => uint256) public balances        // user → balance
mapping(address => uint256) public totalDeposited  // token → total

// Configuration
uint256 public feeRate      // in basis points, 0-10000
address public feeRecipient // where fees go
uint256 public maxFee = 500 // 5% max fee — IS THIS ENFORCED?

// Status
bool public paused          // can pause everything
bool public initialized     // prevent re-initialization

// Key relationships
mapping(uint256 => Order) public orders    // orderId → order struct
mapping(address => uint256[]) userOrders   // user → their order IDs
```

Ask about every variable:
- Can this be set to zero? What breaks?
- Can this overflow?
- Can this be manipulated by a user?
- Is there a gap between when this should update and when it does?

---

## Phase 3 — Invariant Extraction (Day 2, Critical)

This is where 200 IQ auditing separates from average auditing.

**An invariant is a condition that must ALWAYS be true, regardless of what any user does.**

Write invariants in three categories:

### Global Invariants (must hold at all times)
```
G-01: sum(balances[user] for all users) <= totalAssets
G-02: totalDebt * collateralFactor <= totalCollateral
G-03: pricePerShare can never decrease (for non-rebasing vaults)
G-04: A user cannot have healthFactor < 1 without being liquidatable
G-05: feeRate <= maxFee
```

### Function-Level Invariants (must hold after each call)
```
F-01: After deposit(x), balances[user] increases by exactly x (minus fees)
F-02: After withdraw(x), contract token balance decreases by exactly x
F-03: After swap, x*y = k (constant product invariant)
F-04: After liquidation, position's healthFactor >= 1
```

### Economic Invariants (cannot be arbitrarily profitable)
```
E-01: No sequence of calls allows extracting more than deposited
E-02: No flash loan sequence can profit from the protocol
E-03: Fee cannot be charged twice for the same action
E-04: Rounding always favors the protocol, not the user
```

**How to find invariants:**
Every `require` statement in the code is a hint. The developer put it there because they believed it must be true. Ask: "Can I get here without this check passing?" and "Can I make this check pass while violating the spirit of it?"

---

## Phase 4 — Attack Hypothesis Generation (Day 2-3)

Before reading function bodies deeply, generate 30-50 attack hypotheses. Write them in a list. Be specific.

**Template:**
```
HYP-XXX: [WHO] can [ACTION] by [METHOD], resulting in [IMPACT]
```

**Examples:**
```
HYP-001: Attacker can drain vault by using ERC777 reentrancy in withdraw()
HYP-002: Attacker can get free tokens by front-running initialize()
HYP-003: User can avoid fees by exploiting rounding in fee calculation
HYP-004: Attacker can manipulate spot price oracle using flash loan in single tx
HYP-005: Admin can rug users by setting feeRate to 10000 (100%)
HYP-006: Attacker can block liquidations by making collateral token revert
HYP-007: Attacker can inflate shares and steal yield using first-depositor attack
HYP-008: Two users in same block can exploit stale interest accrual
HYP-009: Order can be executed after being cancelled if nonce not incremented
HYP-010: Attacker can grief all users by filling storage with dust orders
```

Now you have a hunting list. You will go through the code specifically searching for evidence that each hypothesis is true or false.

---

## Phase 5 — Code Reading (Day 3-5)

### 5.1 The Order of Reading

**Never read linearly from top to bottom.**

Read in this order:

1. **Imports and inheritance chain** — what does this contract inherit? Proxy? ERC4626?
2. **Constructor and initialize()** — what state gets set? Who can call initialize?
3. **State-modifying external functions** — these are attack surfaces
4. **View functions that inform state-modifying ones** — these can be manipulated to lie
5. **Internal/private helpers** — where developers hide complex logic
6. **Modifiers** — understand every guard before trusting it
7. **Events** — events show what the developer thought was important

### 5.2 The Function Annotation System

For every significant function, annotate in your notes:

```
FUNCTION: liquidate(address borrower, uint256 amount)
─────────────────────────────────────────────────────
ACCESS:     external — anyone can call (intentional?)
MODIFIERS:  nonReentrant, whenNotPaused
INPUTS:     borrower (trusted? NO — attacker can pass any address)
            amount (validated? check below)

PRECONDITIONS CHECKED:
  ✓ healthFactor[borrower] < 1e18
  ✗ amount <= maxLiquidationAmount — NOT CHECKED (HYP-015?)
  ✗ borrower has outstanding debt — NOT CHECKED directly

STATE CHANGES (in order):
  1. debtBalance[borrower] -= amount         (before external call? YES ✓)
  2. collateralBalance[borrower] -= seized   (before external call? YES ✓)
  3. collateralBalance[liquidator] += seized (before external call? YES ✓)

EXTERNAL CALLS:
  token.transferFrom(liquidator, address(this), amount) — after state change ✓
  collateral.transfer(liquidator, seized) — after state change ✓

MATH CRITICAL PATHS:
  seized = amount * liquidationBonus / 1e18
  → Can amount be so large that seized > collateralBalance? → CHECK

INVARIANTS AFFECTED: G-02, G-04, E-01

NOTES:
  - If borrower.collateral is a reentrant token, seized calculation runs
    before the actual transfer — but state is already updated, so OK.
  - What if liquidationBonus is set to 0 by admin? Liquidators have no
    incentive → positions become permanently stuck → protocol insolvency
```

### 5.3 The Math Deep-Dive

Every financial calculation deserves its own analysis. I use this framework:

```
MATH ANALYSIS: interest rate calculation
─────────────────────────────────────────
Formula: interest = principal * rate * time / 1e18

PRECISION CHECK:
  principal: up to 1e30 (large whale position)
  rate: up to 1e18 (100% APY)
  time: up to 365 days = 31,536,000 seconds

  Intermediate: 1e30 * 1e18 = 1e48 — OVERFLOW in uint256? 
  uint256 max = ~1.16e77 — OK, no overflow
  
  But: 1e48 / 1e18 = 1e30 — still huge, fine

ROUNDING DIRECTION:
  integer division rounds DOWN in Solidity
  This means: protocol gets less interest than it should
  Over time: this causes slow accounting drift
  Over 1 year with 10,000 positions: how much drift? CALCULATE

EDGE CASES:
  principal = 0: result = 0 ✓
  rate = 0: result = 0 ✓
  time = 0: result = 0 ✓ (same block deposit+withdraw = no interest)
  time = MAX_UINT: OVERFLOW ← when does this happen?
```

---

## Phase 6 — The Note-Making System (Ongoing)

### My Folder Structure

```
/2024-12-secondswap-audit/
│
├── 00_scope.md              ← contracts, lines, timeframe
├── 01_protocol_overview.md  ← what it does in plain English
├── 02_architecture.md       ← system map diagram
├── 03_trust_boundaries.md   ← every external call mapped
├── 04_value_flows.md        ← money in, money out
├── 05_roles.md              ← who can do what
├── 06_state_variables.md    ← all storage, annotated
├── 07_invariants.md         ← global + function + economic
├── 08_attack_hypotheses.md  ← 40+ hypotheses, each marked:
│                               [CONFIRMED] [REFUTED] [PENDING]
├── 09_questions.md          ← things I don't understand yet
├── 10_findings/
│   ├── HIGH-001.md
│   ├── HIGH-002.md
│   ├── MED-001.md
│   └── LOW-001.md
└── 11_post_audit.md         ← summary, what I'd check with more time
```

### The Question Log (Most Underrated Tool)

Every time something is unclear, I write it as a question and keep going. Never get stuck. Stuckness kills audit momentum.

```
QUESTIONS — 2024-12-secondswap
──────────────────────────────
Q-001: Who sets the initial vestingSchedule? Is this admin-only?
       → Look at initialize() and any setter functions
       → STATUS: ANSWERED — only owner, not a bug

Q-002: The comment says "cannot withdraw during vesting" but I see no
       check for this in withdraw(). Am I missing a modifier?
       → STATUS: PENDING ← investigate tomorrow

Q-003: Why is totalVested calculated differently in two places?
       Line 234 vs Line 891 — are these supposed to be the same?
       → STATUS: CONFIRMED BUG → see FINDING-003
```

### The Finding Template (Full Version)

Every finding gets written immediately and completely:

```
HIGH-001: Reentrancy in buy() allows draining of entire order book

SEVERITY: High
CONFIDENCE: High (PoC written and tested)
INVARIANT VIOLATED: G-01, E-01

DESCRIPTION:
The buy() function transfers tokens to the buyer before updating
the order state. An attacker using a malicious ERC777 token as
payment can reenter buy() and purchase the same order multiple times,
receiving tokens without paying each time after the first.

ROOT CAUSE:
buy() calls token.transferFrom() on line 341 before setting
order.status = FILLED on line 347. This violates CEI pattern.

PRECONDITIONS:
- Payment token must support ERC777 hooks (tokensToSend callback)
- OR payment token must be a fee-on-transfer token that
  the attacker controls
- OR payment token must be a rebasing token

ATTACK PATH:
1. Attacker creates MaliciousToken implementing IERC777
2. Protocol admin whitelists MaliciousToken as valid payment
   (OR: attacker front-runs token whitelist if admin adds it)
3. Attacker calls buy(orderId, amount) with MaliciousToken
4. buy() calls MaliciousToken.transferFrom()
5. MaliciousToken.tokensToSend() fires, calling buy() again
6. Recursive call succeeds because order.status still == OPEN
7. Attacker receives the vesting tokens twice
8. First call's transferFrom() then completes (only one payment)
9. Net: attacker paid once, received twice

PROOF OF CONCEPT:
[Foundry test — 20 lines — I ran this, it works]

function testReentrancy() public {
    MaliciousToken token = new MaliciousToken();
    uint256 orderId = createOrder(vestingToken, 100e18, token, 50e18);
    
    uint256 vestBefore = vestingToken.balanceOf(address(attacker));
    attacker.attack(orderId);
    uint256 vestAfter = vestingToken.balanceOf(address(attacker));
    
    assertGt(vestAfter - vestBefore, 100e18); // got more than the order
}

IMPACT:
Critical. All vesting tokens in the order book can be drained.
At current TVL of $4.2M, full drain in one transaction.
No recovery possible without emergency pause.

FIX:
Apply CEI pattern: update order.status = FILLED before any external call.

// Before (vulnerable):
token.transferFrom(buyer, seller, amount);  // external call first
orders[orderId].status = FILLED;            // state change after

// After (fixed):
orders[orderId].status = FILLED;            // state change first
token.transferFrom(buyer, seller, amount);  // external call after

ALTERNATIVE FIX:
Add ReentrancyGuard modifier to buy().
Note: CEI is preferred — ReentrancyGuard can fail against cross-function reentrancy.

SIMILAR LOCATIONS TO CHECK:
- sell() function (line 401) — same pattern, likely same bug
- cancel() function (line 512) — check if refund happens before status update
```

---

## Phase 7 — The Attack Simulation Mindset

For every critical function, I run this mental simulation:

**The Five What-Ifs:**

1. **What if the attacker controls the input?**
   - Can they pass address(0)?
   - Can they pass MAX_UINT?
   - Can they pass their own malicious contract?

2. **What if the attacker controls the order of transactions?**
   - Can they frontrun this?
   - Can they sandwich this?
   - Can they grief others by filling the block?

3. **What if the attacker controls time?**
   - Can they manipulate block.timestamp?
   - Can they trigger this at a specific block?
   - What happens if this hasn't been called for 365 days?

4. **What if the attacker controls an external dependency?**
   - If they control the token, what can they do?
   - If they control the oracle, what can they do?
   - If they control an upstream protocol, what can they do?

5. **What if the attacker is the admin?**
   - What is the blast radius of admin key compromise?
   - Can the admin steal user funds in one transaction?
   - Is there a timelock? Is it long enough?

---

## Phase 8 — The Interaction Matrix

For complex protocols, draw which contracts can call which:

```
          Core  Vault  Oracle  Router  Token
Core        ✗     W      R       W       W
Vault       R     ✗      ✗       ✗       W
Oracle      ✗     ✗      ✗       ✗       ✗
Router      W     R      ✗       ✗       W
External    W     ✗      ✗       W       ✗

W = writes state  R = reads state  ✗ = no interaction
```

Then ask: **Is any Write arrow unexpected?** Can a contract write state that it shouldn't be able to?

---

## Phase 9 — Economic Attack Modeling

This is where most auditors stop. The best ones go deeper.

**Flash Loan Attack Template:**

For every protocol, I ask: "What sequence of flash loan operations could be profitable?"

```
FLASH LOAN ANALYSIS — SecondSwap

Setup:
  Flash borrow: 10,000,000 USDC from Aave

Step 1: Use 10M USDC to do [X] to SecondSwap state
Step 2: Use distorted state to [Y]
Step 3: Extract [Z] profit
Step 4: Repay 10M USDC + fee

Is this profitable? Is this possible?

Key question: Can ANY state in this protocol be meaningfully
changed with 10M flash borrowed capital in a way that
benefits an attacker?
```

**Price Manipulation Analysis:**

```
PRICE ORACLE ANALYSIS — SecondSwap

Oracle type: Uniswap V3 TWAP (30 min window)
Spot price: pool.slot0()

Questions:
1. Is spot price ever used directly? (Line 234 — YES ← DANGER)
2. What does 30 min TWAP cost to manipulate? 
   → Rough calc: need to move price X% for Y minutes = $Z cost
3. Is there a deviation threshold? (No → FINDING)
4. What happens at price = 0? (Division by zero? ← CHECK)
5. What happens at price = MAX? (Overflow? ← CHECK)
```

---

## Phase 10 — Cross-Contract Attack Paths

The most dangerous bugs are not in single functions. They are in interactions between functions across the call stack.

**The Cross-Contract Analysis:**

For every function that calls external contracts:

```
CALL CHAIN ANALYSIS: buy() → token.transferFrom()

Who controls token? 
  → If protocol accepts any ERC20: attacker controls it

What callbacks does token trigger?
  → ERC20: none (safe)
  → ERC777: tokensToSend, tokensReceived (DANGER)
  → ERC4626: possible hooks
  → Fee-on-transfer: balance differs from amount (DANGER)
  → Rebasing: balance changes between operations (DANGER)

State of our contracts when callback fires:
  → order.status: still OPEN ← REENTRANCY POSSIBLE

What can attacker do inside callback?
  → Call buy() again with same orderId → gets tokens twice
  → Call cancel() to get refund while also completing buy
  → Call any function that reads order.status == OPEN
```

---

## My Personal Checklists

### The 20 Things I Always Check

```
01. Is initialize() protected? Can it be called again?
02. Are all external calls checked for return values?
03. Does every withdrawal update state BEFORE transferring?
04. Is there rounding that always favors the attacker?
05. Can the first depositor inflate share price?
06. Is totalSupply == 0 handled (division by zero)?
07. Can any privilege function change fee to 100%?
08. Is there a timelock on privilege changes?
09. Does Chainlink oracle check updatedAt for staleness?
10. Can the oracle price be manipulated in one block?
11. Are nonces incremented to prevent signature replay?
12. Does ecrecover check for address(0) return?
13. Can msg.value be reused in a loop?
14. Can block.timestamp be abused for meaningful gain?
15. Are there any selfdestruct calls? Where does ETH go?
16. Can ETH be force-sent to break any balance assumptions?
17. Is there a gas limit attack vector in any loop?
18. Can any approval be stolen by a malicious token?
19. Are proxy storage slots correctly non-overlapping?
20. Does emergencyWithdraw bypass any invariant?
```

### The 10 Questions That Find Critical Bugs

```
01. "What if this is called before any other function?"
02. "What if this is called twice in the same transaction?"
03. "What if this is called with maximum uint256 as input?"
04. "What if the protocol has zero liquidity/supply?"
05. "What if the attacker controls ALL tokens in this pool?"
06. "What if every user withdraws at the same time?"
07. "What if the admin sets every parameter to maximum?"
08. "What if every external call reverts?"
09. "What if time jumps forward by 10 years?"
10. "What sequence of normal operations leaves the protocol insolvent?"
```

---

## The Output

At the end of 7 days, my deliverable is:

**1. The Report** — all findings, each with severity, root cause, PoC, fix
**2. The Architecture Document** — system map, trust boundaries, invariants
**3. The Test Suite** — Foundry tests for every finding
**4. The Recommendations** — architectural improvements, not just bug fixes

**The most important thing I leave with every client:**

*"Here are the 5 invariants you must maintain forever. If you ever add a feature that violates any of these, you will lose user funds."*

---

## The Mindset in One Sentence

**You are not looking for bugs. You are proving that the protocol's guarantees hold under adversarial conditions — and when they don't, you document exactly how and why.**

Everything else is technique in service of that goal.