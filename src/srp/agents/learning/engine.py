import os
import json
from .skill_store import SkillStore

class LearningEngine:
    def __init__(self, skill_store=None):
        self.skill_store = skill_store or SkillStore()

    async def extract_and_save(self, strategy_result: dict, context: dict):
        """
        Extracts a skill pattern from a validated exploit and saves it.
        """
        # Only learn from successful exploits
        if strategy_result.get("status") != "success":
            return None
            
        srg = context.get("srg")
        srg_summary = context.get("srg_summary", {})
        
        # 1. Identify pattern
        pattern = {
            "functions": [],
            "state_dependencies": [],
            "call_sequence": []
        }
        
        # Extract from steps
        steps = strategy_result.get("steps", [])
        for step in steps:
            # Clean data prefix
            data = step.get("data", "0x")
            pattern["call_sequence"].append(data[:10] if len(data) >= 10 else data)

        # Extract from SRG (top functions in the project)
        if srg_summary:
            top_funcs = srg_summary.get("top_functions", [])
            pattern["functions"] = [f["name"] for f in top_funcs]

        skill_data = {
            "type": strategy_result.get("strategy"),
            "pattern": pattern,
            "exploit_steps": steps,
            "profit": strategy_result.get("profit"),
            "success_rate": 1.0,
            "project_name": os.path.basename(context.get("project_root", "unknown"))
        }
        
        skill_id = self.skill_store.save_skill(skill_data)
        print(f"[Learning] New skill stored: {skill_data.get('type')}_{skill_id}")
        return skill_id

    def match_skills(self, context: dict) -> list:
        """
        Matches stored skills against the current project's SRG.
        Sorts by score * success_rate.
        """
        srg_summary = context.get("srg_summary", {})
        if not srg_summary:
            return []
            
        current_funcs = set(f["name"].lower() for f in srg_summary.get("top_functions", []))
        all_skills = self.skill_store.load_all_skills()
        
        matched = []
        for skill in all_skills:
            skill_funcs = set(f.lower() for f in skill.get("pattern", {}).get("functions", []))
            
            if not skill_funcs:
                continue
                
            # Overlap scoring
            overlap = current_funcs.intersection(skill_funcs)
            overlap_score = len(overlap) / len(skill_funcs)
            
            success_rate = skill.get("success_rate", 1.0)
            final_score = overlap_score * success_rate
            
            if overlap_score >= 0.3: # Threshold on raw overlap
                matched.append({
                    "skill_id": skill.get("id"),
                    "type": skill.get("type"),
                    "score": overlap_score,
                    "success_rate": success_rate,
                    "final_score": final_score,
                    "steps": skill.get("exploit_steps")
                })
        
        # Sort by final_score (overlap * success)
        matched.sort(key=lambda x: x["final_score"], reverse=True)
        print(f"[Learning] Skills loaded: {len(all_skills)}")
        print(f"[Learning] Matched skills: {len(matched)}")
        return matched

    def update_stats(self, skill_id: str, success: bool):
        """
        Proxies stat updates to the skill store.
        """
        return self.skill_store.update_skill_stats(skill_id, success)

    def apply_decay(self, decay_rate=0.01):
        """
        Proxies decay to the skill store.
        """
        return self.skill_store.apply_decay(decay_rate)
