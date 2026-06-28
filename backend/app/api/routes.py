import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.climate_agent import ClimateAgent
from app.agents.executive_agent import ExecutiveAgent
from app.agents.gap_agent import GapAgent
from app.agents.logistics_agent import LogisticsAgent
from app.agents.market_agent import MarketAgent
from app.agents.regulatory_agent import RegulatoryAgent

router = APIRouter(prefix="/api")

_regulatory = RegulatoryAgent()
_climate    = ClimateAgent()
_market     = MarketAgent()
_logistics  = LogisticsAgent()
_gap        = GapAgent()
_executive  = ExecutiveAgent()


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
    # Phase 1: 4 independent agents in parallel
    reg, clim, mkt, logi = await asyncio.gather(
        asyncio.to_thread(
            _regulatory.analyze,
            body.query, body.commodity, body.origin, body.destination,
        ),
        _climate.analyze(body.origin_region, body.commodity),
        _market.analyze(body.commodity, body.destination),
        _logistics.analyze(body.origin, body.destination, body.commodity),
    )

    # Phase 2: gap (uses reg) + executive (uses all) in parallel
    gap, executive = await asyncio.gather(
        _gap.analyze(reg, body.commodity),
        _executive.synthesize(reg, clim, mkt, logi, {}, body.query, body.commodity, body.destination, body.trade_direction),
    )

    overall = max(0, min(100, round(
        reg["risk_score"]                * 0.30 +
        clim["climate_risk_score"]       * 0.25 +
        mkt["market_risk_score"]         * 0.20 +
        logi["logistics_risk_score"]     * 0.15 +
        gap["gap_risk_score"]            * 0.10
    )))

    return {
        "regulatory":         reg,
        "climate":            clim,
        "market":             mkt,
        "logistics":          logi,
        "gap":                gap,
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
