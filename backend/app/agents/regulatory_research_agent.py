"""Autonomous regulatory research agent.

Uses real Anthropic tool use (function calling): the LLM is given a set of
research tools, decides autonomously which to call and in what order, and
iterates until it has enough evidence. Tool execution is fully deterministic
(structured knowledge lookups, plus the existing EUR-Lex fetch) — this agent
does NOT write deterministic rules, it only returns structured evidence. The
deterministic layer (tariff_agent.py, regulatory_agent.py) decides how to
use it.
"""

from datetime import datetime, timezone

import anthropic

from app.core.config import settings

MODEL = "claude-haiku-4-5-20251001"

TOOLS = [
    {
        "name": "search_wto",
        "description": "Search WTO tariff database and trade agreements for a specific country, commodity and trade direction. Use this to find preferential tariff rates, MFN rates, and trade agreement coverage.",
        "input_schema": {
            "type": "object",
            "properties": {
                "origin": {"type": "string", "description": "Country of origin"},
                "destination": {"type": "string", "description": "Destination country"},
                "commodity": {"type": "string", "description": "Commodity type (coffee, soybeans, fruits)"},
                "query": {"type": "string", "description": "Specific question about tariffs or trade agreements"}
            },
            "required": ["origin", "destination", "commodity"]
        }
    },
    {
        "name": "search_trade_agreement",
        "description": "Search for bilateral or multilateral trade agreements between countries. Use this to find Mercosul, ACE, FTA coverage and preferential treatment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "country_a": {"type": "string"},
                "country_b": {"type": "string"},
                "commodity": {"type": "string"},
                "query": {"type": "string", "description": "Specific question about the agreement"}
            },
            "required": ["country_a", "country_b"]
        }
    },
    {
        "name": "search_sanitary_requirements",
        "description": "Search for phytosanitary and food safety requirements for importing/exporting agricultural commodities between countries.",
        "input_schema": {
            "type": "object",
            "properties": {
                "origin": {"type": "string"},
                "destination": {"type": "string"},
                "commodity": {"type": "string"},
                "query": {"type": "string"}
            },
            "required": ["origin", "destination", "commodity"]
        }
    },
    {
        "name": "search_customs_authority",
        "description": "Search for customs authority requirements, documentation, and procedures for a specific trade route.",
        "input_schema": {
            "type": "object",
            "properties": {
                "country": {"type": "string", "description": "Country whose customs authority to search"},
                "commodity": {"type": "string"},
                "trade_direction": {"type": "string", "description": "import or export"},
                "query": {"type": "string"}
            },
            "required": ["country", "commodity"]
        }
    },
    {
        "name": "search_eurlex_alerts",
        "description": "Search EUR-Lex for active EU regulatory alerts and recalls relevant to a commodity (deforestation regulation updates, food safety recalls). Use this when the destination is in or trades with the EU.",
        "input_schema": {
            "type": "object",
            "properties": {
                "commodity": {"type": "string"},
                "query": {"type": "string"}
            },
            "required": ["commodity"]
        }
    },
]


