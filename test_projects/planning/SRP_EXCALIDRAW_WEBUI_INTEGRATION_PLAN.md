# SRP Excalidraw Web UI Integration Plan

## 1. Goal

This plan decides how SRP should use Excalidraw in the localhost web UI.

The requirement is:

- SRP must use Excalidraw in the web UI
- the solution must be practical
- the solution must not depend on a single model vendor
- the solution must work for auditors and developers
- the solution must fit the existing SRP direction from:
  - [SRP_UI_UX_RESEARCH_AND_RECOMMENDATION.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_UI_UX_RESEARCH_AND_RECOMMENDATION.md)
  - [SRP_CONFIGURATION_SETUP_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_CONFIGURATION_SETUP_PLAN.md)
  - [SRP_AUDIT_METHODOLOGY_ALIGNMENT_PLAN.md](/Users/ramprasadgoud/Downloads/building/srp/test_projects/planning/SRP_AUDIT_METHODOLOGY_ALIGNMENT_PLAN.md)

This is a plan only.
No code changes are made here.

## 2. Executive Decision

SRP should use **native embedded Excalidraw in the SRP web UI** as the primary approach.

That means:

- SRP embeds the Excalidraw editor directly in the localhost app
- SRP generates and stores diagram scenes as SRP artifacts
- users can review and edit diagrams without leaving SRP
- diagrams remain provider-independent

SRP should **not** make Claude-style MCP connector usage the primary path.

MCP/manual connector support should be a **secondary optional integration** for users who want external AI-driven diagram editing.

## 3. Why This Is The Best Choice

## 3.1 Mandatory MCP is the wrong foundation

If SRP depends on an external Excalidraw MCP connector as the main diagram system, SRP becomes:

- dependent on specific AI clients
- dependent on connector availability
- dependent on vendor auth/setup
- weaker for OpenAI/NVIDIA/OpenRouter/Hugging Face/Ollama users
- weaker for pure localhost workflows

That would directly conflict with the multi-provider direction already established for SRP.

## 3.2 Native embedding matches SRP product truth

SRP is supposed to be:

- an audit workspace
- a dev workspace
- an artifact-first system
- a localhost web UI product

So diagrams should be first-class artifacts inside SRP itself, not outsourced to a third-party UX.

## 3.3 Excalidraw officially supports app embedding

Excalidraw’s official package is intended for direct app integration through `@excalidraw/excalidraw`, and its project README highlights:

- direct npm package integration
- exportable `.excalidraw` JSON scenes
- PNG/SVG export
- local-first behavior

These traits fit SRP very well.

## 3.4 Claude’s Excalidraw flow confirms MCP is optional, not required

Claude’s official Excalidraw connector is an MCP-based interactive integration.
That proves Excalidraw can be exposed to AI systems through MCP.

But that is a Claude connector design decision.
It is not evidence that SRP should make MCP the core UI strategy.

For SRP, MCP is useful as:

- an external connector option
- a power-user path
- a future interoperability layer

not as the foundation of SRP diagrams.

## 4. Research Basis

The recommendation above is grounded in the following sources.

### Excalidraw official integration direction

