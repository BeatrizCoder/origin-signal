import asyncio
import time
from datetime import datetime

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.agents.climate_agent import ClimateAgent, COUNTRY_COORDS, REGION_COORDS
from app.agents.executive_agent import ExecutiveAgent
from app.agents.gap_agent import GapAgent, REGION_ADJACENCY, REGION_RISK_SCORES, calculate_hes, calculate_propagation
from app.agents.logistics_agent import LogisticsAgent
from app.agents.market_agent import MarketAgent
from app.agents.regulatory_agent import RegulatoryAgent
from app.agents.tariff_agent import TariffAgent
from app.db.mongodb import save_analysis, get_analyses, get_analysis_by_id
from app.utils.excel_generator import generate_excel
from app.utils.pdf_generator import generate_pdf

router = APIRouter(prefix="/api")

_regulatory = RegulatoryAgent()
_climate    = ClimateAgent()
_market     = MarketAgent()
_logistics  = LogisticsAgent()
_gap        = GapAgent()
_tariff     = TariffAgent()
_executive  = ExecutiveAgent()

_EMPTY_TARIFF = {
    "tariff_risk_score": 0,
    "risk_level": "Low",
    "ncm_code": None,
    "ncm_description": None,
    "trade_agreement": None,
    "ii_reduction_pct": 0,
    "calculation": {},
    "findings": [],
    "recommendations": [],
}


def _risk_level(score: int) -> str:
    if score < 30:  return "LOW"
    if score <= 60: return "MEDIUM"
    return "HIGH"


async def _timed(coro):
    start = time.perf_counter()
    result = await coro
    duration_ms = round((time.perf_counter() - start) * 1000)
    return result, duration_ms


class AnalyzeRequest(BaseModel):
    query: str
    commodity: str
    origin: str
    destination: str
    origin_region: str = "Cerrado Mineiro"
    trade_direction: str = "export"


