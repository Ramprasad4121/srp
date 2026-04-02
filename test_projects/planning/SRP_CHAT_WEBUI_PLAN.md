# SRP Chat Web UI Plan

## 1. Goal

This document defines how the `Chat` section in the localhost SRP web UI should work.

The goal is not to add a generic chatbot tab.

The goal is to build a **serious protocol reasoning workspace** for:

- auditors
- developers
- hybrid users

This chat system must feel like:

- an artifact-aware audit copilot
- a protocol teaching surface
- a reasoning console
- a finding review workspace
- a dev assistance surface

not like:

- a plain LLM wrapper
- a random support chat
- a generic prompt playground

This is a plan only.
No code changes are made here.

## 2. Executive Conclusion

SRP chat should be built as an **artifact-grounded, mode-aware, citation-first workspace** inside the localhost UI.

That means:

- chat must always know what project it is in
- chat must always know what run, phase, contract, function, finding, or artifact the user is referring to
- chat responses must cite SRP artifacts by default
- chat must support both `audit` and `dev` workflows
- chat must not be the primary source of truth
- artifacts remain the source of truth, chat is the navigation and reasoning layer

## 3. Blunt Product Truth

Most AI chat UIs fail in serious engineering/security workflows because they are:

- stateless in practice
- weakly grounded
- too verbose
- not evidence-linked
- not workflow-aware
- not safe enough for high-trust work

If SRP chat copies normal chatbot patterns, it will be mediocre.

If SRP chat becomes an evidence-linked protocol workbench, it can become one of SRP’s strongest features.

## 4. Core Design Principles

## 4.1 Artifact-first

Chat should never replace artifacts.

Chat should sit on top of:

- findings
- invariants
- function annotations
- diagrams
- question logs
- attack paths
- reports
- traces
- test outputs
- PoCs

## 4.2 Context-visible

The user must always see what the assistant is grounded on.

The UI should show:

- active project
- active mode
- active run
- active scope
- attached artifacts
- selected contracts/functions

## 4.3 Citation-first

Every important answer should cite artifacts.

A strong answer should point to:

- function annotation
- invariant entry
- finding id
- evidence graph
- trace step
- test result
- diagram node

## 4.4 Mode-aware

Chat should behave differently in:

- auditor mode
- developer mode
- hybrid mode

## 4.5 Actionable, not fluffy

Chat should produce:

- answers
- linked evidence
- next questions
- concrete actions
- saved artifacts

not empty explanation theater.

## 4.6 Low-noise by default

The chat UI should feel calm and precise.

No giant streaming walls unless the user asks for full reasoning or run logs.

## 4.7 Internet-connected, but not internet-dependent

SRP chat should be able to use the internet when it helps.

But internet access must not replace local artifact grounding.

The rule should be:

- local SRP artifacts first
- external internet sources second
- clear source labeling always

## 5. The Correct Product Shape

SRP chat should have **three layers**.

## Layer 1: Conversation UI

This is what the user sees.

It handles:

- asking questions
- reading answers
- attaching context
- navigating evidence
- launching actions

## Layer 2: Context engine

This decides what the model sees.

It handles:

- role-aware prompts
- active project/run resolution
- artifact retrieval
- contract/function/finding lookup
- question classification
- routing to specialist workers or tools

## Layer 3: Artifact/action engine

This turns chat into durable work.

It handles:

- saving notes
- creating question log entries
- creating follow-up tasks
- generating findings drafts
- generating tests
- generating docs/NatSpec
- generating diagrams
- opening linked panels in UI

## 6. What Chat Should Actually Be Used For

The chat tab should support these major use cases.

## 6.1 Auditor use cases

- explain what this protocol does
- explain a specific contract or function
- summarize unresolved risk
- ask whether an invariant holds
- compare two code paths
- validate a suspected finding
- explain why something is or is not a false positive
- generate attack hypotheses
- ask what to inspect next
- request a PoC plan
- request variant hunting

## 6.2 Developer use cases

- write or improve NatSpec
- write comments
- explain architecture
- generate tests
- review implementation choices
- propose safer patterns
- explain state transitions
- generate docs
- prepare remediation patches
- evaluate patch risk

## 6.3 Hybrid use cases

