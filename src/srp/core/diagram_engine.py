from __future__ import annotations
from typing import Dict, List, Any
import json

class DiagramEngine:
    """Generates JSON data for animated D3.js protocol visualizations."""
    
    def __init__(self, srg: Any):
        self.srg = srg

    def generate_system_map(self) -> Dict[str, Any]:
        """Maps contracts and their relationships for the System Map diagram."""
        nodes = []
        links = []
        
        for node in self.srg.nodes:
            nodes.append({
                "id": node.id,
                "type": node.type,
                "name": node.name
            })
            
        for edge in self.srg.edges:
            links.append({
                "source": edge.source,
                "target": edge.target,
                "type": edge.type
            })
            
        return {"nodes": nodes, "links": links}

    def generate_value_flow(self, protocol_type: str) -> Dict[str, Any]:
        """Generates animation data for money/token movement."""
        # Simulated logic based on protocol type
        flows = []
        if protocol_type.lower() == "lending":
            flows = [
                {"from": "User", "to": "Vault", "asset": "Token", "action": "Deposit"},
                {"from": "Vault", "to": "User", "asset": "DebtToken", "action": "Mint"},
                {"from": "Oracle", "to": "Vault", "asset": "Price", "action": "Update"}
            ]
        elif protocol_type.lower() == "amm":
            flows = [
                {"from": "User", "to": "Pool", "asset": "TokenA", "action": "Swap"},
                {"from": "Pool", "to": "User", "asset": "TokenB", "action": "Return"}
            ]
        return {"protocol": protocol_type, "flows": flows}

    def generate_trust_boundaries(self) -> List[Dict[str, Any]]:
        """Identifies external call trust boundaries."""
        boundaries = []
        for edge in self.srg.edges:
            if edge.type == "external_call":
                boundaries.append({
                    "contract": edge.source,
                    "external": edge.target,
                    "risk": "High" if "oracle" in edge.target.lower() else "Medium"
                })
        return boundaries
