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

## Whole-project CLI scans (`srp scan`, default skips)

| Project | Commit | Files scanned | Findings |
| --- | --- | --- | --- |
| OpenZeppelin/openzeppelin-contracts | `598d3905` | 269 (mocks skipped) | 0 |
| Uniswap/v3-core | `aab5aa0` | 40 | 0 |
| transmissions11/solmate | `89365b8` | 20 | 0 (an earlier build flagged `ERC6909.setOperator`; per-caller writes are now excluded) |
| theredguild/damn-vulnerable-defi | `64fddf9f` | 53 | 6, listed above |

Each scan finishes in under a second.

## Reproduce

```bash
git clone --depth 1 https://github.com/coral-xyz/sealevel-attacks
node scripts/scan-dir.ts sealevel-attacks/programs solana
```

## EVM: smartbugs/smartbugs-curated (labelled)

Commit `230e649123477eff332742a59a1c7cc6dc286cab`, 143 `.sol` files, every file contains at least one labelled vulnerability. Reproduce: `git clone https://github.com/smartbugs/smartbugs-curated /tmp/sb && node scripts/bench-smartbugs.ts /tmp/sb`.

| Category | Files | Mapped detectors | Files detected |
| --- | --- | --- | --- |
| reentrancy | 31 | `evm-reentrancy-external-call` | 21 |
| access_control | 18 | missing-access-control, tx-origin, arbitrary-delegatecall, unprotected-upgrade | 11 |
| unchecked_low_level_calls | 52 | `evm-unchecked-low-level-call` | 52 |
| arithmetic, bad_randomness, denial_of_service, front_running, short_addresses, time_manipulation, other | 42 | none (SRP has no detector yet) | 0 |

Read this honestly: the set is old Solidity (0.4.x), recall is by file not by labelled line, and a mapped detector firing in a file is not proof it hit the labelled line. Overall, 84 of 143 files (59%) get a finding from a mapped detector; SRP does not yet cover most of this corpus's classes. The set contains no clean contracts, so **precision cannot be measured here**; the script prints which detectors fire on unrelated categories (mostly `evm-missing-access-control` on old-style constructors/fallbacks) as a false-positive signal to work down. A clean-contract precision set is still open work. Before this benchmark, legacy `call.value()()` was not recognised and reentrancy recall was 0/31.


Note on `unchecked_low_level_calls` 52/52: every file in that category is labelled for exactly this bug class and the detector is a plain syntactic rule (call/send/delegatecall as a bare statement), so full file recall is expected and says little about subtle cases. The detector also fires in 5 files labelled with other categories (reentrancy, access_control, bad_randomness, denial_of_service, time_manipulation x2); I have not hand-verified those, so treat them as unlabelled rather than as true or false positives. On the clean corpora (OpenZeppelin contracts, Uniswap v3-core, solmate) it produces 0 findings.