- explain a bug from both auditor and developer perspective
- convert findings into engineering tickets
- convert audit notes into remediation advice
- generate regression tests from a finding
- generate updated diagrams after a fix

## 6.4 Internet-assisted use cases

- check standards and EIPs
- check OpenZeppelin or toolchain documentation
- compare with public incident postmortems
- search known vulnerability patterns
- check protocol docs, governance docs, or whitepapers
- pull chain or token metadata from approved sources
- enrich a finding with external references
- compare implementation against public specification language

## 7. What Chat Should Not Be

Do not make SRP chat:

- a free-form playground with no context
- an agent log viewer
- a raw chain-of-thought dump
- a replacement for findings pages
- a replacement for diagrams
- a replacement for reports

The chat layer should help the user navigate and create those artifacts.

## 8. Recommended UI Structure

The localhost `Chat` section should have a **three-panel layout** on desktop.

## Left panel: Conversation index

Show:

- conversation list
- pinned conversations
- recent conversations
- run-linked conversations
- saved prompts
- draft conversations

Filters:

- All
- Audit
- Dev
- Findings
- Contracts
- Invariants
- Questions
- Tests

## Center panel: Main conversation

Show:

- message stream
- response cards
- citations
- inline actions
- tool/action state
- follow-up suggestions
- composer

## Right panel: Context drawer

Show:

- active project
- active run
- selected mode
- attached artifacts
- selected contracts
- selected functions
- selected findings
- selected diagrams
- selected tests

This right panel is critical.
Without it, chat becomes opaque.

## 9. Mobile/Small Screen Behavior

On smaller screens:

- conversation list becomes a drawer
- context panel becomes a collapsible bottom sheet
- message stream remains primary
- citations open in modal or side sheet

The product should still feel like a workbench, not a broken desktop layout squeezed into mobile.

## 10. Main Conversation UX

## 10.1 Message types

The chat stream should support more than plain text.

Recommended message types:

- user question
- assistant answer
- artifact citation block
- finding summary card
- invariant card
- function explanation card
- diagram preview card
- test generation card
- action confirmation card
- warning/risk card
- tool progress card

## 10.2 Response structure

A strong SRP answer should usually render as:

1. direct answer
2. supporting evidence
3. linked artifacts
4. recommended next actions

This is much better than long generic prose.

## 10.3 Suggested quick actions under answers

Examples:

- `Open function`
- `Open finding`
- `Open evidence graph`
- `Generate test`
- `Create question log entry`
- `Add to report`
- `Generate Excalidraw diagram`
- `Run variant hunt`
- `Generate PoC plan`
- `Save as note`

## 11. Composer Design

The chat composer is one of the most important parts of the UI.

It should include:

- prompt input
- mode selector
- attach artifact button
- attach contract/function button
- slash commands
- scope selector
- model/provider selector optional
- send button

## 11.1 Mode selector

The user should be able to choose:

- `Explain`
- `Investigate`
- `Verify`
- `Generate`
- `Teach`
- `Review`

These are much better than a single undifferentiated prompt box.

## 11.2 Scope selector

The user should be able to target:

- whole project
- current audit run
- selected contracts
- selected functions
- selected findings
- selected tests
- current diagram

## 11.3 Slash commands

Recommended slash commands:

- `/explain-contract`
- `/explain-function`
- `/summarize-risk`
- `/check-invariant`
- `/review-finding`
- `/false-positive-review`
- `/generate-poc-plan`
- `/generate-test`
- `/write-natspec`
- `/write-comments`
- `/write-docs`
- `/compare-codepaths`
- `/variant-hunt`
- `/create-diagram`
- `/add-to-report`
- `/save-note`

## 12. The Most Important UX Feature: Visible Grounding

The user must always be able to answer:

- what is this response based on?
- what files/functions/artifacts were used?
- what assumptions were made?
- what is missing?

So every answer should be able to show:

- citations
- assumptions
- unresolved questions
- confidence
- model/provider used
- tool outputs used
- whether internet search was used
- which external sources were used

## 13. Citation System

This should be one of the strongest SRP differentiators.

Each answer should cite SRP-native artifacts, not just file lines.

Recommended citation targets:

- contract
- function
- finding
- invariant
- hypothesis
- question log entry
- test case
- report section
- diagram
- trace event
- external source if browsing was used

