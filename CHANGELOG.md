# Changelog

## Unreleased

### Changed (breaking for consumers of the report JSON)
- Reports carry `schemaVersion: "srp.audit/v1"`, `coverage`, and `unknowns`. Evidence records gain `evidenceId`, `provider`, `operation`, and `kind`. Findings gain `context` (function, visibility, modifiers, facts) and `proposedSeverity`. PoC results gain `executed` and `harness`. Debate decisions can be `inconclusive`.
- The PoC step no longer marks anything `proven` by itself. It used to label any reentrancy hit containing `call` as proven with 0.92 confidence without running anything. A finding is now proven only when a passing local test result is attached through `proofs`.
- Reentrancy is detected per function: an external call followed by a state write. Checks-effects-interactions code (write before call) is no longer flagged.
- Debate rounds cite the actual lines and facts instead of fixed text, and a low score is `inconclusive`, not `exploit_disproven`.

### Added
- Solidity structural index (`solidity.ts`) and detectors: `evm-missing-access-control`, `evm-unprotected-upgrade`, `evm-arbitrary-delegatecall`, `evm-arbitrary-external-call`.
- Anchor analyzer (`anchor.ts`) with 11 rules, checked against coral-xyz/sealevel-attacks (docs/eval.md).
- Comment and string stripping before matching.
- Residual unknowns and coverage per report.
- `scripts/scan-dir.ts` and `docs/eval.md`.

### Removed
- Presence-based rules that fired on safe code: generic `access-control`, `evm-upgrade-admin`, `/price/i` oracle rule, and the Solana rules that fired on any `seeds`/`bump`/`invoke_signed`/`AccountInfo`.


### Added
- Four EVM heuristics, each with true and false positive fixtures:
  - `evm-oracle-stale-price`: Chainlink `latestRoundData` with no `updatedAt` freshness check.
  - `evm-tx-origin-auth`: authorization on `tx.origin`.
  - `evm-signature-replay`: `ecrecover` / `ECDSA.recover` with no nonce or used-signature record.
  - `evm-erc4626-donation-inflation`: vault share math reading `balanceOf(address(this))` with no virtual share offset or dead shares.
- Detector rules can now declare `requires`, `suppressIf`, and `mitigatedBy` guards.
- Findings carry `mitigations`. The debate step weighs them, and the PoC step never marks a mitigated finding as proven.
- CI workflow running `npm test` and the API smoke test on Node 24.
- `docs/detectors.md` listing every rule.

### Fixed
- Reentrancy findings in files guarded by `nonReentrant` / `ReentrancyGuard` were marked proven with 0.92 confidence. They now carry the mitigation and stay unproven until a harness shows a real path.

## 0.1.0
- Initial release.
