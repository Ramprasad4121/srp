import os
import json
import hashlib

class SkillStore:
    def __init__(self, skills_dir="skills"):
        self.skills_dir = skills_dir
        if not os.path.exists(self.skills_dir):
            os.makedirs(self.skills_dir, exist_ok=True)

    def save_skill(self, skill_data: dict) -> str:
        """
        Saves a skill to a JSON file. Returns the skill ID/filename.
        """
        # Generate ID based on deterministic fields (type + functions)
        pattern = skill_data.get("pattern", {})
        funcs = sorted(pattern.get("functions", []))
        id_str = f"{skill_data.get('type')}:{','.join(funcs)}"
        skill_id = hashlib.sha256(id_str.encode()).hexdigest()[:12]
        
        skill_data["id"] = skill_id
        file_path = os.path.join(self.skills_dir, f"{skill_data.get('type')}_{skill_id}.json")
        
        with open(file_path, "w") as f:
            json.dump(skill_data, f, indent=4)
        
        return skill_id

    def load_all_skills(self) -> list:
        """
        Loads all skills from the skills directory.
        """
        skills = []
        if not os.path.exists(self.skills_dir):
            return []
            
        for filename in os.listdir(self.skills_dir):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(self.skills_dir, filename), "r") as f:
                        skills.append(json.load(f))
                except Exception as e:
                    print(f"[Learning] Error loading skill {filename}: {e}")
        return skills

    def update_skill_stats(self, skill_id: str, success: bool) -> float:
        """
        Updates the success rate of a skill.
        On success: +0.1, On failure: -0.05. Clamped [0, 1].
        """
        for filename in os.listdir(self.skills_dir):
            if f"_{skill_id}.json" in filename:
                file_path = os.path.join(self.skills_dir, filename)
                with open(file_path, "r") as f:
                    skill_data = json.load(f)
                
                old_rate = skill_data.get("success_rate", 1.0)
                if success:
                    new_rate = min(1.0, old_rate + 0.1)
                else:
                    new_rate = max(0.0, old_rate - 0.05)
                
                skill_data["success_rate"] = new_rate
                with open(file_path, "w") as f:
                    json.dump(skill_data, f, indent=4)
                
                print(f"[Learning] Skill updated: {skill_data.get('type')}_{skill_id} ({old_rate:.2f} \u2192 {new_rate:.2f})")
                return new_rate
        return 0.0

    def apply_decay(self, decay_rate=0.01):
        """
        Maintains the skill store by decaying success rates of all skills.
        """
        if not os.path.exists(self.skills_dir):
            return
            
        for filename in os.listdir(self.skills_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(self.skills_dir, filename)
                with open(file_path, "r") as f:
                    skill_data = json.load(f)
                
                old_rate = skill_data.get("success_rate", 1.0)
                new_rate = max(0.0, old_rate - decay_rate)
                
                skill_data["success_rate"] = new_rate
                with open(file_path, "w") as f:
                    json.dump(skill_data, f, indent=4)
        print(f"[Learning] Decay applied to all skills (-{decay_rate})")
