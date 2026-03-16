# SRP — Security Reasoning Protocol (ARGUS)

## What This Project Is
13-agent AI system for automated smart contract auditing.
CLI: `srp audit` → deploys agents → opens browser dashboard at localhost:7337
Stack: Python + FastAPI + Vanilla JS

## What This Project Is
13-agent AI system for automated smart contract auditing.
CLI: `srp audit` → deploys agents → opens browser dashboard at localhost:7337
Stack: Python + FastAPI + Vanilla JS

## MAKE NO MISTAKES.
Before touching any file: read it fully first.
Before running: kill port 7337 and stale anvil.
Before any LLM prompt change: check all 3 attack passes (exploit, ghost, zero) — changes must apply to all three.

## Project Structure
```
srp/
├── main.py / cli.py          # entry point
├── server.py                 # FastAPI + SSE streaming
├── core/
│   ├── orchestrator.py       # full pipeline
│   ├── poc_verifier.py       # Foundry/Hardhat PoC execution
│   ├── debate.py             # DynaDebate anti-bias layer
│   ├── anvil.py              # Anvil fork lifecycle
│   ├── intent_engine.py      # Protocol Intent Engine
│   ├── toolchain.py          # forge/hardhat/anchor/truffle detection
│   ├── pdf_exporter.py       # PDF report generation
│   └── skill_loader.py       # loads MASTER_SKILLS.md
├── agents/
│   ├── base_agent.py         # BaseAgent — soul + skill injection
│   ├── attack_agent.py       # 6-pass attack pipeline
│   ├── defense_agent.py
│   ├── intent_agent.py
│   ├── recon_agent.py
│   ├── trace_agent.py
│   ├── report_agent.py
│   └── souls/                # 13 SOUL.md files
├── skills/
│   ├── MASTER_SKILLS.md      # 27 skills, 265KB
│   └── domains/lending.md
└── static/index.html         # dark military ops UI
```

## 13 Agents (codenames)
WATCHDOG, ORACLE, SPIDER, VIPER, GHOST, ZERO, SHIELD, FORGE, SHOCKWAVE, MIRROR, DELTA, COMMAND, LEDGER

## Full Pipeline Order
Intent → Protocol Intent Engine → Recon → Domain Detection
→ Attack (business_logic → invariant → hypothesis → exploit+ghost+zero parallel)
→ [if lending, score≥5] Lending Army (5 agents parallel)
→ Merge findings
→ DynaDebate (2-round per finding, parallel across findings)
→ PoC Verifier (forge or hardhat, parallel)
→ Defense → Trace → Report → PDF Export

## LLM Config
- Provider: NVIDIA API (OpenAI-compatible)
- Model: meta/llama-3.1-405b-instruct
- BYOLLM: supports OpenAI, Anthropic, Gemini, Ollama

## Severity Rules (STRICT — never deviate)
- Cyfrin CodeHawks framework ONLY
- Three tiers: high / medium / low
- NO "critical", NO "informational"
- Normalization in _normalize_vulnerabilities(): critical → high, informational → low
- Scoring: high=25pts, medium=10pts, low=3pts; PROVEN doubles the deduction
- Floor: 15, Cap: 85 deductions max

## PoC Verifier Rules
- exploit_code field = inner statement lines ONLY — no pragma, no contract, no function wrapper
- Toolchain priority: hardhat > anchor > truffle > forge (check hardhat first)
- Hardhat: detect Viem vs Ethers.js via hardhat-toolbox-viem
- Forge: must have forge-std present before running
- run_poc() and run_poc_hardhat() are synchronous (subprocess) — run in ThreadPoolExecutor

## Guardrail Rules
- Guardrail scans for prompt injection in system prompts ONLY
- SAFE_FIELDS = {CONTRACT_CODE, vuln_code, fix_code, exploit_code, source_code}
- These must be stripped/redacted before guardrail scanning — never block on code content