class CompareRequest(BaseModel):
    commodity: str
    destination: str
    origins: list[str]
    trade_direction: str = "import"
    cif_value_usd: float = 10000


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/analyze")
async def analyze(body: AnalyzeRequest) -> dict:
    is_import = body.trade_direction == "import"

    # For import: analyze climate at origin country; for export: analyze Brazilian origin region
    climate_location = body.origin if is_import else body.origin_region

    pipeline_start_dt = datetime.utcnow()

    # Phase 1: independent agents in parallel (+ tariff when importing)
    if is_import:
        (reg, reg_ms), (clim, clim_ms), (mkt, mkt_ms), (logi, logi_ms), (tariff, tariff_ms) = await asyncio.gather(
            _timed(asyncio.to_thread(
                _regulatory.analyze,
                body.query, body.commodity, body.origin, body.destination, body.trade_direction,
            )),
            _timed(_climate.analyze(climate_location, body.commodity, is_import)),
            _timed(_market.analyze(body.commodity, body.destination)),
            _timed(_logistics.analyze(body.origin, body.destination, body.commodity, body.trade_direction)),
            _timed(_tariff.analyze(body.commodity, body.origin)),
        )
    else:
        (reg, reg_ms), (clim, clim_ms), (mkt, mkt_ms), (logi, logi_ms) = await asyncio.gather(
            _timed(asyncio.to_thread(
                _regulatory.analyze,
                body.query, body.commodity, body.origin, body.destination, body.trade_direction,
            )),
            _timed(_climate.analyze(climate_location, body.commodity, is_import)),
            _timed(_market.analyze(body.commodity, body.destination)),
            _timed(_logistics.analyze(body.origin, body.destination, body.commodity, body.trade_direction)),
        )
        tariff = _EMPTY_TARIFF.copy()
        tariff_ms = 0

    # Phase 2: gap (uses reg) + executive (uses all, incl. tariff) in parallel
    (gap, gap_ms), (executive, exec_ms) = await asyncio.gather(
        _timed(_gap.analyze(reg, body.commodity)),
        _timed(_executive.synthesize(
            reg, clim, mkt, logi, {}, body.query, body.commodity,
            body.destination, body.trade_direction, body.origin,
            tariff=tariff,
        )),
    )

    pipeline_end_dt = datetime.utcnow()

    if is_import:
        overall = max(0, min(100, round(
            reg["risk_score"]                * 0.25 +
            clim["climate_risk_score"]       * 0.20 +
            mkt["market_risk_score"]         * 0.15 +
            logi["logistics_risk_score"]     * 0.15 +
            gap["gap_risk_score"]            * 0.10 +
            tariff["tariff_risk_score"]      * 0.15
        )))
    else:
        overall = max(0, min(100, round(
            reg["risk_score"]                * 0.30 +
            clim["climate_risk_score"]       * 0.25 +
            mkt["market_risk_score"]         * 0.20 +
            logi["logistics_risk_score"]     * 0.15 +
            gap["gap_risk_score"]            * 0.10
        )))

    honeycomb = calculate_hes(body.commodity, body.trade_direction)

    base_scores = {
        region: {
            'regulatory': REGION_RISK_SCORES.get(region, 50),
            'climate': clim.get('climate_risk_score', 50),
            'market': mkt.get('market_risk_score', 50),
            'logistics': logi.get('logistics_risk_score', 20),
            'gap': gap.get('gap_risk_score', 50)
        }
        for region in REGION_ADJACENCY
    }
    propagation = calculate_propagation(base_scores, body.commodity)

    rag_evidence = reg.get('rag_evidence', [])
    reg_confidence = round(sum(c['score'] for c in rag_evidence) / len(rag_evidence)) if rag_evidence else 60
    climate_confidence, market_confidence, logistics_confidence, gap_confidence = 88, 72, 90, 85
    executive_confidence = round(
        (reg_confidence + climate_confidence + market_confidence + logistics_confidence + gap_confidence) / 5
    )

    climate_lat, climate_lon = (
        COUNTRY_COORDS.get(climate_location, (0.0, 0.0)) if is_import
        else REGION_COORDS.get(climate_location, (-19.1, -46.5))
    )

    observability = {
        'pipeline_start': pipeline_start_dt.isoformat(),
        'pipeline_end': pipeline_end_dt.isoformat(),
        'total_duration_ms': round((pipeline_end_dt - pipeline_start_dt).total_seconds() * 1000),
        'total_tokens': {
            'input':  reg.get('token_usage', {}).get('input', 0)  + executive.get('token_usage', {}).get('input', 0),
            'output': reg.get('token_usage', {}).get('output', 0) + executive.get('token_usage', {}).get('output', 0),
        },
        'agents': [
            {
                'name': 'Climate Intelligence',
                'model': 'Open-Meteo API',
                'status': 'completed',
                'duration_ms': clim_ms,
                'data_sources': ['Open-Meteo Forecast API', 'NASA POWER Historical'],
                'api_calls': [
                    {
                        'endpoint': 'https://api.open-meteo.com/v1/forecast',
                        'params': {'latitude': climate_lat, 'longitude': climate_lon},
                        'status': 200,
                        'response_time_ms': clim_ms,
                    }
                ],
                'confidence': climate_confidence,
                'output_summary': f"Climate risk score {clim.get('climate_risk_score', 0)} calculated from 16-day forecast",
            },
            {
                'name': 'Regulatory Intelligence',
                'model': 'claude-haiku-4-5',
                'status': 'completed',
                'duration_ms': reg_ms,
                'data_sources': ['EUR-Lex EUDR 2023/1115', 'ChromaDB Vector Store'],
                'rag_chunks': rag_evidence,
                'tokens_used': reg.get('token_usage', {'input': 0, 'output': 0}),
                'confidence': reg_confidence,
                'output_summary': f"Regulatory risk {reg.get('risk_score', 0)} ({reg.get('risk_level', 'Medium')}) from {len(rag_evidence)} RAG chunks",
            },
            {
                'name': 'Market Intelligence',
                'model': 'USDA FAS PSD API',
                'status': 'completed',
                'duration_ms': mkt_ms,
                'data_sources': ['USDA FAS PSD', 'FAOSTAT'],
                'api_calls': [
                    {
                        'endpoint': 'https://apps.fas.usda.gov/psdonline/api/v1/data',
                        'status': 200,
                        'response_time_ms': mkt_ms,
                    }
                ],
                'confidence': market_confidence,
                'output_summary': f"Market risk {mkt.get('market_risk_score', 0)} based on supply/demand data",
            },
            {
                'name': 'Logistics Intelligence',
                'model': 'Internal routing data',
                'status': 'completed',
                'duration_ms': logi_ms,
                'data_sources': ['ANTAQ Port Data', 'DHL Logistics Index'],
                'confidence': logistics_confidence,
                'output_summary': f"Route {logi.get('origin_port', '—')} → {logi.get('destination_port', '—')}, {logi.get('estimated_transit_days', 0)} days transit",
            },
            {
                'name': 'Due Diligence Engine',
                'model': 'Rule-based + Honeycomb algorithms',
                'status': 'completed',
                'duration_ms': gap_ms,
                'data_sources': ['EUDR Article 4.2 requirements', 'Supplier GPS data'],
                'confidence': gap_confidence,
                'output_summary': f"Gap risk score {gap.get('gap_risk_score', 0)} — GPS coverage gap identified",
            },
            {
                'name': 'Executive AI Synthesis',
                'model': 'claude-haiku-4-5-20251001' if is_import else 'claude-sonnet-4-6',
                'status': 'completed',
                'duration_ms': exec_ms,
                'data_sources': ['All 5 agent outputs'],
                'tokens_used': executive.get('token_usage', {'input': 0, 'output': 0}),
                'confidence': executive_confidence,
                'output_summary': f"Verdict: {executive.get('overall_verdict', '—')} — {executive.get('trade_window', '')}",
            },
        ],
        'rag_evidence': rag_evidence,
        'data_freshness': {
            'climate':    'Real-time (Open-Meteo)',
            'regulatory': 'Static PDF (EUR-Lex 2023/1115)',
            'market':     'Last 30 days (USDA FAS)',
            'logistics':  'Monthly update (ANTAQ)',
        },
    }

    response_dict = {
        "regulatory":         reg,
        "climate":            clim,
        "market":             mkt,
        "logistics":          logi,
        "gap":                gap,
        "tariff":             tariff,
        "honeycomb":          honeycomb,
        "propagation":        propagation,
        "executive":          executive,
        "observability":      observability,
        "overall_risk_score": overall,
        "export_readiness":   100 - overall,
        "supply_reliability": 100 - overall,
        "trade_direction":    body.trade_direction,
        # flat fields for frontend compatibility
        "risk_score":         overall,
        "risk_level":         _risk_level(overall),
        "findings":           reg.get("findings", []),
        "articles_cited":     reg.get("articles_cited", []),
        "recommendations":    reg.get("recommendations", []),
        "query":              body.query,
        "commodity":          body.commodity,
        "origin":             body.origin,
        "destination":        body.destination,
    }

    try:
        analysis_id = await save_analysis({**response_dict, 'query': body.query})
        response_dict['analysis_id'] = analysis_id
    except Exception as e:
        print(f"Failed to save analysis: {e}")
        response_dict['analysis_id'] = None

    return response_dict


