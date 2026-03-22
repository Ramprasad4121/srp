from srp.agents.base_agent import BaseAgent

class DefenderAgent(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="Defender",
            role="Tries to break the exploit and find failure conditions",
            model=model
        )

    async def run(self, context: dict, exploit: dict, attacker_argument: str) -> dict:
        """
        Tries to break the exploit and find failure conditions.
        """
        self.log_step("defender_run_started", {"attacker_argument_preview": attacker_argument[:100]})
        
        # Simulating LLM call
        return {
            "argument": "The exploit fails because the target contract has a ReentrancyGuard. Our internal check of the source shows that the 'nonReentrant' modifier is applied to all sensitive state-changing functions, which will revert the call.",
            "confidence": 0.8
        }

    async def counter(self, refined_argument: str, context: dict, exploit: dict) -> dict:
        """
        Provides a final counter-argument based on the attacker's refinement.
        """
        self.log_step("defender_countering", {"refined_argument_preview": refined_argument[:100]})
        
        return {
            "argument": "The attacker mentions a 'window', but that window is not reachable in the current fork because the contract has already locked the 'mutex' variable in the first call.",
            "confidence": 0.85
        }
