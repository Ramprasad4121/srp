# SRP TypeScript Redesign Implementation Plan

## 1. Mission

SRP should become a TypeScript-native, agent-platform-grade security workspace for smart contract auditors.

The product is not "an audit script with many prompts".
The product is:

- a persistent audit session runtime
- a swarm of specialized auditor agents
- a skill and tool marketplace for security workflows
- a grounded protocol-understanding engine
- a bug-finding and PoC-verification engine
- a chat copilot that answers from audit artifacts, not from vibes
- a safe internet-connected research layer
- a rich UI that explains protocol behavior, invariants, functions, and exploit paths visually

This plan is based on studying:

- current SRP Python implementation in `src/srp/**`
- Claude Code snapshot in `test_projects/cc/src/**`
- OpenClaw platform in `test_projects/openclaw/**`

This document is a redesign and implementation plan only. No code migration is performed in this task.

## 2. What The Research Shows

### 2.1 Current SRP strengths

Current SRP already has the right product instinct:

- multi-agent audit flow in [src/srp/core/orchestrator.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/orchestrator.py)
- project scanning in [src/srp/core/project.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/project.py)
- live API/UI streaming in [src/srp/server/server.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/server/server.py)
- domain-specific audit agents under `src/srp/agents/audit/*`
- skills content under `src/srp/skills/*`
- traces, reports, PoC, notes, diagrams, graph ideas

### 2.2 Current SRP weaknesses

The current architecture is not strong enough for the product ambition.

- orchestration is tightly coupled and process-local
- agent runtime, storage, transport, skills, and UI are mixed together
- Python module layout is large but not cleanly bounded
- there is no first-class session identity model
- tool execution boundaries are weak compared with agent platforms
- internet access, remote control, approval policy, and plugin installation are not platformized
- memory exists conceptually but not as a disciplined session artifact system
- animation/explainer/report/chat are features, not first-class subsystems
- the LLM/provider layer is too direct inside agents

### 2.3 What to borrow from Claude Code

Claude Code snapshot gives strong patterns for local coding-agent UX and runtime control:

- remote session control split from rendering:
  [test_projects/cc/src/remote/RemoteSessionManager.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/remote/RemoteSessionManager.ts)
- resilient streaming websocket transport:
  [test_projects/cc/src/remote/SessionsWebSocket.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/remote/SessionsWebSocket.ts)
- adapter layer between SDK events and UI messages:
  [test_projects/cc/src/remote/sdkMessageAdapter.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/remote/sdkMessageAdapter.ts)
- permission bridging for remote tools:
  [test_projects/cc/src/remote/remotePermissionBridge.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/remote/remotePermissionBridge.ts)
- background session memory extraction:
  [test_projects/cc/src/services/SessionMemory/sessionMemory.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/services/SessionMemory/sessionMemory.ts)
- control transport for in-process MCP servers:
  [test_projects/cc/src/services/mcp/SdkControlTransport.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/services/mcp/SdkControlTransport.ts)
- plugin lifecycle surface:
  [test_projects/cc/src/services/plugins/pluginCliCommands.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/services/plugins/pluginCliCommands.ts)

What SRP should copy from Claude Code:

- event normalization between runtime and UI
- remote session manager abstraction
- explicit permission handoff flow for tool calls
- background memory extraction with thresholds
- MCP bridge for internal and external security tools

What SRP should not copy blindly:

- product-specific UI concerns not related to audit workflows
- generic plugin CLI surface without security-specialized approval semantics

### 2.4 What to borrow from OpenClaw

OpenClaw is the stronger overall platform reference for SRP.

Key platform patterns:

- TypeScript-first gateway architecture and package discipline:
  [test_projects/openclaw/package.json](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/package.json)
- session and agent key model:
  [test_projects/openclaw/src/routing/session-key.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/routing/session-key.ts)
- skill loading, filtering, prompt assembly, and path safety:
  [test_projects/openclaw/src/agents/skills.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/agents/skills.ts)
  [test_projects/openclaw/src/agents/skills/workspace.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/agents/skills/workspace.ts)