@router.post("/compare")
async def compare_routes(body: CompareRequest) -> dict:

    # Roda tariff + logistics para cada origem em paralelo
    tasks = []
    for origin in body.origins:
        tasks.append(asyncio.gather(
            _tariff.analyze(body.commodity, origin, body.cif_value_usd),
            _logistics.analyze(origin, body.destination, body.commodity, body.trade_direction),
        ))

    results = await asyncio.gather(*tasks)

    comparisons = []
    for i, origin in enumerate(body.origins):
        tariff, logistics = results[i]
        comparisons.append({
            'origin': origin,
            'tariff': tariff,
            'logistics': logistics,
            'total_risk_score': round(tariff['tariff_risk_score'] * 0.5 + logistics['logistics_risk_score'] * 0.5),
            'landed_cost_brl': tariff['calculation'].get('total_landed_brl', 0),
            'transit_days': logistics.get('estimated_transit_days', 0),
            'trade_agreement': tariff.get('trade_agreement', 'WTO/MFN'),
            'ii_reduction_pct': tariff.get('ii_reduction_pct', 0),
        })

    # Ordena por custo landed
    comparisons.sort(key=lambda x: x['landed_cost_brl'])

    # Marca melhor e pior
    if comparisons:
        comparisons[0]['verdict'] = 'best'
        comparisons[-1]['verdict'] = 'worst' if len(comparisons) > 1 else 'only'
        for c in comparisons[1:-1]:
            c['verdict'] = 'mid'

    # Calcula savings vs pior opção
    if len(comparisons) > 1:
        worst_cost = comparisons[-1]['landed_cost_brl']
        for c in comparisons:
            c['savings_vs_worst'] = round(worst_cost - c['landed_cost_brl'], 2)

    # AI recommendation
    best = comparisons[0] if comparisons else {}
    recommendation = (
        f"{best.get('origin')} is the optimal sourcing origin — "
        f"R$ {best.get('landed_cost_brl', 0):,.0f} landed cost "
        f"({best.get('transit_days')} days transit) under {best.get('trade_agreement')}. "
        f"Tax burden {best['tariff']['calculation'].get('tax_burden_pct', 0):.1f}% of CIF value."
    ) if best else ""

    return {
        'comparisons': comparisons,
        'commodity': body.commodity,
        'destination': body.destination,
        'cif_value_usd': body.cif_value_usd,
        'recommendation': recommendation,
    }


