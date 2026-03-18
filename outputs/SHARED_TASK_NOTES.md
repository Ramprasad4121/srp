
---
# Protocol: SecondSwap
# Type: generic
# Detected: 2026-03-18T19:29:22.071394
---


## What This Protocol Does
Audit all contracts in /Users/ramprasadgoud/Desktop/ETH/2026-03-NFT-dealers/src for reentrancy, access control, invariant violations, and oracle manipulation



## Key Invariants
- INV-001: The total amount of tokens initially listed should always be greater than or equal to the current remaining amount of tokens — SEVERITY: MEDIUM
- INV-002: The listing status should always be one of LIST, SOLDOUT, or DELIST — SEVERITY: MEDIUM
- INV-003: The next available listing ID for each vesting plan should always be unique and incrementing — SEVERITY: MEDIUM


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
