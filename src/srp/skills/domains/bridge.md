# Bridge Protocol Security Skills

## Domain: Cross-Chain Bridge Protocols

This skill pack covers critical invariants, attack vectors, and verification patterns for cross-chain bridges (Wormhole, LayerZero, Axelar, Connext, Chainlink CCIP, etc.).

---

## CRITICAL BRIDGE INVARIANTS

### INV-B1: Message Uniqueness
```
Each cross-chain message MUST have a unique identifier that prevents replay.
```
- Check: messageHash includes chainId, nonce, payload hash
- Attack: replay same message on same chain or different chain
- Implementation: incrementing nonce per sender, chain-scoped message IDs
- ENFORCE: `require(!processed[msgHash], "Already processed")`

### INV-B2: Finality Verification
```
Messages MUST NOT be processed on destination until source chain achieves finality.
```
- Check: block confirmations >= required threshold before relay
- Attack: source chain reorg after message relayed, double spend
- Wormhole used 1 confirmation before the $320M hack; now requires quorum of 19 guardian signatures.
- Implementation: optimistic verification with fraud proofs OR wait for absolute finality

### INV-B3: Signature Authority
```
Only authorized relayers/guardians can relay messages. Signature verification MUST be correct.
```
- Check: ecrecover returns expected signer, multisig threshold met
- Attack: forged signatures, signature malleability (s > n/2)
- Implementation: ECDSA with proper encoding, validator sets with stake-weighted quorum
- ENFORCE: normalize `s` value: `require(s <= 0x7FFFFFFF...FFFF, "Malleable sig")`

### INV-B4: Liquidity Conservation
```
Total locked on source chain >= Total minted on destination chains for each asset.
```
- Check: accounting invariants across all chain pairs
- Attack: mint on destination without locking on source (infinite mint)
- Implementation: strict mint/burn accounting, periodic reconciliation
- ENFORCE: cross-chain balance replication with cryptographic proofs

### INV-B5: Message Ordering
```
Messages from a single sender MUST be processed in sequence (nonce ordering).
```
- Check: nonce strict increment enforcement, no gaps allowed
- Attack: message skipping, out-of-order processing causing state desync
- Implementation: require nonce == expectedNonce, reject out-of-order messages

### INV-B6: Receiver Safety
```
Message execution on destination MUST be reentrancy-safe and gas-bounded.
```
- Check: `_lzReceive` implementation has reentrancy guard
- Attack: malicious receiver re-enters bridge to claim funds multiple times
- Implementation: nonReentrant on all receive paths, gas limit on callbacks

---

## BRIDGE-SPECIFIC ATTACK PATTERNS

### Pattern B-ATK-1: Replay Attack
Attacker replays a valid message: same-chain replay (if nonce not tracked), cross-chain replay (if chainId not in hash).

**Historical:** Nomad Bridge (Aug 2022) — $190M
Root cause: Upgrade set trusted root to `bytes32(0)`. Any message could be "verified" by passing zero root.
Copy-paste exploit: hundreds of attackers drained the bridge by replaying slightly-modified messages.

**Check:**
- Message hash includes source chainId
- Nonce is per-sender and strictly enforced
- Processed messages marked as consumed via storage write

### Pattern B-ATK-2: False Finality Exploit
Attacker submits message before source chain finality, then reorgs source chain to change outcome.

**Historical:** Ronin Bridge (Mar 2022) — $625M
Root cause: 5-of-9 validator key compromise. Not a finality bug, but demonstrated centralized bridge risk.

**Check:**
- Minimum block confirmations enforced per chain (Ethereum: 12+, Polygon: 128+)
- Fraud proof window before funds released for optimistic bridges
- For optimistic bridges: proper 7-day challenge period

### Pattern B-ATK-3: Signature Forgery
Attacker crafts fake guardian signatures or exploits signature malleability.

**Historical:** Wormhole (Feb 2022) — $320M
Root cause: `verify_signatures()` used `secp256k1_verify` from a deprecated instruction that wasn't properly guarded. Attacker bypassed signature verification entirely.

**Check:**
- ecrecover output normalized (reject s > n/2 for malleability)
- Validator set loaded from authoritative on-chain source
- Signature count matches quorum threshold exactly