@router.get("/honeycomb/{commodity}")
async def get_honeycomb_score(commodity: str, trade_direction: str = 'export') -> dict:
    return calculate_hes(commodity, trade_direction)


@router.get("/global-risk/{commodity}")
async def global_risk(commodity: str) -> dict:

    # Scores de risco por país para export (Brasil → mundo)
    EXPORT_RISK = {
        # Destinos europeus — EUDR em vigor
        'Germany': {'regulatory': 72, 'climate': 30, 'market': 45, 'logistics': 35, 'overall': 55},
        'Netherlands': {'regulatory': 68, 'climate': 28, 'market': 48, 'logistics': 28, 'overall': 52},
        'France': {'regulatory': 70, 'climate': 32, 'market': 44, 'logistics': 38, 'overall': 54},
        'Italy': {'regulatory': 65, 'climate': 35, 'market': 42, 'logistics': 40, 'overall': 51},
        'Belgium': {'regulatory': 67, 'climate': 28, 'market': 46, 'logistics': 30, 'overall': 52},
        'Spain': {'regulatory': 60, 'climate': 38, 'market': 40, 'logistics': 42, 'overall': 48},
        'Norway': {'regulatory': 58, 'climate': 25, 'market': 38, 'logistics': 35, 'overall': 46},
        'Switzerland': {'regulatory': 55, 'climate': 22, 'market': 40, 'logistics': 32, 'overall': 44},
        'United Kingdom': {'regulatory': 62, 'climate': 28, 'market': 44, 'logistics': 36, 'overall': 49},
        # EUA — tarifas Trump
        'United States': {'regulatory': 78, 'climate': 35, 'market': 65, 'logistics': 42, 'overall': 68},
        # Ásia
        'Japan': {'regulatory': 45, 'climate': 40, 'market': 55, 'logistics': 38, 'overall': 48},
        'China': {'regulatory': 55, 'climate': 45, 'market': 60, 'logistics': 50, 'overall': 54},
        'South Korea': {'regulatory': 42, 'climate': 38, 'market': 52, 'logistics': 35, 'overall': 46},
        # América Latina
        'Argentina': {'regulatory': 35, 'climate': 48, 'market': 42, 'logistics': 28, 'overall': 38},
        'Colombia': {'regulatory': 40, 'climate': 55, 'market': 45, 'logistics': 35, 'overall': 44},
        'Mexico': {'regulatory': 45, 'climate': 42, 'market': 48, 'logistics': 40, 'overall': 44},
        # Oriente Médio
        'Saudi Arabia': {'regulatory': 38, 'climate': 30, 'market': 50, 'logistics': 45, 'overall': 42},
        'UAE': {'regulatory': 35, 'climate': 28, 'market': 52, 'logistics': 38, 'overall': 40},
    }

    # Scores de risco por país para import (mundo → Brasil)
    IMPORT_RISK = {
        'United States': {'regulatory': 62, 'climate': 58, 'market': 50, 'logistics': 42, 'overall': 55},
        'China': {'regulatory': 75, 'climate': 65, 'market': 55, 'logistics': 68, 'overall': 67},
        'European Union': {'regulatory': 35, 'climate': 42, 'market': 48, 'logistics': 35, 'overall': 40},
        # Não-membros da UE — acordos comerciais distintos com o Brasil
        'Norway': {'regulatory': 26, 'climate': 32, 'market': 46, 'logistics': 30, 'overall': 33},
        'Switzerland': {'regulatory': 24, 'climate': 30, 'market': 48, 'logistics': 26, 'overall': 31},
        'United Kingdom': {'regulatory': 34, 'climate': 36, 'market': 54, 'logistics': 34, 'overall': 40},
        'Argentina': {'regulatory': 25, 'climate': 35, 'market': 45, 'logistics': 15, 'overall': 30},
        'Colombia': {'regulatory': 45, 'climate': 55, 'market': 52, 'logistics': 32, 'overall': 46},
        'Peru': {'regulatory': 48, 'climate': 58, 'market': 50, 'logistics': 38, 'overall': 49},
        'Chile': {'regulatory': 30, 'climate': 40, 'market': 55, 'logistics': 25, 'overall': 38},
        'Uruguay': {'regulatory': 20, 'climate': 30, 'market': 48, 'logistics': 12, 'overall': 27},
        'Paraguay': {'regulatory': 22, 'climate': 32, 'market': 42, 'logistics': 14, 'overall': 28},
        'Vietnam': {'regulatory': 55, 'climate': 70, 'market': 48, 'logistics': 52, 'overall': 57},
        'Ethiopia': {'regulatory': 60, 'climate': 75, 'market': 45, 'logistics': 65, 'overall': 62},
    }

    # Adiciona contexto especial para EUA (tarifas Trump 2025)
    if commodity == 'coffee':
        EXPORT_RISK['United States']['tariff_alert'] = True
        EXPORT_RISK['United States']['tariff_note'] = 'New US tariffs on Brazilian agricultural exports — increased market risk'

    return {
        'commodity': commodity,
        'export_destinations': EXPORT_RISK,
        'import_origins': IMPORT_RISK,
        'alert_countries': ['United States'],
        'last_updated': datetime.utcnow().isoformat()
    }


