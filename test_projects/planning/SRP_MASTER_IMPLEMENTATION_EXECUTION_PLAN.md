# SRP Master Implementation Execution Plan

## 1. Purpose

This document is the **master implementation plan** for building the future SRP from the planning documents in:

- [SRP_TYPESCRIPT_REDESIGN_IMPLEMENTATION_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_TYPESCRIPT_REDESIGN_IMPLEMENTATION_PLAN.md)
- [SRP_REPO_ARCHITECTURE_RECOMMENDATION.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_REPO_ARCHITECTURE_RECOMMENDATION.md)
- [SRP_AGENT_ARCHITECTURE_RECOMMENDATION.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_AGENT_ARCHITECTURE_RECOMMENDATION.md)
- [SRP_AUDIT_METHODOLOGY_ALIGNMENT_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_AUDIT_METHODOLOGY_ALIGNMENT_PLAN.md)
- [SRP_DEV_IMPLEMENTATION_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_DEV_IMPLEMENTATION_PLAN.md)
- [SRP_CONFIGURATION_SETUP_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_CONFIGURATION_SETUP_PLAN.md)
- [SRP_UI_UX_RESEARCH_AND_RECOMMENDATION.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_UI_UX_RESEARCH_AND_RECOMMENDATION.md)
- [SRP_CHAT_WEBUI_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_CHAT_WEBUI_PLAN.md)
- [SRP_EXCALIDRAW_WEBUI_INTEGRATION_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_EXCALIDRAW_WEBUI_INTEGRATION_PLAN.md)
- [SRP_DOCKERIZATION_RECOMMENDATION.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_DOCKERIZATION_RECOMMENDATION.md)
- [SRP_OPEN_SOURCE_BREAKOUT_EXPANSION_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_OPEN_SOURCE_BREAKOUT_EXPANSION_PLAN.md)
- [senior_auditor_audit_process.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/senior_auditor_audit_process.md)

This file is written so an agentic CLI or coding agent can implement the whole SRP program **one step at a time** with minimal confusion.

## 2. Non-Negotiable Implementation Rules

These rules must be followed during implementation.

## 2.1 Build in TypeScript like a super senior engineer

All new runtime/platform/frontend code should be written in **clean, modern TypeScript**.

The coding standard is:

- follow official TypeScript guidance and idioms
- prefer explicit types at boundaries
- use strict mode
- use clear interfaces and discriminated unions where appropriate
- avoid `any`
- avoid giant god files
- avoid weakly typed event payloads
- avoid implicit cross-package coupling
- write code that is maintainable by senior engineers, not just code that “works”

The quality bar is:

- strong naming
- strong module boundaries
- small focused functions
- typed contracts between packages
- predictable error handling
- predictable async control flow
- no prompt-spaghetti architecture

## 2.2 Implement one thing at a time

Do **not** try to build everything at once.

Implement feature sets in the order defined here.

For each major feature:

1. read the relevant planning files
2. implement the minimum correct slice
3. test it
4. fix issues
5. only then move to the next slice

## 2.3 When confused, go back to the plans

If there is uncertainty, do not invent random product behavior.

Return to the relevant planning document and follow it.

Use this rule:

- architecture confusion -> repo/typescript redesign plan
- runtime confusion -> agent architecture plan
- audit confusion -> audit methodology plan
- dev workflow confusion -> dev implementation plan
- onboarding confusion -> configuration setup plan
- UI confusion -> UI/UX plan
- chat confusion -> chat plan
- diagrams confusion -> Excalidraw plan
- packaging/container confusion -> dockerization plan
- community/trust/open-source confusion -> breakout expansion plan

## 2.4 Test every meaningful change

Whenever a new feature is implemented or existing code is changed:

- run the relevant unit tests
- run integration tests if the feature crosses boundaries
- run end-to-end checks for UI/runtime flows where practical
- verify TypeScript type safety
- verify lint/format

Never leave a feature untested just because it compiles.

