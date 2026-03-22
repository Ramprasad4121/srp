# Perpetuals / Derivatives Protocol Security Skills

## Domain: Perpetual Futures / Margin Trading (GMX, dYdX, Synthetix, Hyperliquid)

This skill covers funding rates, leverage, margin, liquidation mechanics, and oracle dependencies.

---

## CRITICAL PERPETUALS INVARIANTS

### INV-P1: Collateral Sufficiency
```
margin >= position_size / max_leverage
```
- Check: collateral posted covers position at max allowed leverage
- Attack: bypass leverage limits through multiple positions or accounts
- Implementation: cross-margin accounting, total position limits per account
- ENFORCE: check AFTER all state changes, not partial checks mid-execution

### INV-P2: Liquidation Profitability
```
liquidation_bonus >= gas_cost + economic_risk_premium
```
- Check: liquidators can profitably liquidate any position above minimum size
- Attack: positions too small to liquidate profitably accumulate as bad debt ("dust positions")
- Implementation: minimum position size, accumulated partial liquidations allowed

### INV-P3: Funding Rate Bounds
```
|funding_rate| <= MAX_FUNDING_RATE_PER_DAY
```
- Check: funding cannot exceed protocol-defined cap (typically 0.1% per 8 hours)
- Attack: manipulation to force funding rate to unfair extremes (short squeeze)
- Implementation: cap with dampening function, 8-hourly updates

### INV-P4: Mark Price Integrity
```
mark_price = oracle_price OR TWAP (not manipulable in single block)
```
- Check: price manipulation in single block cannot affect liquidation prices
- Attack: flash loan price manipulation → liquidate others at artificial price
- Implementation: TWAP (not spot) for margin checks, deviation guard between mark and index

### INV-P5: Insurance Fund Solvency
```
insurance_fund >= total_bad_debt_accumulated
```
- Check: socialized losses only use insurance fund, not user deposits
- Attack: drain insurance fund then cause socialized losses to users
- Implementation: separate accounting, ADL (auto-deleveraging) before socialization

### INV-P6: Open Interest Bounds
```
total_open_interest_long <= max_OI
total_open_interest_short <= max_OI
```
- Check: no single asset's OI can exceed risk-adjusted cap
- Attack: concentrate massive OI to force manipulation of mark price vs oracle
- Implementation: per-asset OI caps, dynamic fee schedule for OI concentration

---

## HISTORICAL EXPLOITS

### 1. GMX Price Manipulation (Sep 2022) — $565K
**Root Cause:** GMX used Chainlink oracles for mark price on AVAX. Attacker manipulated Chainlink price briefly by buying large AVAX positions on spot markets, triggering GMX liquidations.
**Fix:** Deviation guard: if mark price deviates > X% from median oracle price, halt liquidations.

### 2. Kwenta (Multiple 2023)
**Root Cause:** Funding rate not properly capped. Attacker opened massive positions on one side of the market, pushing funding rate to maximum. Forced counterparty positions into losses beyond their understanding.
**Fix:** Funding rate cap with clear protocol documentation; maximum position size per account.

### 3. Perpetual Protocol v2 (2022) — ~$500K
**Root Cause:** vAMM (virtual AMM) mark price could be manipulated by large opening positions. The spread between virtual AMM and index price was exploitable.
**Fix:** Deviation limit between vAMM price and Chainlink index price; pauses automatic trading if deviation exceeds 10%.

### 4. MANGO MARKETS (Oct 2022) — $116M
**Root Cause:** Not a perpetuals protocol, but a manipulation pattern directly applicable.
Attacker opened large MANGO futures position, then pumped MANGO spot price on thin liquidity.
The inflated "collateral value" was borrowed against. Oracle used (spot * volume).
**Fix:** Volume-weighted TWAP with minimum lookback; OI limits relative to total market cap.

---

## PERPETUALS-SPECIFIC ATTACK PATTERNS

### Pattern P-ATK-1: Oracle Manipulation Liquidation
Flashloan → price manipulation → liquidate underwater positions → price recovery.

**Check:**
- TWAP used for liquidation checks, not spot
- Maximum price deviation allowed per block (circuit breaker)
- Mark price settled with minimum oracle sources (3-of-5)

### Pattern P-ATK-2: Funding Rate Arbitrage
Open large position right before funding rate snapshot, close right after.

**Check:**
- Funding based on time-weighted average open interest
- Position open/close affects pro-rata over sampling period
- Minimum position holding time before funding accrues

### Pattern P-ATK-3: Cross-Account Leverage Bypass
Max leverage is per-account, attacker uses multiple accounts to exceed effective leverage.

**Check:**
- Account linking via collateral source (same wallet = same account risk)
- Rate limiting new accounts from same deployer
- Permissioned account creation for high-leverage pools

