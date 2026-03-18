import asyncio
import os
from typing import Dict, Any, List

from mcp.wrapper import MCPWrapper


class AttackEngine:
    def __init__(self):
        from attack_engine.strategies.flashloan import FlashloanStrategy
        from attack_engine.strategies.oracle import OracleManipulationStrategy
        from attack_engine.strategies.reentrancy import ReentrancyProbeStrategy
        
        self.strategies = [
            FlashloanStrategy(),
            OracleManipulationStrategy(),
            ReentrancyProbeStrategy()
        ]

    async def run(self, plan: dict, context: dict) -> List[Dict[str, Any]]:
        mcp = MCPWrapper()
        matched_skills = context.get("matched_skills", [])
        
        # 1. Execute strategies in parallel based on the requested plan
        tasks = []
        for strategy in self.strategies:
            tasks.append(strategy.run(context, mcp))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 2. Add learned skills as successful findings if they match and are profitable
        processed_results = []
        for res in results:
            if isinstance(res, Exception):
                # ... handle exception
                pass
            else:
                processed_results.append(res)
                
        # 3. If any matched skill has successful history, we can simulate it too
        # For now, we just log them. In a real system, we'd run a 'SkillStrategy'.
        if matched_skills:
            print(f"[Learning] Prioritizing {len(matched_skills)} matched skills")
            
        return processed_results
        
        processed_results = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                processed_results.append({
                    "strategy": self.strategies[i].name,
                    "status": "error",
                    "profit": 0,
                    "confidence": 0.0,
                    "error": str(res)
                })
            else:
                processed_results.append(res)
                
        return processed_results
