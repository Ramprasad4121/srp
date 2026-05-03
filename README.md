# SRP — Security Reasoning Protocol

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active%20Development-cyan?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Node-24+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

> **An army of AI agents for smart contract security. One command. Proven findings.**

SRP is an agentic factory platform for web3. It runs a methodology-faithful audit pipeline against any Solidity codebase, injects curated security knowledge at each phase via BM25 retrieval, and gives you findings with exploit paths — not just warnings.

---

## The vision

Current human audits cost **$150,000+** and take weeks. SRP delivers the same depth of reasoning for **~$1 in API tokens**, instantly. Agents don't scan — they **reason**, **trace**, and **prove** vulnerabilities using a structured security methodology backed by the [pashov/ai-web3-security](https://github.com/pashov/ai-web3-security) knowledge base.

---

## Quickstart

**Requirements:** Node.js 24+, pnpm 10+

```bash
git clone https://github.com/Ramprasad4121/srp
cd srp
pnpm install
pnpm build
```

Set your LLM provider key:

```bash
export OPENAI_API_KEY=sk-...       # OpenAI / any OpenAI-compatible endpoint
# or
export ANTHROPIC_API_KEY=...       # Claude
```

Run your first audit:

```bash
srp audit ./path/to/your/protocol
```

---

## Command suite

```bash
srp audit     # Full security audit — Map → Hunt → Attack → Verify → Report
srp dev       # Real-time security feedback while you build
srp learn     # AI-guided education on Ethereum and Solana
srp setup     # Interactive configuration wizard
srp project   # Manage named audit projects
```

### Project management

```bash
srp project list             # Show all projects
srp project current          # Show active project
srp project create "my-audit"
srp project use <id>
```

---

## Audit pipeline

