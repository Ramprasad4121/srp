---
name: discovery-audits
description: Deep research into prior security audit reports (Code4rena, Sherlock, Cantina, Immunefi). Use this skill to identify historical vulnerabilities, recurring security patterns, and previously identified trust assumptions.
---

# Discovery: Prior Audits

This skill enables the agent to perform comprehensive reconnaissance on a protocol's security history.

## Objective
To identify "known-unknowns" and recurring attack vectors by studying how the protocol (or similar protocols) has been broken in the past.

## Workflow

1.  **Search Strategy**: Use `[TOOL: SEARCH]` to target audit platforms:
    *   `site:code4rena.com [Protocol Name] report`
    *   `site:sherlock.xyz [Protocol Name] findings`
    *   `[Protocol Name] security audit pdf`
    *   `site:github.com [Protocol Name] audit`

2.  **Scraping**: Use `[TOOL: FETCH_CONTENT]` on report URLs. Focus on:
    *   **High/Medium Severity Findings**: What was the root cause? (e.g., Logic error, Oracle manipulation, Reentrancy).
    *   **Resolved vs. Acknowledged**: Did the team fix the issues, or are some risks still live?
    *   **Auditor Notes**: Senior auditors often leave "Centralization" or "Systemic" risks in the notes.

3.  **Synthesis**:
    *   Identify **Recurring Patterns**: Is there a specific contract that keeps having issues?
    *   Map **Complexity Hotspots**: Which functions had the most reported bugs?

4.  **Artifact Generation**:
    *   Output: JSON `{ "title": "Audit Analysis: [Firm Name]", "summary": "...", "topFindings": ["..."], "relevance": "High" }`

## Best Practices
*   **Version Check**: Ensure the audit report corresponds to the codebase version being audited.
*   **Competitor Analysis**: If no audits exist for the target, search for audits of its closest competitors (e.g., if auditing Ethena, look at Pendle or other delta-neutral protocols).
