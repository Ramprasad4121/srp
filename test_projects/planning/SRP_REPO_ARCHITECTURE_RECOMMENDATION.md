# SRP Repo Architecture Recommendation

## 1. Short Answer

SRP should move to a **TypeScript monorepo** with:

- `apps/` for runnable products
- `packages/` for reusable runtime/domain libraries
- `extensions/` for optional provider/tool integrations
- `skills/` for bundled skill content
- `docs/` for architecture and product documents
- `scripts/` for automation
- `test_projects/` for research, fixtures, local references, and planning artifacts

This is the right direction if you want SRP to become:

- manageable
- scalable
- auditable
- easy to onboard into
- easy to test
- easy to evolve without turning into a dump yard

## 2. The Main Repo Rule

Every folder should answer one question only:

- is this a runnable app?
- is this a reusable package?
- is this an optional extension?
- is this skill content?
- is this documentation?
- is this test data / fixtures / reference material?

If a folder answers more than one of those, the structure is already going bad.

## 3. The Best Target Top-Level Structure

Recommended top-level structure:

```text
srp/
  apps/
  packages/
  extensions/
  skills/
  docs/
  scripts/
  tests/
  test_projects/
  .github/
  .changeset/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  biome.json
  README.md
  CLAUDE.md
```

## 4. What Each Top-Level Folder Should Mean

## `apps/`

This is where runnable SRP products live.

Each app should be deployable or executable on its own.

Recommended apps:

```text
apps/
  cli/
  gateway/
  web/
  worker/
  docs-site/        # optional, only if you build a docs UI
```

### `apps/cli/`

Contains:

- `srp audit`
- `srp explain`
- `srp chat`
- `srp report`
- `srp doctor`

Should contain:

- CLI entrypoint
- command parsing
- terminal UX only

Should not contain:

- core audit logic
- provider clients
- graph logic
- UI code

### `apps/gateway/`

Contains:

- API server
- websocket events
- session runtime access
- audit run orchestration surface
- approvals surface

Should contain:

- HTTP routes
- WebSocket routes
- auth/session middleware
- event streaming

Should not contain:

- deep protocol analysis logic
- giant business logic files

### `apps/web/`

Contains:

- the full SRP frontend
- methodology UI
- diagrams
- findings workbench
- chat UI

Should contain:

- routes
- pages
- features
- components
- state management

Should not contain:

- raw audit logic
- server-only code

### `apps/worker/`

Contains:

- background jobs
- long-running heavy tasks
- report rendering
- diagram building
- PoC execution dispatch
- search indexing

Should contain:

- job consumers
- queue handling
- worker runtime

Should not contain:

- UI
- CLI parsing

## `packages/`

This is the heart of the repo.

Everything reusable and testable should live here.

Recommended structure:

```text
packages/
  config/
  logging/
  ids/
  sessions/
  events/
  db/
  artifacts/
  memory/
  security/
  providers/
  sdk/
  tools/
  skills/
  project-graph/
  solidity/
  methodology/
  agents/
  audit-runtime/
  analysis-static/
  analysis-dynamic/
  report-engine/
  diagram-engine/
  animation-engine/
  chat-runtime/
  ui-contracts/
  shared-types/
```

## 5. The Most Important Packages

## `packages/config/`

Purpose:

- all runtime config loading and validation

Should contain:

- zod schemas
- env parsing
- app config
- package config helpers

## `packages/logging/`

Purpose:

- unified structured logging

Should contain:

- logger factory
- audit run logger
- worker logger
- browser logger adapter if needed

## `packages/ids/`

Purpose:

- run ids
- workspace ids
- session ids
- artifact ids
- finding ids

This should be its own package because identity conventions spread everywhere.

## `packages/sessions/`

Purpose:

- audit session model
- agent session model
- thread model
- session keys
- lifecycle status

This should own the session model fully.

## `packages/events/`

Purpose:

- canonical event schema
- websocket payload types
- UI event model
- phase events
- artifact events

Do this centrally so the UI and backend never drift.

## `packages/db/`

Purpose:

- database adapters
- migrations
- repositories
- query helpers

Recommended subfolders:

```text
packages/db/
  src/
    client/
    migrations/
    repositories/
    models/
```

## `packages/artifacts/`

