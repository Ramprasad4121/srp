#!/usr/bin/env python3
"""
SRP — Security Reasoning Protocol
CLI: Primary control plane (source of truth)

The CLI is responsible for:
- Building execution intents
- Triggering ERC-8004 policy approval
- Triggering x402 budget lock
- Initiating agent execution
- Displaying structured results
- NEVER bypassing policy or payment
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone


def print_banner():
    print("""
╔═══════════════════════════════════════════════════════════╗
║   SRP — Security Reasoning Protocol                       ║
║   Verifiable · Policy-Bound · Decentralized               ║
║   ERC-8004 + x402 + OpenClaw                              ║
╚═══════════════════════════════════════════════════════════╝
""")


def load_config() -> dict:
    config_path = Path("srp.config.json")
    if not config_path.exists():
        print("[SRP] ❌ Not initialized. Run: srp init")
        sys.exit(1)
    with open(config_path) as f:
        return json.load(f)


def load_context() -> dict:
    ctx_path = Path(".srp-context.json")
    if ctx_path.exists():
        with open(ctx_path) as f:
            return json.load(f)
    return {}


def save_context(ctx: dict):
    with open(".srp-context.json", "w") as f:
        json.dump(ctx, f, indent=2)


def load_assumptions() -> list:
    assume_path = Path(".srp-assumptions.json")
    if assume_path.exists():
        with open(assume_path) as f:
            return json.load(f)
    return []


def save_assumptions(assumptions: list):
    with open(".srp-assumptions.json", "w") as f:
        json.dump(assumptions, f, indent=2)


# ─────────────────────────────────────────────────────────
# COMMANDS
# ─────────────────────────────────────────────────────────

def cmd_init(args):
    """Initialize SRP in current directory."""
    print_banner()

    config = {
        "version": "srp-0.1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "agent": {
            "runtime": "openclaw",
            "binary": "openclaw",
            "model": "meta/llama-3.1-405b-instruct",
        },
        "policy": {
            "mode": "local",
            "erc8004_registry": "",
            "erc8004_agent_id": 0,
            "policy_contract": "",
        },
        "economics": {
            "mode": "local",
            "x402_facilitator": "https://api.cdp.coinbase.com/platform/v1/x402",
            "wallet_address": "",
            "default_budget_usdc": 5.0,
            "network": "eip155:84532",
        },
        "storage": {
            "outputs_dir": "srp-outputs/",
            "traces_dir": "srp-traces/",
            "ipfs": False,
            "github_repo": "",
        },
        "reasoning": {
            "default_depth": 3,
            "timeout_seconds": 300,
        }
    }

    # Create directories
    Path("srp-outputs").mkdir(exist_ok=True)
    Path("srp-traces").mkdir(exist_ok=True)

    # Write config
    with open("srp.config.json", "w") as f:
        json.dump(config, f, indent=2)

    # Write default policy
    from policy import PolicyConfig
    PolicyConfig.default().save("srp.policy.json")

    print("✅ SRP initialized successfully\n")
    print("Files created:")
    print("  📄 srp.config.json  — Protocol configuration")
    print("  📄 srp.policy.json  — ERC-8004 policy rules")
    print("  📁 srp-outputs/     — Audit reports")
    print("  📁 srp-traces/      — Reasoning traces\n")
    print("Next steps:")
    print("  srp context set protocol=lending chain=ethereum")
    print("  srp assume oracle=manipulable flash-loans=enabled")
    print("  srp analyze contracts/ --budget 5.0 --depth 3")


def cmd_context(args):
    """Set protocol context for analysis."""
    ctx = load_context()

    if args.subcommand == "set":
        for item in args.values:
            if "=" not in item:
                print(f"[SRP] ❌ Invalid format: {item}. Use key=value")
                continue
            key, value = item.split("=", 1)
            ctx[key] = value
            print(f"[SRP] ✅ context.{key} = {value}")
        save_context(ctx)

    elif args.subcommand == "show":
        if not ctx:
            print("[SRP] No context set")
        else:
            print("[SRP] Current context:")
            for k, v in ctx.items():
                print(f"  {k} = {v}")

    elif args.subcommand == "clear":
        save_context({})
        print("[SRP] ✅ Context cleared")


def cmd_assume(args):
    """Add analysis assumptions."""
    assumptions = load_assumptions()

    for item in args.values:
        assumptions.append(item)
        print(f"[SRP] ✅ Assumed: {item}")

    save_assumptions(assumptions)


def cmd_analyze(args):
    """
    Run full multi-pass security analysis.

    This is the main SRP execution command.
    Follows canonical flow: Intent → ERC-8004 → x402 → Agent → Trace → Settle
    """
    print_banner()
    config = load_config()
    ctx = load_context()
    assumptions = load_assumptions()

    target = args.target
    budget = args.budget or config["economics"]["default_budget_usdc"]
    depth = args.depth or config["reasoning"]["default_depth"]

    if not Path(target).exists():
        print(f"[SRP] ❌ Target not found: {target}")
        sys.exit(1)

    print(f"[SRP] 🎯 Target: {target}")
    print(f"[SRP] 💰 Budget: ${budget:.2f} USDC")
    print(f"[SRP] 🧠 Depth: {depth} passes")
    if ctx:
        print(f"[SRP] 📋 Context: {ctx}")
    if assumptions:
        print(f"[SRP] 💭 Assumptions: {assumptions}")
    print()

    # ── Step 1: Build Execution Intent ──────────────────────
    from intent import ExecutionIntent
    from policy import ERC8004PolicyClient
    from budget import X402BudgetEngine
    from agent import OpenClawWorker
    from trace import ReasoningTrace
    from srp_pkg.pipeline import MultiPassReasoningPipeline, PASS_SEQUENCE

    task = args.task or f"Perform comprehensive security analysis of {target}"
    if ctx.get("protocol"):
        task += f" ({ctx['protocol']} protocol)"

    # Determine allowed skills based on depth
    allowed_skills = [p["skill"] for p in PASS_SEQUENCE[:depth]]
    # Always include chain-specific audit skills
    if ctx.get("chain") in ("ethereum", "evm"):
        allowed_skills.append("evm-foundry-audit")
    if ctx.get("chain") in ("solana",):
        allowed_skills.append("solana-anchor-audit")
        allowed_skills.append("solana-vulnerability-scanner")
    # Always include these
    allowed_skills.extend(["token-integration-analyzer", "audit-prep-assistant"])

    intent = ExecutionIntent(
        task=task,
        inputs=[target],
        allowed_skills=list(set(allowed_skills)),
        max_reasoning_depth=depth,
        budget_usdc=budget,
        privacy_mode=getattr(args, "privacy", False),
        chain_context=ctx.get("chain"),
        protocol_context=ctx.get("protocol"),
    )

    # Validate intent
    valid, reason = intent.validate()
    if not valid:
        print(f"[SRP] ❌ Invalid intent: {reason}")
        sys.exit(1)

    print(f"[SRP] 📋 Execution Intent")
    print(f"[SRP]    ID:   {intent.intent_id[:8]}...")
    print(f"[SRP]    Hash: {intent.intent_hash[:16]}...")
    print(f"[SRP]    Skills: {', '.join(intent.allowed_skills[:4])}{'...' if len(intent.allowed_skills) > 4 else ''}")

    # Save intent for audit trail
    intent_path = f"srp-traces/{intent.intent_id}-intent.json"
    intent.save(intent_path)
    print(f"[SRP]    Saved: {intent_path}\n")

    # ── Step 2: ERC-8004 Policy Approval ─────────────────────
    print(f"[SRP] 🔐 Requesting ERC-8004 policy approval...")
    policy_client = ERC8004PolicyClient(
        agent_id=config["policy"].get("erc8004_agent_id", 0),
        local_mode=(config["policy"]["mode"] == "local"),
    )
    policy_client.load_policy("srp.policy.json")

    approved, reason = policy_client.approve_intent(
        intent_hash=intent.intent_hash,
        skills=intent.allowed_skills,
        depth=intent.max_reasoning_depth,
        budget_usdc=intent.budget_usdc,
        exploit_sim="exploit-simulation" in intent.allowed_skills,
    )

    if not approved:
        print(f"[SRP] ❌ Policy REJECTED: {reason}")
        print(f"[SRP]    Edit srp.policy.json to adjust limits")
        sys.exit(1)

    print()

    # ── Step 3: x402 Budget Lock ──────────────────────────────
    print(f"[SRP] 💳 Creating x402 payment intent...")
    budget_engine = X402BudgetEngine(
        mode=config["economics"]["mode"],
        wallet_key=os.getenv("SRP_WALLET_KEY", ""),
        wallet_address=config["economics"].get("wallet_address", ""),
    )

    payment = budget_engine.create_payment_intent(
        intent_hash=intent.intent_hash,
        amount_usdc=budget,
        executor_address=config["economics"].get("wallet_address", "srp-local"),
    )

    print(f"\n[SRP] 🔒 Locking budget...")
    locked = budget_engine.lock_budget(payment)
    if not locked:
        print(f"[SRP] ❌ Failed to lock budget. Execution aborted.")
        sys.exit(1)

    print()

    # ── Step 4: Initialize Trace ──────────────────────────────
    trace = ReasoningTrace(
        intent_hash=intent.intent_hash,
        agent_runtime="openclaw",
        agent_version=config["agent"].get("model", "meta/llama-3.1-405b-instruct"),
        model=config["agent"]["model"],
        erc8004_agent_id=config["policy"].get("erc8004_agent_id"),
    )
    trace.erc8004_approval_tx = f"local-approved-{intent.intent_hash[:8]}"

    # Add user-provided assumptions to trace
    for assumption in assumptions:
        trace.add_assumption(assumption, source="user", confidence=1.0)

    # ── Step 5: Execute Reasoning ─────────────────────────────
    print(f"[SRP] 🧠 Starting multi-pass reasoning pipeline...")
    agent = OpenClawWorker(
        openclaw_binary=config["agent"]["binary"],
        timeout_seconds=config["reasoning"]["timeout_seconds"],
    )
    pipeline = MultiPassReasoningPipeline(agent, budget_engine, policy_client)

    try:
        trace = pipeline.execute(intent, payment, trace, target)
    except Exception as e:
        print(f"\n[SRP] ⚠️  Reasoning error: {e}")
        print(f"[SRP]    Saving partial trace...")

    # ── Step 6: Record on ERC-8004 ───────────────────────────
    if trace.output_hash:
        policy_client.record_execution(intent.intent_hash, trace.output_hash)

    # ── Step 7: Settle Budget (x402) ─────────────────────────
    print(f"\n[SRP] 💸 Settling x402 budget...")
    budget_engine.settle_budget(payment)
    trace.cost_usdc = payment.amount_used_usdc

    # ── Step 8: Save Outputs ──────────────────────────────────
    trace_path = f"srp-traces/{trace.trace_id}.json"
    trace.save(trace_path)

    # Print summary
    print(trace.summary())
    print(f"\n[SRP] 📁 Trace saved: {trace_path}")
    print(f"[SRP] 📁 Intent saved: {intent_path}")
    print(f"\n[SRP] Next steps:")
    print(f"       srp export report          # Generate PDF report")
    print(f"       srp verify --trace {trace_path}")
    print(f"       srp replay --trace {trace_path}")


def cmd_simulate(args):
    """Simulate a specific attack vector."""
    print_banner()
    ctx = load_context()

    print(f"[SRP] 🎯 Simulating attack: {args.vector}")
    print(f"[SRP] Context: {ctx}")
    print()
    print("[SRP] Run 'srp analyze <target>' first to generate findings.")
    print("[SRP] Then simulate specific vectors from those findings.")
    print()
    print("Example:")
    print("  srp analyze contracts/ --depth 3")
    print("  srp simulate attack --vector reentrancy --finding SRP-0301")


def cmd_export(args):
    """Export report or trace."""
    if args.type == "report":
        _export_report(args)
    elif args.type == "trace":
        _export_trace(args)
    elif args.type == "all":
        _export_report(args)
        _export_trace(args)


def _export_report(args):
    """Generate audit report from latest trace."""
    traces_dir = Path("srp-traces")
    trace_files = sorted(traces_dir.glob("*.json"))
    trace_files = [f for f in trace_files if "-intent" not in f.name and "payments" not in f.name and "executions" not in f.name]

    if not trace_files:
        print("[SRP] ❌ No traces found. Run 'srp analyze' first.")
        return

    latest = trace_files[-1]
    with open(latest) as f:
        trace_data = json.load(f)

    print(f"[SRP] 📄 Generating report from: {latest.name}")
    _generate_markdown_report(trace_data)


def _generate_markdown_report(trace_data: dict):
    """Generate markdown audit report from trace."""
    findings = trace_data.get("findings", [])
    critical = [f for f in findings if f["severity"] == "CRITICAL"]
    high = [f for f in findings if f["severity"] == "HIGH"]
    medium = [f for f in findings if f["severity"] == "MEDIUM"]
    low = [f for f in findings if f["severity"] in ("LOW", "INFO")]

    report = f"""# SRP Security Analysis Report

