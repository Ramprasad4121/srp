# AMM Domain Skill — Automated Market Maker Security Patterns

## Overview

Automated Market Makers (AMMs) enable decentralized trading via liquidity pools rather than order books. Security audits must focus on price manipulation, invariant violations, and callback reentrancy.

---

## Key Invariants

| ID | Invariant | Category | Severity if Broken |
|----|-----------|----------|-------------------|
| AMM-INV-001 | `x * y = k` (constant product) must hold after every operation | Economic | Critical |
| AMM-INV-002 | `reserve0 * reserve1` never decreases on swaps | Economic | High |
| AMM-INV-003 | LP token mint/burn must be proportional to liquidity added/removed | Economic | High |
| AMM-INV-004 | TWAP should not be manipulable in single block | State | High |
| AMM-INV-005 | Fees must be accounted separately from reserves | Economic | Medium |
| AMM-INV-006 | Rounding must always favor the protocol | Economic | Medium |
| AMM-INV-007 | Callback execution must complete before state updates | Ordering | Critical |
| AMM-INV-008 | First LP cannot grief subsequent LPs through share price manipulation | Economic | High |
| AMM-INV-009 | Slippage bounds must be checked AFTER fee deduction | Ordering | High |

---

## Historical Exploits

### 1. Saddle Finance (Apr 2022) — $10M
**Root Cause:** Rounding error in `swap()` allowed attacker to drain pool by exploiting rounding direction inconsistency between deposit and withdrawal math.
**Fix:** Round always in protocol's favor. Use `mulDivDown` for user, `mulDivUp` for protocol.

### 2. Cream Finance (Oct 2021) — $130M
**Root Cause:** Cream used AMM spot price as oracle for collateral valuation. Flash loan manipulation of reserves inflated collateral value, enabling unbacked borrowing.
**Fix:** Use TWAP or Chainlink, never spot price from same-block AMM reads.

### 3. Uranium Finance (Apr 2021) — $57M
**Root Cause:** Fork of SushiSwap introduced off-by-one error in the k invariant check. The constant product verification compared x*y against k with wrong conditions.
**Fix:** Strict invariant verification in unit + fuzz tests. Never modify the invariant check.

### 4. Indexed Finance (Oct 2021) — $16M
**Root Cause:** Custom AMM with flash loan – allowed unbounded minting via manipulated reserves before finalization.
**Fix:** Check invariant state AFTER all external calls complete.

### 5. SushiSwap/ImBTC (Apr 2020) — $300K
**Root Cause:** ERC-777 token with `tokensToSend` callback enabled reentrancy during swap before reserves were updated.
**Fix:** CEI pattern enforcement. Update reserves before any ERC20 transfer.

### 6. DODO Finance (Mar 2021) — $3.8M
**Root Cause:** Re-initialization of a pool with attacker-controlled parameters. Attacker called `init()` on a flash-loaned clone to drain it.
**Fix:** Proper initialization guards (`initializer` modifier).

### 7. Balancer V1 (Jun 2020) — $500K
**Root Cause:** Fee-on-transfer tokens combined with Balancer's math caused pool accounting to drift from actual balances.
**Fix:** Internal balance tracking; do not use `balanceOf` for accounting.

---

## Must-Check Checklist

### Invariant Verifier
- [ ] `swap()` maintains `x * y >= k`
- [ ] `addLiquidity()` mints correct LP tokens using proportional calculation
- [ ] `removeLiquidity()` burns correct LP tokens, returns proportional assets
- [ ] Token balances match stored reserves after every state transition
- [ ] Flash loans cannot violate invariants (invariant checked after callback)
- [ ] `initialize()` can only be called once and cannot be re-initialized

### Price Manipulation
- [ ] Spot price not used for any external decision (oracle, collateral, etc.)
- [ ] TWAP has sufficient granularity (minimum 30 minutes for price feeds)
- [ ] Single-block price changes cannot affect liquidations, borrowing, or rewards
- [ ] First liquidity provider cannot grief via 1 wei deposit + donation attack
- [ ] Minimum liquidity requirement enforced at pool creation

