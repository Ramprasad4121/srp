# Cross-Chain Messaging Security Skills

## Domain: CCIP, LayerZero, Wormhole, Generic Cross-Chain Messaging

This skill covers cross-chain message protocols, receiver safety, and multi-chain state consistency.

---

## CRITICAL CROSS-CHAIN INVARIANTS

### INV-X1: Message Authenticity
```
Messages received on destination MUST be verified as originating from legitimate source.
```
- Check: sourceChain + sourceAddress verified via trusted relayer/bridge
- Attack: spoofed messages from non-existent or compromised sources
- Implementation: endpoint whitelist + caller verification + signature check
- ENFORCE: `require(msg.sender == trustedEndpoint, "Unauthorized")`

### INV-X2: Nonce-Per-Source Uniqueness
```
Each (sourceChain, sourceAddress, nonce) tuple is unique and consumed exactly once.
```
- Check: nonce strictly increases per destination per source path
- Attack: replay attacks, out-of-order execution causing state desync
- Implementation: mapping consumed nonces, strict ordering with gap protection

### INV-X3: Fee Payment
```
User MUST pay sufficient fees for cross-chain message relay.
```
- Check: fee calculation >= actual relay cost on destination chain
- Attack: underpayment causes message failure after assets locked, spam
- Implementation: dynamic fee oracle, atomically check before locking

### INV-X4: Payload Integrity
```
Payload hash is verified end-to-end: source → destination.
```
- Check: hash(payload) signed/verified at endpoint level
- Attack: tampered message content (man-in-the-middle relayer)
- Implementation: payload hash in guardian signature, content hash verification

### INV-X5: Trusted Remote
```
Destination only accepts from whitelisted/trusted remote contracts.
```
- Check: source contract registry updated via governance timelock
- Attack: rogue contracts sending malicious messages to destination
- Implementation: peer address mapping, immutable or governance-controlled

### INV-X6: Receiver Execution Safety
```
_receive() implementation must not allow reentrancy or arbitrary execution.
```
- Check: `lzReceive` has nonReentrant guard, gas limits enforced
- Attack: malicious receiver re-enters endpoint to extract value
- Implementation: effects before external calls, bounded gas for callbacks

---

## HISTORICAL EXPLOITS

### 1. Nomad Bridge (Aug 2022) — $190M
**Root Cause:** While primarily a replay attack, the underlying issue was: trusted root set to `bytes32(0)` during upgrade. Any `prove()` call succeeded because zero root passes all checks.
**Lesson:** Message verification must be explicit zero-sensitive. `require(root != bytes32(0))`.

### 2. Ronin Network (Mar 2022) — $625M
**Root Cause:** 5-of-9 validator compromise. Attacker gained control of Sky Mavis + Axie DAO validators via social engineering. No independent key management.
**Lesson:** Validator key diversity is security. Collocated validators = single failure point.

### 3. Wormhole (Feb 2022) — $320M
**Root Cause:** Solana program used `secp256k1_program` for signature verification, but used a deprecated instruction that could be called with incorrect parameters.
Attacker bypassed guardian signature verification entirely.
**Lesson:** Cryptographic primitives must be verified independently of the expected call path. Audit all verification code paths, not just the happy path.

### 4. Optimism Cross-Domain Messenger (Jun 2022) — $20M (prevented by whitehack)
**Root Cause:** L2 → L1 message had reentrancy issue. Attacker could replay message to drain bridge.
**Lesson:** Cross-domain message execution must be reentrancy-protected. Mark message consumed BEFORE execution.

### 5. LayerZero Receive Bugs (Multiple 2023)
**Root Cause:** Multiple protocols implementing `lzReceive()` did not guard against:
- Unauthorized callers (not checking `msg.sender == lzEndpoint`)
- Reentrancy during token minting
**Lesson:** `lzReceive` is a privileged function. Treat like `onlyOwner` + `nonReentrant`.

---

## CROSS-CHAIN ATTACK PATTERNS

### Pattern X-ATK-1: Message Replay
Same message replayed multiple times, draining funds on destination.

**Historical:** Nomad — $190M
**Check:**
- Nonce mapping per source (`mapping(uint16 => mapping(address => uint64)) nonces`)
- Message hash marked as consumed BEFORE execution
- Storage write confirms consumption (not memory flag)

### Pattern X-ATK-2: Cross-Chain Race Condition
Message arrives before dependent state is ready on destination.
Protocol assumes ordered guarantee; reality: messages can arrive out of order.

**Check:**
- Message processing idempotent (can handle partial/missing state)
- Ordered execution enforced with nonce gap check
- Retry mechanism backed by persistent storage

### Pattern X-ATK-3: Fee Avoidance via Reentrancy
Attacker bypasses fee payment through contract call reentrancy during fee check.

**Check:**
- Fees deducted and verified BEFORE any external call
- Refund calculation safe from manipulation
- CEI pattern in fee verification flow

### Pattern X-ATK-4: Malicious Receiver Contract
Malicious contract on destination executes arbitrary logic on receipt.

