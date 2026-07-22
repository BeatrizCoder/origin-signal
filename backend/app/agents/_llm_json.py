import json
import re


def parse_llm_json(raw: str) -> dict:
    """Parse a JSON object out of raw LLM text, tolerating markdown fences
    and leading/trailing prose the model sometimes adds despite instructions."""
    text = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)
