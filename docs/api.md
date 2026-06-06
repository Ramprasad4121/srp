# API

Authentication uses bearer tokens. Local demo tokens:

- `srp_demo_admin_token`
- `srp_demo_auditor_token`
- `srp_demo_viewer_token`

## Endpoints

- `GET /api/health`: service status
- `GET /api/openapi.json`: OpenAPI document
- `GET /api/events`: SSE stream
- `GET /api/audits`: list audits
- `POST /api/audits`: run an audit
- `GET /api/audits/{id}`: fetch audit JSON
- `GET /api/reports/{id}.md`: fetch markdown report
- `POST /api/signals`: ingest runtime signal
- `GET /api/incidents`: list incidents
- `GET /api/audit-log`: admin audit log

## Audit Request

```json
{
  "name": "Vault",
  "chain": "ethereum",
  "documents": [
    { "path": "README.md", "kind": "README", "content": "Only GOVERNOR may upgrade the vault." }
  ],
  "sources": [
    { "path": "Vault.sol", "language": "solidity", "content": "contract Vault {}" }
  ]
}
```