## 2.5 Preserve product direction

SRP is not:

- a prompt wrapper
- an agent theater dashboard
- a generic chatbot

SRP is:

- an audit workbench
- a dev workbench
- an artifact-first reasoning system
- a methodology-driven platform
- a citation-first and evidence-linked system

Every implementation choice must preserve that.

## 3. Final Product Definition

The target product is a **TypeScript monorepo** with:

- `apps/cli`
- `apps/gateway`
- `apps/web`
- `apps/worker`
- reusable `packages/*`
- optional `extensions/*`
- bundled `skills/*`

And the product capabilities must include:

- auditor workflow
- developer workflow
- guided first-time setup
- multi-provider model support
- methodology-faithful `srp audit`
- strong `srp dev`
- artifact-grounded chat
- native Excalidraw in the web UI
- internet-connected but controlled research
- reproducible traces, findings, notes, and reports

## 4. Recommended Implementation Strategy

Do the implementation in **phases**.

Do not jump to advanced features before the platform skeleton is solid.

The correct order is:

1. repo and TypeScript foundation
2. shared contracts and infrastructure
3. configuration and provider system
4. session/artifact/event runtime
5. methodology audit runtime
6. dev runtime
7. web UI shell
8. chat and diagram systems
9. heavy toolchain integrations
10. trust/open-source/community layers

## 5. Phase 0: Read, Map, Freeze Direction

Before coding major features:

- read all planning files listed above
- inspect current SRP Python code
- identify reusable assets, prompts, skills, report templates, and logic
- identify what must be migrated vs retired vs rewritten
- write down the migration map before large edits

Deliverables:

- migration inventory
- package ownership map
- feature-to-package mapping
- “do not port” list for legacy mess

## 6. Phase 1: Monorepo And Tooling Foundation

Implement the repo skeleton from the repo architecture plan.

Build:

- `pnpm` workspace
- `turbo` or equivalent task runner
- `tsconfig.base.json`
- strict TypeScript configuration
- linting and formatting
- test runner setup
- package build graph

Create top-level folders:

- `apps/`
- `packages/`
- `extensions/`
- `skills/`
- `tests/`
- `docs/`

Recommended initial apps:

- `apps/cli`
- `apps/gateway`
- `apps/web`
- `apps/worker`

Recommended initial packages:

- `packages/shared-types`
- `packages/config`
- `packages/ids`
- `packages/events`
- `packages/sessions`
- `packages/artifacts`
- `packages/providers`
- `packages/security`
- `packages/methodology`
- `packages/agents`
- `packages/chat-runtime`
- `packages/diagram-engine`
- `packages/report-engine`
- `packages/project-graph`
- `packages/tools`

Phase 1 exit criteria:

- monorepo builds
- TypeScript compiles
- package boundaries exist
- basic tests run

## 7. Phase 2: Shared Contracts And Core Infrastructure

Build the base contracts that the whole platform depends on.

Implement:

- typed ids
- typed events
- typed artifact schemas
- typed session schemas
- typed run manifests
- typed provider configs
- typed approval models
- typed methodology phases

Important rule:

Do this before business logic.
If the contracts are weak, the whole system will become messy again.

Phase 2 exit criteria:

- core schemas validated
- packages can depend on shared contracts safely
- no major runtime component is using ad hoc untyped payloads

## 8. Phase 3: Configuration And First-Time Setup System

Implement the setup/configuration platform described in the configuration setup plan.

Build:

- configuration store
- workspace-level config
- user-level config
- provider registry
- model policy registry
- first-run setup state machine
- health checks

Implement setup screens in the web UI:

- Welcome
- Choose Role
- Models & Providers
- Toolchain Check
- Skills
- Workspace
- UI Preferences
- Ready

Implement role modes:

- Auditor
- Developer
- Both

Phase 3 exit criteria:

- first-time setup works
- user can configure providers and default mode
- toolchain checks run
- setup data is persisted

