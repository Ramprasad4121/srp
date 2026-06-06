# Security Reasoning Protocol

Security Reasoning Protocol (SRP) is an AI-native Web3 security operating system for EVM and Solana protocols. It is designed around evidence-first security workflows: intent extraction, vulnerability discovery, adversarial debate, exploit validation, runtime monitoring, and audit-grade reporting.

This repository contains a runnable production-shaped slice with:

- Agent operating system with sequential, parallel, debate, and verification execution modes
- Protocol intent and threat model engine
- EVM and Solana vulnerability discovery heuristics with evidence spans
- DynaDebate confidence reducer
- Proof-of-concept validation classifier
- Runtime monitoring and incident storage
- REST and SSE API with token auth, RBAC, rate limits, and audit logs
- Static security operations dashboard
- Docker and Kubernetes deployment assets
- Node-native TypeScript tests

## Quick Start

```bash
npm test
npm run dev
```

Open `http://localhost:8080` and use the demo token:

```text
srp_demo_admin_token
```

## Example API

```bash
curl -H "authorization: Bearer srp_demo_admin_token" \
  -H "content-type: application/json" \
  -d '{"name":"Vault","chain":"ethereum","documents":[{"path":"README.md","kind":"README","content":"Only GOVERNOR may upgrade the vault."}],"sources":[{"path":"Vault.sol","language":"solidity","content":"contract Vault { function withdraw() external { (bool ok,) = msg.sender.call(\"\"); require(ok); } }"}]}' \
  http://localhost:8080/api/audits
```

See [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md), [docs/deployment.md](docs/deployment.md), [docs/agents.md](docs/agents.md), and [docs/operator.md](docs/operator.md).
