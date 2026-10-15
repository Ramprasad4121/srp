# CLI

Zero config: point it at a Foundry, Hardhat, or Anchor project.

```bash
node apps/cli/src/cli.ts scan .                 # from a clone of this repo, Node >= 22.18
npm run scan -- path/to/project --format sarif --out srp.sarif
```

`npx srp` is not published yet (see the roadmap: the package needs a compiled build because Node does not strip types inside node_modules).

## What it scans

- Chain is detected: `Anchor.toml` or a Solana `Cargo.toml` means Solana (`.rs`), otherwise EVM (`.sol`). Override with `--chain`.
- Skipped by default: `lib/`, `node_modules/`, `out/`, `cache/`, `target/`, build output, `test/`, `script/`, `mocks/`, `*.t.sol`, `*.s.sol`. Use `--include-tests` to scan tests too.
- Files over 1 MB or past 2,000 files are skipped and listed as residual unknowns, never silently dropped.
- The project README is read as a protocol document for intent extraction.

## Output

| `--format` | Use |
| --- | --- |
| `text` (default) | terminal |
| `summary` | `srp.summary/v1` JSON, one compact record per finding, for agents and scripts |
| `json` | full `srp.audit/v1` report |
| `sarif` | SARIF 2.1.0 for GitHub code scanning |
| `md` | markdown report with debate, validation, and generated Foundry harnesses |

## Exit codes

`0` nothing at or above `--fail-on` (default `high`), `1` findings at or above it, `2` usage or input error. Severity for gating is the detector's proposed severity, so an unproven critical still fails the build.

## Other commands

- `srp doctor [--json]`: analyzers, detectors, chains, and whether `forge` / `anchor` are installed.
- `srp explain <detector-id>`
- `srp verify-bundle <file>`: check an evidence bundle's schema and sha256 digest.
- `srp mcp`: MCP server on stdio (see docs/mcp.md).