- exec approval policy and allowlist model:
  [test_projects/openclaw/src/infra/exec-approvals.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/exec-approvals.ts)
- executable safety validation:
  [test_projects/openclaw/src/infra/exec-safety.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/exec-safety.ts)
- approval forwarding to chat surfaces:
  [test_projects/openclaw/src/infra/exec-approval-forwarder.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/exec-approval-forwarder.ts)
- remote skill/node capability discovery:
  [test_projects/openclaw/src/infra/skills-remote.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/skills-remote.ts)
- guarded internet fetch with SSRF protection:
  [test_projects/openclaw/src/infra/net/fetch-guard.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/net/fetch-guard.ts)

What SRP should copy from OpenClaw:

- session-key discipline
- control-plane thinking
- installable skills with metadata and eligibility
- approval-first system execution
- guarded internet access
- plugin and extension boundaries
- strong infra utilities instead of ad hoc helpers

What SRP should not copy blindly:

- multi-channel personal assistant scope
- huge surface area unrelated to audit work

## 3. Redesign Principles

SRP vNext should follow these principles:

1. TypeScript everywhere for runtime, gateway, UI, skills SDK, and tool SDK.
2. Monorepo architecture, not one giant app directory.
3. Sessions and artifacts are first-class. Every audit is a durable workspace.
4. Agents are products of runtime + tools + memory + policies, not isolated prompt files.
5. Tools are permissioned and typed.
6. Skills are packaged, versioned, and eligibility-checked.
7. Internet access is guarded, attributable, and cached.
8. Static analysis, dynamic analysis, and LLM reasoning are separate layers.
9. UI consumes normalized events, not Python-specific traces.
10. Every "explanation" feature must be grounded in concrete code artifacts and graph facts.

## 4. Target Product Architecture

## 4.1 Monorepo layout

Recommended top-level layout:

```text
srp/
  apps/
    cli/
    gateway/
    web/
    worker/
  packages/
    core/
    sessions/
    agents/
    tools/
    skills/
    providers/
    security/
    memory/
    artifacts/
    project-graph/
    solidity/
    analysis-static/
    analysis-dynamic/
    audit-runtime/
    report-engine/
    explainer-engine/
    animation-engine/
    chat-runtime/
    config/
    db/
    sdk/
  extensions/
    search-tavily/
    search-exa/
    browser/
    slither/
    aderyn/
    foundry/
    hardhat/
  skills/
    bundled/
  test_projects/
```

## 4.2 Runtime split

### `apps/cli`

- commands like `srp audit`, `srp explain`, `srp chat`, `srp bugs`, `srp plan`
- local human entrypoint
- project bootstrap and local agent control

### `apps/gateway`

- persistent API + WebSocket control plane
- session state, approval routing, artifact events, remote workers
- frontend backend

### `apps/worker`

- background jobs
- graph builds
- invariant mining
- internet research
- PoC execution
- animation rendering
- report compilation

### `apps/web`

- audit dashboard
- protocol map
- function explorer
- invariant explorer
- findings board
- exploit simulator timeline
- chat UI

## 4.3 Session model

SRP should adopt an OpenClaw-style session identity model.

Every audit has:

- `workspaceId`
- `auditSessionId`
- `agentId`
- `threadId`
- `artifactNamespace`

Session flavors:

- `main`: primary auditor conversation
- `agent:<agentId>:main`: dedicated agent working session
- `agent:<agentId>:thread:<topic>`: side investigations
- `artifact:<artifactId>`: stable read surfaces for generated outputs

This is critical because SRP will have many agents, long-running jobs, approvals, retries, and user chat questions across the same audit.

## 5. Agent System Redesign

## 5.1 Agent classes

Replace the current broad Python layer cake with explicit TypeScript agent classes.

### Tier A: Intake and understanding

- `ScopePlannerAgent`
- `ProjectMapperAgent`
- `ProtocolNarratorAgent`
- `FunctionExplainerAgent`
- `InvariantMinerAgent`

