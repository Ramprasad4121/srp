# AMM Domain Skill — Automated Market Maker Security Patterns

## Overview

Automated Market Makers (AMMs) enable decentralized trading via liquidity pools rather than order books. Security audits must focus on price manipulation, invariant violations, and callback reentrancy.

---

## Key Invariants

| ID | Invariant | Category | Severity if Broken |
|----|-----------|----------|-------------------|
| AMM-INV-001 | `x * y = k` (constant product) must hold after every operation | Economic | High |
| AMM-INV-002 | `reserve0 * reserve1` never decreases on swaps | Economic | High |
| AMM-INV-003 | LP token mint/burn must be proportional to liquidity added/removed | Economic | High |
| AMM-INV-004 | TWAP should not be manipulable in single block | State | High |
| AMM-INV-005 | Fees must be accounted separately from reserves | Economic | Medium |
| AMM-INV-006 | Rounding must always favor the protocol | Economic | Medium |
| AMM-INV-007 | Callback execution must complete before state updates | Ordering | Critical |

---

## Historical Exploits

### 1. Saddle Finance (2022) — $10M
**Root Cause:** Rounding error in `swap()` allowed attacker to drain pool by exploiting rounding direction.
**Fix:** Round always in protocol's favor.

### 2. Cream Finance (2021) — $130M
**Root Cause:** Integration with AMM for price oracle — flash loan manipulation of reserves.
**Fix:** Use TWAP or multiple oracles, not spot price.

### 3. Uranium Finance (2021) — $57M
**Root Cause:** x*y=k logic flaw — modified formula incorrectly.
**Fix:** Strict invariant verification in unit tests.

### 4. Indexed Finance (2021) — $16M
**Root Cause:** Unbounded mint via flash loan manipulation.
**Fix:** Add liquidity checks and flash loan guards.

### 5. Sushiswap/ImBTC (2020) — $300K
**Root Cause:** Callback reentrancy via ERC777 tokens.
**Fix:** Reentrancy guards, CEI pattern.

---

## Must-Check Checklist

### Invariant Verifier
- [ ] `swap()` maintains `x * y >= k`
- [ ] `addLiquidity()` mints correct LP tokens
- [ ] `removeLiquidity()` burns correct LP tokens
- [ ] Token balances match stored reserves
- [ ] Flash loans cannot violate invariants

### Price Manipulation
- [ ] Spot price not used for external decisions
- [ ] TWAP has sufficient granularity (min 1 hour)
- [ ] Single-block price changes cannot manipulate external systems
- [ ] First liquidity provider cannot grief

### Tick Math (Uniswap V3 style)
- [ ] Tick boundary calculations correct
- [ ] `tickCumulative` cannot overflow
- [ ] Out-of-range positions earn no fees
- [ ] Cross-tick accounting correct

### Callback Reentrancy
- [ ] Locks prevent reentrancy
- [ ] CEI pattern enforced (check-effects-interactions)
- [ ] Callback returns expected selector
- [ ] Tokens with hooks handled safely

### Fee Accounting
- [ ] Protocol fees don't break invariant
- [ ] LP fees compound correctly
- [ ] Fee-on-transfer tokens handled
- [ ] Fee withdrawal doesn't affect swap pricing

---

## Common False Positives

1. **Large price movements** — Large swaps naturally move price; this is not a vulnerability.
2. **Sandwich protection** — Slippage parameters are user-side, not AMM-side.
3. **Flash loan usage** — Using flash loans for arbitrage is normal; manipulation is the bug.

---

## Testing Patterns

```solidity
// Invariant fuzz test
def test_invariant_xyk() {
    (x, y) = pool.getReserves();
    k = x * y;

    attacker.swap(amountIn, 0);

    (x2, y2) = pool.getReserves();
    k2 = x2 * y2;

    assert(k2 >= k); // Invariant maintained
}

// Rounding direction test
def test_rounding_favors_protocol() {
    // Small swaps should round in protocol's favor
}
```
