---
name: synthesis-intent
description: Synthesis of protocol "Ground Truth" from multiple discovery sources. Use this skill to reconcile documentation, audit reports, and governance data into a unified model of intended protocol behavior.
---

# Synthesis: Protocol Intent

This skill enables the agent to act as a Senior Architect, distilling diverse intelligence into a single source of truth.

## Objective
To create a high-fidelity summary of what the protocol is **intended** to do, which serves as the benchmark for all subsequent security analysis.

## Workflow

1.  **Conflict Resolution**: Review artifacts from `docs`, `audits`, and `governance`. If documentation says "X" but a prior audit or governance proposal says "Y", flag the discrepancy and prioritize the most recent/authoritative source.

2.  **Logic Extraction**:
    *   **Value Flow**: Trace how capital enters, stays, and leaves the protocol.
    *   **Core Mechanics**: Define the primary algorithms (e.g., "constant product market maker", "delta-neutral hedging").
    *   **Security Pillars**: List the 3-5 most critical security guarantees the protocol makes to its users.

3.  **Ground Truth Modeling**:
    *   Draft a **Senior-Level Summary** (2-3 paragraphs) that explains the protocol without using jargon.
    *   Identify the **Main Contracts** that implement this intent.

4.  **Artifact Generation**:
    *   Output: JSON `{ "draftSummary": "...", "mainContracts": ["..."], "interfaceCount": N, "securityPillars": ["..."] }`

## Best Practices
*   **Avoid Implementation Bias**: Focus on the *What* and *Why*, not the *How* (Solidity code). That comes in the later synthesis phases.
*   **Identify the "Edge"**: Clearly define where the protocol ends and the external world (Users, Oracles) begins.