### Tier B: Security analysis

- `AttackSurfaceAgent`
- `AccessControlAgent`
- `EconomicRiskAgent`
- `UpgradeSafetyAgent`
- `StateMachineAgent`
- `CrossProtocolDependencyAgent`

### Tier C: Verification

- `PoCPlannerAgent`
- `PoCExecutorAgent`
- `FindingVerifierAgent`
- `FalsePositiveJudgeAgent`

### Tier D: Output generation

- `AuditNotesAgent`
- `ReportComposerAgent`
- `AnimationStoryboardAgent`
- `ChatAnswerAgent`

### Tier E: Platform/system

- `SessionMemoryAgent`
- `InternetResearchAgent`
- `ToolApprovalAgent`
- `ArtifactIndexAgent`

## 5.2 Agent execution style

Do not keep the current "one orchestrator with direct object fields for every agent" model.

Move to:

- registry-based agent runtime
- typed task contracts
- event-emitting execution
- resumable steps
- persistent checkpoints

Execution mode:

1. planner decomposes audit into tasks
2. scheduler dispatches tasks to agent sessions
3. tools emit normalized events
4. artifacts are persisted continuously
5. judge/verifier agents gate promotion of candidate findings

## 5.3 Agent coordination pattern

Use a hybrid of Claude Code and OpenClaw patterns:

- Claude Code style for local/interactive task handoffs and memory extraction
- OpenClaw style for session identity, tool approvals, plugin boundaries, and event routing

Recommended coordination model:

- blackboard plus directed handoff
- every major artifact gets a stable ID
- agents do not talk to each other through prompt paste alone
- agents consume artifact references and graph node ids

## 6. Tooling Platform

## 6.1 Tool runtime

All tools should be TypeScript interfaces with:

- typed input
- typed output
- read/write capability labels
- risk level
- approval policy
- execution host
- retry policy
- provenance logging

Tool categories:

- filesystem
- git
- foundry
- hardhat
- slither
- aderyn
- symbolic execution
- RPC/onchain reads
- web research
- browser
- graph query
- report/artifact generation
- animation rendering

## 6.2 Approval model

Copy the OpenClaw model conceptually, but tighten it for security auditing.

Approval dimensions:

- `security`: `deny | allowlist | full`
- `ask`: `off | on-miss | always`
- `host`: `sandbox | worker | gateway`
- `scope`: workspace / session / agent

High-risk tools requiring approval by default:

- `system.run`
- internet search with arbitrary URLs
- browser execution
- package install
- destructive git operations
- live-chain transaction signing

This should be implemented using an SRP-specific variant of the patterns from:

- [test_projects/openclaw/src/infra/exec-approvals.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/exec-approvals.ts)
- [test_projects/openclaw/src/infra/exec-approval-forwarder.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/exec-approval-forwarder.ts)
- [test_projects/openclaw/src/infra/exec-safety.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/exec-safety.ts)

## 6.3 MCP strategy

SRP should become an MCP-native security platform.

Three MCP modes:

- external MCP servers for research/data/tools
- internal MCP servers for SRP subsystems
- in-process control transport like Claude Code for low-overhead tool RPC

This is directly inspired by:

- [test_projects/cc/src/services/mcp/SdkControlTransport.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/services/mcp/SdkControlTransport.ts)

## 7. Skills Platform

## 7.1 Skills should become first-class packages

Current markdown skills are valuable, but the platform around them is weak.

SRP skills should support:

- frontmatter metadata
- required tools
- required binaries
- domains and tags
- eligibility conditions
- install/update lifecycle
- local/workspace/global scopes

Copy the direction from OpenClaw skills workspace loading:

- [test_projects/openclaw/src/agents/skills/workspace.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/agents/skills/workspace.ts)

## 7.2 Skill categories for SRP

- protocol-domain skills
  - AMM
  - lending
  - bridge
  - governance
  - crosschain
  - staking
  - perpetuals
