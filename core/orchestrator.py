from __future__ import annotations

import asyncio
import inspect
import json
from datetime import datetime, timezone
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
from core.domain_detector import DomainDetector, DetectionResult
from core.poc_verifier import run_all_pocs
from core.anvil import start_anvil, stop_anvil
import os


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

    async def run_solodit_phase(self, context: dict) -> dict:
        """Run Solodit intelligence phase to cross-reference with external findings."""
        if not os.environ.get("CYFRIN_API_KEY"):
            return {"status": "skipped", "reason": "CYFRIN_API_KEY not set"}

        try:
            from agents.audit.solodit import run_solodit_phase
            return await run_solodit_phase(context)
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def run_full_audit(self, raw_input: str, contract_paths: list[str], budget_usd: float, api_key: str | None = None) -> dict:
        """Run full audit pipeline."""
        # Phase 1: Intent Analysis
        intent_result = await self.intent_agent.run({
            "raw_input": raw_input,
            "contract_paths": contract_paths,
            "budget_usd": budget_usd,
            "api_key": api_key,
        })
        if self.status_callback:
            await self.status_callback("IntentAgent", "complete", intent_result)
            self.load_skills()

        available = sorted(self.skills.keys())
        if not available:
            return "solidity-auditor"
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
                skill_tokens = [t for t in normalized_skill_name.replace("_", "-").split("-") if t]
                if any(t and t in need for t in skill_tokens):
                    score_by_skill[skill_name] += 1

        best_skill = max(available, key=lambda name: score_by_skill.get(name, 0))
        if score_by_skill.get(best_skill, 0) == 0 and "solidity-auditor" in self.skills:
            return "solidity-auditor"
        return best_skill

    # ─────────────────────────────────────────────────────────
    # Domain Detection
    # ─────────────────────────────────────────────────────────

    async def detect_domain(self, project_root: str | Path, contract_paths: list[str] | None = None) -> DetectionResult:
        detector = DomainDetector(project_root)
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: detector.detect(contract_paths)
        )
        self.log_orchestrator(
            f"domain_detected — {result.primary} (confidence: {result.confidence:.0%}"
            f"{f', secondary: {result.secondary} ({result.secondary_confidence:.0%})' if result.secondary else ''})"
        )
        return result

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

        # ── Intent Agent ──────────────────────────────────────
        try:
            intent = await self.intent_agent.run(context)
            results["intent"] = intent
            context["intent_output"] = intent
            context.update(intent)

            protocol_intent = intent.get("protocol_intent", {})
            context["protocol_intent"] = protocol_intent

            # Merge Solodit findings into intent if available
            if "solodit_findings" in intent:
                context["solodit_findings"] = intent["solodit_findings"]
            if "solodit_intelligence" in intent:
                context["solodit_intelligence"] = intent["solodit_intelligence"]

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

            await self._emit_status("SkillSelector", "completed", {
                "selected_skill_name": selected_skill_name,
                "selected_skill_content_preview": selected_skill_content[:200],
            })
            await self._emit_status("IntentAgent", "completed", intent)
        except Exception as exc:
            await self._emit_status("IntentAgent", "failed", {"error": str(exc)})
            raise

        # Phase 2: Solodit Intelligence Phase
        solodit_findings = []
        try:
            if os.environ.get("CYFRIN_API_KEY"):
                try:
                    solodit_result = await self.run_solodit_phase({
                        "raw_input": raw_input,
                        "contract_paths": contract_paths,
                        "budget_usd": budget_usd,
                        "api_key": api_key,
                    })
                    if solodit_result:
                        solodit_findings = solodit_result
                        if self.status_callback:
                            await self.status_callback("SoloditIntelligence", "complete", {
                                "confirmed_findings": solodit_findings,
                                "finding_count": len(solodit_findings)
                            })
                except Exception as e:
                    if self.status_callback:
                        await self.status_callback("SoloditIntelligence", "error", {"error": str(e)})
        except Exception as exc:
            await self._emit_status("IntentAgent", "failed", {"error": str(exc)})
            raise

        # Add Solodit findings to context
        context["solodit_findings"] = solodit_findings
        context["solodit_intelligence"] = bool(solodit_findings)

        # ── Recon Agent ───────────────────────────────────────
        try:
            recon = await self.recon_agent.run(context)
            results["recon"] = recon
            context["recon_output"] = recon
            context.update({
                "contract_map": recon.get("contract_map", {}),
                "functions": recon.get("functions", []),
                "state_vars": recon.get("state_vars", []),
                "external_calls": recon.get("external_calls", []),
                "entry_points": recon.get("entry_points", []),
                "risk_surface": recon.get("risk_surface", []),
            })
            await self._emit_status("ReconAgent", "completed", recon)
        except Exception as exc:
            await self._emit_status("ReconAgent", "failed", {"error": str(exc)})
            raise

        # ── Domain Detection ──────────────────────────────────
        detected_domain = "generic"
        secondary_domain = None
        secondary_confidence = 0.0
        try:
            project_root = context.get("project_root") or os.environ.get("SRP_PROJECT_ROOT") or os.getcwd()
            detection_result = await self.detect_domain(project_root, contract_paths)
            detected_domain = detection_result.primary
            secondary_domain = detection_result.secondary
            secondary_confidence = detection_result.secondary_confidence
            context["detected_domain"] = detected_domain
            context["secondary_domain"] = secondary_domain
            context["secondary_confidence"] = secondary_confidence
            await self._emit_status("DomainDetector", "completed", {
                "detected_domain": detected_domain,
                "confidence": detection_result.confidence,
                "secondary": secondary_domain,
                "secondary_confidence": secondary_confidence,
            })
            self.log_orchestrator(f"domain_detection_complete — {detected_domain}")
        except Exception as domain_exc:
            self.log_orchestrator(f"domain_detection_failed — {domain_exc}, falling back to generic")
            await self._emit_status("DomainDetector", "failed", {"error": str(domain_exc)})

        # ── Attack Agent + Domain Armies ──────────────────────
        try:
            attack = await self.attack_agent.run(context)
            results["attack"] = attack
            all_vulns = attack.get("vulnerabilities", [])

            # ── Lending Army ───────────────────────────────────
            if detected_domain == "lending":
                await self._emit_status("LendingArmy", "started", {"domain": "lending", "agents": 5})
                try:
                    from agents.audit.lending import run_lending_army
                    lending_findings = await run_lending_army(context)
                    if isinstance(lending_findings, list):
                        all_vulns = all_vulns + lending_findings
                    self.log_orchestrator(f"lending_army_complete — {len(lending_findings)} additional findings, {len(all_vulns)} total")
                    await self._emit_status("LendingArmy", "completed", {"lending_findings": len(lending_findings), "total_findings": len(all_vulns)})
                except Exception as e:
                    self.log_orchestrator(f"lending_army_failed — {e}")
                    await self._emit_status("LendingArmy", "failed", {"error": str(e)})

            # ── AMM Army ───────────────────────────────────────
            if detected_domain == "amm":
                await self._emit_status("AMMArmy", "started", {"domain": "amm", "agents": 5})
                try:
                    from agents.audit.amm import run_amm_army
                    amm_findings = await run_amm_army(context)
                    if isinstance(amm_findings, list):
                        all_vulns = all_vulns + amm_findings
                    self.log_orchestrator(f"amm_army_complete — {len(amm_findings)} additional findings, {len(all_vulns)} total")
                    await self._emit_status("AMMArmy", "completed", {"amm_findings": len(amm_findings), "total_findings": len(all_vulns)})
                except Exception as e:
                    self.log_orchestrator(f"amm_army_failed — {e}")
                    await self._emit_status("AMMArmy", "failed", {"error": str(e)})

            # ── Bridge Army ────────────────────────────────────
            if detected_domain == "bridge":
                await self._emit_status("BridgeArmy", "started", {"domain": "bridge", "agents": 5})
                try:
                    from agents.audit.bridge import run_bridge_army
                    bridge_findings = await run_bridge_army(context)
                    if isinstance(bridge_findings, list):
                        all_vulns = all_vulns + bridge_findings
                    self.log_orchestrator(f"bridge_army_complete — {len(bridge_findings)} additional findings, {len(all_vulns)} total")
                    await self._emit_status("BridgeArmy", "completed", {"bridge_findings": len(bridge_findings), "total_findings": len(all_vulns)})
                except Exception as e:
                    self.log_orchestrator(f"bridge_army_failed — {e}")
                    await self._emit_status("BridgeArmy", "failed", {"error": str(e)})

            # ── Staking Army ───────────────────────────────────
            if detected_domain == "staking":
                await self._emit_status("StakingArmy", "started", {"domain": "staking", "agents": 4})
                try:
                    from agents.audit.staking import run_staking_army
                    staking_findings = await run_staking_army(context)
                    if isinstance(staking_findings, list):
                        all_vulns = all_vulns + staking_findings
                    self.log_orchestrator(f"staking_army_complete — {len(staking_findings)} additional findings, {len(all_vulns)} total")
                    await self._emit_status("StakingArmy", "completed", {"staking_findings": len(staking_findings), "total_findings": len(all_vulns)})
                except Exception as e:
                    self.log_orchestrator(f"staking_army_failed — {e}")
                    await self._emit_status("StakingArmy", "failed", {"error": str(e)})

            # ── Governance Army ────────────────────────────────
            if detected_domain == "governance":
                await self._emit_status("GovernanceArmy", "started", {"domain": "governance", "agents": 4})
                try:
                    from agents.audit.governance import run_governance_army
                    governance_findings = await run_governance_army(context)
                    if isinstance(governance_findings, list):
                        all_vulns = all_vulns + governance_findings
                    self.log_orchestrator(f"governance_army_complete — {len(governance_findings)} additional findings, {len(all_vulns)} total")
                    await self._emit_status("GovernanceArmy", "completed", {"governance_findings": len(governance_findings), "total_findings": len(all_vulns)})
                except Exception as e:
                    self.log_orchestrator(f"governance_army_failed — {e}")
                    await self._emit_status("GovernanceArmy", "failed", {"error": str(e)})

            # ── Perpetuals Army ────────────────────────────────
            if detected_domain == "perpetuals":
                await self._emit_status("PerpetualsArmy", "started", {"domain": "perpetuals", "agents": 4})
                try:
                    from agents.audit.perpetuals import run_perpetuals_army
                    perpetuals_findings = await run_perpetuals_army(context)
                    if isinstance(perpetuals_findings, list):
                        all_vulns = all_vulns + perpetuals_findings
                    self.log_orchestrator(f"perpetuals_army_complete — {len(perpetuals_findings)} additional findings, {len(all_vulns)} total")
                    await self._emit_status("PerpetualsArmy", "completed", {"perpetuals_findings": len(perpetuals_findings), "total_findings": len(all_vulns)})
                except Exception as e:
                    self.log_orchestrator(f"perpetuals_army_failed — {e}")
                    await self._emit_status("PerpetualsArmy", "failed", {"error": str(e)})

            # ── Cross-Chain Army ───────────────────────────────
            if detected_domain == "crosschain":
                await self._emit_status("CrossChainArmy", "started", {"domain": "crosschain", "agents": 4})
                try:
                    from agents.audit.crosschain import run_crosschain_army
                    crosschain_findings = await run_crosschain_army(context)
                    if isinstance(crosschain_findings, list):
                        all_vulns = all_vulns + crosschain_findings
                    self.log_orchestrator(f"crosschain_army_complete — {len(crosschain_findings)} additional findings, {len(all_vulns)} total")
                    await self._emit_status("CrossChainArmy", "completed", {"crosschain_findings": len(crosschain_findings), "total_findings": len(all_vulns)})
                except Exception as e:
                    self.log_orchestrator(f"crosschain_army_failed — {e}")
                    await self._emit_status("CrossChainArmy", "failed", {"error": str(e)})

            # ── De-sloppify Pass ──────────────────────────────────
            try:
                all_vulns, dropped = self._desloppify_findings(all_vulns)
                if dropped:
                    self.log_orchestrator(f"de_sloppify_complete — {len(dropped)} findings dropped, {len(all_vulns)} remaining")
                    for d in dropped[:5]:  # Log first 5 for brevity
                        self.log_orchestrator(f"de_sloppify_dropped: {d['title']} — reason: {d['reason']}")
                    if len(dropped) > 5:
                        self.log_orchestrator(f"de_sloppify_dropped: {len(dropped) - 5} more findings...")
            except Exception as e:
                self.log_orchestrator(f"de_sloppify_failed — {e}")

            # ── Secondary Domain Army ──────────────────────────
            if secondary_domain and secondary_confidence > 0.3 and secondary_domain != detected_domain:
                self.log_orchestrator(f"running_secondary_domain_army — {secondary_domain} ({secondary_confidence:.0%})")
                try:
                    if secondary_domain == "lending":
                        from agents.audit.lending import run_lending_army
                        extra = await run_lending_army(context)
                    elif secondary_domain == "amm":
                        from agents.audit.amm import run_amm_army
                        extra = await run_amm_army(context)
                    elif secondary_domain == "bridge":
                        from agents.audit.bridge import run_bridge_army
                        extra = await run_bridge_army(context)
                    elif secondary_domain == "staking":
                        from agents.audit.staking import run_staking_army
                        extra = await run_staking_army(context)
                    elif secondary_domain == "governance":
                        from agents.audit.governance import run_governance_army
                        extra = await run_governance_army(context)
                    elif secondary_domain == "perpetuals":
                        from agents.audit.perpetuals import run_perpetuals_army
                        extra = await run_perpetuals_army(context)
                    elif secondary_domain == "crosschain":
                        from agents.audit.crosschain import run_crosschain_army
                        extra = await run_crosschain_army(context)
                    else:
                        extra = []
                    if isinstance(extra, list):
                        all_vulns = all_vulns + extra
                        self.log_orchestrator(f"secondary_army_complete — {len(extra)} additional findings")
                except Exception as e:
                    self.log_orchestrator(f"secondary_army_failed — {e}")

            # ── DynaDebate ─────────────────────────────────────
            contract_map = context.get("contract_map", {})
            contract_summary = "\n".join([f"- {name}: {len(code)} chars" for name, code in contract_map.items()])

            await self._emit_status("DynaDebate", "started", {"finding_count": len(all_vulns)})
            all_vulns = await run_debate(all_vulns, contract_summary, api_key, self.attack_agent.call_llm)
            self.log_orchestrator(f"debate_complete — {len(all_vulns)} findings survived debate")
            await self._emit_status("DynaDebate", "completed", {"surviving_count": len(all_vulns)})

            # ── PoC Verifier ───────────────────────────────────
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
            all_vulns = await run_all_pocs(all_vulns, project_root)
            proven = sum(1 for f in all_vulns if f.get("poc_result", {}).get("status") == "proven")
            self.log_orchestrator(f"poc_verification_complete — {proven}/{len(all_vulns)} PROVEN")
            await self._emit_status("PoCVerifier", "completed", {"finding_count": len(all_vulns), "proven": proven})

            # Safety merge: ensure poc_result preserved
            poc_map = {v.get("id"): v.get("poc_result", {}) for v in all_vulns}
            for v in all_vulns:
                if "poc_result" not in v or not v["poc_result"]:
                    v["poc_result"] = poc_map.get(v.get("id"), {"status": "skipped", "reason": "not run"})

            attack["vulnerabilities"] = all_vulns
            context["attack_output"] = attack
            self._log_final_vulnerabilities(all_vulns)

            context.update({
                "vulnerabilities": all_vulns,
                "attack_summary": attack.get("attack_summary", ""),
            })
            await self._emit_status("AttackAgent", "completed", attack)
        except Exception as exc:
            await self._emit_status("AttackAgent", "failed", {"error": str(exc)})
            raise

        # ── Defense Agent ─────────────────────────────────────
        try:
            defense = await self.defense_agent.run(context)
            results["defense"] = defense
            context["defense_output"] = defense
            context.update({
                "reviewed_vulnerabilities": defense.get("reviewed_vulnerabilities", []),
                "overall_security_score": defense.get("overall_security_score"),
                "final_findings": defense,
            })
            await self._emit_status("DefenseAgent", "completed", defense)
        except Exception as exc:
            await self._emit_status("DefenseAgent", "failed", {"error": str(exc)})
            raise

        # ── Trace Agent ───────────────────────────────────────
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
            context.update({
                "trace_id": trace.get("trace_id"),
                "input_hash": trace.get("input_hash"),
                "output_hash": trace.get("output_hash"),
                "timestamp": trace.get("timestamp"),
            })
            await self._emit_status("TraceAgent", "completed", trace)
        except Exception as exc:
            await self._emit_status("TraceAgent", "failed", {"error": str(exc)})
            raise

        # ── Report Agent + PDF ────────────────────────────────
        try:
            report = await self.report_agent.run(context)
            results["report"] = report
            context["report_output"] = report
            context["report_summary"] = report.get("summary", "")
            context["report_markdown"] = report.get("report_md", "")
            await self._emit_status("ReportAgent", "completed", report)

            try:
                from core.pdf_exporter import export_pdf
                if "project_name" not in context:
                    if contract_paths:
                        context["project_name"] = Path(contract_paths[0]).parent.name
                    else:
                        context["project_name"] = "unknown"
                if "score" not in context:
                    context["score"] = context.get("overall_security_score", 0)

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

    def _desloppify_findings(self, vulnerabilities: list[dict]) -> tuple[list[dict], list[dict]]:
        """Filter weak findings using strict criteria.

        DROP a finding if ANY of these are true:
        - title is None, empty, or "Untitled"
        - description is shorter than 50 characters
        - location is "unknown" AND exploit_code contains no actual function calls
        - exploit_code contains placeholder text like "// TODO" or "..."
        - title is identical to another finding (exact duplicate)
        - severity is missing

        KEEP all findings that pass all 6 checks.
        Log each dropped finding: "de_sloppify dropped: [title] — reason: [rule]"
        """
        import re
        from collections import defaultdict

        kept = []
        dropped = []
        title_counts = defaultdict(int)

        for vuln in vulnerabilities:
            title = vuln.get("title", "")
            title_counts[title] += 1

        for vuln in vulnerabilities:
            title = vuln.get("title", "")
            description = vuln.get("description", "")
            location = vuln.get("location", "")
            exploit_code = vuln.get("exploit_code", "")
            severity = vuln.get("severity", "")

            # Track drop reasons
            drop_reasons = []

            # Rule 1: title is None, empty, or "Untitled"
            if not title or title.strip() == "" or title.strip().lower() == "untitled":
                drop_reasons.append("empty/untitled title")

            # Rule 2: description is shorter than 50 characters
            if len(description) < 50:
                drop_reasons.append("short description")

            # Rule 3: location is "unknown" AND exploit_code contains no actual function calls
            if location.lower() == "unknown":
                # Check if exploit_code contains actual function calls (look for function(), method(), etc.)
                if not re.search(r'\bfunction\s*\(', exploit_code, re.IGNORECASE) and \
                   not re.search(r'\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(', exploit_code):
                    drop_reasons.append("no function calls in unknown location")

            # Rule 4: exploit_code contains placeholder text like "// TODO" or "..."
            if re.search(r'//\s*TODO|//\s*TODO:|//\s*HACK|//\s*FIXME|\.\.\.', exploit_code, re.IGNORECASE):
                drop_reasons.append("placeholder text in exploit_code")

            # Rule 5: title is identical to another finding (exact duplicate)
            if title_counts[title] > 1:
                drop_reasons.append("duplicate title")

            # Rule 6: severity is missing
            if not severity:
                drop_reasons.append("missing severity")

            if drop_reasons:
                dropped.append({
                    "title": title,
                    "reason": ", ".join(drop_reasons)
                })
                self.log_orchestrator(f"de_sloppify dropped: {title} — reason: {', '.join(drop_reasons)}")
            else:
                kept.append(vuln)

        return kept, dropped


    async def _emit_status(self, step_name: str, status: str, data: dict) -> None:
        if self.status_callback is None:
            return
        callback_result = self.status_callback(step_name, status, data)
        if inspect.isawaitable(callback_result):
            await callback_result

    def log_orchestrator(self, msg: str):
        print(f"[SRP] [Orchestrator] {msg}")

    def _desloppify_findings(self, findings: list) -> tuple[list, list]:
        """Filter weak findings using exact criteria."""
        kept = []
        dropped = []

        # Track titles we've seen to detect duplicates
        seen_titles = set()

        for finding in findings:
            title = finding.get("title")
            description = finding.get("description", "")
            location = finding.get("location", "unknown")
            exploit_code = finding.get("exploit_code", "")
            severity = finding.get("severity")

            # Check each criterion
            reasons = []

            if not title or title.strip() == "" or title.strip().lower() == "untitled":
                reasons.append("title_empty_or_untitled")

            if len(description) < 50:
                reasons.append("description_too_short")

            if location.lower() == "unknown" and not any(
                func in exploit_code.lower() for func in ["function", "call", "send", "transfer", "approve", "permit"]
            ):
                reasons.append("unknown_location_no_function_calls")

            if any(placeholder in exploit_code.lower() for placeholder in ["// todo", "...", "placeholder"]):
                reasons.append("placeholder_in_exploit_code")

            if title and title in seen_titles:
                reasons.append("duplicate_title")

            if severity is None:
                reasons.append("missing_severity")

            if reasons:
                dropped.append({
                    "title": title,
                    "reason": ", ".join(reasons),
                    "finding": finding
                })
            else:
                kept.append(finding)
                if title:
                    seen_titles.add(title)

        return kept, dropped

    def _log_final_vulnerabilities(self, all_vulns: list) -> None:
        proven = sum(1 for v in all_vulns if v.get("poc_result", {}).get("status") == "proven")
        print(f"[SRP] [Orchestrator] final_vulnerabilities_logged — {len(all_vulns)} findings, {proven} proven")
        if not hasattr(self, '_orchestrator_trace'):
            self._orchestrator_trace = []
        self._orchestrator_trace.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent": "Orchestrator",
            "step": "post_poc_vulnerabilities_finalized",
            "data": {
                "vulnerabilities": all_vulns,
                "vulnerability_count": len(all_vulns),
                "proven_count": proven,
            },
        })