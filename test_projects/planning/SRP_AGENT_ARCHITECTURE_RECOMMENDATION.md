# SRP Agent Architecture Recommendation

## 1. Short Answer

Do **not** keep the current SRP agent structure as-is.

The current structure is too messy.

You should:

- keep a small number of current agents **conceptually**
- replace the overall agent architecture
- merge many current agents
- demote many current "agents" into tools, analyzers, or skills
- retire duplicate/experimental branches from the primary runtime

So the correct answer is:

- do **not** keep the current agent structure
- do **not** throw away every idea in it
- **redesign the entire agent layer cleanly**, while preserving the useful responsibilities

## 2. Why The Current Agent Structure Is Messy

After inspecting `src/srp/agents/**`, the problem is not that SRP has too few agents.
The problem is that SRP has too many overlapping kinds of "agents" at once.

Current agent families include:

- top-level orchestration agents
- attack/defense agents
- domain-specific audit agents
- attack strategy agents
- intelligence agents
- debate agents
- defense subagents
- dev agents
- analysis agents
- v2 agents
- command agents
- evolution agents
- exploit helpers

This creates several problems:

- overlapping ownership
- unclear runtime boundaries
- duplicate names and duplicate intent
- no clean distinction between:
  - real agents
  - tools
  - sub-strategies
  - analyzers
  - report generators
  - experiments

Examples of structural mess:

- two different `ReconAgent` concepts:
  - [src/srp/agents/recon_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/recon_agent.py)
  - `src/srp/agents/intelligence/recon_agent.py`
- two different `TraceAgent` locations:
  - [src/srp/agents/trace_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/trace_agent.py)
  - `src/srp/agents/command/trace_agent.py`
- top-level `DefenseAgent` plus `defense/defense_agent.py`
- `attack_agent.py` plus `attack/*` plus `debate/*` plus `v2/*`
- `access_control_mapper.py` duplicated at top level and under `dev/`

This is not sustainable.

## 3. The Real Diagnosis

The current SRP tree mixes four different things that should not live at the same level:

### 3.1 True workflow agents

These should own a methodology phase or a durable artifact.

Examples:

- intent / scope / recon
- architecture mapping
- invariant extraction
- hypothesis generation
- finding verification
- report composition

### 3.2 Domain analyzers

These are not really top-level agents.
They are specialized analyzers for protocol types.

Examples:

- lending liquidations
- AMM fee accounting
- bridge message validation
- governance quorum attacks

These should become:

- domain modules
- specialist workers
- or tool-backed analyzers

Not equal peers to the main audit workflow agents.

### 3.3 Attack strategies

These are not top-level agents either.

Examples:

- flashloan
- reentrancy
- oracle

These should become:

- strategy packs
- hunting passes
- reusable attack modules

Not standalone long-lived primary agents.

### 3.4 Platform/experimental branches

These are experiments or side systems, not the core runtime shape.

Examples:

- `v2/*`
- `evolution/*`
- `debate/*`
- `command/*`

These should either:

- move to `experimental/`
- or be absorbed into the main runtime if proven valuable

But they should not all coexist as first-class production architecture.

## 4. What To Keep From Current SRP

Keep these **responsibilities**, not necessarily the current files.

## Keep

- `IntentAgent` concept
  - protocol promise
  - initial threat model
  - pre-code understanding
- `ReconAgent` concept
  - architecture
  - value flow
  - trust boundaries
- `HypothesisAgent` concept
  - attack hypothesis generation
- `AttackAgent` concept
  - exploit hunting and vulnerability synthesis
- `DefenseAgent` concept
  - challenge findings, reduce false positives, propose fixes
- `ReportAgent` concept
  - final client-facing output
- `TraceAgent` concept
  - audit provenance and evidence trail
- `EconomicAttackAgent` concept
  - economic modeling deserves its own major responsibility
- `UpgradePatternAgent` concept
  - upgradeability deserves dedicated treatment
- `AccessControlMapper` concept
  - privilege analysis is important enough to preserve

## Keep only as submodules or specialized workers

- domain-specific audit agents under `audit/*`
- attack strategy modules under `attack/strategies/*`
- graph / threat intel concepts

## Do not keep as primary structure

- duplicate v1/v2 agent hierarchies
- duplicate recon/trace/defense variants
- debate-only agents as first-class default runtime
- evolution branch as core architecture
- command agents as core architecture

## 5. What Must Change

You should replace the current agent tree with a much cleaner model:

- **phase agents**
- **specialist workers**
- **tool/analyzer modules**
- **artifact agents**

That means:

- fewer top-level agents
- sharper ownership
- clearer boundaries
- explicit handoffs

## 6. Recommended SRP Agent Model

SRP should have **three layers**.

## 6.1 Layer 1: Core Phase Agents

These are the real top-level agents.

There should be around 10-12 of them maximum.

Recommended core phase agents:

1. `PreparationAgent`
2. `ReconAgent`
3. `ArchitectureAgent`
4. `InvariantAgent`
5. `HypothesisAgent`
6. `CodeReadingAgent`
7. `AttackSimulationAgent`
8. `EconomicModelingAgent`
9. `CrossContractPathAgent`
10. `FindingVerificationAgent`
11. `ReportAgent`
12. `TraceAgent`

These map directly to the methodology and the artifact system.

## 6.2 Layer 2: Specialist Worker Agents

These are spawned or invoked by phase agents.

Recommended specialist worker agents:

- `AccessControlWorker`
- `UpgradeabilityWorker`
- `OracleRiskWorker`
- `ReentrancyWorker`
- `FlashLoanWorker`
- `MathAuditWorker`
- `StateMachineWorker`
- `TokenBehaviorWorker`
- `GovernanceWorker`
- `BridgeWorker`
- `AMMWorker`
- `LendingWorker`
- `StakingWorker`
- `PerpetualsWorker`
- `CrosschainWorker`