- vulnerability-class skills
  - reentrancy
  - access control
  - accounting
  - oracle manipulation
  - griefing
  - upgradeability
- tool skills
  - slither review
  - aderyn review
  - forge PoC writing
  - invariant testing
- output skills
  - audit-notes style
  - report formatting
  - exploit storyboard rendering

## 7.3 Skill prompt assembly

Do not dump all skill content into every agent prompt.

Implement:

- skill snapshot per session
- filtered skill loading
- prompt budget limits
- eligibility-aware selection
- artifact-aware retrieval

## 8. Memory and Artifact System

## 8.1 Replace ad hoc notes with structured artifacts

SRP needs a durable artifact graph:

- project summary
- protocol summary
- contract summaries
- function summaries
- invariants
- trust boundaries
- state machine edges
- candidate findings
- verified findings
- rejected hypotheses
- PoCs
- generated tests
- animation scenes
- report sections

## 8.2 Session memory

Adopt Claude Code’s background extraction idea, but specialize it.

SRP session memory should continuously maintain:

- audit hypotheses in progress
- evidence gathered
- unresolved questions
- confirmed facts
- user preferences
- project-specific aliases and naming

Inspired by:

- [test_projects/cc/src/services/SessionMemory/sessionMemory.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/services/SessionMemory/sessionMemory.ts)

## 8.3 Storage model

Use SQLite or Postgres plus object storage abstraction.

Structured tables:

- `workspaces`
- `audit_sessions`
- `agent_sessions`
- `messages`
- `tool_calls`
- `approvals`
- `artifacts`
- `artifact_edges`
- `findings`
- `poc_runs`
- `internet_sources`
- `animation_jobs`

Blob/object artifacts:

- markdown
- JSON graph snapshots
- rendered diagrams
- MP4/GIF assets
- report exports

## 9. Protocol Understanding Engine

This is the heart of SRP differentiation.

Build a dedicated explainer pipeline:

1. parse source code
2. build AST + CFG + call graph + storage map
3. detect protocol roles and trust boundaries
4. summarize every contract
5. summarize every function
6. infer invariants
7. generate visual scenes
8. connect scenes to concrete code locations

The chat UI must answer from this artifact graph.

Not from a fresh cold prompt.

## 10. Internet-Connected Research Layer

SRP absolutely should connect to the internet, but not in a naive way.

## 10.1 Allowed use cases

- fetch docs and standards
- fetch protocol docs and whitepapers
- fetch prior incident writeups
- fetch tokenomics/governance docs
- fetch library documentation
- cross-check addresses and deployments
- search audit reports and public findings

## 10.2 Guardrails

Borrow OpenClaw’s guarded fetch philosophy:

- [test_projects/openclaw/src/infra/net/fetch-guard.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/openclaw/src/infra/net/fetch-guard.ts)

Required rules:

- SSRF-safe fetch
- domain allowlist and policy classes
- URL provenance stored per artifact
- caching and dedupe
- citation extraction
- trust labels per source
- no silent internet use in high-stakes flows

## 10.3 Research connectors

Implement as extensions:

- Tavily
- Exa
- Firecrawl
- protocol docs crawler
- security report indexer
- Etherscan/Sourcify connector

## 11. UI and UX Redesign

The web app should be built around artifacts and flows, not around raw logs.

Primary tabs:

- Overview
- Protocol Map
- Contracts
- Functions
- Invariants
- Findings
- PoCs
- Animations
- Chat
- Timeline

Live event model should come from normalized runtime messages, not direct Python callback mutation.

Borrow from Claude Code’s message adapter idea:

- [test_projects/cc/src/remote/sdkMessageAdapter.ts](/Users/ramprasadgoud/Downloads/building/srp/test_projects/cc/src/remote/sdkMessageAdapter.ts)

## 12. Provider Layer

Abstract providers aggressively.

Provider types:

- reasoning LLMs
- code LLMs
- vision/audio if needed for explainer assets
- search providers
- blockchain RPC providers
- static-analysis executors