### Tick Math (Uniswap V3 style)
- [ ] Tick boundary calculations correct with no off-by-one
- [ ] `tickCumulative` cannot overflow within expected time horizon
- [ ] Out-of-range positions earn no fees
- [ ] Cross-tick liquidity accounting correct (liquidity delta signs)

### Callback Reentrancy
- [ ] Reentrance lock set BEFORE any external call
- [ ] CEI pattern enforced (state updates before transfers)
- [ ] Callback returns expected 4-byte selector (unchecked returns = exploit)
- [ ] ERC-777 and hook-enabled tokens cannot reenter during swap

### Fee Accounting
- [ ] Protocol fees deducted from invariant check (not after) OR accounted separately
- [ ] LP fees compound correctly without rounding in user's favor
- [ ] Fee-on-transfer tokens: internal balance vs external balance drift checked
- [ ] Fee withdrawal path cannot drain LP capital

### Access Control
- [ ] Pool parameters (fee, tick spacing) immutable after init OR governance-controlled
- [ ] Emergency pause does not permanently lock LP funds
- [ ] Factory-created pools cannot be re-initialized by attacker

---

## Common False Positives

1. **Large price movements** — Large swaps naturally move price; this is MEV, not a vulnerability.
2. **Sandwich protection** — Slippage parameters are user-side, not AMM-side vulnerability.
3. **Flash loan usage** — Using flash loans for arbitrage is intended behavior; price manipulation for external systems is the bug.
4. **Impermanent loss** — Economic risk for LPs, not a contract vulnerability.

---

## Foundry Testing Patterns

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract AMMInvariantTest is Test {
    IPool pool;
    IERC20 token0;
    IERC20 token1;

    // Invariant: k never decreases after swap
    function invariant_constantProduct() public {
        (uint112 reserve0, uint112 reserve1,) = pool.getReserves();
        uint256 k = uint256(reserve0) * uint256(reserve1);
        assertGe(k, initialK, "Invariant violated: k decreased");
    }

    // Replay Uranium Finance bug
    function test_invariant_exactly_matches_reserves() public {
        uint256 amountIn = 1e18;
        deal(address(token0), address(this), amountIn);
        token0.transfer(address(pool), amountIn);
        pool.swap(0, getAmountOut(amountIn), address(this), "");

        (uint112 r0, uint112 r1,) = pool.getReserves();
        // k MUST not decrease
        assertGe(uint256(r0) * uint256(r1), initialK);
    }

    // First depositor griefing test
    function test_firstDepositor_cannotGrief() public {
        // Setup: first depositor with 1 wei
        deal(address(token0), alice, 1);
        vm.prank(alice);
        pool.addLiquidity(1, 1);

        // Donation attack
        deal(address(token0), alice, 1e24);
        vm.prank(alice);
        token0.transfer(address(pool), 1e24);

        // Second depositor gets >0 shares
        deal(address(token0), bob, 1e18);
        vm.prank(bob);
        uint256 shares = pool.addLiquidity(1e18, 1e18);
        assertGt(shares, 0, "Second depositor got 0 shares: griefing possible");
    }

    // Callback reentrancy test
    function test_noReentrance_onSwap() public {
        ReentrantToken rt = new ReentrantToken(address(pool));
        // Swap with reentrant token should revert or not double-count
        vm.expectRevert();
        pool.swap(rt.balance(), 0, address(this), abi.encode("reenter"));
    }
}
```

---

## Integration-Level Attacks

### AMM + Lending Oracle Manipulation
1. Flash loan large position
2. Swap to move AMM spot price to extremes
3. Exploit lending protocol using AMM spot as oracle
4. Repay flash loan
**Mitigation:** Never use AMM spot price as oracle; require TWAP with minimum window.

### AMM + Governance Token Inflation
1. Acquire large LP position
2. Manipulate pool to claim inflated rewards
3. Use reward tokens in governance vote
**Mitigation:** Reward calculation must use time-weighted LP positions, not instantaneous.
