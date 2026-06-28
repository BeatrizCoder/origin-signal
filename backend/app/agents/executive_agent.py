import json
import re

import anthropic

from app.core.config import settings

_SYSTEM_PROMPT = """\
You are a C-suite trade intelligence advisor for Brazilian agricultural exports to the EU.
You have received 5 specialist agent reports. Write a concise executive briefing.

Respond ONLY with a valid JSON object — no markdown, no extra text.

Required schema:
{
  "executive_summary": "<2-3 sentences synthesizing the overall trade risk situation>",
  "key_risks": [
    { "title": "<short title>", "description": "<1-2 sentences>", "severity": "critical|high|medium" },
    { "title": "...", "description": "...", "severity": "..." },
    { "title": "...", "description": "...", "severity": "..." }
  ],
  "recommended_actions": [
    { "action": "<concrete action>", "priority": "high|medium|low", "timeline": "<e.g. 30 days>" },
    { "action": "...", "priority": "...", "timeline": "..." },
    { "action": "...", "priority": "...", "timeline": "..." }
  ],
  "trade_window": "<best period to export, e.g. 'Q3 2025 — post-harvest, stable freight rates'>",
  "overall_verdict": "Go|Caution|Hold"
}

Guidelines for recommended_actions timelines:
- If gap_agent contains action_timeline.gps_mapping_days, use that exact number of days for GPS-related actions.
- If gap_agent contains action_timeline.documentation_days, use that exact number for documentation actions.
- These are calculated from actual coverage gaps — cite them specifically (e.g. "11 days of drone mapping required").
- All timelines must be concrete and derived from the agent data, not generic.
"""

_MOCK = {
    "executive_summary": (
        "Coffee exports from Brazil to the EU face moderate regulatory and compliance risk driven primarily "
        "by EUDR documentation gaps. Climate conditions are within acceptable range; market fundamentals "
        "remain supportive with upward price trends. Immediate action on GPS coverage and deforestation "
        "documentation is required before shipment."
    ),
    "key_risks": [
        {
            "title": "EUDR Documentation Gap",
            "description": "GPS coverage at 70% and missing deforestation certificates create material compliance risk under EUDR Article 3 and Annex I.",
            "severity": "critical",
        },
        {
            "title": "Regulatory Classification Uncertainty",
            "description": "Brazil's Cerrado region risk classification under EUDR Article 36 is pending EU Commission review, creating timeline uncertainty.",
            "severity": "high",
        },
        {
            "title": "Port Congestion — Hamburg",
            "description": "Hamburg DHL Index of 62/100 indicates moderate congestion that may extend transit by 3-5 days.",
            "severity": "medium",
        },
    ],
    "recommended_actions": [
        {
            "action": "Initiate GPS plot mapping and deforestation certification immediately.",
            "priority": "high",
            "timeline": "30 days",
        },
        {
            "action": "Pre-register due diligence statement on EU TRACES system before shipment.",
            "priority": "high",
            "timeline": "60 days",
        },
        {
            "action": "Evaluate Rotterdam as alternative destination port to reduce logistics risk.",
            "priority": "medium",
            "timeline": "Next shipment cycle",
        },
    ],
    "trade_window": "Q3 2025 — post-harvest window with stable freight rates",
    "overall_verdict": "Caution",
}


class ExecutiveAgent:
    def __init__(self):
        self._client = (
            anthropic.Anthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    async def synthesize(
        self,
        regulatory: dict,
        climate: dict,
        market: dict,
        logistics: dict,
        gap: dict,
        query: str,
        commodity: str,
        destination: str,
    ) -> dict:
        if self._client is None:
            return _MOCK.copy()

        context = json.dumps({
            "query": query,
            "commodity": commodity,
            "destination": destination,
            "regulatory_agent": regulatory,
            "climate_agent":    climate,
            "market_agent":     market,
            "logistics_agent":  logistics,
            "gap_agent":        gap,
        }, indent=2, ensure_ascii=False)

        response = self._client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Agent reports:\n\n{context}"}],
        )

        raw = response.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
