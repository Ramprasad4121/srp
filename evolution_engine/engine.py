import os
import json
import random
from evolution_engine.genome import AttackGenome
from evolution_engine.mutator import Mutator
from evolution_engine.crossover import Crossover
from evolution_engine.evaluator import Evaluator

class EvolutionEngine:
    def __init__(self, mcp=None, skill_store=None, history_dir="evolution_history"):
        from learning_engine.skill_store import SkillStore
        self.mcp = mcp
        self.skill_store = skill_store or SkillStore()
        self.mutator = Mutator()
        self.crossover = Crossover()
        self.evaluator = Evaluator()
        self.history_dir = history_dir
        self.seen_patterns = set() # For novelty tracking
        if not os.path.exists(self.history_dir):
            os.makedirs(self.history_dir, exist_ok=True)

    def _save_to_history(self, genome: AttackGenome):
        """Saves a genome to the history directory."""
        file_path = os.path.join(self.history_dir, f"{genome.genome_id}.json")
        with open(file_path, "w") as f:
            json.dump(genome.to_dict(), f, indent=4)

    def _calculate_similarity(self, genome_a: AttackGenome, genome_b: AttackGenome) -> float:
        """Calculates Jaccard similarity based on called functions."""
        funcs_a = genome_a.get_functions()
        funcs_b = genome_b.get_functions()
        if not funcs_a and not funcs_b:
            return 1.0
        intersection = len(funcs_a.intersection(funcs_b))
        union = len(funcs_a.union(funcs_b))
        return intersection / union if union > 0 else 0.0

    async def run(self, context: dict) -> list:
        """Standardized entry point for the orchestrator."""
        return await self.evolve_strategies(context, max_candidates=5)

    async def evolve_strategies(self, context: dict, max_candidates: int = 10, generations: int = 1) -> list:
        """
        Main evolutionary loop with Lineage tracking and Diversity Pressure.
        """
        print(f"[Evolution] Starting strategy evolution (max_candidates={max_candidates}, generations={generations})...")
        
        # Ensure self.mcp is available
        if not self.mcp:
            print("[Evolution] Warning: self.mcp is not set. Simulation will be restricted.")

        # 1. Load starting population
        matched_skills = context.get("matched_skills", [])
        if not matched_skills:
             matched_skills = self.skill_store.load_all_skills()
             
        if len(matched_skills) < 1:
            print("[Evolution] No base skills found for evolution.")
            return []
            
        population = [AttackGenome.from_dict({"strategy": s.get("type"), "steps": s.get("steps", [])}) for s in matched_skills]
        for p in population:
            p.generate_id()
            self._save_to_history(p)
            self.seen_patterns.add(frozenset(p.get_functions()))
        
        # 2. Multi-generational loop
        for gen in range(1, generations + 1):
            print(f"[Evolution] Starting Generation {gen}...")
            candidates = []
            
            # Forced Exploration Split: 70% Exploitation, 30% Exploration
            num_exploitation = int(max_candidates * 0.7)
            num_exploration = max_candidates - num_exploitation
            
            # exploitation (Crossover + Mutation of best)
            while len(candidates) < num_exploitation:
                if len(population) >= 2 and random.random() > 0.3:
                    # Crossover
                    parents = random.sample(population, 2)
                    candidate = self.crossover.evolve(parents[0], parents[1])
                else:
                    # Mutation
                    parent = random.choice(population)
                    candidate = self.mutator.mutate(parent)
                candidates.append(candidate)
                
            # exploration (Random seeds / high-entropy mutations)
            while len(candidates) < max_candidates:
                # Either take a random base skill or mutate an existing one multiple times
                base = AttackGenome.from_dict(random.choice(matched_skills))
                candidate = self.mutator.mutate(base)
                candidate.mutation_type = "exploration"
                candidates.append(candidate)
                
            # Evaluation
            print(f"[Evolution] Evaluating {len(candidates)} candidates for Gen {gen}...")
            for candidate in candidates:
                scorecard = await self.evaluator.evaluate(candidate, context, self.mcp)
                
                # Base Fitness
                profit = scorecard.get("profit", 0)
                confidence = scorecard.get("success_rate", 0.0)
                validated = scorecard.get("valid", False)
                
                fitness = profit * confidence if validated else 0
                
                # Novelty Boost
                pattern = frozenset(candidate.get_functions())
                if pattern and pattern not in self.seen_patterns:
                    print(f"[Evolution] Novel strategy pattern detected: {candidate.genome_id}! Boosting fitness.")
                    fitness += 1000 # Boost
                    self.seen_patterns.add(pattern)
                
                # Diversity Pressure (Penalize Clones)
                for existing in population:
                    if self._calculate_similarity(candidate, existing) > 0.8:
                        print(f"[Evolution] Clone detected: {candidate.genome_id} is too similar to {existing.genome_id}. Penalizing.")
                        fitness *= 0.5
                        break
                
                candidate.profit = profit # We store raw profit too
                candidate.validated = validated
                candidate.confidence = fitness # We use the 'confidence' field as the final fitness score for selection
                self._save_to_history(candidate)
            
            # Selection
            candidates.sort(key=lambda x: x.confidence, reverse=True)
            population = candidates[:max(2, len(candidates) // 2)]
            
            top = population[0]
            print(f"[Evolution] Top Gen {gen}: {top.genome_id} (fitness: {top.confidence})")

        # 3. Final Selection
        final_results = [p.to_dict() for p in population if p.profit > 0 or p.validated]
        
        print(f"[Evolution] Discovery complete! Found {len(final_results)} valid new strategies.")
        return final_results
