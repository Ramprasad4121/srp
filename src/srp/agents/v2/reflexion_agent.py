"""
agents/v2/reflexion_agent.py
Implements the Reflexion framework (OODA Loop) for V2 autonomous agents.
Automatically retries execution by generating verbal reinforcement logs on failure.
"""
from typing import Dict, Any, Awaitable
from srp.core.v2.base_agent import BaseAgentV2
from srp.core.v2.tools import get_tool
from srp.core.v2.graph import END
import re
import json

class ReflexionAgent(BaseAgentV2):
    """
    OODA-Loop based Agent. 
    State Graph: ACTOR -> EVALUATOR -> [END if success else REFLECTION -> ACTOR]
    """
    def __init__(self, run_id: str = None, max_retries: int = 3):
        super().__init__(run_id)
        self.max_retries = max_retries

    def build_graph(self):
        # M2: Actor Node
        self.graph.add_node("actor", self.node_actor)
        # M3: Evaluator Node
        self.graph.add_node("evaluator", self.node_evaluator)
        # M4: Reflection Node
        self.graph.add_node("reflection", self.node_reflection)

        self.graph.set_entry_point("actor")
        self.graph.add_edge("actor", "evaluator")
        
        # Route logic
        def route_evaluator(state: Dict[str, Any]) -> str:
            if state.get("is_successful") or state.get("retries", 0) >= self.max_retries:
                return END
            return "reflection"
            
        self.graph.add_conditional_edges("evaluator", route_evaluator)
        self.graph.add_edge("reflection", "actor")

    async def node_actor(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Generate output using historical episodic reflection as context."""
        retries = state.get("retries", 0)
        task = state.get("task", "")
        code = state.get("code", "")
        
        # Pull reflection feedback from Episodic Memory
        reflections = self.memory.get_evaluator_feedback()
        reflection_context = "\n".join(reflections) if reflections else "No previous attempts."
        
        sys_prompt = f"""You are an autonomous engineering agent (Actor).
Your goal is to complete the task successfully.

Task:
{task}

Previous Feedback / Mistakes to Avoid (Reflexion Memory):
{reflection_context}

Output ONLY the raw file string or JSON requested. Do not explain."""
        
        output = await self._call_llm(sys_prompt, f"Source Code:\n{code}")
        
        # Strip markdown fences if present
        output = re.sub(r'```(?:solidity|json)?', '', output).strip().rstrip('`').strip()
        
        self.memory.log_episode("actor", f"Generated attempt #{retries + 1}", {"length": len(output)})
        
        return {"current_output": output, "retries": retries + 1}

    async def node_evaluator(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate the actor's output using tools (e.g. Foundry)."""
        output = state.get("current_output", "")
        project_root = state.get("project_root", ".")
        tool_name = state.get("eval_tool", "none")
        
        if tool_name == "none":
            # No tool evaluation required; default to success
            return {"is_successful": True, "eval_trace": "Skipped evaluation."}
            
        tool = get_tool(tool_name, project_root)
        if not tool:
            return {"is_successful": False, "eval_trace": f"Tool '{tool_name}' not found."}
            
        # Write the output to a temporary file via a hook if provided
        write_hook = state.get("write_hook")
        if write_hook:
            await write_hook(output, project_root)
            
        # Invoke the evaluation tool (e.g. Foundry build/test)
        eval_args = state.get("eval_args", {"action": "build"})
        trace = await tool.invoke(eval_args)
        
        # Basic heuristic: if SUCCESS is in the output or it passes without errors
        is_successful = "FAILED" not in trace and "error" not in trace.lower()
        
        self.memory.log_episode("evaluator", "Evaluation completed", {"is_successful": is_successful})
        
        return {"is_successful": is_successful, "eval_trace": trace}

    async def node_reflection(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Generates verbal feedback on the failure."""
        trace = state.get("eval_trace", "")
        task = state.get("task", "")
        
        sys_prompt = """You are a Self-Reflection agent.
Your job is to analyze the execution failure trace and provide concrete, actionable advice for the Actor.
Do NOT output code. Only output verbal instructions on exactly what the Actor did wrong and how to fix it next."""
        
        user_prompt = f"Task: {task}\n\nTrace Output:\n{trace[-4000:]}\n\nWhat failed? How should I fix the code next time?"
        
        reflection_text = await self._call_llm(sys_prompt, user_prompt)
        
        # Store in episodic memory
        self.memory.log_episode("self_reflection", reflection_text)
        
        return {"latest_reflection": reflection_text}