SRP runs the **Map → Hunt → Attack → Verify** methodology, sourced from [Archethect/sc-auditor](https://github.com/Archethect/sc-auditor). Each phase is a specialized sub-agent call with its own prompt, tool set, and structured JSON output.

| Phase | What the agent does |
|-------|---------------------|
| **Setup** | Defines scope, runs static analysis (Slither, Aderyn), builds a checklist |
| **Map** | Reads every contract — produces a full system map of components, surfaces, state, and auth |
| **Hunt** | Runs 6 parallel hunt lanes: adversarial deep, accounting/entitlement, callback liveness, semantic consistency, oracle/token statefulness, economic differential |
| **Attack** | Digs into top-ranked hotspots — builds exploit chains and generates Foundry PoC tests |
| **Verify** | Skeptic + judge review — filters false positives, confirms severity and exploitability |
| **Report** | Formal markdown report with findings grouped by severity, mitigations, and toolchain summary |

### Retrieval-augmented phases

Before each phase executes, SRP queries the knowledge base for the most relevant security skills and injects them into the model's context:

```
Phase: audit-attack
  → BM25 query: "attack vectors exploit approval-abuse callback-grief reentrancy rounding oracle"
  → Top matches: av-approval-abuse, av-callback-grief, av-rounding-entitlement, hunt-adversarial-deep
  → Injected as structured excerpts into the agent's system prompt
  → Model reasons with proven attack patterns, not general training data
```

---

## Security knowledge base

13 curated skills are pre-loaded from the pashov/ai-web3-security hub, stored as structured `SKILL.md` files under `skills/`.

| Skill | Type | What it covers |
|-------|------|----------------|
| `security-auditor` | Orchestrator | Full Map-Hunt-Attack protocol, agent dispatch rules, checkpoint discipline |
| `solidity-auditor` | Orchestrator | 8-agent parallel approach: vector-scan, math-precision, access-control, economic, invariant… |
| `av-approval-abuse` | Attack vector | Unlimited ERC-20 approvals, race conditions, proxy drain patterns |
| `av-callback-grief` | Attack vector | ERC-777 hooks, reentrancy, cross-function reentry, read-only reentrancy |
| `av-rounding-entitlement` | Attack vector | Integer truncation, ERC-4626 share inflation, fee accumulation errors |
| `av-semantic-drift` | Attack vector | Spec vs implementation divergence, state machine violations |
| `av-entitlement-drift` | Attack vector | Access control decay, role propagation bugs, privilege escalation |
| `hunt-adversarial-deep` | Hunt pattern | Enumerates every external call site, stress-tests invariants under worst-case inputs |
| `hunt-accounting-entitlement` | Hunt pattern | Balance deltas, fee distributions, share calculations, entitlement overflow |
| `hunt-callback-liveness` | Hunt pattern | Reentrancy paths, reverting hooks, DoS via external call dependency |
| `hunt-semantic-consistency` | Hunt pattern | Invariants across all code paths, cross-contract semantic drift |
| `hunt-token-oracle-statefulness` | Hunt pattern | Oracle staleness, price manipulation, flash-loan attack vectors |
| `hunt-economic-differential` | Hunt pattern | Incentive modeling, MEV exposure, arbitrage paths, profit-extraction vectors |

### Update skills

```bash
# Fetch latest from GitHub (idempotent, safe to re-run)
node scripts/ingest-skills.mjs

# Preview without writing
node scripts/ingest-skills.mjs --dry-run
```

---

## Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **OpenAI** | gpt-4o, gpt-4-turbo | Default |
| **Anthropic** | claude-3-5-sonnet, claude-3-opus | Best for long context |
| **OpenRouter** | DeepSeek, Llama 3, Mistral | Cost-effective |
| **Mock** | — | `NODE_ENV=test` — runs full pipeline without API keys |

---

## Architecture

```
srp/
├── apps/
│   ├── gateway/         HTTP API + SSE — audit pipeline runtime, project persistence
│   ├── cli/             srp CLI (audit, dev, learn, setup, project)
│   ├── web/             React frontend — audit room, dashboard
│   └── worker/          Background job processor
├── packages/
│   ├── skills/          BM25 search engine (no external deps) + skill loader
│   ├── project-memory/  Project entity, ProjectStore, on-disk persistence, migration
│   ├── shared-types/    Canonical TypeScript types
│   ├── methodology/     Audit phase definitions and playbook
│   ├── agents/          Agent base classes and registry
│   ├── cache/           Inference cache (key/value)
│   └── ...              (config, events, sessions, security, providers, diagram-engine)
├── skills/              Runtime knowledge base (13 skills + prompt assets)
└── scripts/
    └── ingest-skills.mjs   Re-seed skills/ from pashov hub
```

### On-disk layout

```
.srp/
├── projects.json              Registry + active project ID
└── projects/
    └── <projectId>/
        └── runs/
            └── <runId>/
                ├── artifacts/ Intelligence artifacts per phase
                └── events/    Audit event log
```

---

## Gateway API

The gateway (`apps/gateway`) runs on `PORT` and exposes:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/runtime/start` | Start an audit session |
| `GET` | `/api/events` | SSE stream — real-time phase updates |
| `GET` | `/api/runs` | List audit runs |
| `GET` | `/api/runs/:id/projection` | Audit room state snapshot |
| `GET` | `/api/skills` | List all loaded security skills |
| `GET` | `/api/skills/:id` | Full skill content |
| `POST` | `/api/chat` | Chat with the security intelligence engine |

---

## Testing

No API key is required for the core test suite.

```bash
# BM25 retrieval — 25 tests
node --test packages/skills/dist/__tests__/bm25-index.test.js

# Skills catalog — live skill loading + HTTP endpoint
node --test tests/smoke/skills-catalog.test.mjs

# Project memory
node --test tests/project-memory/store.test.mjs
node --test tests/project-memory/migrate.test.mjs

# Gateway runtime
node --test tests/gateway/runtime-registry.test.mjs
node --test tests/smoke/persistence.test.mjs

# Full typecheck
pnpm typecheck
```

> Tests that run the live audit pipeline (full-integration, phase tests) require a valid API key.

---

## Roadmap

- [x] Phase 1 — Project-scoped persistence, RuntimeRegistry, CLI
- [x] Phase 2 — pashov/ai-web3-security knowledge base + BM25 RAG
- [ ] Phase 3 — Learning platform (personalized ETH/Solana education)
- [ ] Phase 4 — DeFi builder agents (write, test, deploy contracts on-chain)
- [ ] Phase 5 — Canonical audit graph + deterministic projection
- [ ] Phase 6 — Live production monitoring (`srp watch`)

---

## Disclaimer

**SRP is under active development.** It performs deep analysis and can execute toolchain commands (Slither, Aderyn, Foundry). Always run in a safe environment. Do not use as the sole basis for a production security sign-off.

---

Built by [@0xramprasad](https://x.com/0xramprasad). Part of the next generation of personal security agents.
