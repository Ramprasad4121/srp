from srp.agents.debate.attacker_agent import AttackerAgent
from srp.agents.debate.defender_agent import DefenderAgent
from srp.agents.debate.judge_agent import JudgeAgent

class DebateEngine:
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct"):
        self.attacker = AttackerAgent(model=model)
        self.defender = DefenderAgent(model=model)
        self.judge = JudgeAgent(model=model)

    async def run_debate(self, context: dict, exploit: dict, rounds: int = 2) -> dict:
        """
        Orchestrates a debate between Attacker and Defender.
        """
        print(f"[Debate] Starting debate for exploit: {exploit.get('strategy')}...")
        debate_history = []
        
        # Round 1: Attacker presents, Defender counters
        print(f"[Debate] Round 1: Opening Arguments")
        attacker_args = await self.attacker.run(context, exploit)
        defender_args = await self.defender.run(context, exploit, attacker_args["argument"])
        
        debate_history.append({"round": 1, "attacker": attacker_args, "defender": defender_args})
        
        # Subsequent Rounds: Refinement and counter-refinement
        for r in range(2, rounds + 1):
            print(f"[Debate] Round {r}: Refinement")
            attacker_refine = await self.attacker.refine(defender_args["argument"], context, exploit)
            defender_counter = await self.defender.counter(attacker_refine["argument"], context, exploit)
            
            debate_history.append({"round": r, "attacker": attacker_refine, "defender": defender_counter})
            
            # Use results for next round
            attacker_args = attacker_refine
            defender_args = defender_counter
            
        # Final Verdict from Judge
        print(f"[Debate] Final Verdict Phase")
        verdict = await self.judge.decide(debate_history, exploit)
        
        print(f"[Debate] Verdict: {verdict.get('verdict').upper()} ({verdict.get('confidence')})")
        return verdict
