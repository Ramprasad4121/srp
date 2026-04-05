---
name: discovery-docs
description: Deep research into protocol documentation, whitepapers, and Gitbooks. Use this skill when tasked with identifying the core security promises, intended value flows, and architectural boundaries of a protocol during the initial discovery phase.
---

# Discovery: Documentation

This skill guides the agent through the process of finding and analyzing high-level protocol documentation.

## Objective
The goal is to build a "Ground Truth" model of what the protocol **claims** to do. This will later be compared against the actual implementation.

## Workflow

1.  **Search Strategy**: Use `[TOOL: SEARCH]` with high-intent queries like:
    *   `[Protocol Name] whitepaper technical documentation`
    *   `site:gitbook.io [Protocol Name]`
    *   `[Protocol Name] protocol design overview`

2.  **Ingestion**: Use `[TOOL: FETCH_CONTENT]` on identified documentation URLs. Ensure you bypass generic landing pages and go straight to technical "How it Works" or "Security" sections.

3.  **Analysis**: For each source, identify:
    *   **Core Promise**: What is the primary value proposition (e.g., "delta-neutral stablecoin")?
    *   **Main Actors**: Who are the users, maintainers, and external entities (Oracles, Bridges)?
    *   **Trust Assumptions**: What must be true for the protocol to remain safe?
    *   **Invariants**: Are there any stated "always true" conditions (e.g., "USDe is always 1:1 backed")?

4.  **Artifact Generation**: Output a senior-level technical digest for each source.
    *   Format: JSON `{ "title": "...", "summary": "...", "relevance": "High|Medium|Low" }`

## Best Practices
*   **Stealth Headers**: Always assume basic bot detection. Use the high-fidelity user agents provided in the protocol infrastructure.
*   **Deep Context**: Read at least the first 15,000 characters of technical docs to ensure you don't miss nuanced security edge cases.
*   **Source Integrity**: Always link the artifact back to the original source URL for auditor verification.
