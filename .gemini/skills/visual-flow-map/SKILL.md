---
name: visual-flow-map
description: Generation of technical Protocol Flow Maps in Excalidraw JSON format. Use this skill to visually represent money entry points, internal logic vaults, external integrations, and value exit paths.
---

# Visual: Protocol Flow Map

This skill enables the agent to act as a Senior System Architect, drawing the "Map of the Protocol."

## Objective
To generate an interactive Excalidraw diagram that shows how value and data move through the system, highlighting security boundaries and trust assumptions.

## Workflow

1.  **Map Layout Design**:
    *   **Left Side**: Input/Users (e.g., Minters, LPs, Oracles).
    *   **Center**: Core Logic (e.g., Vaults, Engines, Managers).
    *   **Right Side**: Outputs/Exits (e.g., Withdrawals, Fee Claims).
    *   **Bottom**: External Dependencies (e.g., Chainlink, Uniswap).

2.  **Element Schema**:
    *   **Rectangles**: Use for Contracts or Actors.
    *   **Text**: Use for Titles and Function names on arrows.
    *   **Arrows**: Use for "Value Transfer" (Solid blue) or "Data Flow" (Dashed gray).

3.  **Synthesis Integration**:
    *   Use `synthesis-intent` for the overall story.
    *   Use `synthesis-entry-exit` for the flow connection points.
    *   Use `synthesis-actors` for labeling the boxes.

4.  **Artifact Generation**:
    *   Output: JSON object with `title`, `summary`, and `elements` array.
    *   Each element must follow the Excalidraw JSON v2 schema (Rectangle, Text, Arrow).

## Best Practices
*   **Logical Positioning**: Use a grid system (e.g., increments of 100) to keep the diagram clean.
*   **Color Coding**: 
    *   `#f3f4f6` (Light Gray) for standard contracts.
    *   `#0052ff` (Blue) for main value entry/exit arrows.
    *   `#ef4444` (Red) for high-risk trust boundaries.
*   **Labels**: Every arrow should have a text label identifying the primary function call (e.g., "mint()").
