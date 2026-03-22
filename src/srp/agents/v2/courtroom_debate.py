"""
agents/v2/courtroom_debate.py
N1-N5: Implements the VulTrial-inspired Courtroom Multi-Agent Debate.
Roles: Prosecutor (Attacker), Defense (Code Author), Judge, Jury.
Eliminates hallucinations through aggressive adversarial cross-examination.
"""
from typing import Dict, Any, Awaitable
from srp.core.v2.base_agent import BaseAgentV2
from srp.core.v2.graph import END
import re
import json

class CourtroomDebateAgent(BaseAgentV2):
    """
    State Graph: PROSECUTOR -> DEFENSE -> JUDGE -> [END if dismissed else PROSECUTOR(Rebuttal) -> JURY -> END]
    """
    def build_graph(self):
        self.graph.add_node("prosecutor", self.node_prosecutor)
        self.graph.add_node("defense", self.node_defense)
        self.graph.add_node("judge", self.node_judge)
        self.graph.add_node("jury", self.node_jury)

        self.graph.set_entry_point("prosecutor")
        self.graph.add_edge("prosecutor", "defense")
        self.graph.add_edge("defense", "judge")
        
        # Route logic after Judge
        def route_judge(state: Dict[str, Any]) -> str:
            verdict = state.get("judge_ruling", "continue")
            if verdict == "dismissed":
                return END
            return "jury"
            
        self.graph.add_conditional_edges("judge", route_judge)

    async def node_prosecutor(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """N2: Generates the strict attack hypothesis."""
        code = state.get("code", "")
        hypo = state.get("initial_hypothesis", "Find vulnerabilities.")
        rebuttal_round = state.get("defense_argument", None) is not None
        
        if not rebuttal_round:
            sys = """You are the PROSECUTOR (Security Researcher).
Your job is to formulate a STRICT attack hypothesis. Identify a critical vulnerability in the provided code.
State the exact execution path and assumptions required to trigger it."""
            user = f"Code:\n{code}\n\nHypothesis Context:\n{hypo}\n\nArgue how this can be exploited."
        else:
            sys = """You are the PROSECUTOR (Security Researcher).
Provide your REBUTTAL to the Defense Attorney's claims."""
            user = f"Defense Argument:\n{state.get('defense_argument')}\n\nProvide your rebuttal."
            
        out = await self._call_llm(sys, user)
        
        if not rebuttal_round:
            self.memory.log_episode("prosecutor", out)
            return {"prosecutor_argument": out}
        else:
            self.memory.log_episode("prosecutor_rebuttal", out)
            return {"prosecutor_rebuttal": out}

    async def node_defense(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """N3: Defends the implementation and finds flaws in Prosecutor's assumptions."""
        code = state.get("code", "")
        prosecutor_arg = state.get("prosecutor_argument", "")
        
        sys = """You are the DEFENSE ATTORNEY (Code Author).
Meticulously tear apart the Prosecutor's attack hypothesis. Point out constraints, modifiers, require() statements, or math that blocks the attack. Do NOT concede unless absolutely undeniably broken."""
        user = f"Code:\n{code}\n\nProsecutor's Attack:\n{prosecutor_arg}\n\nDefend your code."
        
        out = await self._call_llm(sys, user)
        self.memory.log_episode("defense", out)
        
        return {"defense_argument": out}

    async def node_judge(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """N4: Assesses the debate groundedness. Dismisses hallucinations."""
        prosecutor = state.get("prosecutor_argument", "")
        defense = state.get("defense_argument", "")
        code = state.get("code", "")
        
        sys = """You are the JUDGE.
You review the Prosecutor and Defense arguments against the actual code.
If the Prosecutor relies on hallucinated code, non-existent functions, or clearly bypassed modifiers, output exactly "DISMISSED".
Otherwise, output "CONTINUE" to let the Jury decide."""
        user = f"Code:\n{code}\n\nProsecutor:\n{prosecutor}\n\nDefense:\n{defense}\n\nVerdict (DISMISSED or CONTINUE):"
        
        out = await self._call_llm(sys, user).strip().upper()
        
        ruling = "dismissed" if "DISMISSED" in out else "continue"
        self.memory.log_episode("judge", f"Ruling: {ruling}\nReasoning: {out}")
        
        return {"judge_ruling": ruling}

    async def node_jury(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """N5: Delivers final deterministic verdict on severity."""
        prosecutor = state.get("prosecutor_argument", "")
        defense = state.get("defense_argument", "")
        code = state.get("code", "")
        
        sys = """You are the JURY.
Determine the final severity of the vulnerability discussed in the debate.
Return JSON only:
{
    "verdict": "confirmed|false_positive",
    "severity": "critical|high|medium|low|none",
    "reasoning": "Brief final synthesis"
}"""
        user = f"Code:\n{code}\n\nProsecutor:\n{prosecutor}\n\nDefense:\n{defense}\n\nFind a verdict."
        
        out = await self._call_llm(sys, user)
        # Parse JSON safely
        try:
            cleaned = re.sub(r'```(?:json)?\s*', '', out).strip().rstrip('`').strip()
            result = json.loads(cleaned)
        except:
            result = {"verdict": "false_positive", "severity": "none", "reasoning": "JSON parse error"}
            
        self.memory.log_episode("jury", json.dumps(result))
        
        return {
            "final_verdict": result.get("verdict"),
            "final_severity": result.get("severity"),
            "jury_reasoning": result.get("reasoning")
        }