## UI Colors
- Background: #0a0a0a
- Green: #00ff88
- Red: #ff4444
- Amber: #ffaa00
- Font: monospace

## Binaries
- Anvil: /Users/ramprasadgoud/.foundry/bin/anvil
- Forge: /Users/ramprasadgoud/.foundry/bin/forge

## Test Targets
- Hardhat: /Users/ramprasadgoud/Desktop/ETH/2024-12-secondswap/
- Forge:   /Users/ramprasadgoud/Desktop/ETH/2026-03-intuition/

## Common Fixes
```bash
lsof -ti:7337 | xargs kill -9 && pkill anvil   # reset before every run
pip install reportlab --break-system-packages    # PDF export dep
```


---
name: make-no-mistakes
description: Appends "MAKE NO MISTAKES." to every user prompt before processing it. Use this skill whenever you want Claude to be maximally precise, careful, and error-free in its responses.
---

# Make No Mistakes

This skill instructs Claude to append the directive **"MAKE NO MISTAKES."** to every user prompt it receives before generating a response.

## Instructions

Whenever you receive a user message, mentally (or literally, if showing your work) treat the prompt as if it ends with:

> MAKE NO MISTAKES.

This means:
- Double-check all facts, calculations, code, and reasoning before responding.
- If uncertain about something, say so explicitly rather than guessing.
- Prefer accuracy over speed — take the extra moment to verify.
- If the task involves code, test your logic mentally step-by-step.
- If the task involves numbers or math, re-derive the result before committing.
- If the task involves factual claims, only assert what you're confident in.

## Example

**User prompt (as received):**
> What is 17 × 43?

**Prompt as processed under this skill:**
> What is 17 × 43? MAKE NO MISTAKES.

**Response behavior:** Work through the multiplication carefully (17 × 40 = 680, 17 × 3 = 51, total = 731) before answering.

## Notes

- This skill applies to **every prompt** in the session — there are no exceptions.
- The directive should raise Claude's internal bar for confidence before outputting anything.
- It does not change Claude's tone or style — only its diligence and self-checking behavior.

## Known Bugs (track here)
- poc_verification_complete shows "0 passed" in terminal — counter reads wrong variable
- guardrail_blocked fires on legitimate contract code in DynaDebate
- Occasional 4-min LLM timeout on debate pass

## Agent Implementation Note
VIPER/GHOST/ZERO = 3 attack passes inside attack_agent.py (not separate files)
WATCHDOG/ORACLE/SPIDER/SHIELD/FORGE/SHOCKWAVE/MIRROR/DELTA/COMMAND/LEDGER = UI display labels + SOUL.md files
Phase 2 agents (FORGE, SHOCKWAVE, MIRROR, DELTA) are roadmap — not bugs

## Context Management
- Do NOT read skills/MASTER_SKILLS.md unless explicitly asked
- Do NOT read all .sol files at once — read specific files only when needed
- Do NOT load agents/souls/ unless working on a specific agent

## Cyfrin Severity Reference
https://support.cyfrin.io/codehawks/findings-severity

## Telegram Bot Integration
- `tg_claude.py` - Telegram bot bridge for remote CLI access
- `tg_bot.pid` - Process ID file for bot management
- `tg_bot.log` - Bot runtime logs
- All files are in `.gitignore` for version control

## Bot Usage
- Send Claude Code commands via Telegram to the allowed user
- Commands execute in SRP project directory
- Responses chunked at 4000 characters
- 5 minute timeout per command
- Only accessible to TELEGRAM_CHAT_ID from .env

## Telegram Bot Integration
- `tg_claude.py` - Telegram bot bridge for remote CLI access
- `tg_bot.pid` - Process ID file for bot management
- `tg_bot.log` - Bot runtime logs
- All files are in `.gitignore` for version control

## Bot Usage
- Send Claude Code commands via Telegram to the allowed user
- Commands execute in SRP project directory
- Responses chunked at 4000 characters
- 5 minute timeout per command
- Only accessible to TELEGRAM_CHAT_ID from .env