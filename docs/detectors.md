# Detectors

Every rule emits a finding only with a concrete evidence span (file, line, excerpt). Rules are file-level heuristics. They point a reviewer at code, they do not prove a bug. Guards are file-level too, so a guard anywhere in the file suppresses or weakens the rule.

| Rule | Chain | Fires on | Suppressed or weakened by |
| --- | --- | --- | --- |
| `evm-reentrancy-external-call` | EVM | `.call`, `transfer(`, `send(` | Weakened by `nonReentrant` / `ReentrancyGuard` (recorded as a mitigation, never proven) |
| `evm-upgrade-admin` | EVM | `upgradeTo`, `delegatecall`, `implementation` | |
| `evm-oracle-manipulation` | EVM | price and oracle reads | |
| `evm-oracle-stale-price` | EVM | `latestRoundData(` | any comparison on `updatedAt` |
| `evm-tx-origin-auth` | EVM | `tx.origin ==` / `!=` | |
| `evm-signature-replay` | EVM | `ecrecover`, `ECDSA.recover`, `SignatureChecker.isValid` | `nonce`, `_useNonce`, used-signature or used-digest maps |
| `evm-erc4626-donation-inflation` | EVM | `balanceOf(address(this))` in a file with ERC4626 share math | `_decimalsOffset`, virtual shares or assets, dead or minimum shares |
| `solana-pda-validation` | Solana | `find_program_address`, `seeds`, `bump` | |
| `solana-cpi-boundary` | Solana | `invoke_signed`, `invoke(`, `CpiContext` | |
| `access-control` | All | `onlyOwner`, `hasRole`, `authority` | |

## Why these four

- Stale price: oracle freshness keeps costing money in 2026 (Aave CAPO ran on parameters stale for over a year, Ostium accepted future-dated reports). A missing `updatedAt` check is the cheapest freshness bug to catch.
- Signature replay: Dexodus lost about $300K to a replayed signature with no nonce. GiddyVaultV3 lost about $1.3M because only part of the payload was signed.
- ERC4626 donation: Resupply was drained through a donation to an empty ERC4626 vault, and the LlamaLend sDOLA market read `convertToAssets()` with no smoothing.
- tx.origin: old, simple, still shipped.

## Known limits

- Guards are matched anywhere in the file, including comments. A word like `nonce` in a comment silences the replay rule.
- Partial EIP-712 coverage (signing only some fields) is not detected yet.
- Future-dated oracle timestamps (the Ostium pattern, a bound on staleness but none on `timestamp <= block.timestamp`) are not detected yet.
