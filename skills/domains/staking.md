# Staking Protocol Security Skills

## Domain: DeFi Staking / Liquid Staking / Rebase Tokens

This skill pack covers critical invariants for staking protocols (Lido, Rocket Pool, FRAX, vaults).

---

## CRITICAL STAKING INVARIANTS

### INV-S1: Share-Asset Ratio Monotonicity
```
share_price = total_assets / total_shares (normalized)
share_price can ONLY increase (via rewards), never decrease (except slashing)
```
- Check: `convertToAssets(1e18)` does not decrease unexpectedly
- Attack: donation attack inflates share price, first depositor griefing
- Implementation: virtual shares/assets offset, minimum deposit requirement

### INV-S2: Slashing Accounting
```
If slashing occurs: total_assets decreases, shares remain constant or are also reduced.
Share price MUST reflect slashing impact on remaining assets.
```
- Check: slashing propagates fairly to all stakers, no escape hatch for insiders
- Attack: front-run slashing by withdrawing, delayed slashing notification
- Implementation: snapshotted share price at slashing event, pro-rata distribution

### INV-S3: Withdrawal Queue Ordering
```
Withdrawals MUST be processed FIFO (first-in-first-out) OR by epoch.
```
- Check: queue position is preserved, cannot be skipped
- Attack: griefing (spam queue), front-running (reorder within block)
- Implementation: claimable timestamp enforcement, batch processing

### INV-S4: Reward Distribution Fairness
```
Rewards = (user_share / total_shares) * total_rewards
No rounding error favors early/late stakers by > 1 wei.
```
- Check: reward per share calculation uses full precision
- Attack: dust donation to manipulate reward per share
- Implementation: precision scalar (1e27), virtual offset

---

## STAKING-SPECIFIC ATTACK PATTERNS

### Pattern S-ATK-1: First Depositor Griefing
First depositor mints 1 wei share, then donation inflates share price. Subsequent depositors receive 0 shares due to truncation.

**Check:**
- Minimum deposit amount (e.g., 1000 wei)
- Virtual shares offset (OpenZeppelin ERC4626)

### Pattern S-ATK-2: Donation Inflation
Attacker donates assets directly to contract to manipulate share/asset ratio.

**Check:**
- Use internal balance tracking, not ERC20.balanceOf
- Virtual offset in share calculations

### Pattern S-ATK-3: Slashing Front-Running
Attacker sees slash proposal, withdraws before execution.

**Check:**
- Withdrawal delay > governance voting period
- Slashing applies to pending withdrawals

### Pattern S-ATK-4: Epoch Boundary Manipulation
Attacker deposits right before reward distribution, withdraws right after.

**Check:**
- Rewards based on time-weighted balance
- Checkpoint system for balance snapshots

### Pattern S-ATK-5: Reward Rounding Exploit
Attacker spams deposits/withdrawals to collect micro-rewards from rounding errors.

**Check:**
- Minimum stake duration
- Dust threshold (ignore tiny reward discrepancies)

---

## VERIFICATION CHECKLIST

- [ ] ERC4626 implementation uses virtual shares/assets
- [ ] First deposit requires minimum amount (>1000 wei)
- [ ] Share price never decreases except by slashing event
- [ ] Slashing applies to all shares, cannot be front-run
- [ ] Withdrawal queue is FIFO or epoch-based with enforced ordering
- [ ] Reward calculation uses high precision (Ray math)
- [ ] Rewards cannot be stolen by MEV sandwich deposits
- [ ] Deposit/withdraw exchange rates match after rebase
- [ ] Emergency pause cannot freeze user funds indefinitely
- [ ] Upgrade path preserves share balances and reward entitlements
