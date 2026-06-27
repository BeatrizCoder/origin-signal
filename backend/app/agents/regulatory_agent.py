import json
import re
from pathlib import Path

import anthropic

from app.core.config import settings
from app.rag.vector_store import EUDRVectorStore

CHROMA_DIR = str(Path(__file__).parents[3] / "backend" / "data" / "chroma_db")

_SYSTEM_PROMPT = """\
You are a regulatory compliance expert specialized in EU Deforestation Regulation (EUDR 2023/1115).
Analyze the provided regulatory context and answer the user's compliance query.

Respond ONLY with a valid JSON object — no markdown, no explanation, no extra text.

Required JSON schema:
{
  "risk_score": <integer 0-100>,
  "risk_level": "<Low|Medium|High|Critical>",
  "findings": ["<string>", ...],
  "articles_cited": ["<string>", ...],
  "recommendations": ["<string>", ...]
}

Guidelines:
- risk_score MUST be an integer strictly between 0 and 100. Never return values like 7200, 6800, or any number outside 0-100.
- risk_score 0-25 → Low, 26-50 → Medium, 51-75 → High, 76-100 → Critical
- findings: 2-4 specific observations grounded in the provided context
- articles_cited: cite exact article numbers from the EUDR text when referenced
- recommendations: 2-4 actionable steps for compliance
"""


class RegulatoryAgent:
    def __init__(self):
        self._store = EUDRVectorStore(persist_directory=CHROMA_DIR)
        self._client = (
            anthropic.Anthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    def analyze(self, query: str, commodity: str, origin: str, destination: str) -> dict:
        chunks = self._store.search(query, n_results=5)

        if self._client is None:
            return self._mock_response(query, commodity, origin, destination)

        context_blocks = "\n\n---\n\n".join(
            f"[{c['chunk_type'].upper()} {c['article_number']}] (source: {c['source']})\n{c['text']}"
            for c in chunks
        )

        user_message = (
            f"Commodity: {commodity}\n"
            f"Export destination: {destination}\n"
            f"Compliance query: {query}\n\n"
            f"Relevant EUDR regulatory context:\n\n{context_blocks}"
        )

        response = self._client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = response.content[0].text
        # strip markdown code fences if the model wraps JSON in ```json...```
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        parsed["risk_score"] = max(0, min(100, int(parsed.get("risk_score", 50))))

        return {
            **parsed,
            "query": query,
            "commodity": commodity,
            "origin": origin,
            "destination": destination,
        }

    def _mock_response(self, query: str, commodity: str, origin: str, destination: str) -> dict:
        return {
            "risk_score": 42,
            "risk_level": "Medium",
            "findings": [
                f"EU Regulation 2023/1115 may apply to {commodity} imports from {origin}.",
                f"Deforestation-free supply chain documentation required for {destination} customs.",
                "Phytosanitary certificate compliance flagged for review.",
            ],
            "articles_cited": [
                "EU Reg. 2023/1115 Art. 3",
                "EU Reg. 2023/1115 Art. 10",
            ],
            "recommendations": [
                "Obtain EUDR due-diligence statement before shipment.",
                "Verify geolocation data for farm-level traceability.",
                "Cross-check with USDA FAS export data for consistency.",
            ],
            "query": query,
            "commodity": commodity,
            "origin": origin,
            "destination": destination,
        }
