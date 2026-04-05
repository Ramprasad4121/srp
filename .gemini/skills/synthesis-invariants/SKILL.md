---
name: synthesis-invariants
description: Extraction of Global, Function, and Economic invariants. Use this skill to define the fundamental security properties that must hold true at all times for the protocol to be considered safe.
---

# Synthesis: Protocol Invariants

This skill enables the agent to identify the "Security Heartbeat" of the protocol.

## Objective
To distill the protocol's safety requirements into a set of verifiable invariants that can be used for fuzzing, formal verification, or manual auditing.

## Workflow

1.  **Stated Invariant Extraction**:
    *   Review `discovery-docs` and `synthesis-intent` for explicit security promises.
    *   Look for phrases like "always", "never", "must remain", "cannot exceed".

2.  **Implicit Invariant Identification**:
    *   **Global Invariants**: System-wide properties (e.g., "Total supply of USDe must equal value of backing assets").
    *   **Function Invariants**: Properties that must hold before/after a function (e.g., "Withdrawal amount must be less than or equal to balance").
    *   **Economic Invariants**: Incentives and LTV ratios (e.g., "Liquidation must be profitable for the liquidator").

3.  **Priority & Category Assignment**:
    *   **Category**: Global, Function, or Economic.
    *   **Priority**: High (Loss of funds), Medium (Service disruption), Low (UI/UX issue).

4.  **Verification Strategy**:
    *   For each invariant, suggest a method of verification: **Fuzzing**, **Formal Verification (SMT)**, or **Manual Review**.

5.  **Artifact Generation**:
    *   Output: JSON `{ "summary": "...", "invariants": [{ "id": "...", "title": "...", "description": "...", "category": "...", "priority": "...", "suggestedVerification": "..." }] }`

## Best Practices
*   **Be Precise**: "The balance should be right" is a bad invariant. "The sum of all user balances must equal the contract's total tracked deposits" is a good invariant.
*   **Check for Under-Collateralization**: In any lending or synthetic protocol, the solvency invariant is the most critical.