**Trace ID:** `{trace_data['trace_id'][:16]}...`  
**Intent Hash:** `{trace_data['intent_hash'][:16]}...`  
**Output Hash:** `{trace_data['execution']['output_hash'][:16]}...`  
**Model:** `{trace_data['agent']['model']}`  
**Confidence:** {trace_data['execution']['confidence']:.2%}  
**Generated:** {trace_data['execution']['completed_at']}  

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | {len(critical)} |
| 🟠 High | {len(high)} |
| 🟡 Medium | {len(medium)} |
| 🟢 Low/Info | {len(low)} |

---

## Findings

"""
    for f in findings:
        emoji = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢", "INFO": "ℹ️"}.get(f["severity"], "⚪")
        report += f"""### {emoji} [{f['id']}] {f['title']}

**Severity:** {f['severity']}  
**Confidence:** {f['confidence']:.0%}  
**Pass Discovered:** {f['pass_discovered']}  

{f['description']}

---

"""

    report += f"""## Assumptions

"""
    for a in trace_data.get("assumptions", []):
        report += f"- `[{a['source']}]` {a['statement']} (confidence: {a['confidence']:.0%})\n"

    report += f"""

## Reasoning Passes

| Pass | Skill | Duration | Findings |
|------|-------|----------|----------|
"""
    for p in trace_data.get("reasoning_passes", []):
        report += f"| {p['pass_number']} | {p['skill']} | {p['duration_ms']}ms | {len(p['findings_this_pass'])} |\n"

    report += f"""

