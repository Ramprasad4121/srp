# Governance Protocol Security Skills

## Domain: DAO Governance (Compound, Uniswap, Tally, OpenZeppelin Governor)

This skill covers voting, proposals, timelocks, and execution vulnerabilities.

---

## CRITICAL GOVERNANCE INVARIANTS

### INV-G1: Proposal Threshold
```
Voting power >= proposalThreshold required to submit a proposal.
```
- Check: snapshot used is BEFORE proposal creation block (not current block)
- Attack: flash loan to acquire proposal power temporarily
- Implementation: checkpointed voting power at `block.number - 1`

### INV-G2: Voting Power Snapshots
```
Voting power at proposal start block is immutable for that proposal.
```
- Check: voting power queried at proposal.startBlock, not live balance
- Attack: transfer tokens between accounts mid-vote to double vote
- Implementation: checkpoints, no live balance queries

### INV-G3: Quorum Invariant
```
Proposal succeeds only if FOR votes >= quorum AND FOR > AGAINST.
```
- Check: quorum is fixed at proposal creation (not mid-vote changeable)
- Attack: governance manipulates quorum during active vote
- Implementation: snapshot quorum at proposal creation

### INV-G4: Timelock Delay
```
Successful proposal MUST wait timelock delay before execution.
```
- Check: eta >= current time, queued in timelock
- Attack: immediate execution bypassing review window
- Implementation: TimelockController.executeTransaction requires eta passed

### INV-G5: Execution Atomicity
```
All operations in a proposal execute atomically OR revert together.
```
- Check: governance-bridge uses `timelock.executeBatch` not individual calls
- Attack: partial execution leaving protocol in inconsistent state

---

## GOVERNANCE-SPECIFIC ATTACK PATTERNS

### Pattern G-ATK-1: Flash Loan Governance
Borrow to meet proposal threshold, submit proposal, repay loan in same block.

**Check:**
- Proposal threshold uses checkpointed balance (1 block prior)
- Voting delay > 0 blocks (recommend >= 1)

### Pattern G-ATK-2: Vote Manipulation
Split tokens across accounts, vote FOR and AGAINST, cancel self out but manipulate outcome through delegation.

**Check:**
- Delegation cannot be changed mid-vote
- Voting power snapshot frozen at proposal start

### Pattern G-ATK-3: Timelock Bypass
Governance contract admin is non-timelocked EOA that can upgrade away the timelock.

**Check:**
- Timelock owns the governance contract (not EOA)
- No direct exec function bypassing timelock

### Pattern G-ATK-4: Proposal Sandwich
Attacker sees proposal in mempool, buys votes, submits competing proposal.

**Check:**
- Proposal threshold high enough to prevent rapid response
- Voting delay provides time for review

### Pattern G-ATK-5: Quorum Manipulation
Large token transfer during vote changes total supply, making quorum easier to reach.

**Check:**
- Quorum fixed at proposal creation
- Not using live total supply

---

## VERIFICATION CHECKLIST

- [ ] Proposal threshold uses balance checkpoint (not current balance)
- [ ] Voting delay >= 1 block (flash loan resistance)
- [ ] Voting period sufficient for review (>= 3 days typical)
- [ ] Voting power snapshot at proposal creation, not live
- [ ] Delegation state frozen between snapshot and vote end
- [ ] Quorum fixed at proposal creation
- [ ] Timelock delay enforced on all execution paths
- [ ] Timelock is the owner of target contracts (not governance directly)
- [ ] No immediate execution path (all proposals queued in timelock)
- [ ] Cancel proposal requires significant voting power (cannot be griefed)
- [ ] Guardian cannot instantly veto (has timelock or high threshold)
- [ ] Execution can be batched atomically