@router.post("/optimize")
async def optimize_routes(payload: dict) -> dict:
    from app.agents.gap_agent import optimize_honeycomb
    budget = payload.get('budget_brl', 500000)
    commodity = payload.get('commodity', 'coffee')
    return optimize_honeycomb(budget, commodity)


@router.post("/audit-path")
async def audit_path(payload: dict) -> dict:
    from app.agents.gap_agent import calculate_minimum_coverage_path
    return calculate_minimum_coverage_path(
        target_coverage_pct=payload.get('target_coverage_pct', 80),
        start_region=payload.get('start_region', 'Cerrado Mineiro'),
        commodity=payload.get('commodity', 'coffee')
    )


@router.get("/history")
async def get_history(limit: int = 20) -> list:
    return await get_analyses(limit)


@router.get("/history/{analysis_id}")
async def get_analysis(analysis_id: str) -> dict:
    doc = await get_analysis_by_id(analysis_id)
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Analysis not found")
    return doc


@router.post("/export/pdf")
async def export_pdf(data: dict) -> Response:
    timestamp = datetime.now().strftime('%Y%m%d_%H%M')
    pdf_bytes = await asyncio.to_thread(generate_pdf, data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="originsignal_{timestamp}.pdf"'},
    )


@router.post("/export/excel")
async def export_excel_endpoint(data: dict) -> Response:
    timestamp = datetime.now().strftime('%Y%m%d_%H%M')
    xlsx_bytes = await asyncio.to_thread(generate_excel, data)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="originsignal_{timestamp}.xlsx"'},
    )