## 9. Phase 4: Provider, Model Routing, And Internet Research Foundation

Implement the provider layer properly.

Build:

- multi-provider adapter system
- provider health checks
- model routing policy
- task-based model selection
- fallback chains
- request logging

Also implement controlled internet access:

- web research service
- approved domain policy
- docs-first mode
- local-only mode
- open-web mode
- browsing attribution
- external citation model

This is required for chat, methodology research, standards lookup, and enriched explanations.

Phase 4 exit criteria:

- multiple providers can be configured
- routing works by task type
- web research has guardrails
- external sources can be cited distinctly from local artifacts

## 10. Phase 5: Session, Artifact, Memory, And Event Runtime

Implement the platform backbone.

Build:

- durable session model
- run model
- artifact store
- note store
- question log store
- event streaming model
- memory extraction model
- trace/provenance model

SRP should treat these as first-class:

- run
- phase
- artifact
- note
- finding
- invariant
- question
- hypothesis
- diagram
- report
- test artifact

Borrow the right runtime ideas from OpenClaw and Claude Code:

- session-key discipline
- normalized event transport
- approval-forwarding patterns
- durable memory extraction

Phase 5 exit criteria:

- gateway and worker can communicate through typed events
- web UI can subscribe to normalized session/run events
- artifacts persist and can be re-opened later

## 11. Phase 6: Clean Agent Runtime

Implement the redesigned agent system from the agent architecture plan.

Top-level phase agents should be limited and clean.

Recommended top-level phase agents:

- `PreparationAgent`
- `ReconAgent`
- `ArchitectureAgent`
- `InvariantAgent`
- `HypothesisAgent`
- `CodeReadingAgent`
- `AttackSimulationAgent`
- `EconomicModelingAgent`
- `CrossContractPathAgent`
- `FindingVerificationAgent`
- `ReportAgent`
- `TraceAgent`

Implement specialist workers behind them instead of exposing a messy swarm.

Do not recreate the old duplicate Python hierarchy.

Phase 6 exit criteria:

- agent responsibilities are sharp
- runtime orchestration is typed
- specialist workers are internal and reusable
- artifact ownership per phase is clear

## 12. Phase 7: Methodology-Faithful `srp audit`

Implement the audit operating system according to the methodology plan and senior auditor process.

`srp audit` must execute phases `0` through `10` faithfully.

Mandatory outputs include:

- Phase 0 prep outputs
- protocol intent statement
- adversarial actor list
- worst-case outcome statement
- scope map
- trust boundary map
- value flow map
- privilege map
- state map
- invariant registry
- function annotations
- question log
- interaction matrix
- attack hypotheses
- economic risk analysis
- cross-contract path analysis
- finding verification
- report artifacts

Important rule:

Do not reduce the methodology to a single agent prompt.
Each phase must produce durable reviewable artifacts in the system.

Phase 7 exit criteria:

- `srp audit` produces the required artifacts
- methodology status is trackable
- findings are linked to evidence and invariants
- audit runs are replayable

## 13. Phase 8: `srp dev` Runtime

Implement the developer workflow from the dev implementation plan.

`srp dev` should support:

- NatSpec generation
- docs generation
- code comment generation
- contract generation assistance
- architecture assistance
- test generation

Required test generation types:

- Unit tests
- Fuzz tests
- Fork tests
- Invariant tests
- Regression tests
- Integration tests
- Mutation testing support

Also implement:

- remediation support
- patch-risk review
- code review support
- architecture explanation
- docs synchronization

Phase 8 exit criteria:

- developer mode is real, not secondary
- dev artifacts are first-class
- test generation is structured and typed
- dev and audit can share artifacts where appropriate

## 14. Phase 9: Web UI Shell And Information Architecture

Implement the new web app shape from the UI/UX plan.

Primary navigation should center artifacts and methodology, not agents.

Recommended primary nav:

