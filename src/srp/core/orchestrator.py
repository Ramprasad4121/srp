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
from srp.agents.hypothesis_agent import HypothesisAgent
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

# Audit Methodology Engines
from srp.core.notes_engine import NotesEngine
from srp.core.diagram_engine import DiagramEngine


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


from srp.core.store import SRPStore
from srp.core.mcp.mcp_server import SRPMCPServer

class SRPOrchestrator:
    def __init__(self) -> None:
        self.store = SRPStore()
        self.mcp_server = SRPMCPServer()
        self.intent_agent = IntentAgent()
        self.recon_agent = ReconAgent()
        self.hypothesis_agent = HypothesisAgent()
        self.attack_agent = AttackAgent()
        self.defense_agent = DefenseAgent()
        self.trace_agent = TraceAgent()
        self.report_agent = ReportAgent()
        self.status_callback: Callable[[str, str, dict], Any] | None = None
        self.skills: dict[str, str] = {}
        self.mcp = MCPWrapper()
        self.evolution = EvolutionEngine(mcp=self.mcp)
        self.notes: NotesEngine | None = None
        self.diagrams: DiagramEngine | None = None
        
        # Register tools
        self.mcp_server.register_tool("run_full_audit", self.run_full_audit)
        self.mcp_server.register_tool("get_findings", self.store.get_findings)

    @property
    def current_run_id(self):
        return self.store.current_run_id

    @current_run_id.setter
    def current_run_id(self, value):
        self.store.current_run_id = value

    @property
    def context(self):
        return self.store.context
    
    @context.setter
    def context(self, value):
        self.store.context = value

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
            self.hypothesis_agent,
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

        # Methodology Phase 3: Init Notes Engine
        self.notes = NotesEngine(project_root)
        self.log_orchestrator("Methodology Phase 3: NotesEngine Initialized")

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

        # ── Methodology Phase 1: Reconnaissance ────────────────
        try:
            await self._emit_status("Phase1:Recon", "started", {})
            intent = await self.intent_agent.run(context)
            results["intent"] = intent
            context["intent_output"] = intent
            context.update(intent)

            # Update Notes: Overview & Invariants
            self.notes.write_note("00_overview.md", intent.get("summary", ""), append=False)
            inv_text = "\n".join([f"- {i['id']}: {i['description']}" for i in intent.get("protocol_intent", {}).get("invariants", [])])
            self.notes.write_note("04_invariants.md", inv_text, append=False)

            protocol_intent = intent.get("protocol_intent", {})
            context["protocol_intent"] = protocol_intent

            await self._emit_status("Phase1:Recon", "completed", intent)
        except Exception as exc:
            await self._emit_status("Phase1:Recon", "failed", {"error": str(exc)})
            raise

        # ── Methodology Phase 2: Architecture Mapping ──────────
        try:
            await self._emit_status("Phase2:Mapping", "started", {})
            recon = await self.recon_agent.run(context)
            results["recon"] = recon
            context["recon_output"] = recon
            context.update(recon)

            # Update Notes: Architecture & Value Flows
            self.notes.write_note("01_architecture.md", f"Contracts: {', '.join(recon.get('contracts', []))}", append=False)
            
            await self._emit_status("Phase2:Mapping", "completed", recon)
        except Exception as exc:
            await self._emit_status("Phase2:Mapping", "failed", {"error": str(exc)})
            raise

        # ── Methodology Phase 3: Note-Making (Hypotheses) ──────
        try:
            await self._emit_status("Phase3:Notes", "started", {})
            hypo_result = await self.hypothesis_agent.run(context)
            context["hypotheses"] = hypo_result.get("hypotheses", [])
            
            # Populate Hypotheses in Notes
            hypo_text = "\n".join([f"- {h['id']}: {h['title']} ({h['affected_function']})" for h in context["hypotheses"]])
            self.notes.write_note("05_attack_hypotheses.md", hypo_text, append=False)
            
            await self._emit_status("Phase3:Notes", "completed", {"hypotheses": len(context["hypotheses"])})
        except Exception as exc:
            await self._emit_status("Phase3:Notes", "failed", {"error": str(exc)})

        # ── Methodology Phase 5: Animated Diagrams ────────────
        try:
            await self._emit_status("Phase5:Diagrams", "started", {})
            # Build SRG from contract paths
            srg = None
            for sol_path in contract_paths:
                p = Path(sol_path)
                target = str(p) if p.is_dir() else str(p.parent)
                parser = SolidityParser(target)
                parsed = parser.parse_all()
                srg = SecurityReasoningGraph.from_parser_output(parsed)
                break  # use first path
            if srg:
                self.diagrams = DiagramEngine(srg)
                system_map = self.diagrams.generate_system_map()
                value_flow_data = self.diagrams.generate_value_flow(context.get("protocol_type", "generic"))
                
                context["diagram_data"] = {
                    "system_map": system_map,
                    "value_flow": value_flow_data,
                    "trust_boundaries": self.diagrams.generate_trust_boundaries()
                }
                
                # Emit system map first
                await self._emit_status("Phase5:Diagrams", "completed", context["diagram_data"])
                
                # Broadcast individual flows for animation
                for flow in value_flow_data.get("flows", []):
                    await self._emit_status("value_flow", "broadcast", flow)
                    await asyncio.sleep(1) # Gap between animations
            else:
                await self._emit_status("Phase5:Diagrams", "skipped", {"reason": "No SRG"})
        except Exception as srg_exc:
            await self._emit_status("Phase5:Diagrams", "failed", {"error": str(srg_exc)})

        # ── Methodology Phase 4: Code Reading ──────────────────
        try:
            await self._emit_status("Phase4:CodeReading", "started", {})
            planner = Planner()
            plan = await planner.create_plan(srg, api_key=api_key)
            results["plan"] = plan
            context["plan"] = plan
            
            # Specialized Hunters
            print("[Attack] Running strategies (Methodology Hunting List)...")
            from srp.agents.attack.engine import AttackEngine
            attack_engine = AttackEngine()
            attack_results = await attack_engine.run(plan, context)
            context["attacks"] = attack_results
            results["attacks"] = attack_results
            
            await self._emit_status("Phase4:CodeReading", "completed", {"results": len(attack_results)})
        except Exception as ae_exc:
            await self._emit_status("Phase4:CodeReading", "failed", {"error": str(ae_exc)})

        # ── Methodology Phase 6: Findings ──────────────────────
        try:
            await self._emit_status("Phase6:Findings", "started", {})
            attack = await self.attack_agent.run(context)
            all_vulns = attack.get("vulnerabilities", [])
            
            # PoC Verification
            all_vulns = await run_all_pocs(all_vulns, project_root)
            proven = sum(1 for f in all_vulns if f.get("poc_result", {}).get("status") == "proven")
            
            # Populate Findings in Notes
            for vuln in all_vulns:
                fid = f"FINDING-{uuid4().hex[:4].upper()}"
                content = f"# {vuln.get('title')}\nSEVERITY: {vuln.get('severity')}\n\nROOT CAUSE:\n{vuln.get('description')}"
                self.notes.add_finding(fid, content)

            await self._emit_status("Phase6:Findings", "completed", {"findings": len(all_vulns), "proven": proven})
        except Exception as exc:
            await self._emit_status("Phase6:Findings", "failed", {"error": str(exc)})

        # ── Finalize ───────────────────────────────────────────
        try:
            defense = await self.defense_agent.run(context)
            report = await self.report_agent.run(context)
            results["report"] = report
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
        print(f"[SRP] [Orchestrator] {msg}")
