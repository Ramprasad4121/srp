# MCP server

SRP speaks the Model Context Protocol over stdio (JSON-RPC 2.0, one message per line), so Claude Code, Claude Desktop, Cursor, Codex, and other MCP clients can call it.

```bash
node /path/to/srp/apps/cli/src/cli.ts mcp
```

Claude Code:

```bash
claude mcp add srp -- node /path/to/srp/apps/cli/src/cli.ts mcp
```

Claude Desktop / Cursor (`mcpServers` config):

```json
{ "mcpServers": { "srp": { "command": "node", "args": ["/path/to/srp/apps/cli/src/cli.ts", "mcp"], "env": { "SRP_MCP_ROOT": "/path/to/your/project" } } } }
```

## Tools

| Tool | What it does |
| --- | --- |
| `srp_scan_path` | Scan a project or file under `SRP_MCP_ROOT` (default: the working directory). Returns `srp.summary/v1`. |
| `srp_scan_source` | Scan inline source, e.g. code the agent just wrote. |
| `srp_get_finding` | Full finding: evidence, facts, debate rounds, validation, generated harness. |
| `srp_attach_proof` | Record a PoC or test the agent actually ran. A passing run marks the finding `proven`. |
| `srp_coverage` | Coverage and residual unknowns for a scan. |
| `srp_export_evidence` | `srp.evidence-bundle/v1` with a sha256 digest. |
| `srp_explain_detector` | What a detector looks for. |
| `srp_capabilities` | Analyzers, detectors, local tools, what is not built. |

## Rules the server gives agents

The `initialize` result carries instructions: findings are static leads with cited lines; read `srp_coverage` before calling code safe; call a finding proven only after `srp_attach_proof` with a passing run.

## Limits

- Paths outside `SRP_MCP_ROOT` are refused.
- Scans are kept in memory for the session (last 50); `auditId` does not survive a restart.
- Tools only (no resources or prompts yet).
