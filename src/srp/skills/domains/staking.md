# Staking Protocol Security Skills

## Domain: DeFi Staking / Liquid Staking / Rebase Tokens

This skill pack covers critical invariants for staking protocols (Lido, Rocket Pool, FRAX, EigenLayer, vaults).

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
- ENFORCE: internal balance tracking (`storedBalance` not `balanceOf`)

### INV-S2: Slashing Accounting
```
If slashing occurs: total_assets decreases, shares remain constant or are also reduced.
Share price MUST reflect slashing impact on remaining assets.
```
- Check: slashing propagates fairly to all stakers, no escape hatch for insiders
- Attack: front-run slashing by withdrawing before slash is applied
- Implementation: snapshotted share price at slashing event, pro-rata distribution
- ENFORCE: withdrawal delay >= slashing reporting delay

### INV-S3: Withdrawal Queue Ordering
```
Withdrawals MUST be processed FIFO (first-in-first-out) OR by epoch.
```
- Check: queue position is preserved, cannot be skipped
- Attack: griefing (spam queue with tiny withdrawals), front-running within block
- Implementation: claimable timestamp enforcement, minimum withdrawal amount

### INV-S4: Reward Distribution Fairness
```
Rewards = (user_share / total_shares) * total_rewards
No rounding error favors early/late stakers by > 1 wei per epoch.
```
- Check: reward per share calculation uses full precision (Ray math: 1e27)
- Attack: dust donation to manipulate reward per share, MEV sandwich deposit
- Implementation: precision scalar (1e27), virtual offset

### INV-S5: Restaking Leverage Bounds
```
Operator slash coverage MUST cover all restaked positions.
```
- Relevant for EigenLayer-style restaking: operator can be slashed by multiple AVS
- If operator is slashed simultaneously by N AVS: total slash <= operator stake
- Check: max restaking leverage per operator bounded by protocol

### INV-S6: Exchange Rate Manipulation Under Rebase
```
Rebase events must not allow instant arbitrage of staked positions.
```
- Check: rebase and exchange rate update are atomic (same tx)
- Attack: front-run rebase to deposit, back-run to withdraw with inflated shares
- Implementation: rebase happens in same block as reward distribution, no MEV window

---

## HISTORICAL EXPLOITS

### 1. Ankr (Dec 2022) — $5M
**Root Cause:** Compromised deployer key minted unlimited aBNBc tokens (unbacked staking tokens).
**Fix:** Remove single-key minting. Require governance + time-lock for any mint operation.

### 2. Lido Slashing Risk (Ongoing)
**Root Cause:** Not an exploit, but a systemic risk: if a major Lido node operator is slashed,
all stETH holders suffer proportional loss. The protocol socializes slashing.
**Lesson:** Staking protocols MUST document slashing socialization behavior. "Principal is safe" is false.

### 3. StakeDAO vs Convex (Ongoing)
**Root Cause:** Boost competition: two protocols fighting over the same Curve gauge boost.
Whichever protocol has more veCRV gets more rewards. Protocol without boost loses yield.
**Lesson:** External dependency on gauge boost is a structural yield risk, not a bug.

### 4. Yearn Strategies Reentrancy (Multiple 2021)
**Root Cause:** ERC-4626 predecessor vaults with callbacks allowed reentrancy during harvest.
**Fix:** Reentrancy guard on all strategy calls, CEI pattern in vault `deposit`/`withdraw`.

---

## STAKING-SPECIFIC ATTACK PATTERNS

### Pattern S-ATK-1: First Depositor Griefing
First depositor mints 1 wei share, then donation inflates share price. Subsequent depositors receive 0 shares due to truncation.

**Check:**
- Minimum deposit amount (e.g., 1000 wei)
- Virtual shares offset (OpenZeppelin ERC4626 `_decimalsOffset`)

### Pattern S-ATK-2: Donation Inflation
Attacker donates assets directly to contract to manipulate share/asset ratio.

**Check:**
- Use internal balance tracking (`storedBalance`), not `ERC20.balanceOf`
- Virtual offset in share calculations

### Pattern S-ATK-3: Slashing Front-Running
Attacker sees slash proposal on-chain, withdraws before execution.

**Check:**
- Withdrawal delay > governance voting + execution delay
- Slashing applies to positions in withdrawal queue (not just active stake)

### Pattern S-ATK-4: Epoch Boundary Manipulation
Attacker deposits right before reward distribution, withdraws right after.

**Check:**
- Rewards based on time-weighted balance (snapshots before deposit)
- Checkpoint system prevents same-block deposit+claim

### Pattern S-ATK-5: Reward Rounding Exploit
Attacker spams deposits/withdrawals to collect micro-rewards from rounding errors.

**Check:**
- Minimum stake duration (no same-block deposit+withdraw)
- Dust threshold for reward claims
- Per-block rate limiting on deposit/withdraw

