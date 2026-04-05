---
name: discovery-tokenomics
description: Deep research into tokenomics, economic models, and financial incentives. Use this skill to identify systemic risks, inflationary pressures, and indirect actor models that could lead to economic exploits.
---

# Discovery: Tokenomics

This skill enables the agent to map the protocol's "Economic Layer" and financial incentives.

## Objective
To identify how value flows through the protocol and where economic misalignment could lead to security failures (e.g., bank runs, oracle arbitrage).

## Workflow

1.  **Search Strategy**:
    *   `[Protocol Name] tokenomics whitepaper`
    *   `[Protocol Name] emission schedule staking rewards`
    *   `[Protocol Name] collateralization ratio requirements`
    *   `site:medium.com [Protocol Name] fee distribution`

2.  **Analysis**:
    *   **Value Accrual**: How does the token gain value? (e.g., buyback-and-burn, staking dividends).
    *   **Supply Dynamics**: What is the inflation rate? Are there large unlocks coming up that could affect liquidity?
    *   **Collateral Model**: If it's a stablecoin or lending protocol, what assets are used as collateral? How are they valued (Oracles)?
    *   **Incentive Alignment**: Are actors incentivized to act honestly, or are there "MEV-like" opportunities built into the mechanics?

3.  **Economic Risk Identifiers**:
    *   **Death Spirals**: Look for feedback loops between the protocol's debt and its native token value.
    *   **Liquidity Fragmentation**: Identify if the protocol relies on external DEX liquidity that could vanish during a crisis.

4.  **Artifact Generation**:
    *   Output: JSON `{ "title": "Tokenomics Analysis", "summary": "...", "economicRisks": ["..."], "relevance": "High" }`

## Best Practices
*   **Search for Community Dashboards**: Tools like Dune Analytics or DefiLlama often provide better "Ground Truth" on tokenomics than the original whitepaper.
*   **Check for "Ponzinomics"**: Identify if rewards are paid out purely from new capital (systemic risk).
