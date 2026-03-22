"""
core/v2/base_agent.py
Base class for SRP V2 Autonomous Agents.
Integrates StateGraph and MemoryManager into a unified abstract agent.
"""
from typing import Dict, Any, Awaitable
from srp.core.v2.graph import StateGraph
from srp.core.v2.memory import MemoryManager
import uuid
import os

class BaseAgentV2:
    """
    Abstract Class for V2 Agentic Architecture.
    Agents define their own graphs (Courtroom debate vs Reflexion OODA loop)
    by overriding `build_graph()`.
    """
    def __init__(self, run_id: str = None):
        self.run_id = run_id or str(uuid.uuid4())
        self.memory = MemoryManager(run_id=self.run_id)
        self.graph = StateGraph()
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.model = "claude-sonnet-4-6"

    def build_graph(self):
        """
        Must be implemented by subclasses.
        Should map nodes and edges onto `self.graph`.
        """
        raise NotImplementedError("Subclasses must build the StateGraph.")

    async def run(self, initial_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compiles and executes the graph with the given initial state.
        Ensures the graph is built before execution.
        """
        if not self.graph.nodes:
            self.build_graph()
            
        # Inject standard required state variables
        initial_state["messages"] = initial_state.get("messages", [])
        initial_state["run_id"] = self.run_id
        initial_state["errors"] = initial_state.get("errors", [])

        self.memory.log_episode("system", f"Agent run started for {self.__class__.__name__}")
        
        try:
            final_state = await self.graph.compile(initial_state)
            self.memory.log_episode("system", f"Agent run completed")
            return final_state
        except Exception as e:
            self.memory.log_episode("error", f"Agent run failed: {str(e)}")
            raise

    async def _call_llm(self, sys_prompt: str, user_prompt: str) -> str:
        """Helper to call Anthropic API."""
        import anthropic
        client = anthropic.Anthropic(api_key=self.api_key)
        msg = client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=sys_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return msg.content[0].text if msg.content else ""
