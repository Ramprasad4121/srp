# TODOs

## Add deployment department after project-memory and canonical graph land

What:
Design and implement the deployment department that carries a project from audited artifact state to onchain release workflows.

Why:
The approved product story is learn, build, audit, deploy. The current engineering review intentionally stops at the architectural spine for learn/build/audit so the product can become coherent before another major department is added.

Pros:
- Completes the public product promise without forcing deployment concerns into the current re-center.
- Lets deployment reuse project memory, handoff artifacts, and release gates instead of inventing a parallel pipeline.
- Creates a natural place for chain-specific tooling, release checks, and rollback UX.

Cons:
- Adds another department, more routing, and more artifact types.
- Pulls in chain execution, secrets handling, and release safety concerns.
- Easy to overbuild before the single-project flow is stable.

Context:
The `2026-04-26` office-hours design approved SRP as a "Web3 company with agents." The eng review then reduced implementation risk by focusing the first architecture pass on unified entrance, durable project memory, canonical route registry, and room projections over one project graph. Deployment was explicitly deferred so the current implementation can land without turning into a second rewrite.

Depends on / blocked by:
- First-class `ProjectMemory` above runs
- Canonical project graph with room projections as views
- Stable learn → build → audit handoff contracts

## Author beginner teaching paths after unified entrance and project memory land

What:
Create the beginner teaching flows, curriculum sequencing, and progressive teaching artifacts for users who are new to Web3 and want to learn while building.

Why:
Beginner support is part of the approved product direction, but content and pedagogy should not be designed against a moving runtime model. The architecture has to know how project memory, routing, and department handoffs work first.

Pros:
- Gives beginners a credible first experience instead of dropping them into builder or auditor surfaces.
- Lets the teaching department become more than branding by attaching lessons to real project context.
- Makes the "learn while you build" promise concrete.

Cons:
- This is content-system work, not just UI work.
- Requires pacing, simplification, and trust design, not only code.
- Can distract from landing the shared-memory foundation if done too early.

Context:
The approved design calls out beginners as a target audience, but the engineering review chose to separate identity/routing architecture from curriculum authoring. That keeps the first implementation slice focused on explicit state models and handoff integrity. Teaching content should be authored only after the unified entrance and project memory contracts are stable enough to attach lessons to the right project state.

Depends on / blocked by:
- Unified entrance with `userProfile + goal + department`
- Durable project memory
- Canonical route registry and handoff-aware room projections

## Design true multi-user collaboration after the single-user project graph is stable

What:
Design the real multi-user collaboration model for SRP so small teams can share project state, review work together, and coordinate across departments.

Why:
The approved product vision includes teams, but the current repo is still fundamentally local-first and single-session. True collaboration is a separate systems problem and should not be smuggled into the current architecture rewrite.

Pros:
- Preserves the long-term team story without corrupting the current implementation slice.
- Forces explicit design for shared state, permissions, and conflict handling instead of accidental coupling.
- Makes future remote or shared workspace support easier to reason about.

Cons:
- Requires identity, synchronization, recovery, and conflict-resolution design.
- Increases blast radius substantially if attempted before the single-user model is stable.
- Can create false urgency because the current UI already has "team" concepts.

Context:
The repo already contains a team room and control-plane surfaces, but they are derived from single-session runtime state. The eng review locked in a canonical project graph and active project snapshot for the single-user case first. Real collaboration should build on that stable graph rather than racing ahead with ad hoc shared state.

Depends on / blocked by:
- Stable single-user project graph
- Durable project memory and projection consistency
- Clear ownership model for project, department, and artifact updates
