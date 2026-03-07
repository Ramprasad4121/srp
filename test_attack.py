import asyncio
import os
import sys

# Change to srp directory
sys.path.insert(0, "/Users/ramprasadgoud/Desktop/ETH/srp")
os.chdir("/Users/ramprasadgoud/Desktop/ETH/srp")

from agents.attack_agent import AttackAgent
from dotenv import load_dotenv

load_dotenv()

async def test():
    print("Testing AttackAgent with deepseek...")
    agent = AttackAgent()
    contract_map = {"contracts": ["A", "B", "C"]}
    entry_points = ["function test() external"]
    
    print("Running business logic pass...")
    try:
        res = await asyncio.wait_for(agent._run_business_logic_pass(contract_map, entry_points), timeout=10)
        print("Result:", res)
    except Exception as e:
        print("Exception:", repr(e))

if __name__ == "__main__":
    asyncio.run(test())
