"""Autonomous regulatory research agent.

Decides which sources to consult for a given trade route, gathers evidence
in parallel, and scores its relevance/confidence. This agent does NOT write
deterministic rules — it only returns structured evidence. The deterministic
layer (tariff_agent.py, regulatory_agent.py) decides how to use it.
"""

import asyncio
from datetime import datetime, timezone


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

    SOURCES = {
        'wto': 'https://tariffdata.wto.org',
        'camex': 'https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior',
        'eurlex_rss': 'https://eur-lex.europa.eu/rss-eur-lex.xml',
    }

    ACE_REDUCTIONS = {
        'Argentina': {'coffee': 100, 'soybeans': 100, 'fruits': 100},
        'Uruguay': {'coffee': 100, 'soybeans': 100, 'fruits': 100},
        'Paraguay': {'coffee': 100, 'soybeans': 100, 'fruits': 100},
        'Colombia': {'coffee': 50, 'soybeans': 45, 'fruits': 50},
        'Peru': {'coffee': 45, 'soybeans': 40, 'fruits': 45},
        'Chile': {'coffee': 95, 'soybeans': 90, 'fruits': 95},
    }

    WTO_CONTEXT = {
        'Vietnam': {
            'coffee': 'No FTA Brazil-Vietnam. Standard TEC 10% II. MARD phytosanitary certificate required. '
                      'Vietnam is world 2nd largest coffee producer (robusta dominant). Climate risk: Central '
                      'Highlands drought during El Niño.',
        },
        'Japan': {
            'coffee': 'Japan-Brazil EPA in force. Green coffee II = 0% under EPA (vs 3.5% MFN). MHLW pesticide '
                      'positive list applies — unlisted pesticides default 0.01ppm. No EUDR equivalent.',
        },
        'South Korea': {
            'coffee': 'No Korea-Mercosul FTA. Standard MFN rates: green coffee 2%, roasted 8%. MAFRA '
                      'phytosanitary inspection at Busan/Incheon. MFDS food declaration required.',
        },
        'Saudi Arabia': {
            'coffee': 'SFDA (Saudi Food and Drug Authority) import requirements. Halal certification '
                      'recommended. No FTA with Brazil. GCC unified customs territory.',
        },
        'UAE': {
            'coffee': 'ESMA and Dubai Municipality food standards. Part of GCC unified customs. No FTA with '
                      'Brazil. Major re-export hub for Middle East and Asia.',
        },
        'Ethiopia': {
            'coffee': 'ECA (Ethiopian Coffee and Tea Authority) export license required. ECX grading system. '
                      'Landlocked — exports via Djibouti. EUDR high-risk classification.',
        },
    }

    async def research(
        self,
        origin: str,
        destination: str,
        commodity: str,
        trade_direction: str,
    ) -> dict:
        sources_to_check = self._decide_sources(origin, destination, commodity)

        evidence_tasks = [
            self._fetch_source(source, origin, destination, commodity)
            for source in sources_to_check
        ]
        raw_evidence = await asyncio.gather(*evidence_tasks, return_exceptions=True)

        valid_evidence = [e for e in raw_evidence if isinstance(e, dict) and e.get('relevant')]
        evaluated = self._evaluate_evidence(valid_evidence, origin, destination, commodity)

        return {
            'origin': origin,
            'destination': destination,
            'commodity': commodity,
            'evidence': evaluated,
            'sources_checked': sources_to_check,
            'has_rag': origin in self.RAG_COUNTRIES or destination in self.RAG_COUNTRIES,
            'research_confidence': self._calculate_confidence(evaluated),
            'regulatory_context': self._build_context(evaluated, origin, destination, commodity),
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

    def _decide_sources(self, origin: str, destination: str, commodity: str) -> list:
        sources = []

        # Always check active regulatory alerts.
        sources.append('eurlex_rss')

        # Routes with known trade agreements.
        if origin in ['Argentina', 'Uruguay', 'Paraguay', 'Colombia', 'Peru', 'Chile']:
            sources.append('camex')  # Mercosul/ACE agreements

        # Routes without RAG coverage — fall back to WTO reference context.
        if origin not in self.RAG_COUNTRIES and destination not in self.RAG_COUNTRIES:
            sources.append('wto')

        return sources

    async def _fetch_source(self, source: str, origin: str, destination: str, commodity: str) -> dict:
        try:
            if source == 'eurlex_rss':
                return await self._fetch_eurlex(commodity, destination)
            elif source == 'camex':
                return await self._fetch_camex(origin, commodity)
            elif source == 'wto':
                return await self._fetch_wto_context(origin, destination, commodity)
            return {'relevant': False, 'error': f'unknown source {source}', 'source': source}
        except Exception as e:
            return {'relevant': False, 'error': str(e), 'source': source}

    async def _fetch_eurlex(self, commodity: str, destination: str) -> dict:
        from app.agents.alerts_agent import AlertsAgent

        alerts = AlertsAgent()
        result = await alerts.fetch_eurlex_alerts(commodity)
        return {
            'relevant': len(result) > 0,
            'source': 'EUR-Lex RSS',
            'type': 'regulatory_alerts',
            'data': result,
            'confidence': 0.90,
        }

    async def _fetch_camex(self, origin: str, commodity: str) -> dict:
        reduction = self.ACE_REDUCTIONS.get(origin, {}).get(commodity.lower(), 0)
        agreement = 'Mercosul' if origin in ['Argentina', 'Uruguay', 'Paraguay'] else 'ACE 59'
        return {
            'relevant': True,
            'source': 'CAMEX/MDIC',
            'type': 'trade_agreement',
            'data': {
                'agreement': agreement,
                'ii_reduction_pct': reduction,
                'origin': origin,
                'commodity': commodity,
                'effective': True,
            },
            'confidence': 0.95,
            'note': f'{agreement} preferential tariff — {reduction}% II reduction for {origin}',
        }

    async def _fetch_wto_context(self, origin: str, destination: str, commodity: str) -> dict:
        context = self.WTO_CONTEXT.get(origin, {}).get(commodity.lower(), '')
        return {
            'relevant': bool(context),
            'source': 'WTO/Trade Reference',
            'type': 'regulatory_context',
            'data': {'context': context, 'origin': origin, 'commodity': commodity},
            'confidence': 0.75,
            'note': f'Reference regulatory context for {origin} — not real-time',
        }

    def _evaluate_evidence(self, evidence: list, origin: str, destination: str, commodity: str) -> list:
        evaluated = []
        for e in evidence:
            e['relevance_score'] = self._score_relevance(e, origin, destination, commodity)
            if e['relevance_score'] > 0.5:
                evaluated.append(e)
        return sorted(evaluated, key=lambda x: x['relevance_score'], reverse=True)

    def _score_relevance(self, evidence: dict, origin: str, destination: str, commodity: str) -> float:
        score = evidence.get('confidence', 0.5)
        if evidence.get('type') == 'trade_agreement':
            score += 0.2
        if evidence.get('type') == 'regulatory_alerts':
            score += 0.1 if evidence.get('data') else -0.1
        return min(score, 1.0)

    def _calculate_confidence(self, evidence: list) -> float:
        if not evidence:
            return 0.5
        return round(sum(e.get('confidence', 0.5) for e in evidence) / len(evidence), 2)

    def _build_context(self, evidence: list, origin: str, destination: str, commodity: str) -> str:
        context_parts = []
        for e in evidence:
            if e.get('type') == 'trade_agreement':
                d = e['data']
                context_parts.append(
                    f"Trade agreement: {d['agreement']} provides {d['ii_reduction_pct']}% II reduction for {origin}."
                )
            elif e.get('type') == 'regulatory_context':
                context_parts.append(e['data'].get('context', ''))
            elif e.get('type') == 'regulatory_alerts' and e.get('data'):
                context_parts.append(f"Active regulatory alerts: {len(e['data'])} relevant alerts found.")
        return ' '.join(filter(None, context_parts))
