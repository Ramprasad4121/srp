# SRP Audit Methodology Alignment Plan

## 1. Goal

This plan defines how SRP should align `srp audit` with the methodology in:

- [senior_auditor_audit_process.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/senior_auditor_audit_process.md)

The purpose is not just to "cover similar ideas".
The purpose is:

- identify what SRP already does
- identify what SRP does not do yet
- define how SRP must execute phases `0` through `10`
- define what must appear in the localhost web UI
- define the diagram standard SRP should use

This is a plan only. No code changes are made here.

## 2. Executive Conclusion

Current SRP already contains partial execution of the methodology, but it is not yet faithful to the senior auditor process.

SRP currently has:

- a reconnaissance-like phase
- an architecture mapping phase
- a hypothesis generation phase
- a code-reading/attack-hunting phase
- a findings and report phase
- some diagram generation
- some invariant reasoning
- some PoC verification

But SRP does not yet do the following well enough:

- formal Phase 0 written pre-audit preparation
- mandatory written threat model before deep code reading
- disciplined scope map artifact
- disciplined trust boundary map artifact
- disciplined value flow artifact
- state variable map artifact
- invariant extraction with explicit global/function/economic buckets
- function annotation system
- question log
- interaction matrix
- serious economic attack modeling
- serious cross-contract attack-path modeling
- methodology status tracking in the UI
- complete artifact-first execution and review flow

So the answer is:

- SRP is partially aligned
- SRP is not yet methodology-faithful
- `srp audit` should be redesigned to execute this methodology as the default operating system of the audit

## 3. What SRP Already Executes From The Senior Methodology

## 3.1 Phase 1 style behavior already exists

Current SRP already has an intent/recon step in:

- [src/srp/agents/intent_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/intent_agent.py)

What it already does:

- reads project-level context through `ProtocolIntentEngine`
- tries to identify protocol purpose
- extracts invariants
- writes shared notes

This maps partially to the senior methodology:

- "read everything that isn't code"
- "understand stated purpose"
- "note security guarantees"

What is missing:

- it does not explicitly force the one-sentence value proposition
- it does not force the "where does money come from and go" written answer before code reading
- it does not force the adversarial actor list
- it does not force the "worst possible outcome" statement
- it does not explicitly read prior audits/issues/community complaints as first-class inputs

## 3.2 Phase 2 style behavior already exists

Current SRP has architecture mapping in:

- [src/srp/agents/recon_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/recon_agent.py)

And orchestration support in:

- [src/srp/core/orchestrator.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/orchestrator.py)

What it already does:

- maps contracts
- identifies external calls
- identifies roles
- identifies value flows
- identifies entry points
- identifies access control

This aligns partially with:

- scope mapping
- trust boundary mapping
- value flow diagramming

What is missing:

- explicit "contracts in scope / out of scope" map
- privileged address map
- explicit "questions at each trust boundary"
- state variable map as a dedicated artifact
- clear total value at risk artifact

## 3.3 Phase 3 style behavior already exists

Current SRP does some invariant work and some hypothesis work through:

- [src/srp/agents/hypothesis_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/hypothesis_agent.py)
- [src/srp/agents/attack_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/attack_agent.py)

What it already does:

- generates attack hypotheses
- runs invariant-related passes
- performs exploit-oriented reasoning

What is missing:

- explicit invariant buckets:
  - global invariants
  - function-level invariants
  - economic invariants
- explicit requirement that every invariant becomes a tracked audit object
- hypothesis lifecycle states:
  - confirmed
  - refuted
  - pending

## 3.4 Phase 4 and 5 style behavior already exists partially

SRP already performs attack hunting and code reading-like behavior in:

- [src/srp/core/orchestrator.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/orchestrator.py)
- [src/srp/agents/attack_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/attack_agent.py)

What it already does:

- planner-assisted attack hunting
- multiple attack strategies
- some exploit and vulnerability synthesis
- PoC verification

What is missing:

- the senior auditor’s non-linear reading order as a formal plan
- function annotation sheets
- math deep-dive sheets
- explicit modifier analysis
- explicit event-analysis artifact
- explicit question log while reading

## 3.5 Findings and reporting already exist

Current SRP supports findings and final reporting in:

- [src/srp/agents/report_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/report_agent.py)

What it already does:

- compiles markdown report
- includes findings
- includes trace hash
- includes PoC-proven finding information

What is missing:

