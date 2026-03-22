"""
agents/v2/dev_agents_v2.py
O1: V2 Ports of Dev Agents utilizing BaseAgentV2 and Memory encapsulation.
"""
from typing import Dict, Any, Awaitable
from srp.core.v2.base_agent import BaseAgentV2
from srp.core.v2.graph import END
import re
import json

class SimpleV2Agent(BaseAgentV2):
    """A generic V2 agent with a single instruction node."""
    def __init__(self, system_prompt: str, json_mode: bool = False, run_id: str = None):
        super().__init__(run_id)
        self.system_prompt = system_prompt
        self.json_mode = json_mode

    def build_graph(self):
        self.graph.add_node("process", self.node_process)
        self.graph.set_entry_point("process")
        self.graph.add_edge("process", END)

    async def node_process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        code = state.get("code", "")
        prompt = f"Contract Code:\n{code}\n\nPerform your analysis."
        
        output = await self._call_llm(self.system_prompt, prompt)
        
        self.memory.log_episode("actor", "Generated analysis")
        
        if self.json_mode:
            try:
                cleaned = re.sub(r'```(?:json)?\s*', '', output).strip().rstrip('`').strip()
                result = json.loads(cleaned)
                return {"result": result}
            except:
                return {"result": {}, "error": "JSON parse failed"}
        else:
            return {"result": output}


# ── V2 Dev Agents ──

class NatSpecAgentV2(SimpleV2Agent):
    def __init__(self, run_id=None):
        super().__init__(
            system_prompt="You are an expert Solidity documentation writer. Generate complete NatSpec documentation for every function. Output ONLY the documented code.",
            json_mode=False,
            run_id=run_id
        )

class GasOptimizerV2(SimpleV2Agent):
    def __init__(self, run_id=None):
        super().__init__(
            system_prompt="""You are a Solidity gas optimization expert. Analyze the code. Return JSON only:
{"gas_hints": [{"id":"GAS-1","category":"storage","description":"...","before":"...","after":"...","estimated_savings":"..."}]}""",
            json_mode=True,
            run_id=run_id
        )

class UpgradeSafetyCheckerV2(SimpleV2Agent):
    def __init__(self, run_id=None):
        super().__init__(
            system_prompt="""You are an upgrade safety expert. Analyze UUPS/Proxy patterns. Return JSON only:
{"is_upgradeable":true, "proxy_pattern":"UUPS", "upgrade_issues":[{"id":"UPG-1","severity":"high","description":"...","recommendation":"..."}]}""",
            json_mode=True,
            run_id=run_id
        )

class DevAccessControlMapperV2(SimpleV2Agent):
    def __init__(self, run_id=None):
        super().__init__(
            system_prompt="""You are an access control expert. Map roles. Return JSON only:
{"roles":[{"role":"admin","functions":["foo"]}], "access_findings":[{"id":"AC-1","severity":"high","description":"..."}]}""",
            json_mode=True,
            run_id=run_id
        )
