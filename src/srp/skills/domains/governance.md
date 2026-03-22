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
- ENFORCE: `getVotes(proposer, block.number - 1) >= proposalThreshold`

### INV-G2: Voting Power Snapshots
```
Voting power at proposal start block is immutable for that proposal.
```
- Check: voting power queried at proposal.startBlock, not live balance
- Attack: transfer tokens between accounts mid-vote to double vote
- Implementation: ERC20Votes checkpoints, no live balance queries
- ENFORCE: `getPastVotes(voter, proposal.startBlock)` not `getVotes(voter)`

### INV-G3: Quorum Invariant
```
Proposal succeeds only if FOR votes >= quorum AND FOR > AGAINST.
```
- Check: quorum is fixed at proposal creation (not mid-vote changeable)
- Attack: governance manipulates quorum during active vote
- Implementation: snapshot quorum at proposal creation block

### INV-G4: Timelock Delay
```
Successful proposal MUST wait timelock delay before execution.
```
- Check: eta >= current time, queued in timelock before execution
- Attack: immediate execution bypassing review window
- Implementation: TimelockController.executeTransaction requires eta passed

### INV-G5: Execution Atomicity
```
All operations in a proposal execute atomically OR revert together.
```
- Check: governance uses `timelock.executeBatch` not individual calls
- Attack: partial execution leaving protocol in inconsistent state
- ENFORCE: batch all operations in single `executeBatch` call

### INV-G6: Governor Ownership Chain
```
Timelock owns governed contracts. Governor controls timelock.
No EOA can bypass this chain.
```
- Check: `contract.owner() == timelock.address`
- Attack: Timelock admin is EOA that can upgrade governance away
- ENFORCE: admin of timelock is governor contract (not multisig)

---

## HISTORICAL EXPLOITS

### 1. Beanstalk Farm (Apr 2022) — $182M
**Root Cause:** Flash loan governance attack. Protocol's governance had no voting delay.
Attacker: flash borrowed enough BEAN to hit quorum → voted on malicious proposal → executed in same tx.
**Fix:** Minimum 1-block voting delay (flash loans cannot hold tokens across blocks).

### 2. Compound Governor Bravo (Oct 2023) — $150K
**Root Cause:** Proposal to transfer tokens passed with low quorum. Legitimate governance captured by large token holder.
**Lesson:** Quorum thresholds matter. If quorum is 4% and whales own 6%, single actor can pass anything.

### 3. Tornado Cash Governance (May 2023) — $1M
**Root Cause:** Attacker created malicious proposal with extra payload hidden in bytecode.
Proposal looked benign. Executed malicious self-destruct of Governor, gave attacker all votes.
**Fix:** Timelock preview of ALL calldatas before execution. No bytecode surprises.

### 4. Fei Protocol (2021)
**Root Cause:** Emergency admin (Guardian) could immediately veto any proposal.
Guardian was a single EOA. Guardian key compromise = governance capture.
**Fix:** Guardian role requires multisig. Admin veto requires at minimum 24h timelock.

---

## GOVERNANCE-SPECIFIC ATTACK PATTERNS

### Pattern G-ATK-1: Flash Loan Governance
Borrow to meet proposal threshold, submit proposal, repay loan in same block.

**Historical:** Beanstalk — $182M
**Check:**
- Proposal threshold uses checkpointed balance (minimum 1 block prior)
- Voting delay >= 1 block (standard: >= 2 days for major protocols)

### Pattern G-ATK-2: Vote Manipulation
Split tokens across accounts, vote FOR and AGAINST strategically to manipulate outcome.

**Check:**
- Delegation cannot be changed mid-vote (ERC20Votes delegates snapshot at startBlock)
- Voting power snapshot frozen at proposal start
- No self-delegation cycling

### Pattern G-ATK-3: Timelock Bypass
Governance contract admin is non-timelocked EOA that can upgrade away the timelock.

**Check:**
- Timelock owns the governance contract (not EOA)
- No direct exec function bypassing timelock
- `admin()` of timelock is governance contract itself

### Pattern G-ATK-4: Proposal Payload Poisoning (Tornado Cash)
Malicious proposal appears benign but contains hidden payload executed on `execute()`.