- mandatory full finding template for each finding
- explicit invariant-violated field
- explicit preconditions
- explicit attack path
- explicit similar-locations-to-check
- explicit question-log linkage

## 3.6 Diagrams already exist partially

Current SRP has diagram generation through:

- [src/srp/core/diagram_engine.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/diagram_engine.py)
- [src/srp/core/orchestrator.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/core/orchestrator.py)

What it already does:

- emits system map data
- emits value flow data
- emits trust boundary-related data

What is missing:

- methodology-phase ownership of each diagram
- persistent diagram artifact standards
- UI-native audit review of diagrams
- state variable map diagram
- interaction matrix visualization
- cross-contract attack path diagram

## 4. What SRP Is Not Executing Yet But Must Execute

These are the critical methodology gaps.

## 4.1 Phase 0 is not truly implemented

The senior methodology says Phase 0 happens before touching code and must answer in writing:

- core value proposition
- money in / money out
- adversarial actors
- worst outcome

Current SRP does not enforce that as a real phase.

This must be implemented as a hard prerequisite stage of `srp audit`.

## 4.2 The note-making system is not first-class enough

The methodology depends on a strict notes system:

- scope
- overview
- architecture
- trust boundaries
- value flows
- roles
- state variables
- invariants
- attack hypotheses
- questions
- findings
- post-audit notes

Current SRP writes some notes, but not this full evidence system.

## 4.3 The question log is missing

This is one of the highest-value gaps.

SRP must maintain a question log artifact continuously.

Without that:

- confusion gets lost
- unresolved risks get buried
- audit momentum degrades
- findings are easier to hallucinate

## 4.4 The function annotation system is missing

The senior methodology requires per-significant-function analysis:

- access
- modifiers
- inputs and trust assumptions
- preconditions checked
- state changes in order
- external calls
- math critical paths
- invariants affected
- notes

Current SRP does not produce this as a structured artifact.

## 4.5 Economic modeling is underpowered

Current SRP has attack hunting and domain-specific agents, but it does not yet enforce:

- flash loan profitability analysis
- oracle manipulation cost analysis
- fee double-charge analysis
- slow accounting drift analysis
- admin abuse blast radius analysis

This must become an explicit phase, not an implied possibility.

## 4.6 Cross-contract attack path analysis is underpowered

Current SRP reasons about attacks, but the methodology wants explicit cross-contract chain analysis:

- callback surface
- malicious token behavior
- reentrancy through external standards
- state-at-callback-time reasoning

This must be its own tracked artifact set.

## 5. Diagram Standard Decision

SRP should use **Excalidraw-style diagrams as the primary required diagram format**.

This is the best choice.

Why Excalidraw is better than animated diagrams as the primary standard:

- auditors need inspectable static artifacts
- trust boundary maps must be reviewable line by line
- value flow maps must be persistent and printable
- state and interaction diagrams are reference artifacts, not just demos
- Excalidraw diagrams work better in reports, diffs, review, and audit memory
- methodology phases need durable documentation more than visual flair

Animated diagrams can still exist later as optional explanatory overlays, but they should not be the canonical methodology artifact.

So the rule should be:

- primary required diagrams: Excalidraw-style
- optional enhancement later: animation overlays for user education

## 6. Required Phase-By-Phase `srp audit` Execution Model

When the user runs `srp audit`, SRP should execute the methodology exactly in these phases.

## Phase 0 — Pre-Audit Mental Preparation

### What SRP must do

Before deep code reading:

- read README, docs, whitepaper, config, deployment files
- produce a one-sentence value proposition
- produce a money-in / money-out summary
- enumerate adversarial actors
- define worst possible outcome
- produce an initial threat model before reading deep logic

### Required artifacts

- `00_scope.md`
- `01_protocol_overview.md`
- `02_threat_model.md`

### UI requirements

Localhost UI must show:

- value proposition card
- adversarial actors panel
- worst outcome panel
- phase completion checklist

### Gap status

- partially covered today
- must be made mandatory

## Phase 1 — Reconnaissance

### What SRP must do

- read non-code sources first
- identify explicit security guarantees
- gather prior audit signals
- gather issue/PR signals
- identify similar protocols
- convert security guarantees into candidate invariants

### Required artifacts

- `03_recon_sources.md`
- `04_security_guarantees.md`
- `05_scope_map.md`

### UI requirements

- source panel with provenance
- guarantees list
- scope map table
- in-scope / out-of-scope / external dependency sections

### Gap status

- partially covered today
- source provenance and external-source review are missing