These are not top-level workflow owners.
They are focused specialists.

## 6.3 Layer 3: Non-Agent Modules

Many current "agents" should stop being agents.

They should become:

- tools
- analyzers
- services
- libraries

Examples:

- strategy modules
- graph builders
- Solodit fetchers/mappers/verifiers
- exploit sandbox helpers
- patch helpers
- skill loaders

## 7. Exact Recommendation: Keep, Merge, Retire

## 7.1 Keep and rename/reframe

### Keep conceptually

- [src/srp/agents/intent_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/intent_agent.py)
  - keep, but rename conceptually to `PreparationAgent`
- [src/srp/agents/recon_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/recon_agent.py)
  - keep as part of `ReconAgent` / `ArchitectureAgent`
- [src/srp/agents/hypothesis_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/hypothesis_agent.py)
  - keep
- [src/srp/agents/attack_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/attack_agent.py)
  - keep concept, but shrink scope
- [src/srp/agents/defense_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/defense_agent.py)
  - keep concept, but rename to `FindingVerificationAgent`
- [src/srp/agents/economic_attack_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/economic_attack_agent.py)
  - keep concept
- [src/srp/agents/report_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/report_agent.py)
  - keep
- [src/srp/agents/trace_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/trace_agent.py)
  - keep
- [src/srp/agents/upgrade_pattern_agent.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/upgrade_pattern_agent.py)
  - keep as specialist worker
- [src/srp/agents/access_control_mapper.py](/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/access_control_mapper.py)
  - keep as specialist worker

## 7.2 Merge

### Merge into `PreparationAgent`

- current `IntentAgent`
- any audit-prep logic
- any high-level protocol-intent extraction

### Merge into `ArchitectureAgent`

- current `ReconAgent`
- graph / architecture / trust-boundary logic
- state variable map production
- value flow production

### Merge into `CodeReadingAgent`

- planner logic
- function annotation logic
- math deep-dive logic
- question-log maintenance

### Merge into `FindingVerificationAgent`

- current `DefenseAgent`
- courtroom/debate logic if useful
- false-positive filtering

## 7.3 Retire from primary runtime

These should not be first-class default architecture:

- `src/srp/agents/v2/*`
- `src/srp/agents/evolution/*`
- `src/srp/agents/debate/*`
- `src/srp/agents/command/*`

They can survive as:

- experimental research code
- optional strategy backends

But not as the main shape of SRP.

## 7.4 Demote to analyzers or tool modules

These should not be presented as primary top-level agents:

- `src/srp/agents/attack/strategies/*`
- most of `src/srp/agents/audit/*`
- most of `src/srp/agents/intelligence/*`
- exploit helpers
- patch helpers

These are valuable.
But they are better as specialist modules.

## 8. The Target Agent Roster SRP Should Have

If you want a clean, serious SRP, this is the recommended final roster.

## Top-level audit workflow agents

1. `PreparationAgent`
2. `ReconAgent`
3. `ArchitectureAgent`
4. `InvariantAgent`
5. `HypothesisAgent`
6. `CodeReadingAgent`
7. `AttackSimulationAgent`
8. `EconomicModelingAgent`
9. `CrossContractPathAgent`
10. `FindingVerificationAgent`
11. `ReportAgent`
12. `TraceAgent`

## Specialist workers

1. `AccessControlWorker`
2. `UpgradeabilityWorker`
3. `OracleRiskWorker`
4. `MathAuditWorker`
5. `ReentrancyWorker`
6. `FlashLoanWorker`
7. `TokenBehaviorWorker`
8. `StateMachineWorker`
9. `AMMWorker`
10. `LendingWorker`
11. `BridgeWorker`
12. `CrosschainWorker`
13. `GovernanceWorker`
14. `StakingWorker`
15. `PerpetualsWorker`

This is enough.

You do **not** need 50 equal-status agents.

## 9. Best Structural Rule For SRP

Use this rule:

If something owns a methodology phase or a durable audit artifact, it can be a top-level agent.

If something only analyzes one attack class, one domain, or one protocol family, it should be a specialist worker.

If something only computes data or runs commands, it should be a tool/service/module, not an agent.

This single rule will keep SRP clean.

## 10. What Current SRP Gets Wrong About Agents

Current SRP often treats "agent" as meaning:

- any prompt
- any analyzer
- any helper
- any strategy
- any experiment

That is the main mistake.

A real agent should have:

- clear ownership
- explicit inputs
- explicit outputs
- a defined audit phase
- durable artifacts it is responsible for

If it does not have those, it is probably not an agent.

## 11. Concrete Recommendation For You

If you ask me directly:

### Should you keep the current agents?

No, not as a structure.

### Should you keep some current agents?

Yes, conceptually.

### Should you replace the entire agent architecture?

Yes.

### Should you delete everything?

No.
Preserve the useful responsibilities and specialist knowledge.

### Should domain agents stay?

Yes, but not as equal top-level workflow agents.
They should become specialist workers.

### Should attack strategies stay?

Yes, but as strategy modules, not primary agents.

### Should v2, debate, evolution, and command branches remain core?

No.
Move them out of the primary runtime design.

## 12. Final Recommendation

SRP needs a **full agent architecture redesign**.

The correct move is:

1. keep the good responsibilities from the current core agents
2. collapse the top-level roster into a clean methodology-aligned set
3. convert domain and strategy agents into specialist workers
4. demote analyzers/helpers into tools or services
5. move experiments out of the main runtime

That will give you an SRP agent system that is:

- understandable
- extensible
- methodology-aligned
- platform-grade
- much easier to evolve in TypeScript

That is the right answer for SRP.
