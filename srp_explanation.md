# SRP — Security Reasoning Protocol

## What SRP Is

SRP (Security Reasoning Protocol) is a **13-agent AI system** for automated smart contract security auditing. It's designed to find and prove vulnerabilities in Solidity code with verifiable findings, using a multi-pass reasoning pipeline that combines offensive security thinking with defensive verification.

**Core Philosophy:** "One command. Proven findings." The system deploys 13 specialized AI agents that work in parallel to audit smart contracts, achieving what would take human auditors weeks in minutes.

## Key Features

### **Cost Efficiency**
- **$1 in API tokens** vs **$150,000 for human audit**
- Uses NVIDIA NIM (40 req/min free), OpenRouter (free models), LM Studio (local), or llama.cpp (local)
- Token optimization through tiered output depth and smart scope analysis

### **13 Specialized Agents**
Each agent has a specific role and "soul" (personality/identity):

1. **WATCHDOG** - SentinelAgent (11-year incident responder)
2. **ORACLE** - Price oracle manipulation hunter
3. **SPIDER** - Contract dependency mapper
4. **VIPER** - Exploit code generator
5. **GHOST** - Ghost transaction analyzer
6. **ZERO** - Zero-day attack hunter
7. **SHIELD** - Defense code generator
8. **FORGE** - Foundry/Hardhat PoC verifier
9. **SHOCKWAVE** - Flash loan attack specialist
10. **MIRROR** - Contract behavior mirror
11. **DELTA** - Delta attack vector analyzer
12. **COMMAND** - Pipeline orchestrator
13. **LEDGER** - Final report generator

### **Multi-Pass Reasoning Pipeline**
1. **Intent Detection** - Protocol intent engine identifies contract type
2. **Recon** - Domain detection (lending, AMM, bridge, staking, governance)
3. **Attack Passes** - Business logic → Invariant → Hypothesis → Exploit/Ghost/Zero parallel
4. **DynaDebate** - 2-round debate between attacker and defender agents
5. **PoC Verification** - Foundry/Hardhat proof-of-concept execution
6. **Defense** - Fix code generation and security hardening
7. **Report** - Findings consolidation and PDF export

## Technical Architecture

### **CLI Interface**
```bash
srp audit    # pre-deployment: 13 agents find and prove vulnerabilities
srp dev      # during build: security feedback as you write code
srp watch    # live production: real-time monitoring and auto-pause
```

### **FastAPI Server**
- Port 7337 with SSE streaming for real-time audit progress
- Background task processing for long-running audits
- Web UI for audit monitoring and results
- API endpoints for audit control and status

### **Skill-Based Architecture**
- **27 skills**, 265KB of specialized knowledge
- Skills loaded dynamically from `skills/MASTER_SKILLS.md`
- Each agent has specific skill sets (e.g., audit-firm-1-solidity-auditor, quillai-bsa)
- Skills define orchestration patterns and agent behaviors

### **Security Reasoning Protocol**
- **ERC-8004** - Policy approval system for execution intents
- **x402** - Budget lock system for payment control
- **OpenClaw** - Decentralized execution framework

## How It Works

### **1. Initialization**
```bash
cd your-solidity-project
srp audit
```

### **2. Pipeline Execution**
1. **Intent Agent** builds execution intent
2. **Protocol Intent Engine** triggers ERC-8004 policy approval
3. **x402 Budget Lock** ensures payment control
4. **Agent Deployment** - 13 agents spawn in parallel
5. **Multi-Pass Analysis** - Each agent performs specialized analysis
6. **DynaDebate** - Anti-bias layer prevents false positives/negatives
7. **PoC Verification** - Automated proof-of-concept execution
8. **Defense & Report** - Fix generation and findings consolidation

### **3. Results**
- **Structured findings** with severity levels (high/medium/low)
- **Exploit code** for verified vulnerabilities
- **Fix code** for security hardening
- **PDF report** with detailed analysis
- **Confidence scores** for each finding

## Agent Implementation Details

### **BaseAgent Class**
- Core agent functionality with skill injection
- Progress tracking and handoff context
- Trace logging for audit trails
- Model selection (defaults to meta/llama-3.1-405b-instruct)

### **Soul System**
Each agent has a "soul" file defining:
- **Identity** - Professional background and expertise
- **What they've seen** - Historical attack knowledge
- **Their obsession** - Specific focus areas
- **How they think** - Decision-making process
- **Their standards** - Quality and precision requirements

### **Skill System**
- Skills define orchestration patterns
- Each skill has specific triggers and modes
- Skills can be loaded individually or in groups
- Skill content includes detailed instructions and best practices

## Security Features

### **Cyfrin CodeHawks Framework**
- **Three-tier severity**: high/medium/low
- **No "critical" or "informational"** - strict adherence
- **Normalization**: critical → high, informational → low
- **Scoring**: high=25pts, medium=10pts, low=3pts
- **PROVEN** findings double the deduction

### **Guardrail System**
- Scans for prompt injection in system prompts only
- SAFE_FIELDS for code content (CONTRACT_CODE, vuln_code, fix_code, exploit_code, source_code)
- Never blocks on legitimate code content

### **PoC Verification**
- **Exploit code** field = inner statement lines only
- **Toolchain priority**: hardhat > anchor > truffle > forge
- **Synchronous execution** in ThreadPoolExecutor
- **Automated proof-of-concept** generation and verification

## Integration Capabilities

### **Telegram Bot Bridge**
- Remote CLI access via Telegram
- Commands execute in SRP project directory
- 5-minute timeout per command
- 4000-character response chunking
- Only accessible to authorized user ID

### **Discord Integration**
- Discord bot for remote coding
- Tree-based threading for conversations
- Session management and persistence
- Multi-platform support

### **Provider Support**
- **NVIDIA NIM** - 40 req/min free, OpenAI-compatible
- **OpenRouter** - Hundreds of free models
- **LM Studio** - Fully local execution
- **llama.cpp** - Local model inference

## Use Cases

### **Pre-Deployment Audit**
```bash
srp audit
```
- Full 13-agent analysis
- Comprehensive vulnerability discovery
- Proof-of-concept generation
- PDF report export

### **During Development**
```bash
srp dev
```
- Real-time security feedback
- Incremental analysis as code changes
- Immediate vulnerability detection
- Developer guidance

### **Live Production Monitoring**
```bash
srp watch
```
- Real-time transaction monitoring
- Auto-pause on suspicious activity
- Continuous security assessment
- Incident response automation

## Project Status

| Tool | Status |
|------|--------|
| `srp audit` | ✅ Working |
| `srp dev` | 🔨 In Progress |
| `srp watch` | 📋 Coming Soon |

## License & Credits

- **MIT License**
- **Built by** [@0xramprasad](https://x.com/0xramprasad)
- **ERC-8004** + **x402** + **OpenClaw** integration
- **13-agent** architecture with specialized roles

## Key Advantages

1. **Speed** - Minutes vs weeks for human auditors
2. **Cost** - $1 vs $150,000 for human audit
3. **Verification** - Proven findings with PoC execution
4. **Comprehensiveness** - 13 specialized agents covering all attack vectors
5. **Bias Prevention** - DynaDebate anti-bias layer
6. **Scalability** - Parallel agent execution
7. **Integration** - Telegram/Discord remote access
8. **Extensibility** - Skill-based architecture for adding new capabilities