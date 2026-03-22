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
Check: index updates are time-weighted, minimum time between updates is enforced.

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

### INV-L7: Liquidation Atomicity
```
Liquidation MUST reduce bad debt, not increase it.
```
If liquidation of position P creates bad debt in another position (cascading liquidation),
the protocol accumulates uncollectable debt. Check: liquidation cannot trigger oracle update
that immediately makes another position liquidatable in the same block.

---

## LENDING-SPECIFIC ATTACK PATTERNS

### Pattern L-ATK-1: Donation Attack
Attacker donates tokens directly to the pool contract (via transfer, not deposit) to
manipulate exchange rates. First depositor gets inflated shares. Check: minimum deposit
requirements, virtual shares/assets offset (OpenZeppelin ERC4626 standard).

### Pattern L-ATK-2: Interest Rate Manipulation
Attacker borrows/repays rapidly to manipulate utilization rate and thus interest rates.
Can force rate spikes to liquidate other borrowers. Check: rate change dampening, per-block
borrow limits, minimum time between rate updates.

### Pattern L-ATK-3: Liquidation Front-Running
Attacker monitors mempool for liquidation transactions. Sandwiches them to:
- Manipulate oracle price right before liquidation
- Self-liquidate using a second account for the bonus
- Grief legitimate liquidators via gas wars or dust amounts
Check: liquidation delay mechanisms, partial liquidation support, MEV protection.

### Pattern L-ATK-4: Reserve Factor Theft
If reserve factor accounting is wrong, protocol reserves can be drained.
Check: reserve accumulation matches interest spread, reserves cannot be withdrawn
by non-governance addresses, accrueInterest updates reserves correctly.

### Pattern L-ATK-5: Reentrancy via Token Callbacks
ERC-777 tokens, tokens with transfer hooks, or native ETH via receive() can cause
reentrancy during borrow/repay/liquidate flows. Check: CEI pattern enforcement,
reentrancy guards on all external-facing functions.

### Pattern L-ATK-6: Price Staleness Exploit (Euler Finance, Mar 2023 — $197M)
Oracle price goes stale. Protocol continues accepting stale price as valid.
Attacker borrows massive amount against inflated stale collateral before oracle updates.
Check: `block.timestamp - updatedAt < maxStaleness` enforced everywhere oracle is read.

### Pattern L-ATK-7: Cross-Asset Flash Loan Attack (Cream Finance, Oct 2021 — $130M)
1. Flash loan CREAM
2. Deposit CREAM as collateral
3. Borrow yUSD (Yearn vault token)
4. Use yUSD to manipulate price of ETH in Oracle
5. Borrow against inflated ETH collateral
6. Drain protocol
Check: AMM spot price NEVER used as lending oracle; multi-source TWAP required.

---

## VERIFICATION CHECKLIST

For each lending protocol audit, verify:

- [ ] `accrueInterest()` is called at the top of EVERY state-changing function
- [ ] Health factor is checked AFTER all state changes, not before
- [ ] Oracle prices have staleness check with reasonable threshold (< 1 hour for volatile assets)
- [ ] Oracle returns `(price, updatedAt)` and BOTH are validated against minimum thresholds
- [ ] Oracle answer > 0 check (negative prices from Chainlink can happen)
- [ ] Oracle decimal normalization correct across all supported assets
- [ ] Chainlink L2 sequencer uptime feed checked (Arbitrum, Optimism, Base)
- [ ] Liquidation bonus + close factor cannot exceed position collateral
- [ ] Liquidation cannot create bad debt in other positions
- [ ] Flash loan callback cannot re-enter lending functions
- [ ] Exchange rate calculation handles zero totalSupply / zero totalBorrows
- [ ] First depositor cannot manipulate exchange rate (virtual offset or minimum deposit)
- [ ] Interest rate model cannot be gamed via rapid borrow/repay cycles
- [ ] Reserve factor accumulation is correct and reserves are access-controlled
- [ ] Decimal normalization between different token decimals is correct
- [ ] Transfer/transferFrom of cTokens/aTokens calls accrueInterest
- [ ] Governance timelock on critical parameter changes (collateral factor, close factor, etc.)
- [ ] Borrow caps enforced per asset
- [ ] Supply caps enforced per asset
- [ ] Liquidation threshold < collateral factor (liquidation incentive gap)
- [ ] Bad debt socialization mechanism exists and is bounded

---

## Foundry Testing Patterns

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract LendingInvariantTest is Test {
    ILendingPool pool;
    MockPriceOracle oracle;

    // Invariant: no position can have health factor < 1 unless being liquidated
    function invariant_noUndercollateralizedPositions() public {
        for (uint i = 0; i < users.length; i++) {
            uint256 hf = pool.healthFactor(users[i]);
            assertGe(hf, 1e18, "Undercollateralized position exists");
        }
    }

    // Euler-style: test oracle staleness guard
    function test_revertOnStaleOracle() public {
        vm.warp(block.timestamp + 2 hours);
        oracle.freeze(); // stop price updates

        vm.expectRevert("StalePrice");
        pool.borrow(usdc, 1000e6);
    }

    // Cream-style: AMM spot price manipulation
    function test_noAMMSpotPriceManipulation() public {
        // Record borrow limit at current state
        uint256 limitBefore = pool.maxBorrowable(address(this), eth);

        // Manipulate AMM pool (if oracle uses spot price, this increases borrow limit)
        amm.swapLargeAmount(eth, usdc);

        uint256 limitAfter = pool.maxBorrowable(address(this), eth);
        // If oracle is TWAP, limit should not change
        assertEq(limitBefore, limitAfter, "Oracle uses manipulable spot price");
    }

    // Donation attack test
    function test_firstDepositorCannotGrief() public {
        // Attacker deposits tiny amount
        deal(usdc, attacker, 1);
        vm.prank(attacker);
        pool.deposit(usdc, 1);

        // Attacker donates directly to inflate exchange rate
        deal(usdc, attacker, 1e24);
        vm.prank(attacker);
        IERC20(usdc).transfer(address(pool), 1e24);

        // Victim deposits normal amount - must get > 0 tokens
        deal(usdc, victim, 1e18);
        vm.prank(victim);
        uint256 shares = pool.deposit(usdc, 1e18);
        assertGt(shares, 0, "Donation attack: victim gets 0 shares");
    }
}
```

---

## Integration-Level Attacks

### Lending + AMM + Flash Loan Triangle
Standard three-step attack:
1. Flash loan large collateral asset
2. Deposit → borrow → manipulate price → borrow more
3. Drain, repay flash loan
**Mitigation:** TWAP oracle, borrow caps, utilization-based speed limits.

### Lending + Staking Circular Collateral
1. Deposit ETH in staking protocol → receive stETH
2. Deposit stETH in lending as collateral → borrow ETH
3. Repeat: circular leverage builds until liquidation threshold crossed
**Mitigation:** Correlated asset liquidation discount, aggregate leverage limits.
