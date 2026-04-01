# SRP — Security Reasoning Protocol

> AI agent army for smart contract security. One command. Proven findings.

> [!IMPORTANT]  
> SRP is under active development,do not use it until official announcement.
> 

```bash
srp audit    # pre-deployment: 13 agents find and prove vulnerabilities
srp dev      # during build: security feedback as you write code
srp watch    # live production: real-time monitoring and auto-pause
```

**~$1 in API tokens. $150,000 is what a human audit costs.**

---

## Status

| Tool | Status |
|------|--------|
| `srp audit` | ✅ Working |
| `srp dev` | 🔨 In Progress |
| `srp watch` | 📋 Coming Soon |

---

## Quickstart

```bash
git clone https://github.com/Ramprasad4121/srp
cd srp
pip install -e .

# Add your LLM API key to .env
cp .env.example .env

# Run from your Solidity project
cd your-project
srp audit
```

Requires Python 3.11+ and [Foundry](https://getfoundry.sh).

---



## License

MIT · Built by [@0xramprasad](https://x.com/0xramprasad)

## Development Tools

This project includes gstack for enhanced development workflows:

```bash
# Install with development dependencies
pip install -e ".[dev]"

# Available gstack skills (use /skill-name):
# /browse, /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
# /design-consultation, /design-shotgun, /review, /ship, /land-and-deploy,
# /canary, /benchmark, /connect-chrome, /qa, /qa-only, /design-review,
# /setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release,
# /codex, /cso, /autoplan, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade
```

For web browsing tasks, use the `/browse` skill from gstack and avoid mcp__claude-in-chrome__* tools.