from srp.agents.evolution.genome import AttackGenome

class Evaluator:
    async def evaluate(self, genome: AttackGenome, context: dict, mcp) -> dict:
        """
        Simulates the genome steps using MCP and computes basic profit.
        """
        attacker = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        
        # 1. Get balance before
        res_before = await mcp.call("eth_get_balance", {"address": attacker})
        bal_before = res_before.get("result", {}).get("balance", 0)

        # 2. Simulate steps
        success_count = 0
        for step in genome.steps:
            try:
                # Use MCP simulate_tx
                sim_res = await mcp.call("simulate_tx", {
                    "from": attacker,
                    "to": step.target,
                    "data": step.data,
                    "value": step.value
                })
                if sim_res.get("status") != "error":
                    success_count += 1
            except Exception:
                continue
        
        # 3. Get balance after
        res_after = await mcp.call("eth_get_balance", {"address": attacker})
        bal_after = res_after.get("result", {}).get("balance", 0)
        
        profit = max(0, bal_after - bal_before)
        
        # Compute final scorecard
        return {
            "profit": profit,
            "success_rate": success_count / len(genome.steps) if genome.steps else 0,
            "valid": profit > 0 or success_count == len(genome.steps)
        }
