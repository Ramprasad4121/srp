import re
import json

def clean_json_text(text: str) -> str:
    """Strip markdown, remove trailing commas, and normalize quotes for JSON parsing."""
    # 1. Strip markdown code blocks
    text = re.sub(r'```json\s*(.*?)\s*```', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'```\s*(.*?)\s*```', r'\1', text, flags=re.DOTALL)
    
    # 2. Remove trailing commas in objects and arrays
    text = re.sub(r',\s*([\]}])', r'\1', text)
    
    # 3. Basic cleanup for common LLM artifacts
    text = text.strip()
    
    # 4. Enforce double quotes on keys: 'key': -> "key":
    text = re.sub(r"'(.*?)'\s*:", r'"\1":', text)
    
    return text

def parse_llm_json(raw: str) -> dict:
    """Safely extracts and parses JSON from LLM output, stripping markdown fences and handling malformed JSON."""
    if not raw:
        return {}
        
    cleaned = clean_json_text(raw)
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try extracting first JSON object/array
        match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        if match:
            try:
                # Even the matching part might need extra cleaning
                sub_cleaned = clean_json_text(match.group(1))
                return json.loads(sub_cleaned)
            except Exception:
                pass
        return {}