- Overview
- Audit Flow
- Protocol Map
- Contracts
- Functions
- Invariants
- Hypotheses
- Questions
- Economic Risks
- Cross-Contract Paths
- Findings
- PoCs
- Report
- Chat
- Run Trace
- Skills
- Settings

The most important screen is `Overview`.

Do not rebuild the current “agent theater” dashboard as the main product.

Phase 9 exit criteria:

- web shell exists
- methodology is visible
- artifact navigation is first-class
- auditor and developer modes are reflected cleanly

## 15. Phase 10: Native Excalidraw Integration

Implement the Excalidraw plan exactly.

Primary rule:

- native Excalidraw embedded in SRP web UI
- optional MCP/manual connector later

Build:

- diagram artifact model
- scene JSON persistence
- read-only rendering
- editor embedding
- revision history
- export actions
- provenance metadata

Generate diagrams from artifacts using a diagram compiler approach.

Required diagram families:

- protocol map
- trust boundary map
- value flow map
- state map
- interaction matrix
- attack path map
- economic risk map
- privilege map
- remediation diff map

Phase 10 exit criteria:

- diagrams are native SRP artifacts
- users can open and edit diagrams in localhost UI
- diagrams are linked to methodology phases and evidence

## 16. Phase 11: Chat Section

Implement the chat system from the chat plan.

Core design:

- one main chat entry point
- visible context drawer
- artifact-grounded answers
- citation-first responses
- mode-aware behavior
- internet-connected when enabled

Build:

- conversation model
- run-bound chat
- artifact-bound chat
- citation rendering
- context attachment system
- slash commands
- answer-to-artifact actions
- role templates
- research mode

Chat must support:

- Auditor mode behavior
- Developer mode behavior
- Hybrid behavior

Chat must not become a generic web chatbot.

Phase 11 exit criteria:

- chat can answer from local artifacts
- chat can browse safely when enabled
- citations are visible
- users can create notes/tests/findings/report snippets from chat

## 17. Phase 12: Skills And Extension System

Implement the skills/platform layer inspired by OpenClaw, but specialized for SRP.

Build:

- bundled skills registry
- skill metadata
- role-based skill eligibility
- protocol-type skill recommendations
- extension installation boundaries
- local and remote skill support where justified

Expose a `Skills` section in localhost UI.

Users should be able to:

- inspect installed skills
- inspect source/trust of a skill
- enable/disable skills
- see which features use which skills

Phase 12 exit criteria:

- skills are structured and inspectable
- skills are not random prompt files hidden in the repo
- UI exposes skills as a real product surface

## 18. Phase 13: Toolchain And Execution Integrations

Implement the security/dev toolchain integrations.

Priority integrations:

- Foundry
- Anvil
- Hardhat
- Slither
- Aderyn
- Echidna
- Docker-backed tool runners

Build:

- approval model
- isolated execution model
- typed result ingestion
- artifact generation from tool outputs

This includes:

- PoC execution
- test runs
- fuzz runs
- static analysis ingestion
- patch verification

Phase 13 exit criteria:

- tool outputs are structured
- approval flows are clear
- execution is safe and reproducible

## 19. Phase 14: Dockerization

Implement containerization according to the Docker plan.

Do not make SRP one giant container.

Recommended service/container layers:

- gateway
- worker
- foundry toolchain
- static analysis toolchain
- optional web container later

Build:

- dev container strategy
- CI container strategy
- volume mount strategy
- read-only target strategy
- tool cache strategy

Phase 14 exit criteria:

- local dev is reproducible
- CI is cleaner
- toolchain setup friction is lower

## 20. Phase 15: Trust And Verification Features

Implement the breakout/trust features that make SRP credible.

High-priority trust features:

- benchmark suite
- reproducible evaluation harness
- finding quality scoring
- evidence graph per finding
- false-positive review panel

These must appear in localhost UI, not remain hidden backend ideas.

Phase 15 exit criteria:

- benchmark harness exists
- findings have stronger trust surfaces
- false-positive resistance is visible in product

## 21. Phase 16: Open-Source Breakout Features

