from __future__ import annotations

import asyncio
import copy
import inspect
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from agents.analysis.blast_radius_agent import BlastRadiusAgent
from agents.analysis.diff_agent import DiffAgent
from agents.analysis.fork_agent import ForkAgent
from agents.attack.attack_alpha import AttackAgentAlpha
from agents.attack.attack_beta import AttackAgentBeta
from agents.attack.attack_gamma import AttackAgentGamma
from agents.defense.defense_agent import DefenseAgent
from agents.defense.patch_agent import PatchAgent
from agents.intelligence.graph_agent import GraphAgent
from agents.intelligence.recon_agent import ReconAgent
from agents.intelligence.sentinel_agent import SentinelAgent
from agents.intelligence.threat_intel_agent import ThreatIntelAgent
from agents.report_agent import ReportAgent
from agents.trace_agent import TraceAgent
from core.skill_loader import SkillLoader


class OrchestratorAgent:
    WATCHDOG_INTERVAL_SECONDS = 5 * 60
    ATTACK_CONTEXT_KEYS = {"contract_code", "system_map", "entry_points", "invariants"}

    def __init__(self) -> None:
        self.skill_loader = SkillLoader()

        self.recon_agent = ReconAgent()
        self.fork_agent = ForkAgent()
        self.attack_alpha = AttackAgentAlpha()
        self.attack_beta = AttackAgentBeta()
        self.attack_gamma = AttackAgentGamma()
        self.defense_agent = DefenseAgent()
        self.patch_agent = PatchAgent()
        self.trace_agent = TraceAgent()
        self.report_agent = ReportAgent()
        self.sentinel_agent = SentinelAgent()
        self.threat_intel_agent = ThreatIntelAgent()
        self.blast_radius_agent = BlastRadiusAgent()
        self.diff_agent = DiffAgent()
        self.graph_agent = GraphAgent()

        self.agents = {
            "ReconAgent": self.recon_agent,
            "ForkAgent": self.fork_agent,
            "AttackAgentAlpha": self.attack_alpha,
            "AttackAgentBeta": self.attack_beta,
            "AttackAgentGamma": self.attack_gamma,
            "DefenseAgent": self.defense_agent,
            "PatchAgent": self.patch_agent,
            "TraceAgent": self.trace_agent,
            "ReportAgent": self.report_agent,
            "SentinelAgent": self.sentinel_agent,
            "ThreatIntelAgent": self.threat_intel_agent,
            "BlastRadiusAgent": self.blast_radius_agent,
            "DiffAgent": self.diff_agent,
            "GraphAgent": self.graph_agent,
        }
        self.status_callback = None

    def set_status_callback(self, callback) -> None:
        self.status_callback = callback

    async def handle_event(self, event: dict) -> dict:
        if not isinstance(event, dict):
            raise ValueError("OrchestratorAgent.handle_event requires an event dictionary")

        event_type = str(
            event.get("event_type")
            or event.get("event")
            or event.get("type")
            or ""
        ).strip()
        if not event_type:
            raise ValueError("Event is missing a type (expected event_type/event/type)")

        normalized = event_type.lower()
        await self._emit_status("OrchestratorAgent", "event_received", {"event_type": normalized})

        if normalized == "new_audit":
            return await self._handle_new_audit(event)
        if normalized == "anomalous_tx":
            return await self._handle_anomalous_tx(event)
        if normalized == "new_exploit_published":
            return await self._handle_new_exploit_published(event)
        if normalized == "code_change":
            return await self._handle_code_change(event)
        if normalized == "new_contract_deployed":
            return await self._handle_new_contract_deployed(event)

        raise ValueError(f"Unsupported event type: {event_type}")

    async def run_watchdog_cycle(self) -> dict:
        await self._emit_status("Watchdog", "started", {"interval_seconds": self.WATCHDOG_INTERVAL_SECONDS})
        sentinel_result, threat_result = await asyncio.gather(
            self.sentinel_agent.run_heartbeat(),
            self.threat_intel_agent.run_heartbeat(),
        )
        manifest = await self.get_skills_manifest()
        result = {
            "heartbeat_interval_seconds": self.WATCHDOG_INTERVAL_SECONDS,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sentinel": sentinel_result,
            "threat_intel": threat_result,
            "skills_manifest": manifest,
        }
        await self._emit_status("Watchdog", "completed", {"status": "ok"})
        return result

    async def get_skills_manifest(self) -> dict:
        return self.skill_loader.get_manifest()

    async def _handle_new_audit(self, event: dict) -> dict:
        contract_code, contract_paths = self._resolve_contract_inputs(event)
        raw_input = str(event.get("raw_input", "")).strip()

        await self._emit_status("ReconAgent", "started", {})
        recon = await self.recon_agent.run({"contract_paths": contract_paths})
        await self._emit_status("ReconAgent", "completed", {"entry_points": len(recon.get("entry_points", []))})

        await self._emit_status("ForkAgent", "started", {})
        fork = await self.fork_agent.run(
            {
                "contract_code": contract_code,
                "contract_paths": contract_paths,
                "raw_input": raw_input,
                "contract_name": event.get("contract_name", ""),
            }
        )
        await self._emit_status("ForkAgent", "completed", {"is_fork": bool(fork.get("is_fork", False))})

        alpha_ctx, beta_ctx, gamma_ctx = self._build_isolated_attack_contexts(
            contract_code=contract_code,
            system_map=recon.get("system_map", {}),
            entry_points=recon.get("entry_points", []),
            invariants=recon.get("invariants", []),
        )

        await self._emit_status("AttackAgents", "started", {"mode": "parallel"})
        alpha_result, beta_result, gamma_result = await asyncio.gather(
            self.attack_alpha.run(alpha_ctx),
            self.attack_beta.run(beta_ctx),
            self.attack_gamma.run(gamma_ctx),
        )
        await self._emit_status("AttackAgents", "completed", {})

        combined_vulns = self._merge_attack_vulnerabilities(alpha_result, beta_result, gamma_result)
        defense_context = {
            "attack_results": {
                "alpha": alpha_result,
                "beta": beta_result,
                "gamma": gamma_result,
            },
            "combined_findings": combined_vulns,
            "contract_code": contract_code,
            "documented_spec": event.get("documented_spec", ""),
        }

        await self._emit_status("DefenseAgent", "started", {"findings": len(combined_vulns)})
        defense = await self.defense_agent.run(defense_context)
        await self._emit_status(
            "DefenseAgent",
            "completed",
            {
                "confirmed": len(defense.get("confirmed_vulnerabilities", [])),
                "score": defense.get("security_score"),
            },
        )

        patch_trace_id = str(uuid4())
        await self._emit_status("PatchAgent", "started", {"trace_id": patch_trace_id})
        patch = await self.patch_agent.run(
            {
                "contract_code": contract_code,
                "confirmed_vulnerabilities": defense.get("confirmed_vulnerabilities", []),
                "trace_id": patch_trace_id,
            }
        )
        await self._emit_status("PatchAgent", "completed", {"patches": len(patch.get("patches", []))})

        trace_context = {
            "contract_paths": contract_paths,
            "final_findings": defense,
            "defense_output": {
                **defense,
                "overall_security_score": defense.get("security_score"),
            },
            "vulnerabilities": combined_vulns,
            "overall_security_score": defense.get("security_score"),
            "agent_traces": {
                "ReconAgent": self.recon_agent.get_trace(),
                "AttackAgent": [
                    *self.attack_alpha.get_trace(),
                    *self.attack_beta.get_trace(),
                    *self.attack_gamma.get_trace(),
                ],
                "DefenseAgent": self.defense_agent.get_trace(),
                "ForkAgent": self.fork_agent.get_trace(),
                "PatchAgent": self.patch_agent.get_trace(),
            },
            "assumptions": event.get("assumptions", []),
        }

        await self._emit_status("TraceAgent", "started", {})
        trace = await self.trace_agent.run(trace_context)
        await self._emit_status("TraceAgent", "completed", {"trace_id": trace.get("trace_id")})

        attack_summary = (
            f"Alpha findings: {len(alpha_result.get('vulnerabilities', []))}; "
            f"Beta findings: {len(beta_result.get('vulnerabilities', []))}; "
            f"Gamma findings: {len(gamma_result.get('vulnerabilities', []))}."
        )
        report_context = {
            "raw_input": raw_input,
            "contract_paths": contract_paths,
            "intent_output": {
                "task": raw_input,
                "scope": event.get("scope", ""),
                "risk_level": event.get("risk_level", "medium"),
                "skills": event.get("skills", []),
                "budget": event.get("budget_usd"),
            },
            "recon_output": recon,
            "attack_output": {
                "vulnerabilities": combined_vulns,
                "attack_summary": attack_summary,
            },
            "defense_output": {
                **defense,
                "overall_security_score": defense.get("security_score"),
            },
            "trace_output": trace,
        }

        await self._emit_status("ReportAgent", "started", {})
        report = await self.report_agent.run(report_context)
        await self._emit_status("ReportAgent", "completed", {"report_path": report.get("report_path")})

        return {
            "event_type": "new_audit",
            "recon": recon,
            "fork": fork,
            "attack": {
                "alpha": alpha_result,
                "beta": beta_result,
                "gamma": gamma_result,
                "combined_vulnerabilities": combined_vulns,
            },
            "defense": defense,
            "patch": patch,
            "trace": trace,
            "report": report,
        }

    async def _handle_anomalous_tx(self, event: dict) -> dict:
        tx = event.get("tx", event.get("transaction", {}))
        if not isinstance(tx, dict):
            raise ValueError("anomalous_tx event requires tx/transaction object")

        contract_code = str(event.get("contract_code", "")).strip()
        alpha_ctx, beta_ctx, gamma_ctx = self._build_isolated_attack_contexts(
            contract_code=contract_code,
            system_map=event.get("system_map", {}),
            entry_points=event.get("entry_points", []),
            invariants=event.get("invariants", []),
        )

        await self._emit_status("AnomalousTx", "started", {"mode": "fast"})
        sentinel_result, alpha_result, beta_result, gamma_result = await asyncio.gather(
            self.sentinel_agent.analyze_transaction(tx),
            self.attack_alpha.run(alpha_ctx),
            self.attack_beta.run(beta_ctx),
            self.attack_gamma.run(gamma_ctx),
        )
        await self._emit_status("AnomalousTx", "completed", {})

        return {
            "event_type": "anomalous_tx",
            "mode": "fast",
            "sentinel": sentinel_result,
            "attack": {
                "alpha": alpha_result,
                "beta": beta_result,
                "gamma": gamma_result,
                "combined_vulnerabilities": self._merge_attack_vulnerabilities(
                    alpha_result, beta_result, gamma_result
                ),
            },
        }

    async def _handle_new_exploit_published(self, event: dict) -> dict:
        exploit = event.get("new_exploit")
        if not isinstance(exploit, dict):
            exploit = {
                "protocol": event.get("protocol", ""),
                "attack_vector": event.get("attack_vector", ""),
                "vulnerable_pattern": event.get("vulnerable_pattern", ""),
                "exploit_code": event.get("exploit_code", ""),
            }

        await self._emit_status("NewExploit", "started", {})

        if exploit.get("vulnerable_pattern"):
            threat_result, blast_result = await asyncio.gather(
                self.threat_intel_agent.scrape_latest_threats(),
                self.blast_radius_agent.run(
                    {
                        "new_exploit": exploit,
                        "graph_payload": event.get("graph_payload"),
                        "graph_path": event.get("graph_path"),
                        "monitored_contracts": event.get("monitored_contracts", []),
                        "contract_sources": event.get("contract_sources", {}),
                    }
                ),
            )
        else:
            threat_result = await self.threat_intel_agent.scrape_latest_threats()
            if not threat_result:
                blast_result = {
                    "exploit": exploit,
                    "at_risk_contracts": [],
                    "safe_contracts": [],
                }
            else:
                candidate = threat_result[0]
                blast_result = await self.blast_radius_agent.run(
                    {
                        "new_exploit": {
                            "protocol": candidate.get("protocol", ""),
                            "attack_vector": candidate.get("attack_vector", ""),
                            "vulnerable_pattern": candidate.get("vulnerable_pattern", ""),
                            "exploit_code": candidate.get("exploit_code_snippet", ""),
                        },
                        "graph_payload": event.get("graph_payload"),
                        "graph_path": event.get("graph_path"),
                        "monitored_contracts": event.get("monitored_contracts", []),
                        "contract_sources": event.get("contract_sources", {}),
                    }
                )

        await self._emit_status("NewExploit", "completed", {})
        return {
            "event_type": "new_exploit_published",
            "threat_intel": {
                "new_threats": threat_result,
                "count": len(threat_result),
            },
            "blast_radius": blast_result,
        }

    async def _handle_code_change(self, event: dict) -> dict:
        old_code = str(event.get("old_code", ""))
        new_code = str(event.get("new_code", ""))
        if not old_code and not new_code:
            raise ValueError("code_change event requires old_code and/or new_code")

        await self._emit_status("DiffAgent", "started", {})
        diff = await self.diff_agent.run(
            {
                "old_code": old_code,
                "new_code": new_code,
                "file_path": event.get("file_path", "contract.sol"),
                "old_ref": event.get("old_ref", ""),
                "new_ref": event.get("new_ref", ""),
            }
        )
        await self._emit_status("DiffAgent", "completed", {"net_security_change": diff.get("net_security_change")})

        risk_detected = self._is_risk_detected(diff)
        attacks = None
        if risk_detected:
            alpha_ctx, beta_ctx, gamma_ctx = self._build_isolated_attack_contexts(
                contract_code=new_code,
                system_map=event.get("system_map", {}),
                entry_points=event.get("entry_points", []),
                invariants=event.get("invariants", []),
            )
            await self._emit_status("AttackAgents", "started", {"trigger": "code_change"})
            alpha_result, beta_result, gamma_result = await asyncio.gather(
                self.attack_alpha.run(alpha_ctx),
                self.attack_beta.run(beta_ctx),
                self.attack_gamma.run(gamma_ctx),
            )
            await self._emit_status("AttackAgents", "completed", {"trigger": "code_change"})
            attacks = {
                "alpha": alpha_result,
                "beta": beta_result,
                "gamma": gamma_result,
                "combined_vulnerabilities": self._merge_attack_vulnerabilities(
                    alpha_result, beta_result, gamma_result
                ),
            }

        return {
            "event_type": "code_change",
            "diff": diff,
            "risk_detected": risk_detected,
            "attacks": attacks,
        }

    async def _handle_new_contract_deployed(self, event: dict) -> dict:
        source_code = str(
            event.get("source_code", event.get("contract_code", ""))
        ).strip()
        address = str(event.get("address", event.get("contract_address", ""))).strip()
        if not source_code:
            raise ValueError("new_contract_deployed event requires source_code/contract_code")
        if not address:
            raise ValueError("new_contract_deployed event requires address/contract_address")

        await self._emit_status("DeploymentAnalysis", "started", {})
        fork_result, graph_result = await asyncio.gather(
            self.fork_agent.run(
                {
                    "contract_code": source_code,
                    "raw_input": event.get("raw_input", ""),
                    "contract_name": event.get("contract_name", ""),
                }
            ),
            self.graph_agent.map_contract(address=address, source_code=source_code),
        )
        await self._emit_status("DeploymentAnalysis", "completed", {})

        return {
            "event_type": "new_contract_deployed",
            "fork": fork_result,
            "graph": graph_result,
        }

    async def _emit_status(self, step_name: str, status: str, data: dict[str, Any]) -> None:
        if self.status_callback is None:
            return
        maybe_awaitable = self.status_callback(step_name, status, data)
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable

    def _resolve_contract_inputs(self, event: dict) -> tuple[str, list[str]]:
        contract_code = str(event.get("contract_code", "")).strip()
        raw_paths = event.get("contract_paths", [])
        if not isinstance(raw_paths, list):
            raw_paths = [raw_paths] if raw_paths else []

        contract_paths: list[str] = []
        for raw_path in raw_paths:
            text = str(raw_path).strip()
            if text:
                contract_paths.append(text)

        if not contract_paths and contract_code:
            runtime_dir = Path.cwd() / ".runtime" / "contracts"
            runtime_dir.mkdir(parents=True, exist_ok=True)
            path = runtime_dir / f"{uuid4().hex}.sol"
            path.write_text(contract_code, encoding="utf-8")
            contract_paths.append(str(path))

        if not contract_code and contract_paths:
            code_chunks: list[str] = []
            for path_text in contract_paths:
                path = Path(path_text).expanduser()
                if not path.is_absolute():
                    path = Path.cwd() / path
                if path.is_file() and path.suffix.lower() == ".sol":
                    try:
                        code_chunks.append(path.read_text(encoding="utf-8"))
                    except OSError:
                        continue
            contract_code = "\n\n".join(code_chunks).strip()

        if not contract_code and not contract_paths:
            raise ValueError("new_audit event requires contract_code or contract_paths")

        return contract_code, contract_paths

    def _build_isolated_attack_contexts(
        self,
        contract_code: Any,
        system_map: Any,
        entry_points: Any,
        invariants: Any,
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        base = {
            "contract_code": str(contract_code or ""),
            "system_map": system_map if isinstance(system_map, dict) else {},
            "entry_points": entry_points if isinstance(entry_points, list) else [],
            "invariants": invariants if isinstance(invariants, list) else [],
        }

        alpha_context = copy.deepcopy(base)
        beta_context = copy.deepcopy(base)
        gamma_context = copy.deepcopy(base)

        self._assert_isolated_attack_context(alpha_context)
        self._assert_isolated_attack_context(beta_context)
        self._assert_isolated_attack_context(gamma_context)
        return alpha_context, beta_context, gamma_context

    def _assert_isolated_attack_context(self, context: dict[str, Any]) -> None:
        keys = set(context.keys())
        if keys != self.ATTACK_CONTEXT_KEYS:
            raise ValueError(
                "Attack context isolation violated. "
                f"Expected keys {sorted(self.ATTACK_CONTEXT_KEYS)}, got {sorted(keys)}"
            )

    @staticmethod
    def _merge_attack_vulnerabilities(*attack_results: dict[str, Any]) -> list[dict[str, Any]]:
        merged: list[dict[str, Any]] = []
        for result in attack_results:
            if not isinstance(result, dict):
                continue
            agent_name = str(result.get("agent", "unknown"))
            vulns = result.get("vulnerabilities", [])
            if not isinstance(vulns, list):
                continue
            for item in vulns:
                if not isinstance(item, dict):
                    item = {"description": str(item)}
                row = dict(item)
                row.setdefault("agent", agent_name)
                merged.append(row)
        return merged

    @staticmethod
    def _is_risk_detected(diff_result: dict[str, Any]) -> bool:
        net = str(diff_result.get("net_security_change", "")).strip().lower()
        if net in {
            "worse",
            "regression",
            "negative",
            "degraded",
            "potential_regression",
            "high_risk",
            "critical",
        }:
            return True
        if diff_result.get("broken_invariants"):
            return True
        if diff_result.get("new_attack_surfaces"):
            return True
        return False
