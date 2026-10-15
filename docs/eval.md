# Evaluation

Honest numbers on public fixtures, reproducible with the commands below. Small sets; treat them as a regression check, not a benchmark claim.

## Solana: coral-xyz/sealevel-attacks

Commit `24555d044802db4022112a94d6d70e74291a4b6d`, 35 `.rs` files across 11 lessons, each with insecure / secure / recommended variants.

| Lesson | Insecure variant | Secure / recommended variants |
| --- | --- | --- |
| 0 signer authorization | `solana-missing-signer` | clean |
| 1 account data matching | `solana-account-data-matching` (+ owner check) | `solana-unchecked-account-owner` on the secure variant, which indeed never checks the owner (lesson 2's bug) |
| 2 owner checks | `solana-unchecked-account-owner` | clean |
| 3 type cosplay | `solana-type-cosplay` | clean |
| 4 initialization | missed (reported type cosplay + owner check instead) | `solana-unchecked-account-owner`, again a real missing owner check |
| 5 arbitrary CPI | `solana-arbitrary-cpi` | clean |
| 6 duplicate mutable accounts | `solana-duplicate-mutable-accounts` | clean |
| 7 bump canonicalization | `solana-pda-noncanonical-bump` | clean |
| 8 PDA sharing | missed | clean |
| 9 closing accounts | `solana-manual-close-revival` (also on `insecure-still`) | clean |
| 10 sysvar address | `solana-sysvar-address-unchecked` | clean |

Target class found in 9 of 11 lessons. No finding on a secure or recommended variant outside a bug that variant really has.

## EVM: theredguild/damn-vulnerable-defi (src/)

Commit `64fddf9f96de2782f8868898d68673acb295119c`, 53 files. Most challenges are protocol logic bugs a pattern engine cannot see. Findings:

- truster: `evm-arbitrary-external-call` on `target.functionCall(data)` (the intended bug).
- puppet-v2: `evm-oracle-manipulation` on the spot `getReserves` price (the intended bug), plus the library helper it calls.
- unstoppable: `evm-erc4626-donation-inflation` on `totalAssets` reading the raw balance (the donation that breaks the vault's invariant).
- free-rider: `evm-tx-origin-auth` on `tx.origin != beneficiary` (real smell, not the challenge's main bug).
- DamnValuableNFT: `evm-reentrancy-external-call` on `_safeMint` before `++nonce`, role-restricted so confidence is reduced.

Missed: side-entrance, naive-receiver, selfie, climber, backdoor, compromised, and the rest.

## False positive check: OpenZeppelin/openzeppelin-contracts (contracts/)

Commit `598d3905a6f4ebe68a52c79d461bedb7246fa187`, 368 files. 3 findings, all in mocks written to be unsafe: `UUPSUpgradeableMock._authorizeUpgrade` (commented "dangerous"), `UUPSUpgradeableUnsafeMock.upgradeToAndCall`, and `ERC20Reentrant`'s arbitrary `functionCall`. Zero findings in production contracts.

## Reproduce

```bash
git clone --depth 1 https://github.com/coral-xyz/sealevel-attacks
node scripts/scan-dir.ts sealevel-attacks/programs solana
```
