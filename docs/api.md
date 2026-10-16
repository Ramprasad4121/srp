# API

All responses are JSON unless noted. Reports follow `schemaVersion: "srp.audit/v1"`; breaking changes bump it.

## Authentication

Bearer tokens. Configure them with `SRP_TOKENS="token:role:subject,token2:role2:subject2"` (tokens at least 16 characters, roles `admin`, `auditor`, `viewer`).

Local demo tokens (`srp_demo_admin_token`, `srp_demo_auditor_token`, `srp_demo_viewer_token`) are accepted only when `NODE_ENV` is not `production`, or when `SRP_ALLOW_DEMO_TOKENS=1`. The Docker image sets `NODE_ENV=production`, so it starts with no demo tokens.

The SSE endpoint also accepts `?token=` because `EventSource` cannot send headers. Query tokens are masked in the audit log.

## Endpoints

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | public | |
| GET | `/api/capabilities` | public | analyzers, detectors, chains, local tools (forge, anchor), what is not built |
| GET | `/api/openapi.json` | public | |
| GET | `/api/events` | viewer | SSE: `ready`, `audit.started`, `audit.stage`, `audit.completed`, `audit.proved`, `incident.created`, `: heartbeat` comments every 15 s |
| GET | `/api/audits` | viewer | summaries |
| POST | `/api/audits` | auditor | run an audit; `400` with `details` on invalid input, `413` over 5 MB |
| GET | `/api/audits/{id}` | viewer | full report |
| POST | `/api/audits/{id}/proofs` | auditor | attach locally executed PoC results; a passing proof marks the finding `proven` |
| GET | `/api/audits/{id}/evidence` | viewer | evidence bundle `srp.evidence-bundle/v1` with sha256 digest |
| POST | `/api/evidence-bundles/verify` | viewer | `200 {valid:true}` or `422` if the digest or schema is wrong |
| GET | `/api/reports/{id}.md` | viewer | markdown report |
| GET | `/api/reports/{id}.sarif` | viewer | SARIF 2.1.0 |
| POST | `/api/signals` | auditor | runtime signal you post (SRP does not watch chains itself) |
| GET | `/api/incidents` | viewer | |
| POST | `/api/incidents/{id}` | auditor | `{ "status": "acknowledged" | "resolved" | "open" }` |
| GET | `/api/audit-log` | admin | last 10,000 entries |

Rate limit: 240 requests per minute per subject (or IP when unauthenticated), `429` with `retry-after`. Behind a proxy, set `SRP_TRUST_PROXY` (see deployment.md) so the client IP comes from `X-Forwarded-For`.

## Audit request

```json
{
  "name": "Vault",
  "chain": "ethereum",
  "documents": [{ "path": "README.md", "kind": "README", "content": "Only GOVERNOR may upgrade the vault." }],
  "sources": [{ "path": "Vault.sol", "language": "solidity", "content": "contract Vault { ... }" }],
  "proofs": []
}
```

`chain` is one of `ethereum`, `arbitrum`, `optimism`, `base`, `polygon`, `avalanche`, `solana`.

## Proof request

```json
{ "proofs": [{ "findingId": "finding_...", "command": "forge test --match-test test_reenter_withdraw", "passed": true, "assertion": "attacker drained 10 ETH with 1 ETH deposited", "output": "optional log" }] }
```