### External citation rules

If chat uses the internet, the UI must distinguish:

- `Local SRP artifact`
- `External web source`

The user should never confuse audited local evidence with public internet material.

### Citation card content

Each citation card should show:

- artifact title
- artifact type
- short relevance explanation
- created in phase
- last updated
- open action

## 14. Conversation Types

SRP should support multiple conversation types.

## 14.1 General workspace conversation

Use for open-ended help in a project.

## 14.2 Run-bound conversation

Bound to a specific audit or dev run.

Use for:

- reviewing a run
- following up on findings
- generating artifacts from a run

## 14.3 Artifact-bound conversation

Bound to:

- one contract
- one function
- one finding
- one diagram
- one test suite

This is extremely useful.

## 14.4 Role templates

Preset conversation templates:

- Auditor Copilot
- Dev Copilot
- Finding Reviewer
- Protocol Teacher
- Test Generator
- Remediation Reviewer

## 15. Role-Aware Behavior

## 15.1 Auditor mode

Default behavior:

- concise
- evidence-heavy
- skeptical
- methodology-aware
- false-positive resistant

Recommended UI defaults:

- citations expanded
- confidence visible
- evidence graph quick action
- question log quick action

## 15.2 Developer mode

Default behavior:

- implementation-oriented
- code-and-test focused
- remediation aware
- explanation plus generation

Recommended UI defaults:

- code actions visible
- test generation quick action
- NatSpec/docs quick action
- patch-risk quick action

## 15.3 Hybrid mode

Default behavior:

- show security reasoning and implementation consequences together

## 16. Chat To Artifact Flow

This is where SRP becomes powerful.

The user should be able to turn any useful answer into durable project state.

Examples:

- answer -> saved note
- answer -> question log entry
- answer -> finding draft
- answer -> report section
- answer -> invariant candidate
- answer -> test file request
- answer -> diagram request

This is mandatory.

If chat answers disappear into history with no artifact flow, the UX will be weak.

## 17. Suggested High-Value Workflows

## Workflow 1: Explain this function

User asks:

- explain `deposit()`

SRP should return:

- plain-English explanation
- preconditions
- state changes
- external calls
- linked invariants
- linked risks
- related tests
- `Open function annotation`

## Workflow 2: Is this a real bug?

User asks:

- is this finding real?

SRP should return:

- short verdict
- required assumptions
- exploitability analysis
- invariant impact
- counterarguments
- false-positive review
- `Open evidence graph`

## Workflow 3: Write tests from finding

User asks:

- write regression and fuzz tests for finding F-04

SRP should return:

- suggested test strategy
- assumptions
- generated test artifact draft
- `Open in Tests`

## Workflow 4: Teach me this protocol

User asks:

- explain this protocol like I am new

SRP should return:

- layered explanation
- role map
- money flow
- trust boundaries
- key invariants
- linked diagrams
- `Open protocol map`

## Workflow 5: Prepare remediation

User asks:

- how should I fix this safely?

SRP should return:

- remediation options
- tradeoffs
- risk to existing invariants
- required regression tests
- `Generate remediation plan`

## 18. Agent And Routing Model Behind Chat

The chat UI should not expose a messy “pick your agent” surface.

That is the wrong product decision.

Instead use:

- one main chat entry point
- an internal router
- specialist workers behind the scenes

### Internal routing examples

- explanation question -> Explanation path
- finding review -> FindingVerification worker
- test request -> Dev/TestGeneration worker
- invariant question -> Invariant worker
- diagram request -> Diagram worker
- patch review -> Remediation worker
- latest docs/spec/news question -> Web research path
- mixed local plus web comparison -> Hybrid evidence path

The user can optionally inspect “how this answer was produced,” but agent choreography should not dominate the UI.

## 19. Memory Model

SRP chat needs memory, but the memory must be structured.

## 19.1 Short-term conversation memory

For the current thread:

- recent messages
- attached artifacts
- active scope
- current mode

## 19.2 Workspace memory

Across the project:

- saved notes
- bookmarked artifacts
- saved prompts
- role preference
- preferred response style

## 19.3 Run memory

Bound to one audit/dev run:

- findings discussed
- unresolved questions
- user decisions
- accepted/rejected suggestions

