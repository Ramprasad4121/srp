from __future__ import annotations

import asyncio
import inspect
import json
from pathlib import Path
from collections.abc import Callable
from typing import Any

from agents.attack_agent import AttackAgent
from agents.defense_agent import DefenseAgent
from agents.intent_agent import IntentAgent
from agents.recon_agent import ReconAgent
from agents.report_agent import ReportAgent
from agents.trace_agent import TraceAgent
from core.debate import run_debate
from core.poc_verifier import run_all_pocs
from core.anvil import start_anvil, stop_anvil
import os


# ─────────────────────────────────────────────────────────
# Domain Detection Keywords
# ─────────────────────────────────────────────────────────

DOMAIN_KEYWORDS: dict[str, set[str]] = {
    "lending": {
        "liquidate", "liquidation", "collateralfactor", "collateral", "borrow",
        "repay", "repayment", "healthfactor", "health_factor", "accrueinterest",
        "accrue_interest", "borrowrate", "supplyrate", "lendingpool", "lending_pool",
        "ctoken", "atoken", "debt", "reserve", "reservefactor", "borrowindex",
        "supplyindex", "collateralratio", "borrowbalance", "supplycap", "borrowcap",
        "flashloan", "flash_loan",
    },
    "amm": {
        "swap", "getreserves", "get_reserves", "addliquidity", "add_liquidity",
        "removeliquidity", "remove_liquidity", "mint", "burn", "tick", "sqrtprice",
        "sqrt_price", "pool", "pair", "twap", "fee", "slippage", "k_constant",
        "router", "factory", "quoter", "pricecumulativelast", "observe",
    },
    "bridge": {
        "sendmessage", "send_message", "receivemessage", "receive_message",
        "bridge", "relay", "relayer", "messenger", "crosschain", "cross_chain",
        "finality", "nonce", "guardian", "validator", "attestation", "deposit",
        "withdrawal", "message_hash", "messagehash", "chainid", "sourced_chain",
    },
    "staking": {
        "stake", "unstake", "slash", "slashing", "delegate", "delegation",
        "undelegate", "validator", "epoch", "reward", "rewardrate", "staking_pool",
        "staking_contract", "withdrawal_delay", "cooldown", "penalize",
    },
    "governance": {
        "propose", "proposal", "vote", "voting", "timelock", "execute",
        "quorum", "governor", "governance", "veto", "delegate", "ballot",
        "votingperiod", "voting_period", "proposalthreshold", "cancel",
    },
    "perpetuals": {
        "perpetual", "perp", "funding", "fundingrate", "funding_rate",
        "margin", "leverage", "position", "openposition", "closeposition",
        "markprice", "indexprice", "adl", "insurance_fund", "insurancefund",
        "liquidation_engine", "maxleverage",
    },
}