Purpose:

- all artifact definitions and storage helpers

Should contain:

- note artifacts
- invariant artifacts
- question artifacts
- finding artifacts
- report artifacts
- diagram artifacts
- PoC artifacts

This package is extremely important.

## `packages/memory/`

Purpose:

- session memory
- retrieval indexes
- artifact memory summaries
- question memory

## `packages/security/`

Purpose:

- approvals
- execution safety
- URL safety
- SSRF protection
- sandbox policy

Put all dangerous-operation policy here.

## `packages/providers/`

Purpose:

- LLM providers
- search providers
- blockchain RPC providers
- model routing
- retries and failover

Recommended subfolders:

```text
packages/providers/
  src/
    llm/
    search/
    rpc/
    media/
```

## `packages/sdk/`

Purpose:

- internal SDK for tools, extensions, and agents

Should contain:

- tool interfaces
- worker interfaces
- plugin interfaces
- event interfaces

## `packages/tools/`

Purpose:

- the actual SRP tool registry and implementations

Recommended subfolders:

```text
packages/tools/
  src/
    filesystem/
    git/
    foundry/
    hardhat/
    slither/
    aderyn/
    browser/
    web/
    rpc/
    graph/
    report/
    diagrams/
```

## `packages/skills/`

Purpose:

- skill metadata loader
- skill registry
- skill prompt assembly
- skill eligibility logic
- skill installation logic

This is logic only.
Skill content itself should not live here.

## `packages/project-graph/`

Purpose:

- repo detection
- source indexing
- import graph
- dependency graph
- contracts-in-scope graph

## `packages/solidity/`

Purpose:

- Solidity parsing
- contract metadata extraction
- function metadata extraction
- storage layout extraction
- inheritance extraction

## `packages/methodology/`

Purpose:

- phase definitions
- methodology state machine
- required artifacts per phase
- completion gates

This is a very important package for SRP because your audit methodology is the product backbone.

## `packages/agents/`

Purpose:

- agent definitions
- worker definitions
- agent contracts
- orchestration-independent agent logic

Recommended subfolders:

```text
packages/agents/
  src/
    phase-agents/
    specialist-workers/
    prompts/
    contracts/
    registries/
```

Important:

- only real agent definitions here
- no random helpers pretending to be agents

## `packages/audit-runtime/`

Purpose:

- audit run state machine
- scheduler
- handoffs
- execution planner
- agent dispatch
- artifact production coordination

This is the actual audit engine.

## `packages/analysis-static/`

Purpose:

- static-analysis-based reasoning
- Slither/Aderyn normalization
- pattern detection
- storage and upgrade checks

## `packages/analysis-dynamic/`

Purpose:

- PoC execution support
- fork-mode simulation
- runtime testing
- trace capture

## `packages/report-engine/`

Purpose:

- report assembly
- report templating
- markdown report generation
- executive summary generation

## `packages/diagram-engine/`

Purpose:

- Excalidraw-style diagram generation
- trust boundary maps
- value flow maps
- interaction matrix views
- exploit path diagram generation

## `packages/animation-engine/`

Purpose:

- optional animated explainers
- scene timelines
- protocol walkthrough animation

This should be separate from canonical diagrams.

## `packages/chat-runtime/`

Purpose:

- artifact-grounded Q&A
- retrieval orchestration
- citation formatting
- answer assembly

## `packages/ui-contracts/`

Purpose:

- exact DTOs shared between backend and frontend

This avoids backend/frontend drift.

## `packages/shared-types/`

Purpose:

- common utility types
- shared enums
- generic cross-package contracts

## 6. `extensions/` Folder

This should contain optional integrations, not core runtime code.

Recommended:

```text
extensions/
  exa-search/
  tavily-search/
  firecrawl/
  slither-cli/
  aderyn-cli/
  foundry-runtime/
  hardhat-runtime/
  etherscan/
  sourcify/
  openai/
  anthropic/
```

Rule:

- if SRP can run without it, it belongs in `extensions/`
- if SRP core cannot function without it, it belongs in `packages/`

## 7. `skills/` Folder

This should contain actual skill content.

Recommended:

```text
skills/
  bundled/
    methodology/
    domains/
    vulnerabilities/
    output/
    tools/
```

### `skills/bundled/methodology/`