## 20. Safety And Trust UX

This matters because SRP deals with security-critical code.

Every answer that could materially affect an audit or remediation should show:

- confidence level
- assumptions
- evidence availability
- whether browsing was used
- whether code execution was used
- whether tests were run

For risky actions, show confirmation:

- create finding
- generate exploit
- generate patch
- run tests
- overwrite artifact

## 20.1 Internet safety model

Because SRP will work on private codebases, internet-connected chat must be controlled.

Recommended default policy:

- internet access is `off` until enabled in setup
- user can enable it globally and per workspace
- user can choose approved domains or domain classes
- SRP should support `local only`, `local + approved web`, and `open web`

### Recommended modes

- `Local Only`
- `Local + Docs`
- `Local + Approved Web`
- `Open Web`

### Recommended default

- auditors: `Local + Docs`
- developers: `Local + Docs`
- hybrid: `Local + Docs`

This is safer than enabling unrestricted open web by default.

## 20.2 Approval model

For internet use, SRP chat should support two patterns:

- automatic browsing for low-risk documentation lookups
- user-confirmed browsing for broader searches

Broad external research should show:

- what will be searched
- why it is needed
- what local context will be sent

## 20.3 Privacy guardrails

SRP should never silently send full private code or undisclosed findings to arbitrary internet services.

When internet-assisted chat is used, SRP should minimize outbound context and prefer:

- extracted questions
- redacted summaries
- spec keywords
- artifact ids over raw sensitive content where possible

## 21. Recommended Sections Inside Chat

## 21. Recommended Sections Inside Chat

The `Chat` page should include these sub-tabs or modes:

1. `Ask`
2. `Investigate`
3. `Generate`
4. `Teach`
5. `Research`
6. `History`
7. `Saved`

This gives shape without making the UI noisy.

## 21.1 Research mode

This should be the internet-aware chat mode.

It should support:

- search query drafting
- domain filters
- source review
- citation collection
- save external references into SRP artifacts

This is better than mixing broad web research invisibly into every chat turn.

## 22. Integration With The Rest Of The UI

Chat should be deeply connected to all major SRP sections.

From `Functions`:

- `Ask about this function`

From `Invariants`:

- `Ask why this invariant matters`

From `Findings`:

- `Review this finding`

From `Protocol Map`:

- `Explain this diagram`

From `Tests`:

- `Generate missing tests`

From `Report`:

- `Turn this into client-ready prose`

## 23. What Must Be Visible In Localhost UI

The localhost chat section must visibly show:

- active mode
- active context
- attached artifacts
- citations
- confidence
- assumptions
- next actions
- save-to-artifact actions
- model/provider used
- internet mode
- approved domains if restricted
- external sources used in this answer

Without these, the chat section will feel weak and generic.

## 24. Best Initial Rollout

## Phase 1

Build:

- artifact-bound chat
- run-bound chat
- citation cards
- context drawer
- saved note action
- internet mode indicator
- external citation rendering

## Phase 2

Build:

- slash commands
- role templates
- finding review workflow
- function explanation workflow
- invariant review workflow
- research mode
- approved domain filters
- docs-first browsing

## Phase 3

Build:

- test generation from chat
- NatSpec/docs generation from chat
- diagram generation from chat
- report drafting from chat
- hybrid local-plus-web comparison flows
- external reference to artifact save flow

## Phase 4

Build:

- memory preferences
- team/shared conversations
- collaboration states
- advanced routing transparency
- privacy policies per workspace
- org-level web access policies

## 25. Clear Recommendation

SRP chat should be:

- artifact-grounded
- context-visible
- citation-first
- role-aware
- action-oriented
- internet-capable
- deeply integrated with the rest of localhost UI

It should **not** be a generic chatbot tab.

## 26. Final Answer

The best chat section for SRP is a **protocol reasoning workspace**, not a normal chatbox.

The winning design is:

1. one main chat entry point
2. strong visible context on the right
3. citation-heavy answers
4. artifact creation actions under every useful response
5. different behavior for auditor, developer, and hybrid modes
6. safe internet-connected research when enabled
7. deep linking into findings, invariants, functions, tests, reports, and diagrams

If SRP gets this right, the chat section can become one of the most powerful parts of the entire product.
