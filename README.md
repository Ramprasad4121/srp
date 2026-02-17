# Security Reasoning Protocol (SRP)

> A decentralized, verifiable security reasoning protocol for humans, DAOs, and autonomous agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Mainnet-green)](https://eips.ethereum.org/EIPS/eip-8004)
[![x402](https://img.shields.io/badge/x402-V2-blue)](https://x402.org)
[![OpenClaw](https://img.shields.io/badge/Agent-OpenClaw-red)](https://openclaw.ai)

---
> [!IMPORTANT]  
> SRP is under development,do not use it until official announcement.
> 
## What SRP Is

SRP is **not** a chatbot. It is **not** an AI auditor. It is **not** a SaaS.

SRP is a **security reasoning protocol** — a trust layer that wraps an AI agent with:
- On-chain policy enforcement (ERC-8004)
- Trustless payment (x402)
- Verifiable reasoning traces
- Replayable outputs

Every execution is paid, authorized, traced, and verifiable. No step is optional.

---

## Architecture

```
[ CLI ] → [ Intent Builder ] → [ ERC-8004 Policy ] → [ x402 Budget ]
                                         ↓
                              [ OpenClaw Agent (untrusted worker) ]
                                         ↓
                              [ Reasoning Trace Producer ]
                                         ↓
                              [ Output + Trace → User-Owned Storage ]
```

---


## Execution Flow (No Step Optional)

1. User creates **Execution Intent** (task + skills + budget + policy)
2. **x402** payment intent created
3. **ERC-8004** policy contract approves or rejects intent
4. Budget locked on-chain
5. **OpenClaw agent** executes multi-pass reasoning (treated as untrusted worker)
6. **Verifiable Reasoning Trace** produced
7. Output + trace returned to user
8. Budget settled (pay for compute used)

---

## Reasoning Trace (The Product)

Every SRP run produces a trace containing:

```json
{
  "input_hash": "0x...",
  "agent_version": "openclaw-2026.2.16",
  "skill_sequence": ["business-logic", "invariant", "hypothesis", "exploit"],
  "model": "moonshotai/kimi-k2.5",
  "tool_calls": [...],
  "output_hash": "0x...",
  "assumptions": [...],
  "confidence": 0.87,
  "erc8004_agent_id": 42,
  "x402_tx": "0x..."
}
```

The trace is more important than the final answer.

---

## CLI Commands

```bash
srp init                          # Initialize SRP
srp context set protocol=lending  # Set business context
srp assume oracle=manipulable     # Add assumptions
srp analyze contracts/            # Full multi-pass analysis
srp simulate attack --vector reentrancy
srp export report                 # Export PDF report
srp export trace                  # Export JSON trace
srp verify --trace traces/abc.json # Verify previous run
srp replay --trace traces/abc.json # Replay previous run
srp policy show                   # Show ERC-8004 policy
srp budget show                   # Show x402 budget
srp status                        # System status
```


---

## Built With

- **OpenClaw** — Agent runtime (untrusted worker)
- **ERC-8004** — On-chain agent identity + policy (live on mainnet Jan 29, 2026)
- **x402 V2** — HTTP-native payment protocol (Coinbase)