- audit methodology skills
- preparation prompts
- finding templates

### `skills/bundled/domains/`

- AMM
- lending
- bridge
- governance
- staking
- perpetuals
- crosschain

### `skills/bundled/vulnerabilities/`

- reentrancy
- access control
- oracle manipulation
- upgradeability
- griefing
- math
- signature replay

### `skills/bundled/output/`

- report style
- explainer style
- diagram naming conventions

### `skills/bundled/tools/`

- Slither interpretation
- Aderyn interpretation
- forge PoC generation

Important:

- this folder is for skill content
- skill runtime logic belongs in `packages/skills/`

## 8. `docs/` Folder

This must be clean and intentional.

Recommended:

```text
docs/
  architecture/
  product/
  methodology/
  operations/
  api/
  adr/
```

### `docs/architecture/`

- system architecture
- session model
- artifact model
- repo structure

### `docs/product/`

- UI/UX docs
- feature docs
- product philosophy

### `docs/methodology/`

- audit methodology
- phase definitions
- severity rules

### `docs/operations/`

- local setup
- CI/CD
- release process

### `docs/api/`

- HTTP routes
- event schema
- extension interfaces

### `docs/adr/`

- architecture decision records

## 9. `scripts/` Folder

Only automation scripts belong here.

Recommended:

```text
scripts/
  dev/
  build/
  release/
  data/
  audit/
```

Examples:

- seed fixtures
- build docs
- release packaging
- sync skill manifests
- normalize test datasets

Do not put core runtime logic here.

## 10. `tests/` Folder

Keep one central test root for cross-app and integration tests.

Recommended:

```text
tests/
  integration/
  e2e/
  fixtures/
  smoke/
```

Each package should also have local unit tests.

So the rule is:

- package-local tests for unit tests
- root `tests/` for integration/e2e/system tests

## 11. `test_projects/` Folder

Keep this folder.
It is useful.

Purpose:

- fixture repos
- reference codebases
- local research plans
- audit targets
- migration planning docs

Recommended:

```text
test_projects/
  fixtures/
  references/
  plans/
  real_targets/
```

Right now your planning markdown files can live under:

- `test_projects/plans/`

That would be cleaner than dumping all plan files directly under `test_projects/`.

## 12. Recommended Structure Inside `apps/web/`

This one matters a lot.

Recommended:

```text
apps/web/
  src/
    app/
    pages/
    features/
    components/
    layouts/
    hooks/
    lib/
    styles/
    state/
    routes/
    assets/
```

### `features/`

This should be the main UI organization pattern.

Recommended features:

```text
features/
  overview/
  audit-flow/
  protocol-map/
  contracts/
  functions/
  invariants/
  hypotheses/
  questions/
  economic-risks/
  cross-contract-paths/
  findings/
  pocs/
  reports/
  chat/
  trace/
```

This is much better than organizing by random component type only.

## 13. Recommended Structure Inside `apps/gateway/`

```text
apps/gateway/
  src/
    bootstrap/
    routes/
    websocket/
    middleware/
    services/
    controllers/
    presenters/
    auth/
```

Important:

- `routes/` should stay thin
- `services/` should call package logic
- `presenters/` should shape responses for the UI

## 14. Recommended Structure Inside `apps/cli/`

```text
apps/cli/
  src/
    commands/
    presenters/
    prompts/
    utils/
    bootstrap/
    main.ts
```

Commands should be thin wrappers over `packages/*`.

## 15. Recommended Structure Inside `packages/agents/`

This one is critical.

```text
packages/agents/
  src/
    phase-agents/
      preparation/
      recon/
      architecture/
      invariants/
      hypotheses/
      code-reading/
      attack-simulation/
      economic-modeling/
      cross-contract-paths/
      finding-verification/
      reporting/
      tracing/
    specialist-workers/
      access-control/
      upgradeability/
      oracles/
      reentrancy/
      flashloans/
      math/
      tokens/
      governance/
      bridge/
      lending/
      amm/
      staking/
      perpetuals/
      crosschain/
    registry/
    runtime-contracts/
    prompt-assets/
    shared/
```

This is clean and maintainable.

## 16. Recommended Structure Inside `packages/tools/`

