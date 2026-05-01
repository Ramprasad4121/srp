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
  skills/         Skills catalog (agent knowledge)
  providers/      AI provider clients
  sessions/       Session types
  security/       Security utilities
tests/
  smoke/          Integration/smoke tests (per-file, node --test)
  project-memory/ Unit tests for @srp/project-memory
  gateway/        Unit tests for gateway internals (runtime-registry)
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

**Invariants verified:**
- Zero `let activeSessionId` in TypeScript source.
- Zero `"default-project"` string literal outside `migrate.ts` and `types.ts`.

---

## Development

```bash
pnpm install          # install all deps (requires Node 24, pnpm 10.x)
pnpm build            # tsc -b (composite libs + leaf packages)
pnpm typecheck        # full check including leaf packages

# Tests (individual files — no single pnpm test command, some tests require live API keys)
node --test tests/project-memory/store.test.mjs
node --test tests/project-memory/migrate.test.mjs
node --test tests/gateway/runtime-registry.test.mjs
node --test tests/smoke/persistence.test.mjs
node --test tests/smoke/gateway-http.test.mjs
```

### .npmrc note
`manage-package-manager-versions=false` is set so system pnpm (10.26.1) does not try to download the `packageManager` pinned version (10.6.5) — that download hangs in this environment.

---

## Roadmap (what comes after Phase 1)

1. **Ingest pashov/ai-web3-security** as the audit agents' knowledge base — skills indexing, retrieval-augmented audit phases.
2. **Learning platform** — personalized AI-driven education on ETH/Solana, adapted to each learner's pace.
3. **DeFi builder agents** — agentic team helping developers write and deploy contracts on-chain.
4. **Phase 2** — canonical graph + projection refactor.
5. **Phase 3** — route registry + handoff contracts.
