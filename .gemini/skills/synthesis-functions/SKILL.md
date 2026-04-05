---
name: synthesis-functions
description: Mapping of all smart contracts and their primary state-modifying functions. Use this skill to identify the functional surface area of the protocol and locate high-risk logic.
---

# Synthesis: Function Mapping

This skill enables the agent to perform a technical inventory of the protocol's implementation.

## Objective
To map the "Implementation Layer" by identifying every contract and the key functions that drive the protocol's state transitions.

## Workflow

1.  **Contract Discovery**: Use `[TOOL: LIST_FILES]` to identify all `.sol` files in `contracts/` or `src/`. Ignore interfaces and mock files for this phase.

2.  **Function Extraction**: Use `[TOOL: READ_FILE]` on main contracts. Identify:
    *   **External/Public Functions**: Focus on those that change state (e.g., `mint`, `burn`, `stake`, `swap`).
    *   **Visibility**: Note if functions are `external`, `public`, `internal`, or `private`.
    *   **State Mutability**: Distinguish between functions that are `pure`/`view` and those that modify storage.

3.  **Risk Tagging**:
    *   Tag functions with **Security Keywords**: `payable`, `onlyOwner`, `nonReentrant`, `initializer`.
    *   Identify **High-Impact Functions**: Those that handle large transfers of value or change core protocol parameters.

4.  **Artifact Generation**:
    *   Output: JSON `{ "summary": "...", "functions": [{ "functionName": "...", "contract": "...", "visibility": "...", "isStateModifying": true, "description": "..." }] }`

## Best Practices
*   **Focus on Logic, Not Boilerplate**: Do not list standard ERC20 getters or inherited administrative functions unless they have custom logic.
*   **Cross-Check with Intent**: Ensure the functions found actually implement the intent synthesized in Phase 6.
