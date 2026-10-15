# Changelog

## Unreleased

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
