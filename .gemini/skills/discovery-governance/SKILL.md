---
name: discovery-governance
description: Research into governance forums, Snapshot proposals, and Discord snapshots. Use this skill to understand the social trust model, emergency procedures, and governance-controlled risk parameters.
---

# Discovery: Governance

This skill enables the agent to map the protocol's "Social Layer" and governance controls.

## Objective
To understand who controls the protocol, how fast they can change parameters, and what emergency powers exist.

## Workflow

1.  **Search Strategy**:
    *   `[Protocol Name] governance forum`
    *   `site:snapshot.org [Protocol Name]`
    *   `[Protocol Name] timelock period governance`
    *   `[Protocol Name] emergency multisig`

2.  **Scraping**: Use `[TOOL: FETCH_CONTENT]` on forum threads and proposals. Identify:
    *   **Control Points**: Which parameters can governance change? (e.g., LTV ratios, interest rates, fee tiers).
    *   **Timelocks**: Is there a delay between a proposal passing and execution? (Crucial for security).
    *   **Emergency Pause**: Who has the "Pause" button? Is it a multisig, a DAO, or an automated bot?
    *   **Recent Changes**: Have there been any recent controversial or failed proposals?

3.  **Risk Mapping**:
    *   Evaluate the **Centralization Risk**: Is the protocol truly decentralized, or is it a 3/5 multisig?
    *   Identify **Governance-as-an-Attack-Vector**: Could a large token holder drain the protocol via a malicious proposal?

4.  **Artifact Generation**:
    *   Output: JSON `{ "title": "Governance Analysis", "summary": "...", "relevance": "High" }`

## Best Practices
*   **Search for Post-Mortems**: Governance forums often contain detailed post-mortems of small incidents that never made it into official audit reports.
*   **Discord Snapshots**: If forum data is sparse, look for "Discord Summary" blogs or Medium posts.
