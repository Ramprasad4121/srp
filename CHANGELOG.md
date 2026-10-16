# Changelog

## Unreleased

- Rate limiting behind a proxy: opt-in `SRP_TRUST_PROXY` (hop count, or `true` for 1) keys anonymous clients on the trusted `X-Forwarded-For` entry. Off by default, so a spoofed header changes nothing. Subject and IP buckets no longer share a namespace.
- Build: `npm run build` compiles to dist/*.js with tsc (dev dependency only, zero runtime deps). `bin` now points at dist, so `npx srp scan` works from an installed tarball. `npm run test:pack` packs, installs and scans in a temp project, and runs in CI.
- Fix: the CLI and MCP entry check follows symlinks, so the bin shim in node_modules/.bin starts correctly.

### Fixed (honesty)
- Intent "security guarantees" were built by splitting source code on periods, so fragments like `sender.call(...)` showed up as guarantees. Sentences now come only from documents and NatSpec / doc comments.
- Generic assumptions and invariants SRP adds on its own are labelled `Inferred:` instead of reading as extracted from the protocol.
- `OrchestrationEngine.execute("debate" | "verification")` silently ran agents sequentially. It now throws; the audit pipeline uses `runDynaDebate` and `validateFindings` for those steps.
- Incidents could never be acknowledged or resolved, so protocol health stayed critical forever. `POST /api/incidents/{id}` sets the status.


### Added (CLI and MCP)
- `srp scan [path]`: zero-config scan of Foundry, Hardhat, and Anchor projects (framework and chain detection, skips lib/test/build output, size and count limits reported as unknowns), formats text / summary / json / sarif / md, `--fail-on` exit codes. Also `doctor`, `explain`, `verify-bundle`.
- `srp mcp`: dependency-free MCP server on stdio with 8 tools (scan path, scan source, get finding, attach proof, coverage, export evidence, explain, capabilities). Path access confined to `SRP_MCP_ROOT`.
- `srp.summary/v1`: compact per-finding JSON for agents and CI.

### Fixed
- Missing-access-control fired on per-caller settings such as `isOperator[msg.sender][x] = approved` (solmate ERC6909).
- The same residual unknown was repeated per file (285 lines on OpenZeppelin); identical gaps are now grouped with a file list.
- Echidna, Certora, audits, fuzz, and invariant directories are skipped by default like tests.

### Changed
- Findings with weak static evidence are `unverified` instead of `failed`. `failed` now only means an attached test run did not pass.
- `engines.node` is `>=22.18` (type stripping on by default), matching what CI and the CLI need.


### Security
- Auth bypass: tokens were looked up with `DEMO_TOKENS[token]`, so `Authorization: Bearer constructor` (or `toString`, `__proto__`) authenticated and passed every role check, including the admin audit log. Lookups now use own properties only.
- Demo admin tokens were always on, including in the Docker image. They are now off when `NODE_ENV=production` unless `SRP_ALLOW_DEMO_TOKENS=1`; real tokens come from `SRP_TOKENS`.
- SSE query tokens were written to the audit log in clear text. They are masked.
- Static file guard used a bare prefix check; it now requires the web root plus a path separator.

### Fixed (API and deploy)
- Invalid JSON or missing fields returned `500` with a raw TypeError; an unknown chain was accepted with `201`. Now `400` with every problem listed.
- No request body limit (`413` over 5 MB now).
- The Docker image bound `127.0.0.1`, so `docker run -p 8080:8080` was unreachable. It now listens on `0.0.0.0`, runs as `node`, and keeps state in `/data`.
- Kubernetes ran 2 replicas over a per-pod JSON file, so audits split between pods. Now 1 replica with a PVC, token secret, and a restricted security context.
- Concurrent writes could interleave in the JSON store. Writes are serialized and atomic.
- Runtime health was computed from memory and reset on restart. It now comes from stored incidents. Signals are validated.
- The dashboard's "Active Agents" panel was static text and the admin token was prefilled. It now shows pipeline stages from SSE, coverage, unknowns, evidence lines, and asks for a token.

### Added (API)
- `GET /api/capabilities` (doctor), `POST /api/audits/{id}/proofs`, `GET /api/audits/{id}/evidence` and `POST /api/evidence-bundles/verify`, `GET /api/reports/{id}.sarif`.
- SSE `audit.started`, `audit.stage`, `audit.completed`, `audit.proved`, and heartbeats.
- `createSrpServer()` so the API is testable; 11 API tests including SSE.


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