Required provider capabilities:

- retries
- fallback chains
- cost tracking
- token accounting
- model policy by task class
- benchmark harness

SRP should never have agent code instantiating provider clients directly the way it currently does in Python.

## 13. Mapping Current Python SRP To New TypeScript Packages

### Keep concept, rewrite implementation

- `src/srp/core/project.py` -> `packages/project-graph`
- `src/srp/core/orchestrator.py` -> `packages/audit-runtime`
- `src/srp/server/server.py` -> `apps/gateway`
- `src/srp/cli/srp.py` -> `apps/cli`
- `src/srp/core/notes_engine.py` -> `packages/report-engine`
- `src/srp/core/diagram_engine.py` -> `packages/animation-engine`
- `src/srp/core/sol_parser/*` -> `packages/solidity`
- `src/srp/core/mcp/*` -> `packages/sdk` or `packages/tools`

### Preserve domain content, repackage

- `src/srp/skills/**` -> `skills/bundled/**`
- `src/srp/agents/audit/**` -> agent task specs + bundled domain skills
- `src/srp/agents/souls/**` -> agent persona/config layer, not direct runtime logic

### Decommission

- direct FastAPI state globals
- direct agent object mutation in server callbacks
- per-agent hand-written provider calls
- duplicated v1/v2 architecture running in parallel forever

## 14. Implementation Phases

## Phase 0: Freeze the architecture

Goal:

- stop adding major Python features
- treat current Python SRP as reference behavior only

Deliverables:

- architecture decision record set
- package map
- event schema
- artifact schema
- session-key schema

## Phase 1: Create the TypeScript platform skeleton

Goal:

- establish monorepo, package boundaries, CI, lint, tests, build

Deliverables:

- `pnpm` workspace
- base tsconfig
- shared config package
- logging
- env loading
- typed event contracts
- workspace and session ids

Exit criteria:

- CLI starts
- gateway starts
- web shell starts
- no audit features yet

## Phase 2: Session runtime and approval system

Goal:

- reproduce OpenClaw-grade runtime discipline

Deliverables:

- session key model
- agent registry
- event bus
- tool registry
- approval store
- exec safety layer
- basic websocket stream

Exit criteria:

- one mock agent can run with approval-gated tools

## Phase 3: Project graph and Solidity ingestion

Goal:

- replace Python project scanning and code understanding foundation

Deliverables:

- project detector
- toolchain detector
- source loader
- AST parser
- import graph
- contract/function index
- storage slot map
- call graph

Exit criteria:

- a Solidity repo is ingested into structured artifacts

## Phase 4: Core audit swarm

Goal:

- rebuild the real SRP value loop in TS

Deliverables:

- planner
- mapper
- invariant miner
- attack surface agent
- candidate finding store
- verifier
- report notes engine

Exit criteria:

- SRP can produce grounded audit notes and verified candidate findings

## Phase 5: PoC and dynamic verification

Goal:

- make findings actionable

Deliverables:

- forge/hardhat tool adapters
- PoC planner
- PoC executor
- test synthesis
- repro artifact store

Exit criteria:

- verified findings can produce reproducible PoC artifacts

## Phase 6: Explainer, animation, and chat

Goal:

- convert audit artifacts into deep understanding

Deliverables:

- function explainer pipeline
- invariant explorer
- protocol animation storyboard engine
- artifact-grounded chat runtime

Exit criteria:

- user can ask a question in chat and get answers grounded in code + artifacts + citations

## Phase 7: Internet-connected research and extensions

Goal:

- expand beyond local code safely

Deliverables:

- search extensions
- guarded fetch
- source cache
- report/research connectors
- installable skills/extensions

Exit criteria:

- SRP can cite external evidence safely

## Phase 8: Migration and Python sunset

Goal:

- move feature traffic to TS

Deliverables:

- feature parity matrix
- cutover plan
- Python compatibility mode if needed

Exit criteria:

- TS runtime is default
- Python is legacy or removed

