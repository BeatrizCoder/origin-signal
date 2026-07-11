import asyncio
from datetime import datetime

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.agents.climate_agent import ClimateAgent
from app.agents.executive_agent import ExecutiveAgent
from app.agents.gap_agent import GapAgent
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


class AnalyzeRequest(BaseModel):
    query: str
    commodity: str
    origin: str
    destination: str
    origin_region: str = "Cerrado Mineiro"
    trade_direction: str = "export"


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/analyze")
async def analyze(body: AnalyzeRequest) -> dict:
    is_import = body.trade_direction == "import"

    # For import: analyze climate at origin country; for export: analyze Brazilian origin region
    climate_location = body.origin if is_import else body.origin_region

    # Phase 1: independent agents in parallel (+ tariff when importing)
    if is_import:
        reg, clim, mkt, logi, tariff = await asyncio.gather(
            asyncio.to_thread(
                _regulatory.analyze,
                body.query, body.commodity, body.origin, body.destination, body.trade_direction,
            ),
            _climate.analyze(climate_location, body.commodity, is_import),
            _market.analyze(body.commodity, body.destination),
            _logistics.analyze(body.origin, body.destination, body.commodity, body.trade_direction),
            _tariff.analyze(body.commodity, body.origin),
        )
    else:
        reg, clim, mkt, logi = await asyncio.gather(
            asyncio.to_thread(
                _regulatory.analyze,
                body.query, body.commodity, body.origin, body.destination, body.trade_direction,
            ),
            _climate.analyze(climate_location, body.commodity, is_import),
            _market.analyze(body.commodity, body.destination),
            _logistics.analyze(body.origin, body.destination, body.commodity, body.trade_direction),
        )
        tariff = _EMPTY_TARIFF.copy()

    # Phase 2: gap (uses reg) + executive (uses all, incl. tariff) in parallel
    gap, executive = await asyncio.gather(
        _gap.analyze(reg, body.commodity),
        _executive.synthesize(
            reg, clim, mkt, logi, {}, body.query, body.commodity,
            body.destination, body.trade_direction, body.origin,
            tariff=tariff,
        ),
    )

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

    response_dict = {
        "regulatory":         reg,
        "climate":            clim,
        "market":             mkt,
        "logistics":          logi,
        "gap":                gap,
        "tariff":             tariff,
        "executive":          executive,
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