class SRPOrchestrator:
    def __init__(self) -> None:
        self.intent_agent = IntentAgent()
        self.recon_agent = ReconAgent()
        self.attack_agent = AttackAgent()
        self.defense_agent = DefenseAgent()
        self.trace_agent = TraceAgent()
        self.report_agent = ReportAgent()
        self.status_callback: Callable[[str, str, dict], Any] | None = None
        self.skills: dict[str, str] = {}

    def set_status_callback(self, fn) -> None:
        self.status_callback = fn

    def load_skills(self, skills_dir: str = "./skills") -> dict:
        skills_path = Path(skills_dir).expanduser()
        if not skills_path.is_absolute():
            skills_path = Path.cwd() / skills_path

        loaded: dict[str, str] = {}
        if not skills_path.exists() or not skills_path.is_dir():
            self.skills = loaded
            return loaded

        for entry in sorted(skills_path.iterdir()):
            if not entry.is_dir():
                continue

            skill_file = entry / "SKILL.md"
            if not skill_file.exists() or not skill_file.is_file():
                continue

            loaded[entry.name] = skill_file.read_text(encoding="utf-8")

        self.skills = loaded
        return loaded

    def select_skill(self, intent: dict) -> str:
        if not self.skills:
            self.load_skills()

        available = sorted(self.skills.keys())
        if not available:
            return "solidity-auditor"

        # Single skill setup currently defaults to the only loaded skill.
        if len(available) == 1:
            return available[0]

        needs = intent.get("skills_needed", intent.get("skills", []))
        if not isinstance(needs, list):
            needs = [needs] if needs else []
        needs = [str(item).strip().lower() for item in needs if str(item).strip()]

        task_text = " ".join(
            str(intent.get(key, "")).lower()
            for key in ("task", "task_description", "scope", "audit_scope", "raw_input")
        )
        contract_paths = intent.get("contract_paths", [])
        if not isinstance(contract_paths, list):
            contract_paths = [contract_paths]
        has_solidity_path = any(str(path).lower().endswith(".sol") for path in contract_paths)
        looks_like_solidity = has_solidity_path or ("solidity" in task_text) or ("evm" in task_text)

        if looks_like_solidity and "solidity-auditor" in self.skills:
            return "solidity-auditor"

        score_by_skill: dict[str, int] = {name: 0 for name in available}
        for need in needs:
            for skill_name in available:
                normalized_skill_name = skill_name.lower()
                if need == normalized_skill_name:
                    score_by_skill[skill_name] += 4
                    continue
                if need in normalized_skill_name or normalized_skill_name in need:
                    score_by_skill[skill_name] += 2
                    continue

                skill_tokens = [token for token in normalized_skill_name.replace("_", "-").split("-") if token]
                if any(token and token in need for token in skill_tokens):
                    score_by_skill[skill_name] += 1

        best_skill = max(available, key=lambda name: score_by_skill.get(name, 0))
        if score_by_skill.get(best_skill, 0) == 0 and "solidity-auditor" in self.skills:
            return "solidity-auditor"
        return best_skill

    # ─────────────────────────────────────────────────────────
    # Domain Detection
    # ─────────────────────────────────────────────────────────

    def detect_domain(self, recon_output: dict, contract_map: dict) -> str:
        """Detect the protocol domain from recon output and contract source code.

        Scans entry points, contract names, function names, and raw source code against
        domain keyword sets. Returns the domain with the highest match score.

        Args:
            recon_output: Output from ReconAgent with contracts, entry_points, external_calls.
            contract_map: Dict mapping contract name/path to source code.

        Returns:
            One of: lending, amm, bridge, staking, governance, perpetuals, generic.
        """
        # Build a search corpus from all available data
        corpus_parts: list[str] = []

        # Contract names
        contracts = recon_output.get("contracts", recon_output.get("contract_map", {}).get("contracts", []))
        if isinstance(contracts, list):
            corpus_parts.extend(str(c).lower() for c in contracts)

        # Entry points (function names)
        entry_points = recon_output.get("entry_points", {})
        if isinstance(entry_points, dict):
            for contract_name, functions in entry_points.items():
                corpus_parts.append(str(contract_name).lower())
                if isinstance(functions, list):
                    corpus_parts.extend(str(f).lower() for f in functions)
        elif isinstance(entry_points, list):
            corpus_parts.extend(str(ep).lower() for ep in entry_points)

        # External calls
        external_calls = recon_output.get("external_calls", [])
        if isinstance(external_calls, list):
            corpus_parts.extend(str(ec).lower() for ec in external_calls)

        # Contract source code — scan function names from actual code
        if isinstance(contract_map, dict):
            for name, code in contract_map.items():
                corpus_parts.append(str(name).lower())
                if isinstance(code, str):
                    # Extract function signatures from source
                    import re
                    func_matches = re.findall(r'function\s+(\w+)', code)
                    corpus_parts.extend(f.lower() for f in func_matches)
                    # Also add raw identifiers from the code
                    identifiers = re.findall(r'\b[a-zA-Z_]\w+\b', code)
                    corpus_parts.extend(i.lower() for i in identifiers)

        # Build single search string
        corpus = " ".join(corpus_parts)

        # Score each domain
        domain_scores: dict[str, int] = {}
        for domain, keywords in DOMAIN_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in corpus)
            domain_scores[domain] = score

        # Find best match
        if not domain_scores:
            return "generic"

        best_domain = max(domain_scores, key=lambda d: domain_scores[d])
        best_score = domain_scores[best_domain]

        # Require minimum threshold to avoid false positives
        # Score of 5+ required — prevents misclassifying generic protocols
        if best_score < 5:
            return "generic"

        self.log_orchestrator(
            f"domain_detected — {best_domain} (score: {best_score}, "
            f"scores: {json.dumps(domain_scores)})"
        )
        return best_domain

    # ─────────────────────────────────────────────────────────
    # Main Pipeline
    # ─────────────────────────────────────────────────────────

    async def run_full_audit(
        self, raw_input: str, contract_paths: list, budget_usd: float, api_key: str | None = None
    ) -> dict:
        loaded_skills = self.load_skills()
        context: dict[str, Any] = {
            "api_key": api_key,
            "raw_input": raw_input,
            "contract_paths": contract_paths,
            "budget_usd": budget_usd,
            "available_skills": sorted(loaded_skills.keys()),
        }

        anvil_running = start_anvil()
        self.log_orchestrator("anvil_started" if anvil_running else "anvil_skipped")

        results: dict[str, Any] = {}

        try:
            intent = await self.intent_agent.run(context)
            results["intent"] = intent
            context["intent_output"] = intent
            context.update(intent)

            # Inject protocol intent into context for all downstream agents
            protocol_intent = intent.get("protocol_intent", {})
            context["protocol_intent"] = protocol_intent

            skill_selector_input = {
                "skills_needed": intent.get("skills", intent.get("skills_needed", [])),
                "task": intent.get("task", intent.get("task_description", "")),
                "scope": intent.get("scope", intent.get("audit_scope", "")),
                "raw_input": raw_input,
                "contract_paths": contract_paths,
            }
            selected_skill_name = self.select_skill(skill_selector_input)
            selected_skill_content = self.skills.get(selected_skill_name, "")
            context["selected_skill_name"] = selected_skill_name
            context["selected_skill_content"] = selected_skill_content
            context["selected_skill"] = {
                "name": selected_skill_name,
                "content": selected_skill_content,
                "source": "local-skills",
            }

            assumptions = context.get("assumptions", [])
            if not isinstance(assumptions, list):
                assumptions = []
            assumptions.append(f"selected_skill_name: {selected_skill_name}")
            assumptions.append(f"selected_skill_content: {selected_skill_content}")
            context["assumptions"] = assumptions

            await self._emit_status(
                "SkillSelector",
                "completed",
                {
                    "selected_skill_name": selected_skill_name,
                    "selected_skill_content_preview": selected_skill_content[:200],
                },
            )
            await self._emit_status("IntentAgent", "completed", intent)
        except Exception as exc:
            await self._emit_status("IntentAgent", "failed", {"error": str(exc)})
            raise

        try:
            recon = await self.recon_agent.run(context)
            results["recon"] = recon
            context["recon_output"] = recon
            context.update(
                {
                    "contract_map": recon.get("contract_map", {}),
                    "functions": recon.get("functions", []),
                    "state_vars": recon.get("state_vars", []),
                    "external_calls": recon.get("external_calls", []),
                    "entry_points": recon.get("entry_points", []),
                    "risk_surface": recon.get("risk_surface", []),
                }
            )
            await self._emit_status("ReconAgent", "completed", recon)
        except Exception as exc:
            await self._emit_status("ReconAgent", "failed", {"error": str(exc)})
            raise

        # ── Domain Detection ──────────────────────────────────
        detected_domain = self.detect_domain(recon, context.get("contract_map", {}))
        context["detected_domain"] = detected_domain
        await self._emit_status(
            "DomainDetector",
            "completed",
            {"detected_domain": detected_domain},
        )
        self.log_orchestrator(f"domain_detection_complete — {detected_domain}")

        try:
            attack = await self.attack_agent.run(context)
            results["attack"] = attack
            all_vulns = attack.get("vulnerabilities", [])

            # ── Domain Agent Army Phase ───────────────────────
            if detected_domain == "lending":
                await self._emit_status(
                    "LendingArmy",
                    "started",
                    {"domain": "lending", "agents": 5},
                )
                try:
                    from agents.audit.lending import run_lending_army
                    lending_findings = await run_lending_army(context)
                    if isinstance(lending_findings, list):
                        all_vulns = all_vulns + lending_findings
                        self.log_orchestrator(
                            f"lending_army_complete — {len(lending_findings)} additional findings, "
                            f"{len(all_vulns)} total"
                        )
                    await self._emit_status(
                        "LendingArmy",
                        "completed",
                        {
                            "lending_findings": len(lending_findings),
                            "total_findings": len(all_vulns),
                        },
                    )
                except Exception as lending_exc:
                    self.log_orchestrator(f"lending_army_failed — {lending_exc}")
                    await self._emit_status(
                        "LendingArmy",
                        "failed",
                        {"error": str(lending_exc)},
                    )
                    # Don't crash pipeline — continue with generic findings only

            # ── DynaDebate Phase ──────────────────────────────
            contract_map = context.get("contract_map", {})
            contract_summary = "\n".join([f"- {name}: {len(code)} chars" for name, code in contract_map.items()])

            await self._emit_status("DynaDebate", "started", {"finding_count": len(all_vulns)})
            # We pass the attack_agent.call_llm which is already bound to the agent instance
            all_vulns = await run_debate(all_vulns, contract_summary, api_key, self.attack_agent.call_llm)
            self.log_orchestrator(f"debate_complete — {len(all_vulns)} findings survived debate")
            await self._emit_status("DynaDebate", "completed", {"surviving_count": len(all_vulns)})

            # ── PoC Verifier Phase ────────────────────────────
            # derive project_root from environment or first contract path
            project_root = os.environ.get("SRP_PROJECT_ROOT")
            if not project_root:
                if contract_paths and isinstance(contract_paths, list):
                    path = str(contract_paths[0])
                    if os.path.isfile(path):
                        project_root = os.path.dirname(os.path.dirname(path))
                    else:
                        project_root = os.path.dirname(path)
                else:
                    project_root = os.getcwd()
                
            await self._emit_status("PoCVerifier", "started", {"finding_count": len(all_vulns)})
            all_vulns = run_all_pocs(all_vulns, project_root)
            proven = sum(1 for f in all_vulns if f.get("poc_result", {}).get("status") == "proven")
            self.log_orchestrator(f"poc_verification_complete — {proven} passed")
            await self._emit_status("PoCVerifier", "completed", {"finding_count": len(all_vulns), "proven": proven})

            # Safety merge: Ensure poc_result is preserved across all finding objects.
            # Build poc lookup by id from the list returned by run_all_pocs
            poc_map = {v.get("id"): v.get("poc_result", {}) for v in all_vulns}
            # Re-attach to any findings list used downstream, ensuring consistency
            for v in all_vulns:
                if "poc_result" not in v or not v["poc_result"]:
                    v["poc_result"] = poc_map.get(v.get("id"), {"status": "skipped", "reason": "not run"})
            
            # Update attack object so server.py's raw_vulns contains the PoC results
            attack["vulnerabilities"] = all_vulns
            context["attack_output"] = attack
            context.update(
                {
                    "vulnerabilities": all_vulns,
                    "attack_summary": attack.get("attack_summary", ""),
                }
            )
            await self._emit_status("AttackAgent", "completed", attack)
        except Exception as exc:
            await self._emit_status("AttackAgent", "failed", {"error": str(exc)})
            raise

        try:
            defense = await self.defense_agent.run(context)
            results["defense"] = defense
            context["defense_output"] = defense
            context.update(
                {
                    "reviewed_vulnerabilities": defense.get(
                        "reviewed_vulnerabilities", []
                    ),
                    "overall_security_score": defense.get("overall_security_score"),
                    "final_findings": defense,
                }
            )
            await self._emit_status("DefenseAgent", "completed", defense)
        except Exception as exc:
            await self._emit_status("DefenseAgent", "failed", {"error": str(exc)})
            raise

        try:
            context["agent_traces"] = {
                "IntentAgent": self.intent_agent.get_trace(),
                "ReconAgent": self.recon_agent.get_trace(),
                "AttackAgent": self.attack_agent.get_trace(),
                "DefenseAgent": self.defense_agent.get_trace(),
            }
            trace = await self.trace_agent.run(context)
            results["trace"] = trace
            context["trace_output"] = trace
            context.update(
                {
                    "trace_id": trace.get("trace_id"),
                    "input_hash": trace.get("input_hash"),
                    "output_hash": trace.get("output_hash"),
                    "timestamp": trace.get("timestamp"),
                }
            )
            await self._emit_status("TraceAgent", "completed", trace)
        except Exception as exc:
            await self._emit_status("TraceAgent", "failed", {"error": str(exc)})
            raise

        try:
            report = await self.report_agent.run(context)
            results["report"] = report
            context["report_output"] = report
            await self._emit_status("ReportAgent", "completed", report)

            # PDF Report Export
            try:
                from core.pdf_exporter import export_pdf
                pdf_path = export_pdf(
                    findings=all_vulns,
                    report_summary=context.get("report_summary", ""),
                    project_name=context.get("project_name", "unknown"),
                    score=context.get("score", 0),
                    output_dir=os.path.join(project_root, ".srp", "reports"),
                )
                if pdf_path:
                    self.log_orchestrator(f"pdf_exported — {pdf_path}")
                    await self._emit_status("ReportAgent", "pdf_ready", {"pdf_path": pdf_path})
            except Exception as e:
                self.log_orchestrator(f"pdf_export_failed — {e}")
        except Exception as exc:
            await self._emit_status("ReportAgent", "failed", {"error": str(exc)})
            raise
        finally:
            stop_anvil()

        return results

    async def _emit_status(self, step_name: str, status: str, data: dict) -> None:
        if self.status_callback is None:
            return

        callback_result = self.status_callback(step_name, status, data)
        if inspect.isawaitable(callback_result):
            await callback_result

    def log_orchestrator(self, msg: str):
        """Helper to log from orchestrator."""
        print(f"[SRP] [Orchestrator] {msg}")