```text
packages/tools/
  src/
    registry/
    policies/
    filesystem/
    git/
    search/
    browser/
    diagrams/
    reports/
    solidity/
    slither/
    aderyn/
    foundry/
    hardhat/
    rpc/
    sandbox/
```

## 17. Recommended Structure Inside `packages/artifacts/`

```text
packages/artifacts/
  src/
    contracts/
    functions/
    invariants/
    hypotheses/
    questions/
    findings/
    pocs/
    reports/
    diagrams/
    notes/
    traces/
    relations/
```

This package should define the actual artifact shapes and storage rules.

## 18. Folder-Level Markdown Files: Worth It Or Not?

Yes, **but only if done carefully**.

This is worth it.

I recommend adding a markdown manifest file under important folders.

But not under every tiny folder.

If you do it under every tiny folder, it becomes maintenance spam.

## Best rule

Add folder-level markdown only for:

- top-level folders
- apps
- major packages
- major feature folders
- major extension folders

Do **not** add them for tiny leaf folders unless the folder is complex.

## Recommended file name

Use:

- `README.md`

Do not invent multiple names unless you have a reason.

## What each folder README should contain

Very short and practical:

1. purpose of the folder
2. what belongs here
3. what does not belong here
4. important subfolders
5. important entrypoints

### Example

```md
# packages/artifacts

Purpose:
Defines artifact types, relations, storage helpers, and retrieval contracts.

Belongs here:
- invariant artifacts
- finding artifacts
- note artifacts
- report artifacts

Does not belong here:
- UI rendering
- HTTP routing
- provider clients

Important subfolders:
- `src/findings/`
- `src/invariants/`
- `src/relations/`
```

That is enough.

## 19. Repo Hygiene Rules

These rules will keep the repo from rotting.

1. No app should implement core business logic directly.
2. No package should import from `apps/`.
3. Extensions must depend on core packages, never the reverse.
4. Skill content must not be mixed with skill runtime code.
5. Experimental code must live under `experimental/` or be deleted.
6. Every package should have a clear owner and README.
7. Every top-level folder should have one obvious purpose.

## 20. What To Do With Current Python Repo While Migrating

Until the TypeScript version is real, keep the old structure isolated.

Recommended temporary migration layout:

```text
srp/
  legacy/
    python-srp/
  apps/
  packages/
  extensions/
  skills/
  docs/
  scripts/
  test_projects/
```

This is worth doing if you are seriously migrating.

Why:

- keeps old Python code from polluting the new architecture
- avoids endless mixed-language confusion
- makes cleanup easier later

If you do not want a `legacy/` folder, then at least keep the new TS monorepo in a very clearly separated subtree during migration.

## 21. Final Recommended Architecture Snapshot

```text
srp/
  apps/
    cli/
    gateway/
    web/
    worker/
  packages/
    config/
    logging/
    ids/
    sessions/
    events/
    db/
    artifacts/
    memory/
    security/
    providers/
    sdk/
    tools/
    skills/
    project-graph/
    solidity/
    methodology/
    agents/
    audit-runtime/
    analysis-static/
    analysis-dynamic/
    report-engine/
    diagram-engine/
    animation-engine/
    chat-runtime/
    ui-contracts/
    shared-types/
  extensions/
    exa-search/
    tavily-search/
    firecrawl/
    slither-cli/
    aderyn-cli/
    foundry-runtime/
    hardhat-runtime/
    etherscan/
    sourcify/
  skills/
    bundled/
      methodology/
      domains/
      vulnerabilities/
      output/
      tools/
  docs/
    architecture/
    product/
    methodology/
    operations/
    api/
    adr/
  scripts/
    dev/
    build/
    release/
    data/
    audit/
  tests/
    integration/
    e2e/
    fixtures/
    smoke/
  test_projects/
    fixtures/
    references/
    plans/
    real_targets/
```

## 22. Final Recommendation

This is the best repo architecture for SRP:

- app-centric at the top
- package-centric in the middle
- extensions isolated
- skills isolated
- docs explicit
- plans and references isolated
- folder READMEs on important folders only

If you follow this structure, SRP will be:

- far easier to manage
- easier to scale with more contributors
- easier to migrate to TypeScript properly
- much harder to accidentally turn into a spaghetti repo

This is the repo architecture I recommend for SRP.