Implement the top-impact open-source differentiators from the breakout plan.

Priority items:

- one-command setup
- excellent docs
- extension/plugin SDK
- diff audit mode
- contest mode
- review mode
- team workspace later
- community pattern corpus later
- benchmark leaderboard later

Do not try to ship every community feature immediately.
Implement in impact order.

Phase 16 exit criteria:

- project is installable
- project is understandable
- project is extensible
- project is visibly differentiated

## 22. Testing Strategy

Every phase must include testing.

## 22.1 Required test layers

- unit tests for packages
- integration tests for gateway/runtime/provider/tool flows
- UI component tests where practical
- end-to-end tests for critical workflows
- smoke tests for CLI commands

## 22.2 Critical end-to-end workflows

Must be tested:

- first-time setup
- provider setup and health check
- `srp audit`
- methodology artifact creation
- finding review flow
- `srp dev`
- test generation flow
- chat with local artifacts
- chat with approved web research
- Excalidraw rendering and save flow

## 22.3 Test rule for implementation agents

Whenever you implement or modify a feature:

- run the nearest relevant tests immediately
- if no test exists, add one where reasonable
- do not postpone testing until the end of the migration

## 23. Code Quality Rules For Implementation Agents

The implementation agent must follow these engineering rules.

## 23.1 Package discipline

- no circular dependencies
- no business logic in UI-only packages
- no provider logic inside UI components
- no giant orchestration logic inside CLI commands

## 23.2 Type discipline

- prefer explicit domain types
- validate external inputs
- use schema validation at boundaries
- keep event payloads versionable

## 23.3 Runtime discipline

- do not mix session storage and agent prompts directly
- do not bury core logic in prompt strings
- do not hide critical product behavior inside random helpers

## 23.4 UI discipline

- artifacts first
- evidence first
- chat grounded
- methodology visible
- no fake hacker aesthetic as product foundation

## 24. Migration Guidance

The old Python SRP should be treated as:

- a source of useful logic
- a source of prompts and workflow ideas
- a source of artifacts and report patterns

It should **not** be ported file-for-file blindly.

Use this rule:

- preserve valuable behavior
- redesign poor structure
- delete duplication
- do not recreate legacy mess in TypeScript

## 25. Recommended Working Loop For The Agentic CLI

For each implementation slice, follow this loop:

1. identify the next phase from this master plan
2. open the relevant detailed planning file
3. inspect current codebase state
4. implement the smallest correct vertical slice
5. run tests
6. fix failures
7. update docs/READMEs if needed
8. move to the next slice

If confused:

1. stop
2. re-read the relevant planning file
3. align implementation to the plan
4. continue

## 26. Suggested Execution Order Summary

Use this exact order unless a strong dependency forces a small adjustment:

1. Phase 0: read and map
2. Phase 1: monorepo/tooling
3. Phase 2: shared contracts
4. Phase 3: setup/config
5. Phase 4: providers and internet foundation
6. Phase 5: sessions/artifacts/events
7. Phase 6: clean agent runtime
8. Phase 7: `srp audit`
9. Phase 8: `srp dev`
10. Phase 9: web UI shell
11. Phase 10: Excalidraw
12. Phase 11: chat
13. Phase 12: skills/extensions
14. Phase 13: toolchain integrations
15. Phase 14: Dockerization
16. Phase 15: trust and verification
17. Phase 16: open-source breakout

## 27. Final Instruction To The Implementation Agent

Implement SRP **cleanly, incrementally, and professionally**.

Do not rush into feature chaos.

Do not guess when the plans already answer the question.

Do not ship untested changes.

Do not compromise the TypeScript quality bar.

Build it like a senior platform engineer would:

- typed
- modular
- testable
- inspectable
- secure
- maintainable
- evidence-driven

And always remember:

- if a feature is confusing, return to the relevant planning file
- if a feature changed, test it
- if the structure starts getting messy, stop and clean the architecture before continuing