**Check:**
- Receiver validation (registered contracts vs unknown)
- `lzReceive` has gas limit enforcement
- Reentrancy guard on all receive functions
- Failed execution: retry mechanism with stored message, not automatic

### Pattern X-ATK-5: Source Chain Fork / Reorg
Source chain reorganizes after message relayed, invalidating basis for the message.

**Check:**
- Block confirmation finality threshold per chain (Ethereum: 12, Polygon: 128, etc.)
- Optimistic bridges: 7-day fraud proof window
- ZK bridges: proof finality before relay (no reorg risk)

### Pattern X-ATK-6: Spoofed Source Contract
Attacker deploys contract on source chain with same address as trusted contract.
Sends message from attacker contract; destination accepts it as legitimate.

**Check:**
- Address + chainId must be trusted (not just address)
- Trusted remote registry: `mapping(uint16 chainId => bytes trustedRemote)`
- Registry updates require governance timelock

---

## VERIFICATION CHECKLIST

- [ ] Source chain and address BOTH verified before processing message
- [ ] Nonce strictly increases per source per destination (no gaps accepted)
- [ ] Message hash signed and content hash verified end-to-end
- [ ] Message marked consumed BEFORE execution (not after)
- [ ] Trusted remote mapping updated only via governance/timelock
- [ ] Fee calculation covers actual gas cost on destination (with buffer)
- [ ] Refund mechanism cannot be griefed or exploited
- [ ] Receiver validation: only registered contracts accepted
- [ ] `lzReceive` / `_execute` has reentrancy guard (nonReentrant)
- [ ] Circuit breaker for failed message handling (max retry count)
- [ ] Retry mechanism rate-limited to prevent spam attacks
- [ ] Message expiry time enforced (no indefinitely pending messages)
- [ ] Refund path for expired/failed messages with bounded gas
- [ ] Block confirmations enforced per source chain (chain-specific thresholds)
- [ ] Guardian/validator key management: multisig, geographic distribution
- [ ] `require(root != bytes32(0))` in all verification paths
- [ ] Gas limit on `_execute` / callback (OOG cannot permanently block bridge)
- [ ] Failed execution stores message for user-initiated retry (not silent loss)

---

## Foundry Testing Patterns

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract CrossChainTest is Test {
    IReceiver receiver;
    address lzEndpoint;

    // Only trusted endpoint can call lzReceive
    function test_unauthorizedCallerRejected() public {
        vm.prank(attacker); // not lzEndpoint
        vm.expectRevert("InvalidEndpoint");
        receiver.lzReceive(1, abi.encode(victim), 0, abi.encode("payload"));
    }

    // Replay attack test
    function test_replayIsBlocked() public {
        bytes memory payload = abi.encode(victim, 1000e18);

        // First delivery
        vm.prank(lzEndpoint);
        receiver.lzReceive(1, trustedRemote, 1, payload);

        // Replay attempt
        vm.prank(lzEndpoint);
        vm.expectRevert("AlreadyProcessed");
        receiver.lzReceive(1, trustedRemote, 1, payload); // same nonce
    }

    // Reentrancy on receive test
    function test_noReentrancyOnReceive() public {
        ReentrantCaller reentrant = new ReentrantCaller(address(receiver));

        vm.prank(lzEndpoint);
        vm.expectRevert("ReentrancyGuard: reentrant call");
        receiver.lzReceive(1, trustedRemote, 2, abi.encode(address(reentrant), 100e18));
    }

    // Zero root is not trusted (Nomad-style)
    function test_zeroRootNotAccepted() public {
        bytes32 root = bytes32(0);
        vm.expectRevert("ZeroRoot");
        bridge.prove(root, "any message", proof);
    }

    // Invariant: nonces are strictly increasing
    function invariant_noncesMonotonicallyIncrease() public {
        for (uint16 chainId = 1; chainId <= 10; chainId++) {
            uint64 current = receiver.nonce(chainId, trustedRemotes[chainId]);
            assertGe(current, lastNonce[chainId], "Nonce decreased or replayed");
            lastNonce[chainId] = current;
        }
    }
}
```

---

## Integration-Level Attacks

### Cross-Chain + Lending: Synthetic Collateral Inflation
1. Lock $1M collateral on chain A
2. Receive $1M synthetic representation on chain B
3. Use synthetic as collateral on chain B lending protocol
4. Borrow $500K on chain B
5. Duplicate synthetic on chain C (message replay or chain fork)
6. Borrow another $500K on chain C
7. Default on both: original $1M collateral cannot cover $1M debt across two chains
**Mitigation:** Cross-chain collateral registries with atomic state; no synthetic used as collateral without escrow proof on source chain.

### Cross-Chain + AMM: Arbitrage Without Risk
1. Flash loan on chain A
2. Signal large bridge transfer to create price differential
3. Front-run AMM on chain B before bridge completes
4. Settle bridge, pocket arbitrage profit
**Mitigation:** Bridge finality must precede AMM state changes that depend on bridge output; no MEV extraction before message finalized.