class RegulatoryResearchAgent:

    # Countries that already have a RAG knowledge base — research only complements it.
    RAG_COUNTRIES = [
        'European Union', 'Germany', 'Netherlands', 'France',
        'Norway', 'Switzerland', 'United Kingdom',
        'United States', 'China',
    ]

    # Countries that depend on autonomous research for regulatory context.
    RESEARCH_COUNTRIES = [
        'Vietnam', 'Japan', 'South Korea', 'Saudi Arabia',
        'UAE', 'Mexico', 'Ethiopia', 'Colombia', 'Peru',
        'Chile', 'Argentina', 'Uruguay', 'Paraguay',
    ]

    def __init__(self):
        self._client = (
            anthropic.Anthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    async def research(
        self,
        origin: str,
        destination: str,
        commodity: str,
        trade_direction: str,
    ) -> dict:
        has_rag = origin in self.RAG_COUNTRIES or destination in self.RAG_COUNTRIES

        if self._client is None:
            return {
                'origin': origin,
                'destination': destination,
                'commodity': commodity,
                'evidence': [],
                'tool_calls': [],
                'tools_used': [],
                'iterations': 0,
                'has_rag': has_rag,
                'research_confidence': 0.5,
                'regulatory_context': '',
                'is_autonomous': False,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }

        system_prompt = f"""You are a specialized trade regulatory research agent.

Your task: Research regulatory requirements for this trade route and provide structured evidence.

Trade route: {origin} -> {destination}
Commodity: {commodity}
Direction: {trade_direction}

Use the available tools to research:
1. Tariff rates and trade agreements
2. Sanitary/phytosanitary requirements
3. Customs authority procedures
4. Active EU regulatory alerts (if the route touches the EU)

Research until you have enough information to assess regulatory risk.
Be thorough but efficient — use each tool only when it adds new information.

After research, summarize your findings as regulatory context for risk assessment."""

        messages = [{
            "role": "user",
            "content": f"Research regulatory requirements for {commodity} {trade_direction} route: {origin} -> {destination}",
        }]

        tool_calls_log = []
        evidence = []
        max_iterations = 5
        iteration = 0
        final_text = ''

        while iteration < max_iterations:
            iteration += 1

            response = self._client.messages.create(
                model=MODEL,
                max_tokens=1000,
                system=system_prompt,
                tools=TOOLS,
                messages=messages,
            )

            if response.stop_reason == 'end_turn':
                for block in response.content:
                    if hasattr(block, 'text'):
                        final_text = block.text
                break

            if response.stop_reason == 'tool_use':
                messages.append({"role": "assistant", "content": response.content})

                tool_results = []
                for block in response.content:
                    if block.type == 'tool_use':
                        result = await self._execute_tool(block.name, block.input)

                        tool_calls_log.append({
                            'tool': block.name,
                            'input': block.input,
                            'result_preview': result[:100] + '...' if len(result) > 100 else result,
                        })
                        evidence.append({
                            'source': block.name,
                            'type': block.name,
                            'data': result,
                            'relevant': True,
                            'confidence': 0.85,
                        })
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })

                messages.append({"role": "user", "content": tool_results})
            else:
                break

        research_confidence = min(0.95, 0.60 + (len(tool_calls_log) * 0.10))
        regulatory_context = final_text

        return {
            'origin': origin,
            'destination': destination,
            'commodity': commodity,
            'evidence': evidence,
            'tool_calls': tool_calls_log,
            'tools_used': list(dict.fromkeys(t['tool'] for t in tool_calls_log)),
            'iterations': iteration,
            'has_rag': has_rag,
            'research_confidence': research_confidence,
            'regulatory_context': regulatory_context,
            'is_autonomous': True,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        if tool_name == 'search_wto':
            return self._search_wto(**tool_input)
        elif tool_name == 'search_trade_agreement':
            return self._search_trade_agreement(**tool_input)
        elif tool_name == 'search_sanitary_requirements':
            return self._search_sanitary_requirements(**tool_input)
        elif tool_name == 'search_customs_authority':
            return self._search_customs_authority(**tool_input)
        elif tool_name == 'search_eurlex_alerts':
            return await self._search_eurlex_alerts(**tool_input)
        return "No data found for this query."

    def _search_wto(self, origin, destination, commodity, query='') -> str:
        TARIFF_DATA = {
            ('Argentina', 'Brazil', 'coffee'): "Mercosul member — II = 0% preferential rate under Mercosul agreement. No MFN tariff applies.",
            ('Colombia', 'Brazil', 'coffee'): "ACE 59 member — II = 50% reduction on standard TEC rate. Green coffee NCM 0901.11: TEC 10% → ACE 59 rate 5%.",
            ('Vietnam', 'Brazil', 'coffee'): "No FTA between Brazil and Vietnam. Standard TEC applies: NCM 0901.11.00 (green coffee) II = 10% MFN. No preferential treatment available.",
            ('China', 'Brazil', 'coffee'): "No FTA between Brazil and China. Standard TEC applies: II = 10% MFN. No preferential treatment. CAMEX anti-dumping investigation risk.",
            ('United States', 'Brazil', 'coffee'): "No FTA between Brazil and USA. Standard TEC: II = 10% MFN. No preferential rate.",
            ('Japan', 'Brazil', 'coffee'): "Japan-Brazil EPA in force — green coffee II = 0% under EPA (vs 3.5% MFN). Significant tariff advantage.",
            ('Ethiopia', 'Brazil', 'coffee'): "No FTA. Standard TEC: II = 10% MFN. Landlocked origin via Djibouti adds logistics complexity.",
        }
        key = (origin, destination, commodity.lower())
        result = TARIFF_DATA.get(key, f"No specific tariff data found for {origin}→{destination} {commodity}. Standard WTO MFN rates likely apply.")
        return f"WTO Tariff Search Result: {result}"

    def _search_trade_agreement(self, country_a, country_b, commodity='', query='') -> str:
        AGREEMENTS = {
            frozenset(['Argentina', 'Brazil']): "Mercosul (Treaty of Asunción, 1991) — full customs union. II = 0% for all agricultural products between members.",
            frozenset(['Colombia', 'Brazil']): "ACE 59 (2004) — preferential tariff for agricultural products. Coffee: 50% II reduction.",
            frozenset(['Peru', 'Brazil']): "ACE 58 (2003) — preferential tariff. Coffee: 45% II reduction.",
            frozenset(['Chile', 'Brazil']): "ACE 35 (1996) — preferential tariff. Coffee: 95% II reduction.",
            frozenset(['Japan', 'Brazil']): "Japan-Brazil EPA (signed 2019, in force) — green coffee II = 0% under EPA.",
        }
        key = frozenset([country_a, country_b])
        result = AGREEMENTS.get(key, f"No specific trade agreement found between {country_a} and {country_b}. WTO MFN rates apply.")
        return f"Trade Agreement Search: {result}"

    def _search_sanitary_requirements(self, origin, destination, commodity, query='') -> str:
        SANITARY = {
            ('Vietnam', 'Brazil', 'coffee'): "MAPA phytosanitary certificate required at Brazilian entry port. ANVISA food safety inspection. SISCOMEX DI filing with NCM 0901.11.00. Vietnamese MARD export certificate required at origin.",
            ('Ethiopia', 'Brazil', 'coffee'): "ECA (Ethiopian Coffee Authority) export license required. ECX grading certificate. MAPA phytosanitary at Brazilian port. High canal vermelho probability due to non-traditional origin.",
            ('China', 'Brazil', 'coffee'): "GACC export registration required for Chinese facilities. CIQ phytosanitary certificate. ANVISA registration for roasted coffee (NCM 0901.21) requires 8-week pre-shipment notice.",
            ('Colombia', 'Brazil', 'coffee'): "FNC (Federación Nacional de Cafeteros) quality certificate recommended. MAPA phytosanitary at Santos. Lower canal vermelho risk vs non-Mercosul origins.",
            ('Japan', 'Brazil', 'coffee'): "MHLW notification required 7 days before sea arrival. Pesticide positive list — unlisted pesticides default 0.01ppm. Radiation screening since 2011.",
        }
        key = (origin, destination, commodity.lower())
        result = SANITARY.get(key, "Standard phytosanitary certificate from origin country required. MAPA/ANVISA inspection at Brazilian port of entry. Consult SISCOMEX for specific NCM requirements.")
        return f"Sanitary Requirements: {result}"

    def _search_customs_authority(self, country, commodity, trade_direction='import', query='') -> str:
        CUSTOMS = {
            ('Brazil', 'coffee', 'import'): "Receita Federal via SISCOMEX. LI (Licença de Importação) required before shipment. DI (Declaração de Importação) at arrival. Canal verde/amarelo/vermelho/cinza classification. Despachante aduaneiro mandatory.",
            ('Germany', 'coffee', 'export'): "Hamburg Customs (Hauptzollamt Hamburg). EUDR compliance documentation required since Dec 2024. Deforestation-free certificate + GPS polygon data + due diligence statement required.",
            ('Japan', 'coffee', 'export'): "Japan Customs + MHLW quarantine station at port of entry. MHLW Prior Notice system mandatory. Quarantine inspection — aflatoxin and pesticide residue testing.",
            ('China', 'coffee', 'export'): "China Customs + GACC. GACC registration mandatory for all Brazilian exporters. CIQ inspection at Chinese port. Standard clearance 3-5 days.",
            ('United States', 'coffee', 'export'): "US CBP + FDA. FDA Prior Notice mandatory 8h before sea arrival. FDA facility registration required. FSMA FSVP compliance for US importer.",
        }
        key = (country, commodity.lower(), trade_direction)
        result = CUSTOMS.get(key, f"Standard customs procedures apply for {country}. Consult official customs authority website for current requirements.")
        return f"Customs Authority Requirements: {result}"

    async def _search_eurlex_alerts(self, commodity, query='') -> str:
        from app.agents.alerts_agent import AlertsAgent

        alerts = await AlertsAgent().fetch_eurlex_alerts(commodity)
        if not alerts:
            return f"No active EUR-Lex alerts found for {commodity}."
        lines = [
            f"[{a.get('severity', '')}] {a.get('title', '')} ({a.get('date', '')})"
            for a in alerts
        ]
        return "EUR-Lex Alerts: " + " | ".join(lines)