## Phase 2 — Architecture Understanding

### What SRP must do

- generate trust boundary map
- generate value flow map
- generate privileged role map
- generate state variable map
- identify entry and exit points
- identify privileged extraction paths

### Required artifacts

- `06_architecture.md`
- `07_trust_boundaries.md`
- `08_value_flows.md`
- `09_roles.md`
- `10_state_variables.md`

### Diagram requirements

- Excalidraw system architecture diagram
- Excalidraw trust boundary diagram
- Excalidraw value flow diagram
- Excalidraw privilege graph

### UI requirements

- architecture tab
- trust boundary viewer
- value flow viewer
- role matrix
- state variable explorer

### Gap status

- partially covered today
- state variable map and privileged extraction analysis are not strong enough

## Phase 3 — Invariant Extraction

### What SRP must do

- extract global invariants
- extract function-level invariants
- extract economic invariants
- map each invariant to code locations
- map each invariant to affected state variables and external dependencies

### Required artifacts

- `11_invariants.md`
- `12_invariant_registry.json`

### UI requirements

- invariants tab
- filters by global/function/economic
- invariant-to-function linkage
- invariant status:
  - untested
  - under review
  - violated
  - defended

### Gap status

- partially covered today
- invariant taxonomy must become explicit and enforced

## Phase 4 — Attack Hypothesis Generation

### What SRP must do

- generate 30-50 specific attack hypotheses
- format each as:
  - who
  - action
  - method
  - impact
- map each hypothesis to target function/contract/invariant
- track status:
  - pending
  - refuted
  - confirmed

### Required artifacts

- `13_attack_hypotheses.md`
- `14_hypothesis_registry.json`

### UI requirements

- hypothesis board
- status chips
- linked evidence
- linked functions
- linked invariants

### Gap status

- partially covered today
- lifecycle tracking is missing

## Phase 5 — Code Reading

### What SRP must do

SRP must follow the senior reading order:

1. imports and inheritance chain
2. constructor and initialize
3. state-modifying external functions
4. view functions that inform them
5. internal/private helpers
6. modifiers
7. events

SRP must also produce function annotation sheets for all significant functions.

### Required artifacts

- `15_function_annotations/`
- `16_math_deep_dives/`
- `17_modifier_analysis.md`
- `18_event_analysis.md`
- `19_questions.md`

### UI requirements

- function explorer
- annotation sheet per function
- math risk panel
- open questions panel
- reading progress tracker

### Gap status

- mostly missing as a methodology artifact system

## Phase 6 — Note-Making System

### What SRP must do

SRP must maintain the methodology note system continuously.

Mandatory note folders:

- scope
- overview
- architecture
- trust boundaries
- value flows
- roles
- state variables
- invariants
- hypotheses
- questions
- findings
- post-audit notes

### Required artifacts

- full note tree under `.srp` or run artifacts

### UI requirements

- notes navigator
- note diff over time
- unresolved-question count
- link every finding to notes that produced it

### Gap status

- partially present
- not rigorous enough

## Phase 7 — Attack Simulation Mindset

### What SRP must do

For every critical function, evaluate the five what-ifs:

- attacker controls input
- attacker controls transaction ordering
- attacker controls time
- attacker controls external dependency
- attacker is the admin

### Required artifacts

- `20_attack_simulations/`
- `21_admin_blast_radius.md`

### UI requirements

- attack simulation cards
- blast-radius viewer
- reorderability / MEV risk panel
- dependency control risk panel

### Gap status

- partially implied today
- not explicit, not systematic

## Phase 8 — Interaction Matrix

### What SRP must do

- compute contract-to-contract read/write matrix
- highlight unexpected write paths
- highlight externally writable paths
- surface cross-contract state mutation paths

### Required artifacts

- `22_interaction_matrix.md`
- `23_interaction_matrix.json`

### Diagram requirements

- Excalidraw interaction matrix or matrix-like graph

### UI requirements

- interaction matrix tab
- read/write filters
- unexpected write alerts

### Gap status

- missing today

## Phase 9 — Economic Attack Modeling

### What SRP must do

- flash loan sequence analysis
- price manipulation analysis
- fee extraction abuse analysis
- insolvency path analysis
- slow drift / rounding analysis
- no-sequence-profitability analysis

### Required artifacts

- `24_economic_attack_models.md`
- `25_flash_loan_scenarios.md`
- `26_oracle_manipulation_models.md`

### UI requirements

