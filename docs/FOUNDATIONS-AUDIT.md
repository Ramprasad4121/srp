# SRP Foundations Audit

**Date:** 2026-04-30
**Scope:** Verify the prerequisite foundations that `TODOS.md` says must land *before* any of the deferred items (deployment department, beginner teaching paths, multi-user collaboration) can be safely built.

**Bottom line:** Of the seven prerequisite foundations called out in `TODOS.md`, **zero are built**, **two are partially named in code under different shapes**, and **five do not exist at all**. None of the deferred TODOs can be started safely on the current foundation. If they are, they will either reproduce the existing structural issues at larger scale, or get rewritten when the foundations finally land.

---

## How the audit was performed

I read the prerequisites named in `TODOS.md`, then searched the codebase for each concept by name and by behavior. Where a concept did not exist by its TODOs name, I looked for the closest existing equivalent and judged whether it satisfies the prerequisite's intent.

Files inspected (key ones):
- `apps/gateway/src/router.ts`
- `apps/gateway/src/runtime/session-manager.ts`
- `apps/gateway/src/runtime/persistence-manager.ts`
- `apps/gateway/src/runtime/room-projection.ts`
- `apps/gateway/src/runtime/build-room-projection.ts`
- `apps/gateway/src/runtime/control-plane.ts`
- `apps/gateway/src/handlers/setup.ts`
- `apps/gateway/src/handlers/chat.ts`
- `packages/project-graph/src/index.ts`
- `packages/sessions/src/index.ts`
- `packages/chat-runtime/src/conversation-manager.ts`
- `packages/shared-types/src/index.ts`
- `apps/web/src/features/team/team-view.ts`

Searches run:
- `rg "ProjectMemory|project[_ -]?memory"` → only `TODOS.md`
- `rg "userProfile|UserProfile|unifiedEntrance"` → only `TODOS.md`
- `rg "RouteRegistry|route[_ -]?registry|canonical.*route"` → only `TODOS.md`
- `rg "RoomProjection"` → exists, in `apps/gateway/src/runtime/`, `packages/shared-types`, `apps/web`
- `rg "default-project"` → 2 hits in `session-manager.ts` (both literal hardcodes)
- `rg "ProjectStore|listProjects|getProjects"` → no hits

---

## Foundation status

| # | Prerequisite (per TODOs.md)                                                                 | Status         | Notes |
|---|---------------------------------------------------------------------------------------------|----------------|-------|
| 1 | First-class `ProjectMemory` above runs                                                      | **NOT BUILT**  | Only run-scoped persistence exists. |
| 2 | Canonical project graph with room projections as views                                      | **NOT BUILT**  | A different `project-graph` package exists (smart-contract deps). Rooms each derive independently from run data. |
| 3 | Unified entrance with `userProfile + goal + department`                                     | **NOT BUILT**  | Only the multi-step setup flow exists; it captures `RuntimeMode`, not a user profile / goal / department. |
| 4 | Canonical route registry (and handoff-aware room projections)                               | **NOT BUILT**  | `router.ts` is a 308-line hardcoded if/else chain; no registry, no metadata. |
| 5 | Stable learn → build → audit handoff contracts                                              | **NOT BUILT**  | No "learn" department exists. Phases are a sequential array inside one session. No handoff objects. |
| 6 | Stable single-user project graph                                                            | **NOT BUILT**  | `projectId` is hardcoded to `"default-project"` in two places. No project store. |
| 7 | Clear ownership model for project, department, artifact updates                             | **NOT BUILT**  | No user identity, no department field on artifacts, no update protocol — artifacts are write-once. |

---

## Detailed findings

### 1. `ProjectMemory` above runs — NOT BUILT

**What TODOs require:** Durable project memory that lives *above* individual runs and is shared across departments.

**What exists:** `PersistenceManager` (`apps/gateway/src/runtime/persistence-manager.ts`) is **run-scoped**, not project-scoped:
- It writes to `.srp/runs/<runId>/manifest.json`, `.srp/runs/<runId>/events.jsonl`, and `.srp/runs/<runId>/artifacts/<artifactId>.json`.
- There is no `.srp/projects/<projectId>/...` layer. There is no `ProjectMemory` class, no project-level state, no project listing API.
- `RunManifest` carries a `projectId` field, but it is always literally `"default-project"` (see `session-manager.ts:123` and `:178`). No user code passes a real project id.

