from agents.base_agent import BaseAgent

class AttackerAgent(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="Attacker",
            role="Tries to prove the exploit is real and strengthens the attack",
            model=model
        )

    async def run(self, context: dict, exploit: dict) -> dict:
        """
        Tries to prove the exploit is real and strengthens the attack.
        """
        self.log_step("attacker_run_started", {"strategy": exploit.get("strategy")})
        
        # Simulating LLM call that returns JSON
        # In a real run, this would be:
        # response = await self.call_llm(...)
        # return self.parse_json(response)
        
        refined_exploit = exploit.copy()
        
        return {
            "argument": "The exploit is valid because the state dependency in the SRG shows that the withdraw function does not update the balance before the external call, allowing for a recursive entry.",
            "refined_exploit": refined_exploit,
            "confidence": 0.9
        }

    async def refine(self, counter_argument: str, context: dict, exploit: dict) -> dict:
        """
        Refines the argument or exploit based on the defender's counter.
        """
        self.log_step("attacker_refining", {"counter_length": len(counter_argument)})
        
        return {
            "argument": "The defender's claim about the 'require' check is invalid because the 'lock' state variable is only updated at the end of the transaction, which is exactly the window we exploit.",
            "refined_exploit": exploit,
            "confidence": 0.95
        }