### Pattern S-ATK-6: MEV Rebase Sandwich
Attacker watches beacon chain for upcoming ETH rewards.
Front-runs the `submitReport()` call to deposit right before rebase.
Back-runs to withdraw right after rebase with inflated share value.

**Check:**
- Rebase and reward distribution atomic
- Deposit cooldown period post-rebase
- Large deposit triggers time-weighted averaging for new shares

---

## VERIFICATION CHECKLIST

- [ ] ERC4626 implementation uses virtual shares/assets (`_decimalsOffset`)
- [ ] First deposit requires minimum amount (> 1000 wei minimum)
- [ ] Share price never decreases except by documented slashing event
- [ ] Slashing applies to positions in withdrawal queue, not just active stake
- [ ] Withdrawal queue is FIFO or epoch-based with enforced ordering
- [ ] Reward calculation uses high precision (Ray math, 1e27 scalar)
- [ ] Rewards cannot be stolen by MEV sandwich around rebase
- [ ] Deposit/withdraw exchange rates match after rebase (atomic update)
- [ ] Emergency pause cannot freeze user funds indefinitely (escape hatch exists)
- [ ] Upgrade path preserves share balances and reward entitlements
- [ ] Operator slashing does not brick the entire protocol
- [ ] Internal balance tracking used (not ERC20.balanceOf) to prevent donation attack
- [ ] Reentrancy guard on `deposit`, `withdraw`, `harvest`, `claim`
- [ ] No single-key minting authority (requires multisig + timelock)
- [ ] Maximum withdrawal per epoch bounded (prevents bank run in one block)

---

## Foundry Testing Patterns

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "openzeppelin/token/ERC20/extensions/ERC4626.sol";

contract StakingInvariantTest is Test {
    IVault vault;
    IERC20 asset;

    // Invariant: share price never decreases (without slashing)
    uint256 lastSharePrice;
    function invariant_SharePriceMonotonic() public {
        uint256 currentPrice = vault.convertToAssets(1e18);
        assertGe(currentPrice, lastSharePrice, "Share price decreased without slashing");
        lastSharePrice = currentPrice;
    }

    // First depositor griefing test
    function test_firstDepositor_cannotGrief() public {
        // Attacker deposits 1 wei
        deal(address(asset), attacker, 1);
        vm.prank(attacker);
        vault.deposit(1, attacker);

        // Donation attack
        deal(address(asset), attacker, 1e24);
        vm.prank(attacker);
        asset.transfer(address(vault), 1e24);

        // Victim gets > 0 shares
        deal(address(asset), victim, 1e18);
        vm.prank(victim);
        uint256 shares = vault.deposit(1e18, victim);
        assertGt(shares, 0, "First depositor griefing: victim gets 0 shares");
    }

    // Slashing test: all stakers take proportional hit
    function test_slashingProRata() public {
        uint256 totalBefore = vault.totalAssets();
        uint256 aliceSharesBefore = vault.balanceOf(alice);
        uint256 bobSharesBefore = vault.balanceOf(bob);

        // Trigger 10% slash
        vm.prank(slashingAuthority);
        vault.slash(totalBefore / 10);

        // Both alice and bob lost 10% of value
        assertApproxEqRel(
            vault.convertToAssets(aliceSharesBefore),
            vault.convertToAssets(aliceSharesBefore) * 90 / 100,
            1e15 // 0.1% tolerance
        );
    }

    // MEV rebase sandwich test
    function test_rebaseSandwich_bounded() public {
        uint256 valueBeforeDeposit = vault.convertToAssets(1e18);

        // Deposit right before rebase
        deal(address(asset), attacker, 1e24);
        vm.prank(attacker);
        vault.deposit(1e24, attacker);

        // Trigger rebase
        vm.prank(oracle);
        vault.submitReport(rewards);

        uint256 valueAfterRebase = vault.convertToAssets(1e18);

        // Withdraw immediately after
        vm.prank(attacker);
        uint256 withdrawn = vault.redeem(vault.balanceOf(attacker), attacker, attacker);

        // Attacker profit should be bounded by actual reward earned proportionally
        assertLe(withdrawn - 1e24, proportionalReward);
    }
}
```

---

## Integration-Level Attacks

### Staking + Lending Circular Leverage
1. Deposit ETH → receive stETH
2. Deposit stETH as collateral in lending → borrow ETH
3. Repeat N times until at liquidation threshold
4. ETH price drops slightly → entire loop liquidates at once
**Mitigation:** Correlated asset discount, aggregate leverage caps, loop detection.

### Liquid Staking + DEX Peg Attacks
1. Large stETH/ETH pool exists on Curve
2. Attacker swaps large ETH to stETH, depeg occurs
3. Lending protocols using Curve price as oracle reduce stETH collateral value
4. Mass liquidations of stETH-collateralized positions
**Mitigation:** Depeg circuit breaker, liquidation rate limits per block.
