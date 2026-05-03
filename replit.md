# SRP — Security Reasoning Protocol

**Vision:** The single destination for anyone in web3 — learn, build, and audit Ethereum and Solana. Developers use SRP to write production-quality smart contracts; auditors use it to find bugs; learners use it as a personalized AI instructor. No need to go anywhere else.

---

## Repository layout

```
apps/
  gateway/        HTTP gateway — audit pipeline runtime, project-scoped persistence
  cli/            srp CLI — audit, dev, setup, project commands
  web/            React frontend (web UI, audit room)
packages/
  project-memory/ Project entity, ProjectStore, ProjectMemory, migration
  shared-types/   Canonical TypeScript types across all packages
  methodology/    Audit phase definitions and playbook
  config/         Setup manifest loading
  cache/          Key/value cache
  skills/         Skills catalog (agent knowledge) + BM25 retrieval
  providers/      AI provider clients
  sessions/       Session types
  security/       Security utilities
skills/           Runtime security knowledge base (populated by ingest-skills.mjs)
  security-auditor/   Archethect/sc-auditor: Map-Hunt-Attack orchestrator + prompt assets
  solidity-auditor/   pashov/skills: 8-agent parallel audit methodology
  av-approval-abuse/  Attack vector: ERC-20 approval abuse
  av-callback-grief/  Attack vector: reentrancy/callback grief
  av-rounding-entitlement/  Attack vector: integer rounding / ERC-4626 share inflation
  av-semantic-drift/  Attack vector: spec vs implementation drift
  av-entitlement-drift/  Attack vector: access control decay
  hunt-adversarial-deep/   Hunt pattern: adversarial deep
  hunt-accounting-entitlement/ Hunt pattern: accounting/entitlement
  hunt-callback-liveness/  Hunt pattern: callback liveness/DoS
  hunt-semantic-consistency/ Hunt pattern: semantic consistency
  hunt-token-oracle-statefulness/ Hunt pattern: oracle/token statefulness
  hunt-economic-differential/ Hunt pattern: economic differential/MEV
tests/
  smoke/          Integration/smoke tests (per-file, node --test)
  project-memory/ Unit tests for @srp/project-memory
  gateway/        Unit tests for gateway internals (runtime-registry)
scripts/
  ingest-skills.mjs  Fetch + seed skills/ from pashov/ai-web3-security hub
```

---

## Key architecture decisions

### Phase 1 — DONE (foundation)

**Project as a first-class entity:**
- `@srp/project-memory` package owns `Project`, `ProjectStore`, `ProjectMemory`, and `migrateLegacyLayout`.
- On-disk layout: `.srp/projects/<projectId>/runs/<runId>/...`
- Registry: `.srp/projects.json` with `activeProjectId`.
- Migration: legacy `.srp/runs/` is moved automatically to `default-project` on first boot — idempotent.

**RuntimeRegistry replaces the singleton:**
- `apps/gateway/src/runtime/runtime-registry.ts` — `RuntimeRegistry` keyed by `projectId`.
- Each entry holds its own `KnowledgeBus`, `AgentRegistry`, `AuditRoomProjector`, phase states, artifacts, persistence, and abort controller.
- `session-manager.ts` is now a thin facade over `runtimeRegistry`; all public functions accept an optional `projectId`.
- Zero module-level mutable `let` bindings for runtime state.

**PersistenceManager is project-scoped:**
- Constructor: `(rootDirectory, projectId, outputDirectory?)`.
- Writes under `.srp/projects/<projectId>/runs/`.

**Gateway handlers wire projectId:**
- All routes accept `?projectId=` query param; default resolves via `ProjectStore.getActive()`.

**CLI `srp project` commands:**
- `srp project list`, `current`, `use <id>`, `create <name>`.

### Phase 2 — DONE (pashov/ai-web3-security knowledge base)

**Skills knowledge base (`skills/`):**
- 13 security skills seeded from the pashov/ai-web3-security hub.
- Sources: Archethect/sc-auditor (Map-Hunt-Attack methodology + all prompt assets), pashov/skills (8-agent parallel approach), 5 attack-vector docs, 6 hunt-pattern prompts.
- `skills/security-auditor/assets/prompts/` contains the full sc-auditor prompt assets used directly by `executeAuditPhase`.
- Re-seed any time with: `node scripts/ingest-skills.mjs`

**BM25 retrieval (`@srp/skills`):**
- `packages/skills/src/bm25-index.ts` — pure-TypeScript Okapi BM25 (k₁=1.5, b=0.75), no external deps.
- `packages/skills/src/skill-retriever.ts` — `searchSkills(query, topK, skills[])` and `formatSkillsForPrompt(skills, maxChars)`.
- 25 unit tests covering tokenizer, index build, query scoring, and formatting.

**Skill catalog with search:**
- `apps/gateway/src/runtime/skills-catalog.ts` exports `searchSkills(query, topK)` and `retrieveSkillContext(query, topK, maxChars)`.
- Root detection uses `pnpm-workspace.yaml` as a marker — works in any working directory.
- Module-level cache: skills loaded once per process, invalidatable via `invalidateSkillsCache()`.

**RAG injection into audit pipeline (`inference-bridge.ts`):**
- `executeAuditPhase` — maps each phase to a BM25 query (`PHASE_SKILL_QUERIES`), retrieves top-4 skills (1200 chars each), injects between the prompt template and context JSON.
- `generateInvariants` — retrieves top-3 invariant/economic/access-control skills, injects into prompt.
- `streamChatResponse` — retrieves top-3 skills for the user's message, injects into system prompt (replaces "1074 skills" placeholder).
- `generateChatResponse` — same per-message RAG, injected into CONTEXT section.

---

## Development

```bash
pnpm install          # install all deps (requires Node 24, pnpm 10.x)
pnpm build            # tsc -b (composite libs + leaf packages)
pnpm typecheck        # full check including leaf packages

# Re-ingest security skills from GitHub
node scripts/ingest-skills.mjs
node scripts/ingest-skills.mjs --dry-run   # preview without writing

# BM25 unit tests
node --test packages/skills/dist/__tests__/bm25-index.test.js

# Smoke tests (no API key required)
node --test tests/gateway/runtime-registry.test.mjs
node --test tests/project-memory/store.test.mjs
node --test tests/project-memory/migrate.test.mjs
node --test tests/smoke/persistence.test.mjs
node --test tests/smoke/skills-catalog.test.mjs
node --test tests/smoke/monorepo-foundation.test.mjs
node --test tests/smoke/runtime-stores.test.mjs
```

### .npmrc note
`manage-package-manager-versions=false` is set so system pnpm (10.26.1) does not try to download the `packageManager` pinned version (10.6.5) — that download hangs in this environment.

---

## Roadmap

1. **Phase 3 — Learning platform** — personalized AI-driven education on ETH/Solana.
2. **Phase 4 — DeFi builder agents** — agentic team helping developers write and deploy contracts on-chain.
3. **Phase 5 — Canonical graph + projection refactor** — deterministic audit state machine.
4. **Phase 6 — Route registry + handoff contracts** — formalize agent-to-agent handoffs.
