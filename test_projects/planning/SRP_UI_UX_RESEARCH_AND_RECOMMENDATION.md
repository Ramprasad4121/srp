# SRP UI/UX Research And Recommendation

## 1. Objective

This document defines how SRP UI/UX should be designed so it becomes a genuinely elite product for smart contract auditors.

The goal is not:

- pretty dashboards
- random animations
- agent-status theater

The goal is:

- faster understanding
- deeper trust
- lower cognitive load
- stronger evidence navigation
- methodology-native audit flow
- a product that feels like an auditor cockpit, not a hacker demo

This plan is based on:

- current SRP UI in:
  - [src/srp/ui/index.html](/Users/ramprasadgoud/Downloads/building/srp/src/srp/ui/index.html)
  - [src/srp/ui/app.js](/Users/ramprasadgoud/Downloads/building/srp/src/srp/ui/app.js)
  - [src/srp/ui/style.css](/Users/ramprasadgoud/Downloads/building/srp/src/srp/ui/style.css)
- current server/event surface in:
  - [src/srp/server/server.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/server/server.py)
  - [src/srp/server/gateway.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/server/gateway.py)
- prior SRP platform and methodology plans already produced in `test_projects/`

## 2. Blunt Assessment Of Current UI

Current SRP UI has energy, but it is not yet the right product shape.

### 2.1 What is good today

- live audit feeling
- visible pipeline
- visible findings and score
- simple single-page bootstrapping
- strong hacker-tool vibe

### 2.2 What is wrong today

The current UI is trying to be:

- a terminal dashboard
- a cyberpunk mission console
- a pipeline monitor
- a results screen
- a form UI

all at the same time.

That creates problems:

- too much emphasis on agents, not enough on methodology
- too much emphasis on status theater, not enough on evidence
- poor information hierarchy for actual auditing
- no durable artifact navigation model
- findings are not strongly linked back to invariants, hypotheses, questions, and code
- architecture and economic analysis are not first-class workspaces
- there is no real auditor workflow
- there are signs of multiple UI directions coexisting in the same codebase

Examples:

- [src/srp/ui/index.html](/Users/ramprasadgoud/Downloads/building/srp/src/srp/ui/index.html) is a highly styled single-page mission dashboard
- [src/srp/ui/app.js](/Users/ramprasadgoud/Downloads/building/srp/src/srp/ui/app.js) references a different page/tab shell and richer app structure than the HTML reflects
- [src/srp/ui/style.css](/Users/ramprasadgoud/Downloads/building/srp/src/srp/ui/style.css) reflects another visual system again

That means the UI direction is not settled.

## 3. Core Product Truth

SRP is not just an "agent app".

SRP is a:

- methodology-driven audit workspace
- protocol understanding engine
- evidence graph
- findings verification system
- explainer and teaching surface

So the UI should be built around these objects:

- phases
- artifacts
- invariants
- functions
- trust boundaries
- questions
- hypotheses
- findings
- PoCs
- reports

Not around agents as the primary thing.

Agents matter.
But agents are backstage machinery.

Artifacts and evidence are what the user must live in.

## 4. Design Principles

These should govern the entire SRP UI.

## 4.1 Methodology-first

The UI must mirror the audit methodology phases directly.

If a methodology phase exists, the UI should show:

- status
- artifacts created
- unresolved questions
- linked risks
- linked findings

## 4.2 Artifact-first

Every output should become a navigable artifact.

Artifacts are more important than logs.

## 4.3 Evidence-linked

Every finding should be navigable backward to:

- broken promise
- invariant
- code path
- function annotation
- question log entry
- hypothesis
- PoC

## 4.4 Low-noise by default

The default screen should not drown the user in logs.

Logs should be accessible, but secondary.

## 4.5 Strong visual hierarchy

An auditor should know within 3 seconds:

- where they are in the methodology
- what is risky
- what is unresolved
- what is proven

## 4.6 Professional, not toy-cyberpunk

SRP can be bold and distinctive, but it should feel:

- premium
- sharp
- serious
- high-agency

Not like a fake "hacker movie" UI.

## 5. Recommended Product Structure

SRP should have **three major UI modes**.

## 5.1 Audit Mode

For running and monitoring `srp audit`.

Primary goals:

- show phase progression
- show artifacts as they are produced
- show open questions
- show emerging findings

## 5.2 Investigation Mode

For deep work after the initial run.

Primary goals:

- inspect contracts/functions/invariants
- inspect trust boundaries and value flows
- inspect hypotheses and cross-contract paths
- compare evidence

## 5.3 Presentation Mode

For sharing, explaining, and exporting results.

Primary goals:

- tell the protocol story clearly
- show findings cleanly
- show diagrams and flows
- answer questions in chat from artifacts

## 6. Information Architecture

This should be the top-level app navigation.

## Recommended primary nav

1. Overview
2. Audit Flow
3. Protocol Map
4. Contracts
5. Functions
6. Invariants
7. Hypotheses
8. Questions
9. Economic Risks
10. Cross-Contract Paths
11. Findings
12. PoCs
13. Report
14. Chat
15. Run Trace

