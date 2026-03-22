import os
from web3 import Web3

class ReentrancyProbeStrategy:
    name = "reentrancy"

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
        
        attacker = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

        # 1. identify external calls & simulate recursive call
        selector = "0x00000000"
        if srg:
            print(f"[Attack] Analyzing SRG for reentrancy patterns in {contract_name}...")
            # Pattern: EXTERNAL_CALL + WRITES in same function
            potential_targets = srg.get_sensitive_functions()
            
            reentrancy_target = None
            for f in potential_targets:
                if f.metadata.get("contract") == contract_name:
                    reentrancy_target = f
                    # Prioritize common names
                    if any(kw in f.name.lower() for kw in ["withdraw", "claim", "refund", "transfer"]):
                        break
            
            if reentrancy_target:
                print(f"[Attack] Found reentrancy candidate: {reentrancy_target.name}")
                sig = srg.get_function_signature(reentrancy_target.id)
                selector = self.w3.keccak(text=sig).hex()[:10]
            else:
                 # Fallback name search
                 all_funcs = srg.get_functions(contract_name)
                 for f in all_funcs:
                    if any(kw in f.name.lower() for kw in ["withdraw", "claim", "transfer"]):
                        selector = self.w3.keccak(text=f"{f.name}()").hex()[:10]
                        break

        # 2. Get balance before
        bal_before_res = await mcp.call("eth_get_balance", {"address": attacker})
        bal_before = bal_before_res.get("result", {}).get("balance", 0)

        # 3. Simulate attack
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
            "status": "success" if profit > 10000 else "no_exploit", # Threshold for reentrancy
            "profit": profit,
            "confidence": 0.8 if profit > 10000 else 0.1,
            "steps": [
                {"target": target, "data": selector, "value": 0}
            ],
            "rpc_url": os.environ.get("RPC_URL", "http://127.0.0.1:8545")
        }