### Pattern P-ATK-4: Insurance Fund Drain
Accumulate bad debt, force ADL, insurance fund covers, then attacker drains insurance reserve.

**Check:**
- Insurance fund capped by trading fees automatically (balanced accrual)
- ADL triggers before insurance fund hits minimum threshold
- Maximum payout per liquidation event bounded

### Pattern P-ATK-5: Stale Oracle Exploit
Position accumulates losses while oracle is stale, appears healthy. Attacker closes before oracle updates.

**Check:**
- Maximum staleness enforced across ALL oracle types (Chainlink + on-chain)
- Circuit breaker if oracle stale for > 1 heartbeat period
- Position health recalculated fresh at close time (no cached price)

### Pattern P-ATK-6: Short Squeeze via OI Imbalance
Attacker accumulates massive long OI, drives funding rate negative for shorts.
Forces short-sellers to close, which pushes mark price higher (reflexive loop).

**Check:**
- Open interest concentration limits per account
- Funding rate dampening at extreme imbalances (non-linear rate)
- ADL of largest long positions if OI imbalance exceeds threshold

---

## VERIFICATION CHECKLIST

- [ ] Margin checks use TWAP not spot price (minimum 30-minute window)
- [ ] Mark price sourced from minimum 3 independent oracles
- [ ] Deviation circuit breaker: halt if mark vs index > 10%
- [ ] Leverage limits enforced per account across ALL positions (cross-margin)
- [ ] Liquidation bonus sufficient to cover gas + 20% buffer at all gas prices
- [ ] Minimum position size prevents unprofitable dust accumulation
- [ ] Funding rate capped (maximum 0.1% / 8 hours typical)
- [ ] Funding payments proportional to time held (not snapshot)
- [ ] Insurance fund tracked separately from user deposits
- [ ] Oracle staleness checked at every margin calculation
- [ ] Circuit breaker if oracle fails (pause liquidations, allow only position closure)
- [ ] ADL triggers before insurance fund hits zero
- [ ] No instant close-and-reopen to reset funding accrual
- [ ] OI limits per asset (relative to 30-day volume or total market cap)
- [ ] Bad debt socialization clearly documented with user-facing disclosure

---

## Foundry Testing Patterns

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract PerpetualInvariantTest is Test {
    IPerp perp;
    MockOracle oracle;

    // Invariant: insurance fund never goes negative
    function invariant_insuranceFundSolvent() public {
        assertGe(
            int256(perp.insuranceFundBalance()),
            int256(perp.totalBadDebt()),
            "Insurance fund insolvent"
        );
    }

    // Oracle manipulation test (GMX-style)
    function test_twapResistsFlashManipulation() public {
        uint256 normalPrice = perp.getMarkPrice();

        // Manipulate oracle in same block
        oracle.setPrice(normalPrice * 2);

        // Mark price should not instantly change 2x
        uint256 markAfter = perp.getMarkPrice();
        assertLe(markAfter, normalPrice * 110 / 100, "Mark price too sensitive to spot manipulation");
    }

    // Stale oracle circuit breaker
    function test_staleOracleHaltsLiquidations() public {
        // Advance time past oracle heartbeat
        vm.warp(block.timestamp + 2 hours);

        // Liquidation should revert due to stale oracle
        vm.expectRevert("OracleStale");
        perp.liquidate(victimAccount);
    }

    // Dust position test
    function test_dustPositionCanBeLiquidated() public {
        // Open minimum position
        perp.openPosition(minPositionSize, 10e18); // 10x leverage

        // Price drops slightly, position underwater
        oracle.setPrice(currentPrice * 95 / 100);

        // Liquidator can profitably liquidate
        uint256 balanceBefore = liquidator.balance;
        perp.liquidate(dustAccount);
        assertGt(liquidator.balance, balanceBefore, "Dust liquidation unprofitable");
    }
}
```

---

## Integration-Level Attacks

### Perpetuals + Spot AMM: Reflexive Price Manipulation
1. Open large long on perpetuals protocol
2. Buy large amount on spot AMM (moves oracle price up)
3. Perp mark price increases → unwind long at profit
4. Sell spot → price returns to normal
**Mitigation:** TWAP oracle decoupled from spot — spot buys cannot instantly move perp mark price. OI limits prevent position large enough to profitably manipulate.

### Perpetuals + Options: Delta-Neutral Vault Drain
1. Protocol offers delta-neutral vault backed by perp + options
2. Attacker uses extreme funding rate to drain vault yield
3. Vault becomes undercollateralized
**Mitigation:** Funding rate caps must account for vault exposure; hedged position must be stress-tested against extreme funding scenarios.
