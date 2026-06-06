# Agents

SRP agents are typed execution units registered with the Agent Operating System.

## Required Roles

- Intent agents extract protocol purpose, assumptions, trust boundaries, and invariants.
- Discovery agents find vulnerability candidates with evidence.
- Attacker agents construct attack paths and exploit hypotheses.
- Defender agents challenge reachability, preconditions, and state assumptions.
- Judge agents score confidence and decide whether debate should continue.
- PoC agents build and execute validation harnesses.
- Watch agents monitor runtime signals and generate incidents.
- Report agents produce audit-grade reports.

## Execution Modes

- Sequential: use when downstream agents depend on upstream outputs.
- Parallel: use for independent detectors and watch agents.
- Debate: run attacker, defender, and judge rounds until proof, disproof, or threshold.
- Verification: run exploit and state assertions before final severity.