**Check:**
- Full calldata review before vote (not just summary)
- Timelock allows human review of decoded calldata
- No proxy pattern that changes behavior after proposal passes

### Pattern G-ATK-5: Quorum Manipulation
Large token transfer or burn during vote changes total supply, making quorum easier to reach.

**Check:**
- Quorum fixed at proposal creation using `quorumDenominator` + snapshot
- Not using live total supply (`totalSupply()`)
- OpenZeppelin GovernorVotesQuorumFraction snapshots at startBlock

### Pattern G-ATK-6: Guardian Veto Capture
Single-account guardian can veto any proposal.
If guardian key is compromised: valid proposals blocked, attacker holds veto power.

**Check:**
- Guardian role requires multisig (5-of-9 minimum)
- Veto has time limit (cannot be delayed indefinitely)
- Community can override guardian with supermajority

---

## VERIFICATION CHECKLIST

- [ ] Proposal threshold uses balance checkpoint (not current balance)
- [ ] Voting delay >= 1 block (flash loan resistance); major protocols: >= 2 days
- [ ] Voting period sufficient for review (>= 3 days typical, 7 days for high-value)
- [ ] Voting power snapshot at proposal creation, not live balance
- [ ] Delegation state snapshot taken at startBlock (not mid-vote changeable)
- [ ] Quorum fixed at proposal creation (not using live totalSupply)
- [ ] Timelock delay enforced on ALL execution paths (no shortcuts)
- [ ] Timelock is the owner of target contracts (not governance contract directly)
- [ ] No immediate execution path (all proposals queued in timelock first)
- [ ] Cancel proposal requires significant threshold (cannot be griefed by small holder)
- [ ] Guardian/Veto cannot instantly cancel without cause (requires multisig, timelock)
- [ ] Execution is batched atomically (all-or-nothing)
- [ ] All proposal calldatas decodeable and reviewable in timelock queue
- [ ] Upgrade proposals cannot remove timelock or governance
- [ ] Emergency "shutdown" requires supermajority, not Guardian alone

---

## Foundry Testing Patterns

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract GovernanceTest is Test {
    IGovernor governor;
    IToken token;

    // Flash loan governance attack (Beanstalk-style)
    function test_flashLoanCannotCreateProposal() public {
        uint256 threshold = governor.proposalThreshold();

        // Flash loan to get threshold of tokens
        vm.prank(flashLoanProvider);
        token.transfer(attacker, threshold);

        // Try to submit proposal in same tx as receiving tokens
        vm.prank(attacker);
        vm.expectRevert("InsufficientProposalThreshold");
        governor.propose(targets, values, calldatas, "malicious");

        // Repay flash loan
        vm.prank(attacker);
        token.transfer(flashLoanProvider, threshold);
    }

    // Voting delay enforcement
    function test_votingDelayEnforced() public {
        uint256 proposalId = createProposal();

        // Cannot vote immediately
        vm.expectRevert("VotingNotYetOpen");
        governor.castVote(proposalId, 1);

        // Fast forward past voting delay
        vm.roll(block.number + governor.votingDelay() + 1);

        // Now can vote
        governor.castVote(proposalId, 1);
    }

    // Timelock bypass test
    function test_noExecutionWithoutTimelock() public {
        uint256 proposalId = createAndPassProposal();

        // Cannot execute immediately after passing
        vm.expectRevert("TimelockNotMet");
        governor.execute(targets, values, calldatas, descriptionHash);

        // Fast forward past timelock
        vm.warp(block.timestamp + governor.timelock().getMinDelay() + 1);

        // Now can execute
        governor.execute(targets, values, calldatas, descriptionHash);
    }
}
```

---

## Integration-Level Attacks

### Governance + Token Whale Capture
1. Large token holder accumulates > quorum threshold
2. Submits self-serving proposal (fee capture, parameter change)
3. Votes pass with minimal opposition
**Mitigation:** Time-weighted voting power, capped single-address voting weight, vote delegation restrictions.

### Governance + Treasury Drain
1. Pass proposal to transfer treasury to attacker address
2. Timelock provides delay, but no automatic reversal trigger
**Mitigation:** Spending limits per timelock period, guardian veto for treasury actions, super-majority threshold for treasury proposals.