- economic risk tab
- scenario cards
- profitability assumptions
- capital requirements
- oracle risk panel

### Gap status

- underimplemented today

## Phase 10 — Cross-Contract Attack Paths

### What SRP must do

- enumerate call chains across contracts
- analyze malicious token standards
- analyze callbacks and hook behavior
- analyze state at callback time
- generate explicit cross-contract exploit narratives

### Required artifacts

- `27_cross_contract_paths.md`
- `28_callback_surface_map.md`
- `29_reentrancy_surfaces.md`

### Diagram requirements

- Excalidraw call-chain diagrams
- Excalidraw callback surface diagrams

### UI requirements

- cross-contract paths tab
- callback viewer
- exploit path explorer

### Gap status

- partially present in attack logic
- not explicit enough as a methodology phase

## 7. What `srp audit` Should Do In Practice

The runtime should behave like this:

1. create audit workspace
2. complete Phase 0 artifacts before deep code read
3. complete recon source ingestion
4. generate scope map and architecture maps
5. generate invariant registry
6. generate hypothesis registry
7. begin structured code reading and annotation
8. maintain question log continuously
9. run attack simulations and economic modeling
10. run cross-contract path analysis
11. produce findings only after evidence linking
12. write full report and post-audit summary

Important rule:

SRP should not jump directly from recon into findings.
It must earn findings through methodology artifacts.

## 8. Proposed Mapping From Current SRP Phases To Correct Methodology

Current SRP phase labels are not sufficient.

Recommended mapping:

- current `Phase1:Recon` -> split into true Phase 0 + Phase 1
- current `Phase2:Mapping` -> Phase 2
- current `Phase3:Notes` -> should become Phase 4 plus partial Phase 6
- current `Phase5:Diagrams` -> should become supporting output inside Phase 2, 8, and 10, not a standalone isolated phase
- current `Phase4:CodeReading` -> should become true Phase 5 with annotations and question logging
- current `Phase6:Findings` -> should only happen after Phases 7-10 evidence is present

## 9. Required Localhost UI Structure

The localhost UI should mirror the methodology phases directly.

Required top-level sections:

- Overview
- Phase 0 Preparation
- Recon
- Architecture
- Invariants
- Hypotheses
- Code Reading
- Notes
- Attack Simulations
- Interaction Matrix
- Economic Modeling
- Cross-Contract Paths
- Findings
- Report

Every section must show:

- status
- completion %
- generated artifacts
- open questions
- linked findings

## 10. Required Artifact Rules

Every artifact should have:

- phase owner
- generated timestamp
- source provenance
- linked contracts/functions
- linked invariants
- linked hypotheses
- linked findings if any

Every finding should be linked backward to:

- one or more hypotheses
- one or more invariants
- one or more code annotations
- one or more notes or question-log entries
- PoC if available

## 11. Exact “Already Doing / Not Doing / How To Do It” Summary

## Already doing

- protocol intent extraction
- some invariant extraction
- architecture mapping
- trust/value flow approximation
- attack hypothesis generation
- attack hunting
- PoC verification
- report generation
- some diagram emission

## Not doing enough

- formal pre-audit preparation
- strict source-first recon process
- methodology note tree
- question log
- function annotation sheets
- math deep-dive sheets
- interaction matrix
- full economic modeling
- full cross-contract path modeling
- methodology-native UI

## How to do it

- make each methodology phase a first-class pipeline stage
- make each stage produce mandatory artifacts
- make the UI show those artifacts live
- block downstream phases when mandatory upstream artifacts are missing
- make diagrams canonical Excalidraw-style artifacts
- link every finding to upstream evidence artifacts

## 12. Non-Negotiable Rules SRP Must Follow

1. No finding without linked invariant or broken promise.
2. No finding without linked code path.
3. No finding without methodology evidence artifacts.
4. No skipping Phase 0.
5. No skipping question log.
6. No diagrams as cosmetic output only.
7. No chat answers that are not grounded in phase artifacts.
8. No final report that hides unresolved questions.

## 13. Final Recommendation

SRP should adopt the senior auditor methodology as the default execution contract of `srp audit`.

The correct direction is:

- use the senior methodology as the audit operating system
- use current SRP agents as partial building blocks
- fill the missing phases with explicit artifacts and UI sections
- standardize on Excalidraw-style diagrams as the primary diagram format
- make every methodology phase visible in the localhost UI

That will make SRP much closer to how elite auditors actually work, instead of just looking like a multi-agent analyzer.