**Implication:** Every TODO depends on this. The deployment department needs to know "which project are we deploying" and "what handoff artifacts is the audit department offering us". Beginner teaching needs "where is this user in their project journey across runs". Multi-user collaboration needs "what is the shared project state". None of that is possible against per-run JSON files keyed by `"default-project"`.

### 2. Canonical project graph with room projections as views — NOT BUILT

**What TODOs require:** A single canonical graph representing project state, with each room (audit, build, team, control-plane) being a *projection* over that one graph.

**What exists, and why it does not satisfy the requirement:**
- `packages/project-graph/src/index.ts` (107 lines) models the **dependency graph between Solidity contracts** (nodes are `"contract" | "interface" | "library" | "abstract"`). This is a *source-code* graph, not the *project state* graph the TODOs are talking about.
- The actual room projections (`AuditRoomProjector`, `rebuildBuildRoomProjection`, `deriveControlPlaneProjection`) each derive **independently** from `RunManifest + events + payloads`. They do not project from a shared canonical structure. A schema change in one projection has no relationship to the others — they will drift.
- `apps/web/src/features/team/team-view.ts` confirms the TODO's own observation: the team room derives its "members" from `runtime.agentRegistry.activeInstances` (lines 38–50), which is single-session runtime state, not real team data.

**Implication:** The TODOs treat "rooms as views over a canonical graph" as a foundation. The codebase treats "rooms as parallel rebuilders over manifest JSON". These are very different architectures.

### 3. Unified entrance with `userProfile + goal + department` — NOT BUILT

**What TODOs require:** A single entrance that takes `(userProfile, goal, department)` and routes the user into the correct department with the correct project context.

**What exists:** `apps/gateway/src/handlers/setup.ts` defines a multi-step flow:
- `POST /api/setup/role` — sets `RuntimeMode` (`"auditor" | "developer" | "hybrid"`)
- `POST /api/setup/providers` — picks LLM providers
- `POST /api/setup/workspace` — picks a workspace dir
- `POST /api/setup/complete/welcome|providers|workspace` — completes a step
- `GET /api/setup` — fetches the setup manifest

There is no `userProfile`, no `goal`, and no `department` anywhere in the codebase outside `TODOS.md`. The setup flow saves a `SetupManifest`, not a routable profile.

**Implication:** The beginner teaching paths TODO is gated on this exactly because the curriculum needs to know "who is this person, what are they here to do, and which department owns the next step". That input doesn't exist yet.

### 4. Canonical route registry — NOT BUILT

**What TODOs require:** A canonical registry of routes that the rooms can reflect over to build handoff-aware projections.

**What exists:** `apps/gateway/src/router.ts` is a 308-line `routeRequest` function with an imperative if/else chain. Each route is wired by hand, with no metadata about:
- which department owns it
- which room it projects into
- which handoff stage it serves
- what artifacts it consumes or produces

**Implication:** Without a registry, every handoff-aware projection has to hardcode its own knowledge of routes. Adding a deployment department means another wave of hardcoded paths in the router AND in every projection that wants to reference deployment state.

### 5. Stable learn → build → audit handoff contracts — NOT BUILT

**What TODOs require:** Stable contract objects that describe how a project moves between learn → build → audit (and eventually deploy), including required artifacts, acceptance criteria, and ownership transfer.

**What exists:**
- A "learn" department does not exist anywhere in code.
- The pipeline is a sequential array of 17 audit phases in `session-manager.ts:28–47` (`TARGET_PHASES`), executed by `runAuditWorkflow` inside one session.
- The "build room" projection (`build-room-projection.ts`) is a derived view that re-groups the *same audit phases* into stages (`discover / plan / design / build / qa / ship`). It is not a separate department with its own state — it is a re-presentation of audit run data.
- There is no `HandoffContract` type, no handoff dispatcher, no acceptance check.

**Implication:** "Stable handoff contracts" is the foundation that lets deployment trust audit's output, and lets audit trust build's output. Today there is nothing to be stable about — the phases are one linear list inside one session.

### 6. Stable single-user project graph — NOT BUILT

**What TODOs require:** A stable representation of one user's project state that survives across runs.

**What exists:**
- `let activeSessionId`, `let activeRunId`, `let phaseStates`, `let liveArtifacts` — all module-level singletons in `session-manager.ts`. The runtime supports exactly **one** in-flight session at a time.
- No `Project` entity is persisted. `RunManifest.projectId` is `"default-project"`.
- `packages/sessions/src/index.ts` defines an in-memory `SessionStore` map but it is unused by the gateway runtime — the gateway uses the singleton state above.

