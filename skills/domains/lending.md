# Lending Protocol Security Skills

## Domain: DeFi Lending Protocols

This skill pack covers the critical invariants, attack vectors, and verification patterns
specific to lending protocols (Aave, Compound, MakerDAO, Euler, Silo, Morpho, etc.).

---

## CRITICAL LENDING INVARIANTS

### INV-L1: Collateral Ratio Invariant
```
collateral_value >= borrowed_value * liquidation_threshold
```
This MUST hold at ALL times for every position. If violated, the protocol accrues bad debt.
Check: after every borrow, withdraw, repay, liquidate, and oracle price update.
Attack surface: Oracle manipulation, flash loan price distortion, rounding errors in
collateral factor calculations.

### INV-L2: Interest Accrual Ordering
```
accrueInterest() MUST be called BEFORE any state change involving balances.
```
Interest indexes must be updated before: borrow, repay, deposit, withdraw, liquidate, transfer.
If accrual happens AFTER a state change, stale indexes allow borrowers to extract value.
Attack surface: Functions that modify balanceOf or totalSupply without calling accrueInterest first.
Look for: missing accrueInterest() at the top of external functions, or functions that read
cached indexes without refreshing them.

### INV-L3: Oracle Safety
```
Oracle MUST have: staleness check, price > 0 check, and fallback mechanism.
```
Every price feed must verify:
- `updatedAt + maxStaleness >= block.timestamp` (staleness)
- `answer > 0` (zero/negative price)
- Fallback oracle exists and activates on primary failure
- Decimals are correctly normalized between feeds
- TWAP/spot price cannot be manipulated in a single block
Attack surface: Chainlink heartbeat gaps, L2 sequencer downtime, TWAP manipulation via
large swaps, oracle front-running.

### INV-L4: Liquidation Bonus Bound
```
liquidation_bonus MUST NOT exceed the collateral value of the position.
```
If `bonus > collateral_available`, the liquidator extracts more than exists, creating bad debt.
Check: liquidation math handles partial liquidations correctly, bonus percentage is capped,
edge case where position has exactly enough collateral for the loan but not for bonus.

### INV-L5: Index Manipulation Protection
```
No single-block manipulation of supply or borrow indexes.
```
Supply and borrow indexes determine interest distribution. If manipulable within one block:
- Attacker can inflate index, withdraw excess interest
- Attacker can deflate index, reduce others' balances
Check: index updates are time-weighted, minimum time between updates is enforced (or
at minimum, the same block update doesn't allow outsized changes).

### INV-L6: Flash Loan Health Factor Integrity
```
Flash loan MUST NOT be able to manipulate health factor within one transaction.
```
Attack pattern:
1. Flash loan large amount
2. Deposit as collateral (inflates collateral)
3. Borrow against inflated position
4. Withdraw collateral (or manipulate oracle)
5. Repay flash loan
6. Position is now underwater but passed health check during the tx
Check: health factor checked at END of transaction, not just during individual operations.
Reentrancy guards on all state-changing functions. No callback exploitation.

---

## LENDING-SPECIFIC ATTACK PATTERNS

### Pattern L-ATK-1: Donation Attack
Attacker donates tokens directly to the pool contract (via transfer, not deposit) to
manipulate exchange rates. First depositor gets inflated shares. Check: minimum deposit
requirements, virtual shares/assets offset.

### Pattern L-ATK-2: Interest Rate Manipulation
Attacker borrows/repays rapidly to manipulate utilization rate and thus interest rates.
Can force rate spikes to liquidate other borrowers. Check: rate change dampening, per-block
borrow limits.

### Pattern L-ATK-3: Liquidation Front-Running
Attacker monitors mempool for liquidation transactions. Sandwiches them to:
- Manipulate oracle price right before liquidation
- Self-liquidate using a second account for the bonus
- Grief legitimate liquidators via gas wars or dust amounts
Check: liquidation delay mechanisms, partial liquidation support, MEV protection.

### Pattern L-ATK-4: Reserve Factor Theft
If reserve factor accounting is wrong, protocol reserves can be drained.
Check: reserve accumulation matches interest spread, reserves cannot be withdrawn
by non-governance addresses.

### Pattern L-ATK-5: Reentrancy via Token Callbacks
ERC-777 tokens, tokens with transfer hooks, or native ETH via receive() can cause
reentrancy during borrow/repay/liquidate flows. Check: CEI pattern enforcement,
reentrancy guards on all external-facing functions.

---

## VERIFICATION CHECKLIST

For each lending protocol audit, verify:

- [ ] `accrueInterest()` is called at the top of EVERY state-changing function
- [ ] Health factor is checked AFTER all state changes, not before
- [ ] Oracle prices have staleness check with reasonable threshold (< 1 hour for volatile assets)
- [ ] Oracle returns `(price, updatedAt)` and both are validated
- [ ] Liquidation bonus + close factor cannot exceed position collateral
- [ ] Flash loan callback cannot re-enter lending functions
- [ ] Exchange rate calculation handles zero totalSupply / zero totalBorrows
- [ ] First depositor cannot manipulate exchange rate (virtual offset or minimum deposit)
- [ ] Interest rate model cannot be gamed via rapid borrow/repay cycles
- [ ] Reserve factor accumulation is correct and reserves are access-controlled
- [ ] Decimal normalization between different token decimals is correct
- [ ] Transfer/transferFrom of cTokens/aTokens calls accrueInterest
- [ ] Governance timelock on critical parameter changes (collateral factor, close factor, etc.)
