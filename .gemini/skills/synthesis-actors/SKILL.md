---
name: synthesis-actors
description: Mapping of the protocol's Actor Model and trust boundaries. Use this skill to identify Trusted, Adversarial, and Economic actors based on the synthesized protocol intent.
---

# Synthesis: Actor Model

This skill enables the agent to map the human and automated entities that interact with the protocol.

## Objective
To define the "Trust Architecture" of the protocol by identifying who has power, who is a threat, and who is an observer.

## Workflow

1.  **Actor Identification**:
    *   **Trusted Actors**: Who has administrative power? (e.g., Multisig, Timelock, Governance).
    *   **Economic Actors**: Who provides or removes liquidity? (e.g., LPs, Arbitrageurs, Liquidators).
    *   **Adversarial Actors**: Who are the potential attackers? (e.g., Malicious users, compromised Oracles).
    *   **Automated Actors**: Which off-chain bots are critical? (e.g., Keepers, Hedging bots).

2.  **Boundary Mapping**:
    *   Define the **Trust Boundary**: Where does the protocol's control end?
    *   Identify **External Dependencies**: (e.g., Chainlink Oracles, Uniswap Pools, LayerZero Bridges).

3.  **Role Analysis**:
    *   Compare the "Intended Roles" (from docs) with "Implementation Roles" (from code/on-chain data).
    *   Flag **Role Overlap**: Are there entities with too much combined power?

4.  **Artifact Generation**:
    *   Output: JSON `{ "markdownSummary": "...", "keyComponents": [{ "name": "...", "description": "..." }], "trustLevel": "High|Medium|Low" }`

## Best Practices
*   **Adversarial Thinking**: For every actor, ask: "What is the worst thing this entity could do if they became malicious?"
*   **Permissionless vs. Permissioned**: Clearly distinguish between actions anyone can take and actions restricted to specific roles.