## 15. Workstreams

Run these in parallel after Phase 1.

### Workstream A: Platform runtime

- sessions
- approvals
- ws streaming
- artifacts

### Workstream B: Solidity intelligence

- parser
- graph
- invariant extraction

### Workstream C: Security tooling

- slither
- aderyn
- forge
- hardhat

### Workstream D: Skills and extensions

- bundled skills migration
- frontmatter
- installer

### Workstream E: Frontend

- event model
- audit dashboard
- graph views
- chat

### Workstream F: Research layer

- guarded fetch
- citations
- source trust scoring

## 16. Risks And Countermeasures

### Risk 1: Trying to port line-by-line from Python

Bad.
This will preserve today’s architecture problems.

Countermeasure:

- port concepts, not file structure

### Risk 2: Copying all of OpenClaw

Bad.
OpenClaw solves a much bigger surface than SRP needs.

Countermeasure:

- copy the platform patterns only

### Risk 3: Building agents before session/runtime discipline

Bad.
You will get a prompt zoo with zero control.

Countermeasure:

- build runtime, approvals, artifacts, and events first

### Risk 4: Internet access without trust controls

Bad.
You will import garbage into audit reasoning.

Countermeasure:

- domain policies, guarded fetch, provenance, caching, citations

### Risk 5: Chat answers detached from artifacts

Bad.
Users will not trust the system.

Countermeasure:

- retrieval only from stored audit artifacts plus explicitly cited outside sources

## 17. Concrete Borrow List

## Borrow directly in concept and design

From Claude Code:

- remote session manager
- websocket reconnection model
- SDK message normalization
- permission bridge for remote tools
- background session memory extraction
- in-process MCP control transport

From OpenClaw:

- session key model
- skill loading and filtering
- plugin/extensibility mindset
- approval and exec policy surface
- guarded fetch
- remote capability probing
- control plane architecture

## Do not borrow directly

- OpenClaw’s multi-channel messaging sprawl
- Claude Code’s UI specifics unrelated to audit flow
- any provider/product-specific assumptions

## 18. Recommended First 30 Implementation Tickets

1. Create `pnpm` workspace and base packages.
2. Define SRP event schema.
3. Define session key format.
4. Define artifact schema.
5. Build gateway bootstrap.
6. Build CLI bootstrap.
7. Add SQLite persistence layer.
8. Add workspace/session tables.
9. Add tool registry interface.
10. Add approval store interface.
11. Add exec safety validator.
12. Add websocket event stream.
13. Add project detector package.
14. Add Solidity file loader.
15. Add AST parser package.
16. Add import graph builder.
17. Add contract/function indexer.
18. Add provider abstraction.
19. Add agent registry.
20. Add planner agent shell.
21. Add project mapper agent shell.
22. Add invariant miner shell.
23. Add findings store.
24. Add artifact-grounded notes engine.
25. Add skill metadata/frontmatter loader.
26. Migrate one domain skill family.
27. Add guarded fetch package.
28. Add source cache and citation model.
29. Add chat runtime backed by artifacts.
30. Add one end-to-end demo audit flow.

## 19. Success Criteria

SRP vNext is successful when:

- it is fully TypeScript-native
- every audit has durable sessions, artifacts, approvals, and replayable events
- function explanations and invariants are grounded in actual code structure
- findings have verification states and PoC evidence
- chat answers from artifacts, not from raw model memory
- internet research is safe and cited
- skills and tools are installable and policy-controlled
- the system feels closer to an agent platform than to a Python script bundle

## 20. Final Recommendation

Do not do a straight Python-to-TypeScript rewrite.

Do this instead:

1. rebuild SRP as a TypeScript control plane and audit runtime
2. preserve the smart-contract domain knowledge from current SRP
3. adopt OpenClaw’s platform discipline
4. adopt Claude Code’s interaction, memory, and remote-control patterns
5. make artifacts, approvals, and sessions the core of the product

That is the path to making SRP genuinely better than a collection of audit prompts.
