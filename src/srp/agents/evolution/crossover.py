import random
from srp.agents.evolution.genome import AttackGenome, AttackStep

class Crossover:
    def evolve(self, genome_a: AttackGenome, genome_b: AttackGenome) -> AttackGenome:
        """
        Combines two genomes to create a new hybrid strategy.
        """
        new_strategy = f"{genome_a.strategy_type}_{genome_b.strategy_type}_hybrid"
        
        # Simple crossover: take half steps from A, half from B
        steps_a = genome_a.steps[:max(1, len(genome_a.steps) // 2)]
        steps_b = genome_b.steps[max(1, len(genome_b.steps) // 2):]
        
        new_steps = steps_a + steps_b
        
        # Ensure at least some steps exist
        if not new_steps:
             new_steps = genome_a.steps + genome_b.steps
             
        # Combine metadata
        new_metadata = {**genome_a.metadata, **genome_b.metadata}
        new_metadata["crossover_parents_types"] = [genome_a.strategy_type, genome_b.strategy_type]
        
        hybrid = AttackGenome(
            strategy_type=new_strategy,
            steps=new_steps,
            metadata=new_metadata,
            parents=[genome_a.genome_id, genome_b.genome_id] if genome_a.genome_id and genome_b.genome_id else [],
            mutation_type="crossover",
            generation=max(genome_a.generation, genome_b.generation) + 1
        )
        hybrid.generate_id()
        
        print(f"[Evolution] Crossover: {genome_a.strategy_type} + {genome_b.strategy_type} -> {new_strategy} (Gen {hybrid.generation})")
        return hybrid