### Pattern B-ATK-4: Relayer Collusion
Compromised relayers relay fake messages or censor valid ones.

**Check:**
- Relayer rotation/random selection with economic stake
- Message verification independent of relayer trust (ZK proofs or light client proofs)
- Economic slashing for malicious relayers
- Fallback to direct user relay

### Pattern B-ATK-5: Liquidity Lock / Admin Key Exploit
Funds locked in bridge contract become unrecoverable due to upgrade failure, bridge paused, admin key lost.

**Historical:** Multichain Bridge (Jul 2023) — $125M
Root cause: CEO arrested, private keys inaccessible. No key rotation or multisig.

**Check:**
- Admin key is multisig (5-of-9 minimum) with hardware wallets
- Emergency withdrawal via governance timelock (not single EOA)
- Bridge can be upgraded without pausing (upgrade path tested)
- No single point of failure for fund recovery

---

## VERIFICATION CHECKLIST

- [ ] Nonce is per-sender and strictly increments by 1
- [ ] Message hash includes source chainId to prevent cross-chain replay
- [ ] Processed messages are permanently marked (storage write, not memory)
- [ ] Block confirmations verified for source chain finality (per-chain threshold)
- [ ] Signature verification uses ecrecover correctly (no malleability: s <= n/2)
- [ ] Validator set cannot be instantly changed (timelock on validator updates)
- [ ] Liquidity accounting: locked >= minted tracked per asset per chain pair
- [ ] Revert messages can be relayed back to source for refund
- [ ] Rate limiting on message value to limit exploit scope
- [ ] Circuit breaker/pause functionality with multisig (not single EOA)
- [ ] No self-destruct or unguarded delegatecall in proxy/implementation
- [ ] Guardian key management: multisig, hardware wallet, no bare EOA
- [ ] Reentrancy guard on `receive`/`lzReceive`/`_execute` function
- [ ] Gas limit enforced on destination execution (OOG cannot freeze bridge)
- [ ] Canonical token contract verified (not attacker-deployed ERC20)
- [ ] Upgrade initialization: `initialize()` guarded against re-initialization

---

## Foundry Testing Patterns

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract BridgeInvariantTest is Test {
    IBridge bridge;

    // Replay attack test (Nomad replay)
    function test_messageCannotBeReplayed() public {
        bytes32 msgHash = keccak256(abi.encodePacked(
            uint256(block.chainid), address(this), uint256(1), "payload"
        ));

        // First execution
        bridge.execute(msgHash, "payload");

        // Replay attempt must revert
        vm.expectRevert("AlreadyProcessed");
        bridge.execute(msgHash, "payload");
    }

    // Zero root exploit test (Nomad-style)
    function test_zeroRootNotTrusted() public {
        bytes32 root = bytes32(0);
        vm.expectRevert("UntrustedRoot");
        bridge.verify(root, "arbitrary message");
    }

    // Signature malleability test
    function test_malleableSignatureRejected() public {
        (uint8 v, bytes32 r, bytes32 s) = getValidSignature();
        // Flip s to create malleable sig
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 sMalleable = bytes32(n - uint256(s));
        vm.expectRevert("MalleableSignature");
        bridge.processMessage(v, r, sMalleable, "payload");
    }

    // Invariant: locked >= minted per asset
    function invariant_liquidityConservation() public {
        for (uint i = 0; i < assets.length; i++) {
            uint256 locked = bridge.lockedAmount(assets[i]);
            uint256 minted = bridge.mintedAmount(assets[i]);
            assertGe(locked, minted, "Minted exceeds locked");
        }
    }
}
```

---

## Integration-Level Attacks

### Bridge + DEX Arbitrage Extract
1. Bridge large amount to chain B
2. Manipulate DEX on chain B (small liquidity)
3. Bridge profits back to chain A
**Mitigation:** Rate limits per bridge per time window; value caps per message.

### Bridge + Lending: Cross-Chain Collateral Spoofing
1. Lock collateral on chain A
2. Receive bridged representation on chain B
3. Use bridged token as collateral on chain B lending
4. Default on loan; original collateral proves hard to liquidate cross-chain
**Mitigation:** Bridge token collateral treated as higher risk; cross-chain liquidation path required.
