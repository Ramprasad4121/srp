# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
# Install development dependencies
pip install -e .

# Run the CLI
srp audit    # Scan and audit contracts
srp dev      # Developer mode with real-time feedback
srp watch    # Live monitoring (coming soon)

# Development tools
srp graph    # Build Security Reasoning Graph
srp status   # Check system status
srp traces   # View audit history
```

## Project Architecture

SRP is a security-focused smart contract analysis framework built around a multi-agent system. The architecture follows a layered design:

- **CLI Layer** (`src/srp/cli/srp.py`): FastAPI-based dashboard with command-line interface
- **Core Layer** (`src/srp/core/`): Project detection, configuration management, and orchestration
- **Agent Layer** (`src/srp/agents/`): Specialized AI agents for security analysis, divided into:
  - Audit agents (amm, bridge, crosschain, governance, lending, etc.)
  - Development agents (access control, gas optimization, testing)
  - Attack agents (flashloan, oracle manipulation, reentrancy)
  - Intelligence agents (recon, threat intel, graph analysis)
- **Engine Layer**: Debate engine, evolution engine, exploit generator for complex analysis

## Key Patterns

- **Multi-agent orchestration**: Uses OpenAI/NVIDIA APIs to deploy specialized agents
- **Security Reasoning Graph (SRG)**: Visual representation of contract relationships and vulnerabilities
- **Foundry integration**: Requires Foundry for Solidity compilation and testing
- **Dashboard-based UI**: All operations served through localhost:7337 (audit) or 7338 (dev)

## Development Workflow

1. Initialize in project: `srp init`
2. Run audit: `srp audit` (auto-scans and launches dashboard)
3. View results in browser at http://localhost:7337
4. Use `srp graph` for SRG analysis
5. Check status with `srp status`

## Important Files

- `src/srp/core/project.py`: Project initialization and configuration
- `src/srp/cli/srp.py`: Main CLI and dashboard launcher
- `src/srp/agents/`: All agent implementations organized by category
- `.srp/`: Runtime data directory (config, audits, traces, reports)

## Testing

SRP uses Foundry for smart contract testing. The project structure supports:
- `tests/` directory for unit tests
- Foundry contracts for integration testing
- Manual testing via the dashboard UI

## Dependencies

- Python 3.11+ required
- FastAPI, Uvicorn for web dashboard
- OpenAI/NVIDIA APIs for AI agents
- Web3.py for blockchain interaction
- NetworkX for graph analysis
- Rich for terminal UI components

## Security Notes
SRP handles sensitive blockchain data and API keys. All secrets should be stored in `.env` files and excluded from version control via `.gitignore`.

## gstack Integration

### Installation
```bash
# Already installed in ~/.claude/skills/gstack
# Run setup if needed: cd ~/.claude/skills/gstack && ./setup
```

### Usage Guidelines
- Use the `/browse` skill from gstack for all web browsing tasks
- Never use mcp__claude-in-chrome__* tools
- For Chrome automation, use `/connect-chrome` instead

### Available gstack Skills
- /office-hours: YC-style startup consultation
- /plan-ceo-review: CEO/founder-mode plan review
- /plan-eng-review: Engineering manager plan review
- /plan-design-review: Designer's eye plan review
- /design-consultation: Complete design system proposal
- /design-shotgun: Generate multiple design variants
- /design-html: Design to HTML conversion
- /review: Pre-landing PR review
- /ship: Ship workflow (detect, test, review, deploy)
- /land-and-deploy: Merge PR + verify production health
- /canary: Post-deploy monitoring
- /benchmark: Performance regression detection
- /browse: Fast headless browser for QA testing
- /connect-chrome: Real Chrome controlled by gstack
- /qa: Systematic QA testing and bug fixing
- /qa-only: Report-only QA testing
- /design-review: Designer's eye visual QA
- /setup-browser-cookies: Import cookies from real Chrome
- /setup-deploy: Configure deployment settings
- /retro: Weekly engineering retrospective
- /investigate: Systematic debugging with root cause analysis
- /document-release: Post-ship documentation updates
- /codex: OpenAI Codex CLI wrapper
- /cso: Chief Security Officer mode
- /autoplan: Auto-review pipeline with sequential skills
- /careful: Safety guardrails for destructive commands
- /freeze: Restrict file edits to specific directory
- /guard: Full safety mode (destructive warnings + directory scope)
- /unfreeze: Clear freeze boundary
- /gstack-upgrade: Upgrade gstack to latest version
- /learn: Manage project learnings

### Troubleshooting
If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.

## Also Add to Project?

Yes - gstack has been added to the project as a development dependency. All teammates will get it automatically when they install the project with development dependencies:

```bash
pip install -e ".[dev]"
```

See the README.md for usage instructions and available gstack skills.

### Quick gstack Commands

```bash
# Use skills with /skill-name
/browse         # Fast headless browser for QA testing
/office-hours    # YC-style startup consultation
/plan-ceo-review # CEO/founder-mode plan review
/ship           # Ship workflow (detect, test, review, deploy)
/review         # Pre-landing PR review
/investigate    # Systematic debugging with root cause analysis
```