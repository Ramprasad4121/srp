# SRP Architecture

SRP is built as a TypeScript monorepo using `pnpm` workspaces.

## System Overview

The system consists of three main layers:

### 1. Applications (`apps/`)
- **cli**: The primary command-line interface for `srp audit` and `srp dev`.
- **gateway**: The central API and coordination server.
- **web**: The localhost React-based web interface.
- **worker**: Background task runner for long-running audit jobs.

### 2. Core Packages (`packages/`)
- **shared-types**: Canonical TypeScript interfaces used across the platform.
- **config**: Manages setup manifests, provider selections, and workspace settings.
- **events**: Type-safe event bus for inter-package communication.
- **sessions**: Logic for managing audit sessions and run lifecycles.
- **artifacts**: Persistence and retrieval of audit-produced data (findings, invariants, etc.).
- **providers**: Multi-provider LLM routing and web research service.
- **security**: Internet policy enforcement and domain guardrails.
- **agents**: Clean agent runtime and methodology-specific workers.
- **tools**: Toolchain adapters for Foundry, Slither, Aderyn, and Echidna.
- **diagram-engine**: Compiles artifacts into Excalidraw-compatible scenes.
- **report-engine**: Synthesizes full security audit reports from artifacts.
- **benchmark**: Evaluation harness for measuring finding accuracy.
- **skills**: Bundled domain knowledge and extension SDK.

### 3. Extension Layer (`extensions/`)
Supports third-party additions to the methodology or specialist agents via the `ExtensionSDK`.

## Technical Integrity
- **Local-First**: All audit data and artifacts are stored locally in the `.srp/` directory of the project being audited.
- **Type-Safe**: Strict TypeScript enforcement across all package boundaries.
- **Methodology-Driven**: Every component is aligned with the senior auditor security reasoning process.