This is much better than putting "agents" front and center.

## 7. The Single Most Important Screen

The most important screen should be **Overview**.

It should answer:

- What protocol is this?
- What does it promise?
- What is at risk?
- Where are we in the audit?
- What are the top unresolved risks?
- What findings are already credible?

### Overview layout

Top band:

- protocol name
- protocol type
- current phase
- audit health
- run id
- last updated

Second band:

- one-sentence value proposition
- money in / money out summary
- adversarial actors
- worst-case outcome

Third band:

- critical metrics
  - contracts in scope
  - external dependencies
  - invariants extracted
  - open questions
  - pending hypotheses
  - validated findings

Fourth band:

- top 3 trust boundaries
- top 3 economic risks
- top 3 likely exploit paths

Fifth band:

- latest methodology progress
- recent artifact generation

## 8. Audit Flow Screen

This should replace the current "agent theater" as the main live screen.

## Structure

Left side:

- phase timeline `0` through `10`
- completion state
- blockers

Center:

- current phase workspace
- artifacts being generated
- phase-specific outputs

Right side:

- live activity stream
- current running workers
- user approvals needed
- newest questions

### Phase cards should show

- phase number and title
- progress state
- artifact count
- unresolved item count
- findings linked to this phase

### Example

`Phase 3 — Invariant Extraction`

- `24 invariants extracted`
- `7 economic invariants`
- `3 unlinked functions`
- `2 candidate violations`

## 9. Protocol Map Screen

This should be the visual heart of SRP.

## Required views

- system architecture map
- trust boundary map
- value flow map
- privileged role map
- interaction matrix view

## Diagram standard

Canonical diagrams should be Excalidraw-style.

Why:

- readable
- annotatable
- human-review friendly
- better for audits and reports
- clearer than gratuitous animation

Animation should be optional and only used for:

- explaining protocol behavior to humans
- showing attack sequences
- onboarding or demo mode

Not as the default primary audit artifact.

## 10. Contracts Screen

This is where auditors navigate the codebase structurally.

Each contract row/card should show:

- name
- role
- lines of code
- inheritance
- external dependencies
- writes value?
- privileged?
- findings count
- open questions count

Clicking a contract opens:

- summary
- storage map
- functions list
- trust boundaries
- invariants touching this contract
- findings touching this contract

## 11. Functions Screen

This must become one of the most powerful screens in the product.

Each function page should show:

- signature
- contract
- visibility
- mutability
- modifiers
- reads/writes
- external calls
- invariants affected
- math critical paths
- question log entries
- linked hypotheses
- linked findings

### Function annotation sheet

The function annotation card should literally reflect the audit methodology:

- access
- modifiers
- input trust assumptions
- preconditions checked
- missing checks
- state changes in order
- external calls in order
- math paths
- invariant impact
- notes

This is where SRP becomes elite.

## 12. Invariants Screen

Invariants should not be buried in notes.

They should be first-class objects with filtering and status.

### Required filtering

- global
- function-level
- economic
- by contract
- by severity if broken
- by validation status

### Each invariant card should show

- invariant id
- type
- plain-English description
- formal expression if available
- affected contracts/functions
- evidence supporting it
- hypotheses testing it
- whether it was violated

## 13. Hypotheses Screen

This should be a real attack board.

### Required columns

- pending
- being tested
- refuted
- confirmed

### Each hypothesis card should show

- id
- who / action / method / impact
- target function
- target invariant
- severity estimate
- evidence gathered
- linked question log
- linked PoC if any

## 14. Questions Screen

This is currently missing from SRP and must become a major UI surface.

Questions are the audit pressure points.

### Each question card should show

- id
- text
- status
- owner phase
- linked contract/function
- linked hypothesis
- linked finding if resolved into one

### Statuses

- open
- investigating
- answered
- escalated
- turned-into-finding

This screen is critical for atomic auditors.

## 15. Economic Risks Screen

This should be dedicated, not mixed into generic findings.

### Sections

- flash loan scenarios
- oracle manipulation
- fee abuse
- rounding drift
- insolvency paths
- admin economic abuse

### Each scenario card should show

- title
- attack sequence
- required capital
- required conditions
- estimated profit
- confidence
- severity

## 16. Cross-Contract Paths Screen

This should show exploit chains and callback surfaces.

### Required views

- call chain explorer
- callback surface map
- malicious token behavior cases
- reentrancy surfaces
- state-at-callback snapshots

This is one of the biggest differentiators if done well.

## 17. Findings Screen

This should be the cleanest, strongest screen in the product.

Each finding should show:

- title
- severity
- confidence
- invariant violated
- root cause
- preconditions
- attack path
- impact
- mitigation
- proof status
- linked evidence

### Do not show findings as only simple cards

Each finding should open into a full workspace with tabs:

- Summary
- Evidence
- Code Path
- Invariant Linkage
- PoC
- Remediation
- Similar Locations

## 18. PoCs Screen

PoCs should be treated as first-class verification assets.

Each PoC should show:

- status
- execution logs
- assumptions
- exploit code
- environment used
- proof outcome
- related finding

## 19. Report Screen

This should support two modes.

