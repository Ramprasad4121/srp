from __future__ import annotations

import asyncio
import inspect
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from collections.abc import Callable
from typing import Any
from uuid import uuid4

from srp.agents.attack_agent import AttackAgent
from srp.agents.defense_agent import DefenseAgent
from srp.agents.intent_agent import IntentAgent
from srp.agents.recon_agent import ReconAgent
from srp.agents.report_agent import ReportAgent
from srp.agents.trace_agent import TraceAgent
from srp.core.debate import run_debate
from srp.core.domain_detector import DomainDetector, DetectionResult
from srp.core.poc_verifier import run_all_pocs
from srp.core.anvil import start_anvil, stop_anvil
import os
import subprocess

# Phase 2 imports
from srp.core.sol_parser.solidity_parser import SolidityParser
from srp.core.srg.graph import SecurityReasoningGraph
from srp.agents.planner.planner import Planner
from srp.core.mcp.wrapper import MCPWrapper
from srp.agents.evolution.engine import EvolutionEngine


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
        self.mcp = MCPWrapper()
        self.evolution = EvolutionEngine(mcp=self.mcp)
        self.context: dict[str, Any] = {}
        self.current_run_id: str | None = None

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
        """Select the best skill for the given intent."""
        if not self.skills:
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

    async def run_solodit_phase(self, context: dict) -> dict:
        """Run Solodit intelligence phase to cross-reference with external findings."""
        if not os.environ.get("CYFRIN_API_KEY"):
            await self._emit_status("SoloditIntelligence", "skipped", {"reason": "CYFRIN_API_KEY not set"})
            return {"status": "skipped", "reason": "CYFRIN_API_KEY not set"}

        try:
            from srp.agents.audit.solodit import run_solodit_phase
            return await run_solodit_phase(context)
        except Exception as e:
            await self._emit_status("SoloditIntelligence", "failed", {"error": str(e)})
            return {"status": "error", "error": str(e)}

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

    def _resolve_project_root(self, contract_paths: list[Any]) -> str:
        env_root = os.environ.get("SRP_PROJECT_ROOT", "").strip()
        if env_root:
            return str(Path(env_root).resolve())

        if contract_paths and isinstance(contract_paths, list):
            first_path = Path(str(contract_paths[0])).resolve()
            if first_path.is_dir():
                if first_path.name in {"contracts", "src", "contract", "test", "tests"}:
                    return str(first_path.parent)
                return str(first_path)
            if first_path.is_file():
                if first_path.parent.name in {"contracts", "src", "contract", "test", "tests"}:
                    return str(first_path.parent.parent)
                return str(first_path.parent)

        return os.getcwd()

    def _detect_project_name(self, project_root: str, contract_paths: list[Any]) -> str:
        root_name = Path(project_root).resolve().name
        if root_name and root_name not in {"contracts", "src", "contract", "test", "tests"}:
            return root_name

        if contract_paths and isinstance(contract_paths, list):
            first_path = Path(str(contract_paths[0])).resolve()
            if first_path.is_file():
                return first_path.parent.name or "unknown"
            if first_path.is_dir():
                return first_path.name or "unknown"

        return "unknown"

    def _set_agents_shared_notes_path(self, shared_notes_path: Path) -> None:
        for agent in (
            self.intent_agent,
            self.recon_agent,
            self.attack_agent,
            self.defense_agent,
            self.trace_agent,
            self.report_agent,
        ):
            if hasattr(agent, "trace_log"):
                agent.trace_log = []
            if hasattr(agent, "progress"):
                agent.progress = None
            if hasattr(agent, "set_shared_notes_path"):
                agent.set_shared_notes_path(shared_notes_path)

    def _clean_run_cache(self, project_root: str) -> None:
        project_path = Path(project_root).resolve()
        srp_root = project_path / ".srp"

        for dirname in ("cache", "tmp"):
            target_dir = srp_root / dirname
            target_dir.mkdir(parents=True, exist_ok=True)
            for child in target_dir.iterdir():
                if child.is_dir() and not child.is_symlink():
                    shutil.rmtree(child)
                else:
                    child.unlink(missing_ok=True)

        outputs_dir = project_path / "outputs"
        for generated_file in ("SHARED_TASK_NOTES.md", "intent.json"):
            (outputs_dir / generated_file).unlink(missing_ok=True)

    def _fresh_context(
        self,
        raw_input: str,
        contract_paths: list[Any],
        budget_usd: float,
        api_key: str | None,
        project_root: str,
        project_name: str,
        shared_notes_path: Path,
        loaded_skills: dict[str, str],
    ) -> dict[str, Any]:
        return {
            "current_run_id": self.current_run_id,
            "api_key": api_key,
            "raw_input": raw_input,
            "contract_paths": contract_paths,
            "budget_usd": budget_usd,
            "project_root": project_root,
            "project_name": project_name,
            "project": project_name,
            "shared_notes_path": str(shared_notes_path),
            "available_skills": sorted(loaded_skills.keys()),
            "findings": [],
            "skills": [],
            "srg": None,
            "srg_summary": {},
            "plan": {},
            "planner_result": {},
            "detected_domain": "unknown",
            "attack_surfaces": [],
            "protocol_type": "unknown",
            "protocol_intent": {},
            "solodit_findings": [],
            "solodit_intelligence": False,
            "assumptions": [],
        }

    async def run_full_audit(
        self, raw_input: str, contract_paths: list, budget_usd: float, api_key: str | None = None
    ) -> dict:
        loaded_skills = self.load_skills()
        project_root = self._resolve_project_root(contract_paths)
        project_name = self._detect_project_name(project_root, contract_paths)
        shared_notes_path = Path(project_root) / "outputs" / "SHARED_TASK_NOTES.md"

        self.current_run_id = uuid4().hex
        self._clean_run_cache(project_root)
        self._set_agents_shared_notes_path(shared_notes_path)

        self.context = self._fresh_context(
            raw_input=raw_input,
            contract_paths=contract_paths,
            budget_usd=budget_usd,
            api_key=api_key,
            project_root=project_root,
            project_name=project_name,
            shared_notes_path=shared_notes_path,
            loaded_skills=loaded_skills,
        )
        context = self.context
        os.environ["SRP_PROJECT_ROOT"] = project_root
        os.environ["SRP_SHARED_NOTES_PATH"] = str(shared_notes_path)
        print(f"[DEBUG] project: {context['project']}")

        anvil_running = start_anvil()
        self.log_orchestrator("anvil_started" if anvil_running else "anvil_skipped")

        results: dict[str, Any] = {
            "current_run_id": self.current_run_id,
            "project": project_name,
            "project_name": project_name,
        }
        plan: dict[str, Any] = {
            "protocol_type": "unknown",
            "confidence": 0.0,
            "attack_surfaces": [],
            "plan": [],
            "fallback": True,
            "error": "planner_not_run",
        }
        context["plan"] = plan
        context["planner_result"] = plan

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
                "functions": recon.get("functions", []),
                "state_vars": recon.get("state_vars", []),
                "external_calls": recon.get("external_calls", []),
                "entry_points": recon.get("entry_points", []),
                "risk_surface": recon.get("risk_surface", []),
            })

            # Build real contract_map: {stem_name: source_code} from .sol files
            # This is what AttackAgent + domain armies expect
            real_contract_map: dict[str, str] = {}
            for sol_path in contract_paths:
                try:
                    p = Path(sol_path)
                    if p.is_file() and p.suffix == ".sol":
                        real_contract_map[p.stem] = p.read_text(encoding="utf-8")
                    elif p.is_dir():
                        for sol_file in sorted(p.rglob("*.sol")):
                            real_contract_map[sol_file.stem] = sol_file.read_text(encoding="utf-8")
                except OSError:
                    pass
            context["contract_map"] = real_contract_map
            context["sol_sources"] = real_contract_map

            await self._emit_status("ReconAgent", "completed", recon)
        except Exception as exc:
            await self._emit_status("ReconAgent", "failed", {"error": str(exc)})
            raise

        # ── Phase 2: SRG + Planner ─────────────────────────────
        try:
            await self._emit_status("SRGBuilder", "started", {})
            # Build SRG from contract paths
            srg = None
            for sol_path in contract_paths:
                p = Path(sol_path)
                target = str(p) if p.is_dir() else str(p.parent)
                parser = SolidityParser(target)
                parsed = parser.parse_all()
                srg = SecurityReasoningGraph.from_parser_output(parsed)
                break  # use first path
            if srg is None:
                srg = SecurityReasoningGraph()  # empty fallback

            srg_summary_data = srg.summary()
            self.log_orchestrator(
                f"srg_built — nodes={len(srg.nodes)} edges={len(srg.edges)}"
            )
            await self._emit_status("SRGBuilder", "completed", srg_summary_data)
            results["srg_summary"] = srg_summary_data
            context["srg"] = srg
            context["srg_summary"] = srg_summary_data
        except Exception as srg_exc:
            self.log_orchestrator(f"srg_build_failed — {srg_exc}")
            await self._emit_status("SRGBuilder", "failed", {"error": str(srg_exc)})

        try:
            await self._emit_status("Planner", "started", {})
            planner = Planner()
            plan = await planner.create_plan(srg, api_key=api_key)
            results["plan"] = plan
            context["plan"] = plan
            context["planner_result"] = plan
            context["protocol_type"] = plan.get("protocol_type", "unknown")
            context["attack_surfaces"] = plan.get("attack_surfaces", [])

            # Terminal output for Phase 2 validation
            if plan.get("fallback"):
                print("[Planner] LLM failed → using fallback")
                print(f"[Planner] Protocol: {plan.get('protocol_type', 'Unknown').upper()} (fallback)")
            else:
                print(f"[Planner] Protocol: {plan.get('protocol_type', 'Unknown').capitalize()}")
            print(f"[Planner] Attack surfaces: {', '.join(plan.get('attack_surfaces', []))}")
            print("[Planner] Plan:")
            for step in plan.get("plan", []):
                action = step.get("action", "")
                target = step.get("target", "")
                if target and target != "all_contracts":
                    print(f" - {action} ({target})")
                else:
                    print(f" - {action}")

            self.log_orchestrator(
                f"planner_complete — type={plan.get('protocol_type')}, "
                f"surfaces={len(plan.get('attack_surfaces', []))}, "
                f"steps={len(plan.get('plan', []))}"
            )
            await self._emit_status("Planner", "completed", {
                "protocol_type": plan.get("protocol_type"),
                "confidence": plan.get("confidence"),
                "attack_surfaces": plan.get("attack_surfaces", []),
                "plan_steps": len(plan.get("plan", [])),
                "fallback": plan.get("fallback", False),
            })
        except Exception as plan_exc:
            self.log_orchestrator(f"planner_failed — {plan_exc}")
            results["plan"] = plan
            context["plan"] = plan
            context["planner_result"] = plan
            await self._emit_status("Planner", "failed", {"error": str(plan_exc)})

        context["project_root"] = project_root

        # ── Learning Engine (Phase Retrieval) ─────────────────
        try:
            from srp.agents.learning.engine import LearningEngine
            learning_engine = LearningEngine()
            # Apply decay on startup to maintain skill relevance
            learning_engine.apply_decay()
            matched_skills = learning_engine.match_skills(context)
            context["matched_skills"] = matched_skills
        except Exception as le_exc:
            print(f"[Learning] Retrieval failed: {le_exc}")

        # ── Evolution Engine (Phase 16: strategy discovery) ──
        try:
            candidates = await self.evolution.run(context)
            context["evolved_strategies"] = candidates
        except Exception as evo_exc:
            print(f"[Evolution] Engine failed: {evo_exc}")

        # ── Attack Engine (Phase 3) ───────────────────────────
        try:
            print("[Attack] Running strategies...")
            from srp.agents.attack.engine import AttackEngine
            attack_engine = AttackEngine()
            attack_results = await attack_engine.run(plan, context)
            context["attacks"] = attack_results
            results["attacks"] = attack_results
            
            for res in attack_results:
                strat = res.get("strategy")
                profit = res.get("profit", 0)
                print(f"[Attack] {strat} → profit: {profit}")
                
                # Exploit Generation
                if profit > 0:
                    from srp.agents.exploit.generator import ExploitGenerator
                    gen = ExploitGenerator()
                    output_file = "tests/Exploit.t.sol"
                    if gen.save_exploit(res, output_file, project_root=project_root):
                        print(f"[Exploit] Generated: {output_file}")
                        print(f"[Exploit] Profit: {profit}")
                        
                        # Phase 12: Real Exploit Validation
                        try:
                            # 1. Ensure forge-std is present (required for the template)
                            subprocess.run(["forge", "install", "foundry-rs/forge-std", "--no-commit"], cwd=project_root, capture_output=True)
                            
                            # 2. Run forge test
                            process = subprocess.run(
                                ["forge", "test", "--match-test", "testExploit"],
                                cwd=project_root,
                                capture_output=True,
                                text=True,
                                timeout=60
                            )
                            if process.returncode == 0:
                                res["exploit_status"] = "validated"
                                print(f"[Exploit] Status: validated")
                                
                                # Phase 13: Learning Engine (Self-Improving SRP)
                                try:
                                    from srp.agents.learning.engine import LearningEngine
                                    learning_engine = LearningEngine()
                                    await learning_engine.extract_and_save(res, context)
                                    # ── Debate Phase (Phase 15: Multi-Agent Refinement) ──
                                    try:
                                        from srp.agents.debate.engine import DebateEngine
                                        debate_engine = DebateEngine()
                                        debate_res = await debate_engine.run_debate(context, res, rounds=2)
                                        
                                        res["debate_verdict"] = debate_res.get("verdict")
                                        res["debate_confidence"] = debate_res.get("confidence")
                                        res["debate_reasoning"] = debate_res.get("reasoning")
                                        
                                        if debate_res.get("verdict") == "rejected":
                                            print(f"[Debate] Exploit REJECTED by judge. Removing from final results.")
                                            # We still log it but mark as rejected
                                            res["exploit_status"] = "rejected_by_debate"
                                    except Exception as de_exc:
                                        print(f"[Debate] Engine failed: {de_exc}")

                                    # Update success rate of the skill used if applicable
                                    if res.get("skill_id"):
                                        learning_engine.update_stats(res["skill_id"], success=(res["exploit_status"] == "validated"))
                                except Exception as ls_exc:
                                    print(f"[Learning] Storage failed: {ls_exc}")
                            else:
                                res["exploit_status"] = "invalid_exploit"
                                print(f"[Exploit] Status: invalid_exploit")
                                # Update success rate (failure)
                                if res.get("skill_id"):
                                    try:
                                        from srp.agents.learning.engine import LearningEngine
                                        learning_engine = LearningEngine()
                                        learning_engine.update_stats(res["skill_id"], success=False)
                                    except Exception as ls_exc:
                                        print(f"[Learning] Stat update failed: {ls_exc}")
                                # print(f"[Exploit] Forge Output: {process.stdout}")
                        except Exception as ve:
                             print(f"[Exploit] Validation failed to run: {ve}")
                             res["exploit_status"] = "validation_error"
                    else:
                        res["exploit_status"] = "discarded_invalid_exploit"
                        if gen.last_error:
                            print(f"[Exploit] Discarded: {gen.last_error}")



                
            await self._emit_status("AttackEngine", "completed", {"results": len(attack_results)})
        except Exception as ae_exc:
            self.log_orchestrator(f"attack_engine_failed — {ae_exc}")
            await self._emit_status("AttackEngine", "failed", {"error": str(ae_exc)})


        # ── Domain Detection ──────────────────────────────────
        # Priority 1: Planner output (LLM-driven)
        planner_result = context.get("planner_result", {})
        planner_protocol = str(planner_result.get("protocol_type", "unknown")).lower()
        planner_failed = bool(planner_result.get("fallback")) or planner_protocol in {"", "unknown"}
        detected_domain = planner_protocol if not planner_failed else "unknown"
        detection_source = "planner" if not planner_failed else "unresolved"

        # Priority 2: Keyword-based detection (SRG signals)
        if detected_domain in ["unknown", "generic"]:
            try:
                project_root = context.get("project_root") or os.environ.get("SRP_PROJECT_ROOT") or os.getcwd()
                detection_result = await self.detect_domain(project_root, contract_paths)
                detected_domain = detection_result.primary
                context["secondary_domain"] = detection_result.secondary
                context["secondary_confidence"] = detection_result.secondary_confidence
                detection_source = "keywords"
            except Exception as domain_exc:
                self.log_orchestrator(f"keyword_detection_failed — {domain_exc}")

        # Priority 3: Fallback to IntentAgent or Generic
        if detected_domain in ["unknown", "generic"]:
            detected_domain = intent.get("domain", intent.get("protocol_type", "generic")).lower()
            detection_source = "intent_fallback"

        # Final normalization & cleanup
        if detected_domain == "unknown":
            detected_domain = "generic"
            
        context["detected_domain"] = detected_domain
        print(f"[Domain] Detected: {detected_domain} (via {detection_source})")

        try:
            await self._emit_status("DomainDetector", "completed", {
                "detected_domain": detected_domain,
                "detection_source": detection_source,
                "confidence": planner_result.get("confidence") if detection_source == "planner" else 0.5
            })
            self.log_orchestrator(f"domain_detection_complete — {detected_domain} (source: {detection_source})")
        except Exception as emit_exc:
            self.log_orchestrator(f"domain_emit_failed — {emit_exc}")

        secondary_domain = context.get("secondary_domain")
        secondary_confidence = context.get("secondary_confidence", 0.0)

        # ── Attack Agent + Domain Armies ──────────────────────
        try:
            attack = await self.attack_agent.run(context)
            results["attack"] = attack
            all_vulns = attack.get("vulnerabilities", [])

            # ── Lending Army ───────────────────────────────────
            if detected_domain == "lending":
                await self._emit_status("LendingArmy", "started", {"domain": "lending", "agents": 5})
                try:
                    from srp.agents.audit.lending import run_lending_army
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
                    from srp.agents.audit.amm import run_amm_army
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
                    from srp.agents.audit.bridge import run_bridge_army
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
                    from srp.agents.audit.staking import run_staking_army
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
                    from srp.agents.audit.governance import run_governance_army
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
                    from srp.agents.audit.perpetuals import run_perpetuals_army
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
                    from srp.agents.audit.crosschain import run_crosschain_army
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
                        from srp.agents.audit.lending import run_lending_army
                        extra = await run_lending_army(context)
                    elif secondary_domain == "amm":
                        from srp.agents.audit.amm import run_amm_army
                        extra = await run_amm_army(context)
                    elif secondary_domain == "bridge":
                        from srp.agents.audit.bridge import run_bridge_army
                        extra = await run_bridge_army(context)
                    elif secondary_domain == "staking":
                        from srp.agents.audit.staking import run_staking_army
                        extra = await run_staking_army(context)
                    elif secondary_domain == "governance":
                        from srp.agents.audit.governance import run_governance_army
                        extra = await run_governance_army(context)
                    elif secondary_domain == "perpetuals":
                        from srp.agents.audit.perpetuals import run_perpetuals_army
                        extra = await run_perpetuals_army(context)
                    elif secondary_domain == "crosschain":
                        from srp.agents.audit.crosschain import run_crosschain_army
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
                from srp.core.pdf_exporter import export_pdf
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