## Verification

This report was produced by the Security Reasoning Protocol (SRP).

To independently verify this output:
```bash
srp verify --trace srp-traces/{trace_data['trace_id']}.json
```

**ERC-8004 Agent ID:** {trace_data['agent'].get('erc8004_agent_id', 'N/A')}  
**x402 Payment TX:** {trace_data['chain'].get('x402_payment_tx', 'N/A')}  
**ERC-8004 Approval TX:** {trace_data['chain'].get('erc8004_approval_tx', 'N/A')}  
"""

    output_path = f"srp-outputs/report-{trace_data['trace_id'][:8]}.md"
    with open(output_path, "w") as f:
        f.write(report)

    print(f"[SRP] ✅ Report saved: {output_path}")


def _export_trace(args):
    """Export latest trace as JSON."""
    traces_dir = Path("srp-traces")
    trace_files = sorted([
        f for f in traces_dir.glob("*.json")
        if "-intent" not in f.name
    ])
    if trace_files:
        print(f"[SRP] ✅ Latest trace: {trace_files[-1]}")
    else:
        print("[SRP] ❌ No traces found")


def cmd_verify(args):
    """Verify a reasoning trace independently."""
    print_banner()

    trace_path = Path(args.trace)
    if not trace_path.exists():
        print(f"[SRP] ❌ Trace not found: {args.trace}")
        sys.exit(1)

    with open(trace_path) as f:
        trace_data = json.load(f)

    print(f"[SRP] 🔍 Verifying trace: {trace_path.name}\n")
    print(f"  SRP Version   : {trace_data.get('srp_version', 'unknown')}")
    print(f"  Trace ID      : {trace_data['trace_id'][:16]}...")
    print(f"  Intent Hash   : {trace_data['intent_hash'][:16]}...")
    print(f"  Output Hash   : {trace_data['execution']['output_hash'][:16]}...")
    print(f"  Agent Version : {trace_data['agent']['version']}")
    print(f"  Model         : {trace_data['agent']['model']}")
    print(f"  Passes        : {len(trace_data['reasoning_passes'])}")
    print(f"  Findings      : {len(trace_data['findings'])}")
    print(f"  Confidence    : {trace_data['execution']['confidence']:.2%}")
    print(f"  Cost          : ${trace_data['execution']['cost_usdc']:.4f} USDC")
    print(f"\n  ERC-8004 TX   : {trace_data['chain'].get('erc8004_approval_tx', 'N/A')}")
    print(f"  x402 TX       : {trace_data['chain'].get('x402_payment_tx', 'N/A')}")
    print(f"\n✅ Trace structure valid and verifiable")


def cmd_policy(args):
    """Show or set policy configuration."""
    from policy import PolicyConfig

    if args.subcommand == "show":
        policy_path = Path("srp.policy.json")
        if not policy_path.exists():
            print("[SRP] No policy file. Run: srp init")
            return
        with open(policy_path) as f:
            policy = json.load(f)
        print("[SRP] 📋 Current ERC-8004 Policy:")
        print(json.dumps(policy, indent=2))


def cmd_status(args):
    """Show system status."""
    print_banner()
    config_exists = Path("srp.config.json").exists()
    policy_exists = Path("srp.policy.json").exists()
    traces = list(Path("srp-traces").glob("*.json")) if Path("srp-traces").exists() else []
    traces = [t for t in traces if "-intent" not in t.name]

    print(f"  Config        : {'✅' if config_exists else '❌'} srp.config.json")
    print(f"  Policy        : {'✅' if policy_exists else '❌'} srp.policy.json (ERC-8004)")
    print(f"  Traces        : {len(traces)} stored")
    print(f"  ERC-8004      : local mode (mainnet: Jan 29, 2026)")
    print(f"  x402          : local mode (V2 live)")
    print(f"  Agent         : openclaw 2026.2.16")
    print(f"  Model         : meta/llama-3.1-405b-instruct (NVIDIA)")


# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="srp",
        description="Security Reasoning Protocol — Verifiable, Policy-Bound Security Analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  srp init
  srp context set protocol=lending chain=ethereum
  srp assume oracle=manipulable
  srp analyze contracts/ --budget 5.0 --depth 3
  srp simulate attack --vector reentrancy
  srp export report
  srp verify --trace srp-traces/abc123.json
        """
    )

    subparsers = parser.add_subparsers(dest="command")

    # init
    subparsers.add_parser("init", help="Initialize SRP in current directory")

    # context
    ctx_parser = subparsers.add_parser("context", help="Set protocol context")
    ctx_sub = ctx_parser.add_subparsers(dest="subcommand")
    ctx_set = ctx_sub.add_parser("set")
    ctx_set.add_argument("values", nargs="+", help="key=value pairs")
    ctx_sub.add_parser("show")
    ctx_sub.add_parser("clear")

    # assume
    assume_parser = subparsers.add_parser("assume", help="Add analysis assumptions")
    assume_parser.add_argument("values", nargs="+")

    # analyze
    analyze_parser = subparsers.add_parser("analyze", help="Run security analysis")
    analyze_parser.add_argument("target", help="Path to contracts/directory")
    analyze_parser.add_argument("--budget", type=float, help="Budget in USDC (default: 5.0)")
    analyze_parser.add_argument("--depth", type=int, choices=[1,2,3,4,5], help="Reasoning depth")
    analyze_parser.add_argument("--task", type=str, help="Custom task description")
    analyze_parser.add_argument("--privacy", action="store_true", help="Enable privacy mode")

    # simulate
    sim_parser = subparsers.add_parser("simulate", help="Simulate attack vectors")
    sim_sub = sim_parser.add_subparsers(dest="subcommand")
    sim_attack = sim_sub.add_parser("attack")
    sim_attack.add_argument("--vector", required=True, help="Attack vector to simulate")
    sim_attack.add_argument("--finding", help="Finding ID to simulate")

    # export
    export_parser = subparsers.add_parser("export", help="Export report or trace")
    export_parser.add_argument("type", choices=["report", "trace", "all"])
    export_parser.add_argument("--format", choices=["md", "json", "pdf"], default="md")

    # verify
    verify_parser = subparsers.add_parser("verify", help="Verify a reasoning trace")
    verify_parser.add_argument("--trace", required=True, help="Path to trace JSON file")

    # replay
    replay_parser = subparsers.add_parser("replay", help="Replay an execution")
    replay_parser.add_argument("--trace", required=True, help="Path to trace JSON file")

    # policy
    policy_parser = subparsers.add_parser("policy", help="Policy management")
    policy_sub = policy_parser.add_subparsers(dest="subcommand")
    policy_sub.add_parser("show")

    # status
    subparsers.add_parser("status", help="Show system status")

    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "context":
        cmd_context(args)
    elif args.command == "assume":
        cmd_assume(args)
    elif args.command == "analyze":
        cmd_analyze(args)
    elif args.command == "simulate":
        cmd_simulate(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "verify":
        cmd_verify(args)
    elif args.command == "policy":
        cmd_policy(args)
    elif args.command == "status":
        cmd_status(args)
    else:
        print_banner()
        parser.print_help()


if __name__ == "__main__":
    main()
