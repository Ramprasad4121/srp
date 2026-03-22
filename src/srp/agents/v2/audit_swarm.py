"""
agents/v2/audit_swarm.py
N6: Ports the master AttackAgent logic to use the new CourtroomDebateAgent framework.
"""
from typing import Dict, Any, List
from srp.agents.v2.courtroom_debate import CourtroomDebateAgent
import asyncio

class AuditSwarmV2:
    """
    Replaces the linear AttackAgent.
    Dispatches candidate vulnerabilities to independent CourtroomDebate graphs.
    """
    def __init__(self, run_id: str = None):
        self.run_id = run_id
        
    async def run(self, context: dict) -> dict:
        code = context.get("code", "")
        candidate_hypotheses = context.get("hypotheses", [])
        
        if not code or not candidate_hypotheses:
            return {"findings": []}
            
        # Run independent Courtroom debates concurrently for each candidate
        tasks = []
        for hypo in candidate_hypotheses:
            agent = CourtroomDebateAgent(run_id=f"{self.run_id}_{len(tasks)}")
            tasks.append(agent.run({
                "code": code,
                "initial_hypothesis": hypo
            }))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        valid_findings = []
        for res, hypo in zip(results, candidate_hypotheses):
            if isinstance(res, Exception):
                continue
                
            # Filter solely based on VulTrial courtroom outcome
            if res.get("judge_ruling") != "dismissed" and res.get("final_verdict") == "confirmed":
                valid_findings.append({
                    "title": hypo.split("\n")[0][:80].replace("Title: ", ""),
                    "severity": res.get("final_severity", "high"),
                    "contract": "Unknown_Contract", # Will be resolved by normalize pass
                    "description": res.get("prosecutor_argument", "") + "\n\nJury Reasoning: " + res.get("jury_reasoning", ""),
                    "exploit_code": "// Validated by Courtroom Debate.",
                    "fix_code": "// Needs remediation.",
                    "confidence": 0.95,
                    "debate_trace": [ep for ep in res.get("messages", [])]
                })
                
        return {"findings": valid_findings}
