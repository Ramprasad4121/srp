# Detectors

Every finding carries one or more evidence records (file, line range, raw excerpt, provider, operation, kind, and a deterministic `ev_` id). Source is matched with comments and string contents blanked, so a word in a comment neither triggers nor silences a rule.

Three analyzers run:

- `srp-structural` (Solidity): indexes functions (visibility, mutability, modifiers, parameters, body) and contract state variables, then reasons per function.
- `srp-anchor` (Solana / Anchor): parses `#[derive(Accounts)]` structs, their `#[account(...)]` constraints, and `#[account]` data structs.
- `srp-pattern` (EVM): file-level patterns with guards, for bugs a single expression shows.

None of these execute code. A finding is a lead with cited lines, not a proof. See "Proof" below.

## EVM

| Rule | Analyzer | Fires when | Not fired / weakened when |
| --- | --- | --- | --- |
| `evm-reentrancy-external-call` | structural | a function makes an external call (`.call`, `functionCallWithValue`, `safeTransferFrom`, `_safeMint`) and writes a state variable after it | write happens before the call (CEI); a variable set before and restored after (lock pattern). Weakened by `nonReentrant`, an access modifier or caller check, or internal visibility |
| `evm-missing-access-control` | structural | a public/external function with no access modifier and no caller check writes owner/admin/implementation-like state, or calls `selfdestruct` / `upgradeTo` | access modifier, `require/if` on `msg.sender` or `_msgSender()`, `_check*` / `_authorize*` calls, or the body defers to `super` |
| `evm-unprotected-upgrade` | structural | UUPS `_authorizeUpgrade` with no modifier and no caller check | `onlyOwner` or any caller check |
| `evm-arbitrary-delegatecall` | structural | a public function delegatecalls to one of its own parameters with no access check | target is a stored implementation |
| `evm-arbitrary-external-call` | structural | a public function calls a caller-chosen target with caller-chosen calldata (Truster) | access modifier or caller check (`nonReentrant` does not count) |
| `evm-unchecked-low-level-call` | structural | `.call` / `.send` / `.delegatecall` used as a bare statement, success flag discarded (`.send` only with one argument) | result assigned, required, tested in `if`, or returned |
| `evm-oracle-manipulation` | pattern | `getReserves`, `slot0`, `get_dy`, `getAmountsOut` spot reads | TWAP (`observe`, `consult`, `OracleLibrary`) or Chainlink in the file |
| `evm-oracle-stale-price` | pattern | `latestRoundData(` | any comparison on `updatedAt` |
| `evm-tx-origin-auth` | pattern | `tx.origin ==` / `!=` | |
| `evm-unchecked-arithmetic` | pattern | `+= -= *=` or `a op b` using a function parameter or `msg.value`, in a state-changing function of a file with a pre-0.8 pragma and no SafeMath | Does not model bounds checks beyond lowering confidence when a `require(... >= ...)` exists; fires on bounded operands |
| `evm-weak-randomness` | pattern | hash or `%` over `block.timestamp`/`number`/`blockhash`/`difficulty`/`prevrandao`/`now` in a state-changing function | Also fires on benign uses such as nonces or salts; review the line |
| `evm-signature-replay` | pattern, function-aware | `ecrecover`, `ECDSA.recover`, `SignatureChecker.isValid` inside a state-changing, non-library function | `nonce`, used-signature or used-digest maps; view/pure helpers and libraries |
| `evm-erc4626-donation-inflation` | pattern | `balanceOf(address(this))` in a file with ERC4626 share math | `_decimalsOffset`, virtual or dead shares |

Removed in this version because they fired on the presence of code rather than on a bug: the generic `access-control` rule (fired on `onlyOwner` itself), `evm-upgrade-admin` (fired on the word `implementation`), and the old `evm-oracle-manipulation` that matched `/price/i`.

## Solana (Anchor)

| Rule | Fires when | Not fired when |
| --- | --- | --- |
| `solana-missing-signer` | an authority-named account (`authority`, `owner`, `admin`, ...) is `AccountInfo` / `UncheckedAccount` with no `signer` constraint | typed `Signer`, `signer` constraint, a manual `is_signer` check, or the account is handed to a CPI that enforces the signature |
| `solana-missing-has-one` | an `Account<'info, T>` whose data stores `authority: Pubkey` sits next to an `authority` account with no `has_one` or constraint tying them | `has_one = authority`, a `constraint`, or an explicit key comparison |
| `solana-unchecked-account-owner` | raw `AccountInfo` data is deserialized (`unpack`, `try_from_slice`, ...) with no owner check | `owner =` constraint or a `.owner` comparison |
| `solana-account-data-matching` | an unpacked token account's `owner` is never compared to anything | `token.owner` is checked |
| `solana-type-cosplay` | Borsh `try_from_slice` with no discriminator in the file | a discriminant / discriminator check |
| `solana-arbitrary-cpi` | a `*program` account is `AccountInfo` with no address pin and the file does CPI | `Program<'info, T>`, `address =`, or a key comparison |
| `solana-sysvar-address-unchecked` | a sysvar account (`rent`, `clock`, `instructions`, ...) is `AccountInfo` with no address check | `Sysvar<'info, T>`, `address =`, `require_keys_eq!` / `require_eq!` |
| `solana-duplicate-mutable-accounts` | two accounts of the same data type are used with no key inequality | key comparison, constraint, or both pinned by `has_one` |
| `solana-init-if-needed-reinit` | `init_if_needed` with no `is_initialized` guard | an initialized flag check |
| `solana-manual-close-revival` | lamports set to 0 with no close constraint or data wipe | `close =`, `CLOSED_ACCOUNT_DISCRIMINATOR` |
| `solana-pda-noncanonical-bump` | `create_program_address` with no `find_program_address` | canonical bump derivation |

Native (non-Anchor) programs are not analyzed structurally. They are reported as a high-severity residual unknown instead of passing silently.

## Proof

SRP never marks a finding `proven` on its own. Findings start as `candidate`, become `debated`, and then:

- `partial`: at least two cited lines or facts, no mitigation, confidence >= 0.6. A Foundry harness is generated for reentrancy and access-control findings.
- `unverified`: a single pattern match or a mitigated finding, nothing executed.
- `failed`: an attached test run that did not pass.
- `proven`: only when the request includes a `proofs` entry for the finding with `passed: true` (a PoC or test you ran locally).

High and critical findings are shown at medium until proven; `proposedSeverity` keeps the detector's original call.

## Coverage and residual unknowns

Every report has `coverage` (files analyzed, functions indexed, analyzers used) and `unknowns`: files no analyzer handles, inline assembly, unresolved imports, `remaining_accounts`, `unsafe` Rust, and native Solana programs. No finding is not the same as no bug.

## Known limits

- Single-file reasoning. Inheritance, imports, and cross-contract calls are not resolved; an override that calls `super` is skipped rather than guessed.
- Read-only and cross-function reentrancy are not detected.
- Partial EIP-712 coverage and future-dated oracle timestamps are not detected yet.
- Anchor reinitialization through native `try_from_slice` + manual init (sealevel lesson 4) and PDA sharing (lesson 8) are missed.
