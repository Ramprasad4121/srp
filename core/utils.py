import re
import json

def parse_llm_json(raw: str) -> dict:
    """Safely extracts and parses JSON from LLM output, stripping markdown fences."""
    # Strip ```json ... ``` or ``` ... ``` fences
    cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
    cleaned = re.sub(r'\s*```$', '', cleaned.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try extracting first JSON object/array
        match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return {}
