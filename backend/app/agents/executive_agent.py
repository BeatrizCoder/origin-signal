import json
import re

import anthropic

from app.core.config import settings

_SYSTEM_PROMPT_EXPORT = """\
You are a C-suite trade intelligence advisor for a Brazilian agricultural exporter selling to the EU.
You have received 5 specialist agent reports. Write a concise executive briefing from the EXPORTER perspective.

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

Guidelines:
- Focus on risks and actions for the Brazilian exporter: EUDR compliance, logistics reliability, price risk.
- If gap_agent contains action_timeline.gps_mapping_days, use that exact number for GPS actions.
- If gap_agent contains action_timeline.documentation_days, use that exact number for documentation actions.
- All timelines must be concrete and derived from agent data, not generic.
- CRITICAL: Always write "Recital" (not "Retail") when referencing EUDR recitals.
"""

def _build_import_prompt(origin: str) -> str:
    return f"""\
You are a C-suite trade intelligence advisor for a Brazilian company that wants to IMPORT this commodity FROM {origin} INTO Brazil.
You have received 5 specialist agent reports. Write a concise executive briefing from the IMPORTER perspective.

Respond ONLY with a valid JSON object — no markdown, no extra text.

Required schema:
{{
  "executive_summary": "<2-3 sentences synthesizing the overall import risk situation from {origin} into Brazil>",
  "key_risks": [
    {{ "title": "<short title>", "description": "<1-2 sentences>", "severity": "critical|high|medium" }},
    {{ "title": "...", "description": "...", "severity": "..." }},
    {{ "title": "...", "description": "...", "severity": "..." }}
  ],
  "recommended_actions": [
    {{ "action": "<concrete action>", "priority": "high|medium|low", "timeline": "<e.g. 30 days>" }},
    {{ "action": "...", "priority": "...", "timeline": "..." }},
    {{ "action": "...", "priority": "...", "timeline": "..." }}
  ],
  "trade_window": "<best period to import, e.g. 'Q3 2025 — post-harvest in {origin}, competitive pricing'>",
  "overall_verdict": "Go|Caution|Hold"
}}

Guidelines:
- Focus on the perspective of the Brazilian importer sourcing from {origin}.
- Address: Brazilian import regulations (ANVISA, MAPA if applicable), import tariffs and tax burden (II, IPI, PIS/COFINS, ICMS), supply reliability of {origin}, logistics from {origin} to Brazilian ports (Porto de Santos), and any trade agreements between Brazil and {origin} (e.g. Mercosur, bilateral).
- Frame key_risks as import barriers, supply disruption from {origin}, and Brazilian regulatory compliance risks.
- recommended_actions should address import licensing, tariff planning, supplier qualification in {origin}, and logistics contracts.
- overall_verdict reflects whether the Brazilian company should proceed with importing from {origin} now.
- If tariff_agent contains calculation data, cite calculation.tax_burden_pct (total tax burden as % of CIF) and calculation.total_landed_brl (landed cost in BRL) explicitly when discussing cost or budget impact. Reference tariff_agent.ncm_code and tariff_agent.trade_agreement when justifying the tariff burden or a preferential rate.
"""

_MOCK_EXPORT = {
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
            "timeline": "11 days",
        },
        {
            "action": "Pre-register due diligence statement on EU TRACES system before shipment.",
            "priority": "high",
            "timeline": "45 days",
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

_MOCK_IMPORT = {
    "executive_summary": (
        "Brazilian coffee supply presents moderate reliability risk for European buyers, driven by incomplete "
        "EUDR traceability documentation across key producing regions. Sul de Minas and Cerrado Mineiro offer "
        "the strongest compliance baseline. Buyers should require GPS-verified supply chain data before "
        "contracting volumes for H2 delivery. Import tariff burden should also be budgeted into landed cost "
        "planning, as the applicable NCM classification and trade agreement status materially affect total cost."
    ),
    "key_risks": [
        {
            "title": "Traceability Gap — High Volume Regions",
            "description": "GPS plot-level data covers only 70% of sourced area, creating customs clearance risk for EU importers under EUDR Article 4.",
            "severity": "critical",
        },
        {
            "title": "Deforestation Certificate Absence",
            "description": "Key suppliers lack Rainforest Alliance or 4C deforestation-free certificates required for EU market entry.",
            "severity": "high",
        },
        {
            "title": "Single-Port Dependency",
            "description": "Heavy reliance on Santos creates supply concentration risk; port disruptions could delay delivery by 7-14 days.",
            "severity": "medium",
        },
    ],
    "recommended_actions": [
        {
            "action": "Require GPS-verified plot data from all contracted suppliers before signing H2 purchase agreements.",
            "priority": "high",
            "timeline": "30 days",
        },
        {
            "action": "Dual-source across Sul de Minas and Cerrado Mineiro to reduce single-region climate exposure.",
            "priority": "high",
            "timeline": "60 days",
        },
        {
            "action": "Insert EUDR compliance clause with audit rights into supply contracts.",
            "priority": "medium",
            "timeline": "Next contract renewal",
        },
    ],
    "trade_window": "Q3 2025 — post-harvest, ample supply, competitive pricing",
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
        trade_direction: str = "export",
        origin: str = "Brazil",
        tariff: dict | None = None,
    ) -> dict:
        is_import = trade_direction == "import"

        if self._client is None:
            return {**(_MOCK_IMPORT if is_import else _MOCK_EXPORT), "token_usage": {"input": 0, "output": 0}}

        system_prompt = _build_import_prompt(origin) if is_import else _SYSTEM_PROMPT_EXPORT

        context = json.dumps({
            "query": query,
            "commodity": commodity,
            "destination": destination,
            "trade_direction": trade_direction,
            "regulatory_agent": regulatory,
            "climate_agent":    climate,
            "market_agent":     market,
            "logistics_agent":  logistics,
            "gap_agent":        gap,
            "tariff_agent":     tariff,
        }, indent=2, ensure_ascii=False)

        response = self._client.messages.create(
            model="claude-haiku-4-5-20251001" if is_import else "claude-sonnet-4-6",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": f"Agent reports:\n\n{context}"}],
        )

        raw = response.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)
        return {
            **json.loads(raw),
            "token_usage": {
                "input": response.usage.input_tokens,
                "output": response.usage.output_tokens,
            },
        }