### Auditor mode

- structured report sections
- finding review
- appendix
- evidence trace

### Client mode

- cleaner presentation
- less tooling detail
- more narrative

## 20. Chat Screen

This should not be a generic LLM chat box.

It must be artifact-grounded.

### Chat should answer from

- notes
- functions
- invariants
- trust boundaries
- question log
- findings
- report sections

### Chat UI should support

- ask against entire audit
- ask against selected artifact
- ask against selected contract
- ask against selected function
- ask against finding

### Best interaction pattern

Left: chat thread

Right: cited evidence panel

When the agent answers, it should cite:

- artifact ids
- function names
- invariant ids
- finding ids

## 21. Run Trace Screen

This should show provenance clearly.

### Needed sections

- run metadata
- phase completion log
- tool calls
- approvals
- artifacts created
- evidence lineage

This is for trust and replay, not for vanity.

## 22. Visual Design Direction

SRP should look intentional, premium, and technical.

## Recommended visual character

- editorial technical
- forensic
- sharp, bright accents on quiet surfaces
- mono + serif/sans pairing
- diagram-centric
- spacious

## Typography

Avoid generic default stacks as the whole personality.

Recommended:

- UI sans: `Manrope`, `Söhne`, `IBM Plex Sans`, or `Geist`
- mono: `JetBrains Mono` or `Berkeley Mono`
- optional display/editorial accent: `IBM Plex Serif` or `Newsreader`

Use:

- sans for product UI
- mono for code, metrics, ids, logs
- serif sparingly for report/presentation sections

## Color system

Avoid purple-heavy "AI slop" and avoid neon overload.

Recommended palette direction:

- base: graphite / ink / paper
- accent 1: security green
- accent 2: caution amber
- accent 3: risk red
- accent 4: evidence blue

Light mode should be excellent.
Dark mode should be excellent.
Neither should feel like an afterthought.

## Motion

Use motion only where it clarifies state.

Good uses:

- phase progression
- artifact arrival
- diagram reveal
- proof completion
- confidence change

Bad uses:

- constant glowing
- decorative pulses everywhere
- noisy hover overload

## 23. Layout System

Use a stable three-zone layout for investigation screens:

- left rail: navigation and filters
- center: primary content
- right rail: context and evidence

For overview screens:

- modular cards with clear section hierarchy

For deep detail screens:

- split-pane with sticky evidence rail

## 24. Component System

SRP should define a real design system.

Required components:

- phase pill
- artifact card
- finding severity badge
- invariant badge
- evidence chip
- trust-boundary card
- question status chip
- function annotation panel
- diagram canvas shell
- code/evidence split view
- methodology timeline
- run health strip

## 25. Mobile Strategy

Mobile should support:

- overview
- findings review
- chat
- report reading
- phase status

Deep investigation screens can be simplified, but not broken.

The main mobile pattern should be:

- bottom sheet details
- collapsible evidence
- stacked cards

## 26. What The UI Must Avoid

Avoid these mistakes:

- making agents the main product
- showing raw logs as the main content
- using giant unreadable diagrams
- stuffing all data into a single page
- hiding evidence links
- overanimating everything
- making the product feel like a demo, not a workbench
- mixing multiple visual systems in one app

## 27. Recommended Final Navigation Model

This is the best final structure:

- `Overview`
- `Audit Flow`
- `Protocol Map`
- `Contracts`
- `Functions`
- `Invariants`
- `Hypotheses`
- `Questions`
- `Economic Risks`
- `Cross-Contract Paths`
- `Findings`
- `PoCs`
- `Report`
- `Chat`
- `Trace`

## 28. Recommended UX Flow For A User

### First-time auditor flow

1. lands on Overview
2. sees protocol summary and audit progress
3. opens Audit Flow
4. checks Protocol Map
5. inspects Invariants
6. inspects Findings
7. opens PoCs
8. reads Report

### Deep investigator flow

1. lands on Findings
2. opens a finding
3. checks linked invariant
4. checks linked function annotation
5. checks cross-contract path
6. checks PoC
7. asks chat for explanation

### Client/demo flow

1. lands on Overview
2. sees value proposition and worst-case outcome
3. opens Protocol Map
4. opens Findings
5. opens Report

## 29. What To Keep From Current UI

Keep conceptually:

- live run feeling
- visible mission progress
- some technical sharpness
- clear score and findings summary

## 30. What To Replace From Current UI

Replace:

- agent-first architecture as the main story
- overlapping page systems
- fragmented visual identity
- raw-log-heavy emphasis
- lack of artifact-based navigation

## 31. Final Recommendation

SRP UI should be rebuilt as an **auditor workbench**, not as an "AI dashboard".

The correct direction is:

1. methodology-first information architecture
2. artifact-first navigation
3. Excalidraw-style canonical diagrams
4. evidence-linked findings
5. strong function/invariant/question workspaces
6. premium technical visual design
7. logs and agent activity as secondary context, not the primary product

If you execute this properly, SRP UI will feel:

- serious
- memorable
- fast to understand
- trustworthy
- much more valuable than generic audit tooling

That is the UI/UX direction SRP should take.
