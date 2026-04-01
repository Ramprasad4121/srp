import os
import re

def migrate():
    dir_path = "/Users/ramprasadgoud/Downloads/building/srp/src/srp/agents/souls/"
    files = [f for f in os.listdir(dir_path) if f.endswith(".md")]
    
    for filename in files:
        filepath = os.path.join(dir_path, filename)
        with open(filepath, "r") as f:
            content = f.read()
        
        name = ""
        philosophy = ""
        methodology = ""
        guardrails = []
        
        # Standard Soul File
        if "## WHO YOU ARE" in content:
            # Extract name
            match = re.search(r"Codename:\s*(.*)", content)
            if match:
                name = match.group(1).strip()
            else:
                match = re.search(r"#\s*(.*?)\s*[—\-]", content)
                if match:
                    name = match.group(1).strip()
                else:
                    name = filename.replace(".md", "")
            
            # Extract Philosophy
            who_you_are = extract_section(content, "## WHO YOU ARE")
            your_philosophy = extract_section(content, "## YOUR PHILOSOPHY")
            philosophy = (who_you_are + "\n\n" + your_philosophy).strip()
            
            # Extract Methodology
            hunting_ground = extract_section(content, "## YOUR HUNTING GROUND")
            your_methodology = extract_section(content, "## YOUR METHODOLOGY")
            output_discipline = extract_section(content, "## OUTPUT DISCIPLINE")
            methodology = (hunting_ground + "\n\n" + your_methodology + "\n\n" + output_discipline).strip()
            
            # Extract Guardrails
            standards = extract_section(content, "## YOUR STANDARDS")
            # Split by lines starting with - or bullet points
            guardrails = parse_list(standards)
            
        elif "Linus Torvalds Persona" in content or "name: linus-torvalds" in content:
            name = "linus-torvalds"
            philosophy = extract_section(content, "## Core Philosophy").strip()
            methodology = (
                extract_section(content, "## Pre-Analysis") + "\n\n" +
                extract_section(content, "## Five-Layer Problem Decomposition") + "\n\n" +
                extract_section(content, "## Output Formats")
            ).strip()
            guardrails = parse_list(extract_section(content, "## Communication Rules"))
            
        else:
            # Fallback for others (ATTACK_PHILOSOPHY.md, AUDIT_METHODOLOGY.md)
            match = re.search(r"#\s*(.*)", content)
            name = match.group(1).strip() if match else filename.replace(".md", "")
            philosophy = content.strip()
            methodology = "See philosophy."
            guardrails = ["Follow the philosophy."]
            
        # Format as YAML
        yaml_content = format_yaml(name, philosophy, methodology, guardrails)
        
        yaml_filename = filename.replace(".md", ".yaml")
        yaml_filepath = os.path.join(dir_path, yaml_filename)
        
        with open(yaml_filepath, "w") as f:
            f.write(yaml_content)
        
        os.remove(filepath)
        print(f"Migrated {filename} to {yaml_filename}")

def extract_section(content, section_name):
    pattern = rf"{re.escape(section_name)}(.*?)(?=^## |$)"
    match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""

def parse_list(text):
    # Try to find list items starting with - or *
    items = re.findall(r"^\s*[-*]\s*(.*)", text, re.MULTILINE)
    if not items:
        # If no list items, split by sentences or paragraphs
        items = [line.strip() for line in text.split("\n") if line.strip()]
    return items

def format_yaml(name, philosophy, methodology, guardrails):
    # Manual YAML formatting to avoid dependencies
    def escape_multiline(text):
        if not text: return ""
        lines = text.split("\n")
        indented = "\n  ".join(lines)
        return "| \n  " + indented
    
    yaml_lines = [f"name: {name}"]
    yaml_lines.append(f"philosophy: {escape_multiline(philosophy)}")
    yaml_lines.append(f"methodology: {escape_multiline(methodology)}")
    yaml_lines.append("guardrails:")
    for g in guardrails:
        # Simple escaping for yaml list items if they have quotes
        g_safe = g.replace('"', '\\"')
        yaml_lines.append(f'  - "{g_safe}"')
    
    return "\n".join(yaml_lines) + "\n"

if __name__ == "__main__":
    migrate()
