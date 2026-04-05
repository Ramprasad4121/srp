---
name: synthesis-entry-exit
description: Identification of all external entry points and value exit paths. Use this skill to map how capital enters, moves within, and is removed from the protocol.
---

# Synthesis: Entry & Exit Points

This skill enables the agent to map the "Money Flows" and trust boundaries of the implementation.

## Objective
To identify every possible way for a user (or attacker) to interact with the protocol and every path by which value (tokens, ETH) can leave the system.

## Workflow

1.  **Entry Point Identification**:
    *   Find all `external` and `public` functions that accept tokens or ETH.
    *   Focus on `mint`, `deposit`, `stake`, and `supply` logic.
    *   Identify **Permissionless vs. Permissioned** entry points.

2.  **Exit Path Identification**:
    *   Trace all logic that calls `transfer`, `transferFrom`, or `safeTransfer`.
    *   Find all `withdraw`, `redeem`, `claim`, and `liquidate` functions.
    *   Identify **Administrative Exits**: Can an owner "rescue" tokens or "drain" the vault?

3.  **Access Control Matrix**:
    *   For every exit path, identify the required authorization (e.g., `onlyOwner`, `whenNotPaused`, or specific role).
    *   Identify **Zero-Check Vulnerabilities**: Can value be sent to the zero address?

4.  **Artifact Generation**:
    *   Output: JSON `{ "summary": "...", "points": [{ "id": "...", "type": "entry|exit", "contract": "...", "functionName": "...", "description": "...", "accessControl": "..." }] }`

## Best Practices
*   **The "Drain" Test**: For every vault contract, specifically look for "Emergency Rescue" functions which are common exit points for attackers.
*   **Indirect Exits**: Don't forget yield distribution or fee collection mechanisms—these are also value exit paths.
