# Perpetuals / Derivatives Protocol Security Skills

## Domain: Perpetual Futures / Margin Trading (GMX, dYdX, Synthetix)

This skill covers funding rates, leverage, margin, and liquidation mechanics.

---

## CRITICAL PERPETUALS INVARIANTS

### INV-P1: Collateral Sufficiency
```
margin >= position_size / max_leverage
```
- Check: collateral posted covers position at max allowed leverage
- Attack: bypass leverage limits through multiple positions or accounts
- Implementation: cross-margin accounting, total position limits per account

### INV-P2: Liquidation Profitability
```
liquidation_bonus >= gas_cost + economic_risk_premium
```
- Check: liquidators can profitably keepers running
- Attack: positions too small to liquidate profitably (dust → bad debt)
- Implementation: minimum position size, accumulated liquidations allowed

### INV-P3: Funding Rate Bounds
```
funding_rate capped to prevent extreme payments
```
- Check: funding cannot exceed 100% per day (or protocol-defined cap)
- Attack: manipulation to force funding rate to unfair extremes
- Implementation: hourly/8-hourly updates with caps

### INV-P4: Mark Price Integrity
```
mark_price = oracle_price OR TWAP (not manipulable single-block)
```
- Check: price manipulation in single block cannot affect liquidation prices
- Attack: flash loan price manipulation → liquidate others
- Implementation: TWAP (not spot) for margin checks, update frequency limits

### INV-P5: Insurance Fund Solvency
```
insurance_fund >= total_bad_debt_accumulated
```
- Check: socialized losses only use insurance, not user deposits
- Attack: drain insurance then social losses to users
- Implementation: separate accounting, ADL (auto-deleveraging) before socialization

---

## PERPETUALS-SPECIFIC ATTACK PATTERNS

### Pattern P-ATK-1: Oracle Manipulation Liquidation
Flashloan → price manipulation → liquidate underwater positions → price recovery.

**Check:**
- TWAP used for liquidation checks, not spot
- Liquidation grace period (cannot immediately re-enter)

### Pattern P-ATK-2: Funding Rate Arbitrage
Open large position right before funding rate snapshot, close right after.

**Check:**
- Funding based on time-weighted average
- Position open/close affects pro-rata over period

### Pattern P-ATK-3: Cross-Account Leverage Bypass
Max leverage is per-account, attacker uses multiple accounts to exceed effective leverage.

**Check:**
- Account linking via collateral source
- Rate limiting new accounts

### Pattern P-ATK-4: Insurance Fund Drain
Accumulate bad debt, force ADL, insurance fund covers, then attacker drains insurance.

**Check:**
- Insurance fund topped by trading fees automatically
- ADL triggers before insurance fund depleted
- Maximum payout per liquidation event

### Pattern P-ATK-5: Stale Oracle Exploit
Position accumulates losses, oracle stale → position appears healthy → attacker closes before oracle updates.

**Check:**
- Maximum staleness threshold enforced
- Circuit breaker if oracle stale

---

## VERIFICATION CHECKLIST

- [ ] Margin checks use TWAP not spot price
- [ ] TWAP window long enough to resist manipulation (>= 1 hour)
- [ ] Leverage limits enforced across positions (not per-position)
- [ ] Liquidation bonus sufficient for gas costs
- [ ] Minimum position size to prevent unprofitable dust positions
- [ ] Funding rate capped and updated on fixed schedule
- [ ] Funding payments proportional to time held
- [ ] Insurance fund tracked separately from user deposits
- [ ] Oracle staleness checked before margin calculations
- [ ] Circuit breaker if oracle fails
- [ ] ADL triggers before insurance fund exhausted
- [ ] No instant close-and-reopen to game funding