**Implication:** Every TODO assumes a stable single-user project graph as the foundation that multi-user, deployment, and teaching layer onto. That graph does not exist yet.

### 7. Clear ownership model — NOT BUILT

**What TODOs require:** A clear ownership model for project, department, and artifact updates.

**What exists:**
- No user identity at all — sessions are anonymous singletons.
- Artifacts (`ArtifactMetadata`) carry `kind` and `phase`, but not `department` or `owner`.
- Artifacts are write-once via `RuntimeArtifactWriter.persistArtifact` — there is no update protocol, conflict handling, or version history.

**Implication:** Multi-user collaboration depends entirely on this. So does "department X handed off to department Y" semantics for deployment.

---

## Recommended path forward (in order)

These are the foundation builds that, in this order, unblock the three deferred TODOs. Each is a real engineering scope, sized realistically.

### Phase 0 — Decide (1 short conversation, ~1 day)
- Confirm which of the deferred TODOs is the highest-value target. (The deployment department is the most concrete and most user-visible.)
- This decision shapes how much of each foundation has to land. (Multi-user collab requires *all* foundations; deployment requires #1, #2, #5; teaching requires #1, #3, #4.)

### Phase 1 — Project as a first-class entity (foundations #1, #6)
**What:** Replace the hardcoded `"default-project"` with a real `Project` aggregate. Add `ProjectMemory` with project-scoped persistence (`.srp/projects/<projectId>/`), and lift run history into project memory.
**Deliverables:**
- `packages/project-memory/` package with `ProjectStore`, `ProjectMemory`, persistence layout
- `apps/gateway` switched off the singleton `let activeSessionId` model to a project-keyed runtime registry
- Migration: existing `.srp/runs/` becomes `.srp/projects/default-project/runs/`
**Estimate:** ~1.5 weeks for one engineer who knows the codebase. Risk: medium — touches the runtime singleton.

### Phase 2 — Canonical project graph + projections (foundation #2)
**What:** Define one canonical project graph type, and rewrite the existing room projectors as pure functions over it. Today's projectors stay, but as adapters over the new graph.
**Deliverables:**
- `packages/project-graph` reframed (or a new `packages/canonical-graph`) — keep contract dependency separate
- Existing `AuditRoomProjector`, `rebuildBuildRoomProjection`, `deriveControlPlaneProjection` rewritten as pure projections
- A snapshot test fixture: same input graph → all projections deterministic
**Estimate:** ~1 week. Risk: low (pure refactor with tests).

### Phase 3 — Route registry and handoff contracts (foundations #4, #5)
**What:** Build a `RouteRegistry` with route metadata (department, room, handoff stage). Define `HandoffContract` and a tiny dispatcher. Wire current routes through the registry.
**Deliverables:**
- `packages/route-registry/`
- `packages/handoff/` with contract types and a dispatcher
- `apps/gateway/src/router.ts` rewritten as registry walker (~50 lines instead of 308)
- One real handoff implemented end-to-end (e.g. "build → audit") as the proof
**Estimate:** ~1 week. Risk: low–medium.

### Phase 4 — Unified entrance + ownership (foundations #3, #7)
**What:** Add `userProfile`, `goal`, and `department` to setup. Add an owner field to artifacts and a basic update protocol (last-write-wins is fine for single-user).
**Deliverables:**
- `userProfile` schema and persistence
- New `POST /api/entrance` route that takes `(userProfile, goal, department)` and returns a routable target
- `ArtifactMetadata.owner` field, write-rules in `RuntimeArtifactWriter`
**Estimate:** ~1 week. Risk: low.

### Phase 5 — Pick a deferred TODO and ship it
After Phases 1–4, the deployment department is straightforwardly buildable on top: it gets its own department, its routes go in the registry, it consumes audit handoff artifacts via a `HandoffContract`, and it persists into project memory.

**Total:** ~4.5 weeks of focused work to clear the foundations, then the chosen TODO on top.

---

## Recommendation in one paragraph

Do not start any of the three deferred TODOs yet. Start with **Phase 1 (project as a first-class entity)**, because every other foundation and every deferred TODO depends on it, and because the singleton `let activeSessionId` model in `session-manager.ts` is the single biggest structural blocker in the codebase right now. Phase 1 is a self-contained, demoable piece of work (you can show a `srp project list / srp project switch` flow), and it makes Phases 2–4 much easier because they will all key off the project entity it introduces.