- Excalidraw official repo says the npm package supports direct integration and install via `@excalidraw/excalidraw`: [GitHub README](https://github.com/excalidraw/excalidraw)
- Excalidraw official repo highlights exportable scene JSON, PNG/SVG export, and local-first autosave behavior: [GitHub README](https://github.com/excalidraw/excalidraw)
- Excalidraw developer docs position the product as something developers can integrate into their own apps: [Excalidraw developer docs](https://docs.excalidraw.com/)

### Claude/MCP research

- Claude’s official Excalidraw page describes it as an “official Excalidraw MCP app” with interactive fullscreen editing: [Claude Excalidraw connector](https://claude.com/connectors/excalidraw-app-demo)
- Anthropic documentation says custom connectors use remote MCP servers and are added through connector settings: [Custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- Anthropic documentation says Claude supports SSE and Streamable HTTP remote MCP servers, with SSE likely to be deprecated later: [Building custom connectors](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)

## 5. Final Architecture Choice

SRP should implement a **three-layer diagram strategy**.

## Layer 1: Native Excalidraw in SRP web UI

This is mandatory.

Use this for:

- viewing diagrams
- editing diagrams
- annotating diagrams
- exporting diagrams
- storing diagrams as SRP artifacts

This is the default and primary experience.

## Layer 2: SRP scene generation engine

This is mandatory.

SRP should generate Excalidraw scene JSON from:

- protocol maps
- trust boundaries
- value flows
- state maps
- interaction matrices
- attack paths
- remediation diffs
- dev architecture diagrams

This is how SRP turns audit/dev artifacts into usable diagrams automatically.

## Layer 3: Optional MCP/external connector bridge

This is optional.

Use this only for:

- users who want Claude or another MCP-capable client to manipulate diagrams
- advanced collaborative AI workflows
- remote or organization-level tool interoperability later

This layer must never be required for normal SRP usage.

## 6. What SRP Should Actually Build

## 6.1 Core product requirement

SRP should embed Excalidraw directly into the TypeScript frontend.

The core implementation direction should be:

- React frontend
- `@excalidraw/excalidraw` package
- SRP-side scene persistence
- SRP-side artifact metadata

## 6.2 Diagram artifact model

Each diagram should be stored as a first-class artifact with:

- artifact id
- project id
- audit or dev run id
- phase id
- diagram type
- title
- description
- source artifact links
- scene JSON
- preview image
- provenance
- last edited by
- generation mode

### Recommended diagram types

- `protocol-map`
- `trust-boundary-map`
- `value-flow-map`
- `state-map`
- `interaction-matrix`
- `attack-path-map`
- `economic-risk-map`
- `privilege-blast-radius-map`
- `upgradeability-map`
- `callgraph-slice`
- `remediation-diff-map`
- `dev-architecture-map`

## 6.3 Generation modes

Every diagram should have one of these origins:

- `auto_generated`
- `auto_generated_then_human_edited`
- `human_created`
- `human_created_then_ai_refined`

This matters because auditors need to know whether a diagram is evidence, draft, or presentation material.

## 7. Why Native Excalidraw Beats The Alternatives

## Option A: Native embedded Excalidraw

Verdict: **best**

Pros:

- vendor-independent
- localhost-native
- works for all SRP users
- first-class artifact support
- best audit UX
- best developer UX
- easiest to connect to SRP artifacts
- no forced connector setup

Cons:

- SRP must own scene generation and persistence
- SRP must build the UI integration properly

## Option B: MCP-only Excalidraw integration

Verdict: **not acceptable as the primary approach**

Pros:

- fast for external AI editing
- useful for Claude-style interactive tooling
- good optional interoperability layer

Cons:

- not universal
- adds setup friction
- depends on external MCP client support
- weak for pure localhost artifact-first work
- diagram ownership becomes more fragmented

## Option C: open `excalidraw.com` in a separate tab and export manually

Verdict: **acceptable only as fallback**

Pros:

- simplest fallback path
- low engineering effort

Cons:

- poor UX
- poor artifact traceability
- poor methodology integration
- poor reproducibility

## 8. Recommended SRP UX

Excalidraw should appear directly in localhost UI.

## 8.1 Main places it should appear

In `srp audit`:

- Audit Flow
- Protocol Map
- Invariants
- Cross-Contract Paths
- Economic Risks
- Findings

In `srp dev`:

- Architecture
- Contract Design
- Test Planning
- NatSpec/Docs explainers
- Remediation review

## 8.2 Diagram workspace structure

Each diagram screen should have:

- diagram canvas
- artifact metadata panel
- source evidence panel
- generation controls
- revision history
- export actions

### Core actions

- `Generate`
- `Regenerate`
- `Edit`
- `Lock`
- `Compare revisions`
- `Export .excalidraw`
- `Export PNG`
- `Export SVG`
- `Open presentation mode`

## 8.3 Phase-aware ownership

Each methodology phase should create specific diagram artifacts.

Examples:

- Phase 0: protocol intent map
- Phase 1: scope map
- Phase 2: trust boundary map
- Phase 2: value flow map
- Phase 2: privilege map
- Phase 3: invariant map
- Phase 4/5: attack path diagrams
- Phase 6+: remediation and verification diagrams

## 9. How SRP Should Generate Excalidraw Diagrams

SRP should not ask the model to dump arbitrary SVG or canvas instructions.

That is weak and inconsistent.

Instead SRP should use a **diagram compiler** pattern:

1. collect structured audit/dev artifacts
2. transform them into an internal diagram AST
3. compile the AST into Excalidraw scene JSON
4. render that scene in the web UI
5. let the user edit it
6. preserve both original generated structure and edited result

## 9.1 Why this matters

This gives SRP:

- consistent layouts
- reproducible generation
- diffs between versions
- traceability to evidence
- safer regeneration

## 9.2 Diagram compiler inputs

Inputs should include:

- contract graph
- function graph
- external call graph
- privilege graph
- token flow graph
- invariant registry
- finding evidence graph
- user notes
- selected viewpoint

## 9.3 Viewpoints

Users should be able to generate the same protocol through different diagram viewpoints:

- architecture view
- asset flow view
- trust boundary view
- call flow view
- privilege view
- attack path view
- remediation view
- teaching view

## 10. Setup Recommendation

Excalidraw should be part of SRP setup, but not as a blocking external dependency.

## 10.1 First-time setup should ask

- enable native Excalidraw editor?
- enable diagram autosave?
- store diagram revisions?
- allow export to PNG/SVG?
- enable optional external Excalidraw connector integrations?

The first four should default to `yes`.

The last one should default to `no` and remain optional.

## 10.2 If user wants external AI connector support

SRP setup can offer optional config for:

- Claude Excalidraw connector
- custom remote MCP server URL
- local MCP bridge later

But this should live under:

- `Integrations`
- `Advanced`
- `External diagram tools`

not under the critical path setup.

## 11. MCP Strategy For SRP

SRP should support MCP for diagrams, but narrowly.

## 11.1 Recommended MCP role

Use MCP only for:

- external diagram editing
- connector interoperability
- advanced automation
- organization integrations later

## 11.2 Not recommended

Do not make MCP responsible for:

- core diagram rendering
- core diagram storage
- required diagram generation
- required audit flow diagrams

## 11.3 Transport recommendation

If SRP later exposes its own diagram MCP server or consumes one, prefer:

- Streamable HTTP remote MCP

Reason:

- Anthropic documents that SSE is supported today but may be deprecated in the coming months
- Streamable HTTP is the safer long-term bet

## 12. Security Recommendation

Because SRP deals with private codebases and potentially undisclosed vulnerabilities, diagrams are security-sensitive artifacts.

So the default rule should be:

- diagrams stay local inside SRP
- scenes are stored locally or in SRP-controlled storage
- exports to third-party services are explicit user actions

If external connector mode is enabled, SRP should show a warning that diagram content may leave the local environment.

## 13. Recommended Implementation Order

## Phase 1: Native read-only rendering

Build:

- artifact model
- scene storage
- render Excalidraw scenes in UI
- export support

## Phase 2: Native editing

Build:

- embedded editor
- autosave
- revision history
- diagram locking

## Phase 3: Auto-generation

Build:

- protocol map compiler
- trust boundary compiler
- value flow compiler
- attack path compiler

## Phase 4: Artifact-linked editing

Build:

- evidence side panel
- click-to-highlight related contracts/functions/findings
- provenance badges

## Phase 5: Optional MCP/external integrations

Build:

- external connector settings
- remote MCP URL support
- import/export bridge

## 14. What Must Appear In Localhost UI

The localhost web UI should visibly support:

- a `Diagrams` or `Protocol Map` section
- inline Excalidraw canvas
- artifact metadata
- evidence-linked side panel
- export controls
- version history
- regenerate from artifacts
- lock/unlock diagram
- presentation mode

Optional advanced controls:

- `Send to external diagram connector`
- `Import edited scene`
- `Open with external MCP integration`

These advanced controls should be hidden unless enabled in configuration.

## 15. Clear Recommendation

SRP should use this exact strategy:

1. embed Excalidraw natively in the SRP web UI
2. generate Excalidraw scene JSON from SRP artifacts
3. store diagrams as first-class local SRP artifacts
4. let users edit diagrams directly in localhost UI
5. keep MCP/manual connector support optional and advanced

## 16. Final Answer

The best approach is **not** “manual connection only” and **not** “MCP server only.”

The best approach is:

- **native Excalidraw in SRP web UI as the default**
- **optional MCP/manual connector integration as an advanced extension**

That gives SRP the strongest mix of:

- product quality
- provider independence
- local-first safety
- artifact traceability
- audit usability
- developer usability
- future interoperability
