# Cross-Chain Messaging Security Skills

## Domain: CCIP, LayerZero, Wormhole, Generic Cross-Chain Messaging

This skill covers cross-chain message protocols and their security considerations.

---

## CRITICAL CROSS-CHAIN INVARIANTS

### INV-X1: Message Authenticity
```
Messages received on destination MUST be verified as originating from legitimate source.
```
- Check: sourceChain + sourceAddress verified via trusted relayer/bridge
- Attack: spoofed messages from non-existent sources
- Implementation: endpoint whitelist, verified caller

### INV-X2: Nonce-Per-Source Uniqueness
```
Each (sourceChain, sourceAddress, nonce) tuple is unique and consumed.
```
- Check: nonce strictly increases per destination per source
- Attack: replay attacks, out-of-order execution
- Implementation: mapping consumed nonces, strict ordering

### INV-X3: Fee Payment
```
User MUST pay sufficient fees for cross-chain message relay.
```
- Check: fee calculation > actual relay cost
- Attack: underpayment, spam messages
- Implementation: dynamic fee oracle, refund excess

### INV-X4: Payload Integrity
```
Payload hash is verified end-to-end: source → destination.
```
- Check: hash(payload) signed/verified
- Attack: tampered message content
- Implementation: payload hash in signature, content hash verification

### INV-X5: Trusted Remote
```
Destination only accepts from whitelisted/trusted remote contracts.
```
- Check: source contract registry with updates via governance
- Attack: rogue contracts sending malicious messages
- Implementation: peer address mapping, immutable or timelocked

---

## CROSS-CHAIN ATTACK PATTERNS

### Pattern X-ATK-1: Message Replay
Same message replayed multiple times, draining funds on destination.

**Check:**
- Nonce mapping per source
- Message hash marked as consumed

### Pattern X-ATK-2: Cross-Chain Race Condition
Message arrives before dependent state is ready on destination.

**Check:**
- Message processing can handle missing prerequisites
- Ordered execution enforced

### Pattern X-ATK-3: Fee Avoidance
Attacker bypasses fee payment through contract call reentrancy.

**Check:**
- Fees deducted before external calls
- Refund calculation safe from manipulation

### Pattern X-ATK-4: Malicious Receiver
Malicious contract on destination executes arbitrary logic on receipt.

**Check:**
- Receiver validation (contracts vs EOA)
- Reentrancy guards on receive function
- Callback gas limits enforced

### Pattern X-ATK-5: Source Chain Fork
Source chain reorganizes, invalidating previously valid messages.

**Check:**
- Finality threshold before relay
- Fork handling: message replay on new fork

---

## VERIFICATION CHECKLIST

- [ ] Source chain and address verified before processing message
- [ ] Nonce strictly increases per source per destination
- [ ] Message hash signed and content hash verified
- [ ] Trusted remote mapping only updated via governance/timelock
- [ ] Fee calculation covers actual gas cost on destination
- [ ] Refund mechanism cannot be griefed or exploited
- [ ] Receiver validation prevents malicious contracts
- [ ] Reentrancy guards on receive and retry paths
- [ ] Circuit breaker for failed message handling
- [ ] Retry mechanism rate-limited to prevent spam
- [ ] Message expiry to handle indefinite pending states
- [ ] Refund path for expired/failed messages
