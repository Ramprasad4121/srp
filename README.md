# SRP — Security Reasoning Protocol

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active%20Development-cyan?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Inspiration-OpenClaw-blue?style=for-the-badge" alt="Inspiration" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

> **An army of AI agents for smart contract security. One command. Proven findings.**

SRP is a methodology-faithful autonomous agent framework designed to perform security audits, real-time development feedback, and production monitoring for Ethereum smart contracts.

---

## ⚡ The Vision

> "How does one person ship like a team of twenty? They build an army." — Inspired by Peter Steinberger's **OpenClaw**.

Current human audits cost **$150,000+** and take weeks. SRP aims to deliver the same depth of reasoning for **~$1 in API tokens**, instantly. We don't just "scan" for bugs; our agents **reason**, **trace**, and **prove** vulnerabilities using a multi-phase security methodology.

---

## 🛡️ The SRP Command Suite

```bash
srp onboard   # Interactive setup (OpenClaw style)
srp audit     # Pre-deployment: 13 agents find and prove vulnerabilities
srp dev       # During build: security feedback and workbench for engineers
srp watch     # Live production: real-time monitoring and auto-pause (Coming Soon)
```

---

## 🤖 The Army of Agents

SRP isn't a single LLM prompt. It's a coordinated protocol of specialized agents:

| Agent | Specialty | Output |
| :--- | :--- | :--- |
| **Preparation Agent** | Scope Discovery | `scope_map`, `actor_list` |
| **Recon Agent** | Intent Analysis | `intent_statement` |
| **Architecture Agent** | Trust Boundaries | `trust_boundary_map`, `value_flow_map` |
| **NatSpec Agent** | Documentation | Inline code comments & documentation |
| **Test Gen Agent** | Exploit Proofs | Foundry/Hardhat test suites |
| **Explain Agent** | Logic Synthesis | Protocol walkthroughs & summaries |

---

## 🚀 Quickstart

### 1. Install
Requires Node.js 18+, pnpm 8+, and [Foundry](https://getfoundry.sh).

```bash
git clone https://github.com/Ramprasad4121/srp
cd srp
pnpm install
./setup.sh
```

### 2. Onboard
Run the interactive wizard to configure your risk profile and LLM providers.
```bash
srp onboard
```

### 3. Audit
Point SRP at any Solidity project directory.
```bash
srp audit
```

---

## 🛠️ Provider Configuration

SRP supports a wide range of providers to ensure maximum reasoning depth:
- **Anthropic** (Claude 3.5 Sonnet / Opus) — *Recommended*
- **OpenAI** (GPT-4o)
- **OpenRouter** (DeepSeek, Llama 3)
- **Mock Mode** — Run without API keys for toolchain testing (`SRP_TOOLCHAIN_MODE=mock`)

---

## ⚠️ Disclaimer

**SRP is under active development.** It is a powerful tool that performs deep analysis and can execute toolchain commands. Always run in a safe environment. Do not use for final production sign-offs until the official 1.0 announcement.

---

## 📜 License & Credits

Built with ❤️ by [@0xramprasad](https://x.com/0xramprasad).

Inspired by the speed and autonomy of [OpenClaw](https://github.com/openclaw/openclaw). Part of the next generation of personal security agents.
