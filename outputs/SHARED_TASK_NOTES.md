
---
# Protocol: SRP (Security Reasoning Protocol)
# Type: generic
# Detected: 2026-03-22T11:15:11.147693
---


## What This Protocol Does
AI-powered smart contract security analysis protocol featuring x402-compatible budget management for agent services, ERC-8004 style policy registries, and intent-based approval systems for autonomous security agents.



## Key Invariants
- INV-001: Budget solvency: Locked funds must always cover all settled and pending obligations. The contract must never allow settlement amounts to exceed the locked budget balance. — SEVERITY: HIGH
- INV-002: Intent approval consistency: The view function approveIntent() and the state-changing approveIntentWithEvent() must return identical boolean approval decisions for identical intent parameters to prevent state divergence. — SEVERITY: HIGH
- INV-003: Policy-authorized settlement: Budget settlement can only be triggered by agents registered in SRPPolicy with active authorization for the specific intent type, preventing unauthorized fund drainage. — SEVERITY: HIGH
- INV-004: Event-state correspondence: approveIntentWithEvent must emit exactly one IntentApproved or IntentRejected event per invocation, and the event parameters must match the actual approval decision and consumed budget amount. — SEVERITY: MEDIUM
- INV-005: Budget immutability during pending settlement: Locked budget amounts associated with pending intents cannot be withdrawn or reallocated until the intent is either settled or explicitly rejected. — SEVERITY: MEDIUM


## Critical Functions to Hunt
- approveIntentWithEvent
- settle
- lockBudget
- unlockBudget
- registerAgent
- updatePolicy


## Trust Assumptions
- AI agents registered in the policy registry act according to their declared capabilities and do not collude to drain budgets
- The x402 payment rail provides accurate settlement confirmations
- The approveIntentWithEvent function is called atomically with off-chain agent execution to prevent intent replay
- Budget oracle prices (if any) are accurate and tamper-resistant


## Access Control Rules
- Only the budget owner can lock and unlock funds in SRPBudget
- Only agents registered in SRPPolicy with valid ERC-8004 credentials can call approveIntentWithEvent
- Only the SRPPolicy contract or its designated oracle can update agent authorization statuses
- Settlement execution requires dual authorization from both the budget contract (sufficient funds) and policy contract (intent approval)


## Attack Surface Summary
- No attack surface analysis available


---
# Shared Notes for SRP Agents
# DO NOT EDIT MANUALLY
---
