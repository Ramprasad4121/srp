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