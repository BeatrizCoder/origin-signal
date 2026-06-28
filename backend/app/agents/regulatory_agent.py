import json
import re
from pathlib import Path

import anthropic

from app.core.config import settings
from app.rag.vector_store import EUDRVectorStore

CHROMA_DIR = str(Path(__file__).parents[3] / "backend" / "data" / "chroma_db")

_SYSTEM_PROMPT_EXPORT = """\
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
- CRITICAL: Always write "Recital" (not "Retail") when referencing EUDR recitals (e.g. "Recital 49", "Recital 12")
- Non-EU destinations (Norway, Switzerland, United Kingdom): EUDR 2023/1115 does not apply directly. However, mention equivalent bilateral agreements or national legislation in findings (e.g. Norway via EEA agreement, Switzerland bilateral MRA, UK via UKDR equivalent under development). Adjust risk_score downward by 10-15 points vs. equivalent EU destination, but note the bilateral compliance requirements.
- For soybeans: EUDR applies fully. Key requirements include deforestation-free certification, geolocation of production areas, and due diligence statements. Brazil's Cerrado and Amazon biomes are high-scrutiny areas under Article 36.
"""

_SYSTEM_PROMPT_IMPORT = """\
You are a Brazilian import compliance expert. Analyze import requirements for bringing the commodity FROM the origin country INTO Brazil.

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
- risk_score MUST be an integer strictly between 0 and 100.
- risk_score 0-25 → Low, 26-50 → Medium, 51-75 → High, 76-100 → Critical
- findings: 2-4 specific observations on Brazilian import requirements
- articles_cited: cite specific Brazilian regulations (e.g. "IN MAPA 36/2020", "RDC ANVISA 204/2017", "Lei 8.078/90") when referenced
- recommendations: 2-4 actionable steps for the Brazilian importer
- Focus on: ANVISA/MAPA requirements for the commodity, LI/DI process in SISCOMEX, NCM classification and applicable taxes (II, IPI, PIS/COFINS, ICMS), trade agreements between Brazil and the origin country, and phytosanitary/sanitary requirements.
- Mention the total estimated tax burden (II + IPI + PIS/COFINS + ICMS) for the commodity.
- If a trade agreement exists (Mercosul, ACE under ALADI), note the preferential tariff rate.
"""


class RegulatoryAgent:
    def __init__(self):
        self._store = EUDRVectorStore(persist_directory=CHROMA_DIR)
        self._client = (
            anthropic.Anthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    def analyze(self, query: str, commodity: str, origin: str, destination: str, trade_direction: str = "export") -> dict:
        is_import = trade_direction == "import"
        system_prompt = _SYSTEM_PROMPT_IMPORT if is_import else _SYSTEM_PROMPT_EXPORT

        search_query = (
            f"Brazil import {commodity} from {origin} ANVISA MAPA tariff NCM"
            if is_import
            else query
        )
        chunks = self._store.search(search_query, n_results=5)

        if self._client is None:
            return self._mock_response(query, commodity, origin, destination)

        context_blocks = "\n\n---\n\n".join(
            f"[{c['chunk_type'].upper()} {c['article_number']}] (source: {c['source']})\n{c['text']}"
            for c in chunks
        )

        if is_import:
            if origin in ("United States", "USA"):
                origin_context = (
                    "Focus on: USDA APHIS phytosanitary certificates, FDA FSMA compliance, "
                    "FSMA Prior Notice requirements (8h before sea arrival), no FTA with Brazil "
                    "(standard WTO rates apply), anti-dumping risk assessment, USD/BRL exchange rate risk."
                )
            elif origin == "China":
                origin_context = (
                    "Focus on: GACC registration and CIQ inspection certificates, higher Brazilian "
                    "customs scrutiny for Chinese goods (canal vermelho risk), anti-dumping duties risk "
                    "(check CAMEX resolutions), ANVISA registration for processed foods, "
                    "geopolitical supply chain risk, port congestion in Shanghai/Qingdao."
                )
            elif origin in ("European Union", "Germany", "Netherlands", "France"):
                origin_context = (
                    "Focus on: EU phytosanitary standards (among highest in world — generally satisfy MAPA), "
                    "Mercosul-EU agreement status (under ratification — may reduce tariffs when in force), "
                    "MAPA/ANVISA entry requirements, generally lower risk origin with established trade flows."
                )
            elif origin in ("Argentina", "Colombia", "Peru", "Chile"):
                origin_context = (
                    "Focus on: Mercosul/trade agreement benefits — Argentina is Mercosul member (zero/reduced II), "
                    "Colombia/Peru/Chile under ACE ALADI agreements (preferential tariffs), "
                    "MAPA phytosanitary requirements still apply, shorter transit times reduce logistics risk, "
                    "currency considerations (ARS/BRL, COP/BRL volatility)."
                )
            else:
                origin_context = (
                    "Analyze general Brazilian import requirements including ANVISA/MAPA compliance, "
                    "SISCOMEX process, LI/DI documentation, NCM classification, and applicable trade agreements."
                )

            user_message = (
                f"Commodity: {commodity}\n"
                f"Origin country (where Brazil imports FROM): {origin}\n"
                f"Destination: Brazil\n"
                f"Origin-specific context: {origin_context}\n"
                f"Import compliance query: {query}\n\n"
                f"Relevant regulatory context:\n\n{context_blocks}"
            )
        else:
            user_message = (
                f"Commodity: {commodity}\n"
                f"Export destination: {destination}\n"
                f"Compliance query: {query}\n\n"
                f"Relevant EUDR regulatory context:\n\n{context_blocks}"
            )

        response = self._client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=system_prompt,
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
