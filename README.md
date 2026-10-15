# Security Reasoning Protocol

Security Reasoning Protocol (SRP) is an AI-native Web3 security operating system for EVM and Solana protocols. It is designed around evidence-first security workflows: intent extraction, vulnerability discovery, adversarial debate, exploit validation, runtime monitoring, and audit-grade reporting.

## What works today

- Solidity structural analysis: per-function index (visibility, modifiers, parameters, state writes) driving reentrancy (checks-effects-interactions), missing access control, unprotected UUPS upgrade, arbitrary delegatecall, and arbitrary external call detectors.
- Anchor (Solana) analysis: account constraint checks for missing signer, missing `has_one`, unchecked owner, account data matching, type cosplay, arbitrary CPI, sysvar spoofing, duplicate mutable accounts, `init_if_needed`, manual close, and non-canonical bumps.
- EVM pattern rules with guards: stale Chainlink price, AMM spot price, `tx.origin` auth, signature replay, ERC4626 donation.
- Evidence records on every finding: file, line range, raw excerpt, analyzer, operation, observed/derived kind, and a deterministic `ev_` id.
- DynaDebate: deterministic attacker / defender / judge rounds that argue over the cited lines and structural facts (reachability, ordering, mitigations).
- Proof step: generated Foundry harnesses; a finding is `proven` only when you attach a passing local test result. Unproven high/critical findings are held at medium.
- Coverage and residual unknowns in every report, so SRP says what it could not analyze.
- REST + SSE API with token auth, RBAC, rate limits, audit log, SARIF and evidence-bundle export, proof attachment, and a capabilities (doctor) endpoint; static dashboard; Docker and Kubernetes manifests; Node-native tests.
- Runtime monitoring: threshold incidents from signals you post to the API. SRP does not watch mempools or chains itself yet.
- Results on public fixtures, including misses: [docs/eval.md](docs/eval.md).

## Not built yet (planned)

- No LLM reasoning. "AI-native" is the direction; today every step is deterministic and offline. Model-backed triage is on the roadmap.
- No exploit execution inside SRP. Run the generated harness with `forge test` and attach the result.
- No cross-file analysis (inheritance, imports, cross-contract calls).
- The agent registry and orchestration engine exist as a library but the audit pipeline does not run through them yet.
- MCP adapters, PostgreSQL / Redis storage, and real identity are not built; demo tokens and a JSON file store are for local use only.

## Quick Start

```bash
npm test
npm run dev
```

Open `http://localhost:8080` and paste the local demo token (demo tokens are disabled when `NODE_ENV=production`; set `SRP_TOKENS` there):

```text
srp_demo_admin_token
```

## Example API

```bash
curl -H "authorization: Bearer srp_demo_admin_token" \
  -H "content-type: application/json" \
  -d '{"name":"Vault","chain":"ethereum","documents":[{"path":"README.md","kind":"README","content":"Only GOVERNOR may upgrade the vault."}],"sources":[{"path":"Vault.sol","language":"solidity","content":"contract Vault { mapping(address => uint256) balances; function withdraw() external { (bool ok,) = msg.sender.call{value: balances[msg.sender]}(\"\"); require(ok); balances[msg.sender] = 0; } }"}]}' \
  http://localhost:8080/api/audits
```

See [docs/eval.md](docs/eval.md), [docs/detectors.md](docs/detectors.md), [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md), [docs/deployment.md](docs/deployment.md), [docs/agents.md](docs/agents.md), and [docs/operator.md](docs/operator.md).
