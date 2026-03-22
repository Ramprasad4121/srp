from srp.agents.base_agent import BaseAgent

class JudgeAgent(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="Judge",
            role="Decides final verdict based on the debate history",
            model=model
        )

    async def decide(self, debate_history: list, exploit: dict) -> dict:
        """
        Decides the final verdict based on the debate history.
        """
        self.log_step("judge_deciding", {"round_count": len(debate_history)})
        
        # Simulating verdict logic
        attacker_wins = True # For now...
        
        return {
            "verdict": "confirmed" if attacker_wins else "rejected",
            "confidence": 0.82,
            "reasoning": "The attacker proved that the 'mutex' variable is only set at the end of the transaction in this specific contract version, which the defender failed to address properly.",
            "final_exploit": exploit
        }
