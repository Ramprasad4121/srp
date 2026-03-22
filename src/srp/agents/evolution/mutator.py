import random
from srp.agents.evolution.genome import AttackGenome, AttackStep

class Mutator:
    def mutate(self, genome: AttackGenome) -> AttackGenome:
        """
        Randomly applies one or more mutation operators to the genome.
        """
        mutated = AttackGenome.from_dict(genome.to_dict())
        mutated.parents = [genome.genome_id] if genome.genome_id else []
        mutated.generation = genome.generation + 1
        
        operators = {
            "reorder": self._reorder_steps,
            "tweak": self._tweak_calldata,
            "swap": self._swap_steps
        }
        
        # Apply 1 random mutation
        op_name = random.choice(list(operators.keys()))
        op_func = operators[op_name]
        
        mutated = op_func(mutated)
        mutated.mutation_type = op_name
        mutated.generate_id()
            
        print(f"[Evolution] Mutated: {genome.strategy_type} -> {mutated.strategy_type} ({op_name}, Gen {mutated.generation})")
        return mutated

    def _reorder_steps(self, genome: AttackGenome) -> AttackGenome:
        """
        Shuffles the order of steps in the genome.
        """
        if len(genome.steps) > 1:
            random.shuffle(genome.steps)
        return genome

    def _tweak_calldata(self, genome: AttackGenome) -> AttackGenome:
        """
        Tweaks the calldata (currently just appends 0s or changes a byte).
        """
        if genome.steps:
            step = random.choice(genome.steps)
            if len(step.data) > 10:
                # Tweak one byte of calldata
                idx = random.randint(10, len(step.data) - 1)
                step.data = step.data[:idx] + hex(random.randint(0, 15))[2:] + step.data[idx+1:]
        return genome

    def _swap_steps(self, genome: AttackGenome) -> AttackGenome:
        """
        Swaps two random steps.
        """
        if len(genome.steps) > 1:
            i, j = random.sample(range(len(genome.steps)), 2)
            genome.steps[i], genome.steps[j] = genome.steps[j], genome.steps[i]
        return genome
