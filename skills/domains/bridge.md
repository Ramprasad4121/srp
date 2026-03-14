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

### INV-B2: Finality Verification
```
Messages MUST NOT be processed on destination until source chain achieves finality.
```
- Check: block confirmations >= required threshold before relay
- Attack: source chain reorg after message relayed, double spend
- Implementation: optimistic verification with fraud proofs OR wait for absolute finality

### INV-B3: Signature Authority
```
Only authorized relayers/guardians can relay messages. Signature verification MUST be correct.
```
- Check: ecrecover returns expected signer, multisig threshold met
- Attack: forged signatures, signature malleability, unauthorized relayers
- Implementation: ECDSA with proper encoding, validator sets with stake-weighted quorum

### INV-B4: Liquidity Conservation
```
Total locked on source chain >= Total minted on destination chains for each asset.
```
- Check: accounting invariants across all chain pairs
- Attack: mint on destination without locking on source (infinite mint)
- Implementation: strict mint/burn accounting, periodic reconciliation

### INV-B5: Message Ordering
```
Messages from a single sender MUST be processed in sequence (nonce ordering).
```
- Check: nonce strict increment enforcement, no gaps allowed
- Attack: message skipping, out-of-order processing causing state desync
- Implementation: require nonce == expectedNonce, reject out-of-order messages

---

## BRIDGE-SPECIFIC ATTACK PATTERNS

### Pattern B-ATK-1: Replay Attack
Attacker replays a valid message: same-chain replay (if nonce not tracked), cross-chain replay (if chainId not in hash).

**Check:**
- Message hash includes source chainId
- Nonce is per-sender and strictly enforced
- Processed messages are marked as consumed

### Pattern B-ATK-2: False Finality Exploit
Attacker submits message before source chain finality, then reorgs source chain to change outcome.

**Check:**
- Minimum block confirmations enforced
- Fraud proof window before funds released
- For optimistic bridges: proper challenge period

### Pattern B-ATK-3: Signature Forgery
Attacker crafts fake guardian signatures or exploits signature malleability.

**Check:**
- ecrecover output normalized (reject s > n/2 for malleability)
- Validator set is correctly loaded from source of truth
- Multisig threshold cannot be bypassed

### Pattern B-ATK-4: Relayer Collusion
Compromised relayers relay fake messages or censor valid ones.

**Check:**
- Relayer rotation/random selection
- Economic slashing for malicious relayers
- Message verification independent of relayer trust

### Pattern B-ATK-5: Liquidity Lock
Funds locked in bridge contract become unrecoverable due to: upgrade failure, bridge paused, admin key lost.

**Check:**
- Upgrade mechanism exists and is tested
- Emergency withdrawal paths (governance, timelock)
- No single point of failure for fund recovery

---

## VERIFICATION CHECKLIST

- [ ] Nonce is per-sender and strictly increments by 1
- [ ] Message hash includes source chainId to prevent cross-chain replay
- [ ] Processed messages are permanently marked (storage write)
- [ ] Block confirmations verified for source chain finality
- [ ] Signature verification uses ecrecover correctly (no malleability)
- [ ] Validator set cannot be instantly changed (timelock)
- [ ] Liquidity accounting: locked >= minted tracked per asset
- [ ] Revert messages can be relayed back to source for refund
- [ ] Rate limiting on message value to limit exploit scope
- [ ] circuit breaker/pause functionality with multisig
- [ ] No self-destruct or delegatecall in proxy/implementation
- [ ] Guardian key management (HSM, multisig, no EOA)
