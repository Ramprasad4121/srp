import hashlib
from dataclasses import dataclass, field
from typing import List, Dict, Any

@dataclass
class AttackStep:
    target: str
    data: str
    value: int = 0
    contract_name: str = ""
    function_name: str = ""

@dataclass
class AttackGenome:
    strategy_type: str
    steps: List[AttackStep] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Lineage Fields
    genome_id: str = ""
    parents: List[str] = field(default_factory=list)
    mutation_type: str = "initial"
    generation: int = 0
    
    # Fitness Fields
    profit: int = 0
    validated: bool = False
    confidence: float = 0.0

    def get_functions(self) -> set:
        """Returns the set of unique functions called in this genome."""
        return {s.function_name for s in self.steps if s.function_name}

    def generate_id(self):
        """Generates a unique ID based on the steps and parents."""
        id_str = f"{self.strategy_type}:{self.generation}:{','.join(self.parents)}:"
        for s in self.steps:
            id_str += f"{s.target}{s.data}{s.value}"
        self.genome_id = hashlib.sha256(id_str.encode()).hexdigest()[:12]
        return self.genome_id

    def to_dict(self) -> dict:
        return {
            "id": self.genome_id,
            "strategy": self.strategy_type,
            "steps": [
                {
                    "target": s.target,
                    "data": s.data,
                    "value": s.value,
                    "contract_name": s.contract_name,
                    "function_name": s.function_name
                } for s in self.steps
            ],
            "metadata": self.metadata,
            "lineage": {
                "parents": self.parents,
                "mutation_type": self.mutation_type,
                "generation": self.generation
            },
            "fitness": {
                "profit": self.profit,
                "validated": self.validated,
                "confidence": self.confidence
            }
        }

    @staticmethod
    def from_dict(data: dict) -> 'AttackGenome':
        steps = [
            AttackStep(
                target=s.get("target", ""),
                data=s.get("data", "0x"),
                value=s.get("value", 0),
                contract_name=s.get("contract_name", ""),
                function_name=s.get("function_name", "")
            ) for s in data.get("steps", [])
        ]
        lineage = data.get("lineage", {})
        fitness = data.get("fitness", {})
        
        genome = AttackGenome(
            genome_id=data.get("id", ""),
            strategy_type=data.get("strategy", "unknown"),
            steps=steps,
            metadata=data.get("metadata", {}),
            parents=lineage.get("parents", []),
            mutation_type=lineage.get("mutation_type", "initial"),
            generation=lineage.get("generation", 0),
            profit=fitness.get("profit", 0),
            validated=fitness.get("validated", False),
            confidence=fitness.get("confidence", 0.0)
        )
        if not genome.genome_id:
            genome.generate_id()
        return genome
