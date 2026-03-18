
---
# Protocol: SecondSwap
# Type: generic
# Detected: 2026-03-18T14:03:44.357680
---


## What This Protocol Does
Audit smart contracts for reentrancy, access control, invariant violations, and oracle manipulation



## Key Invariants
- INV-001: Total amount of tokens initially listed must be greater than or equal to the current remaining amount of tokens — SEVERITY: MEDIUM
- INV-002: The minimum purchase amount must be less than or equal to the total amount of tokens initially listed — SEVERITY: MEDIUM
- INV-003: The discount percentage must be between 0 and 10000 (inclusive) — SEVERITY: MEDIUM
- INV-004: The listing status must be one of LIST, SOLDOUT, or DELIST — SEVERITY: MEDIUM


## Critical Functions to Hunt
- No critical functions identified



## Trust Assumptions
- No trust assumptions identified



## Access Control Rules
- No access control rules identified



## Attack Surface Summary
- No attack surface analysis available


---
# Shared Notes for SRP Agents
# DO NOT EDIT MANUALLY
---
