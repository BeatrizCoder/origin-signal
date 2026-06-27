import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.climate_agent import ClimateAgent
from app.agents.market_agent import MarketAgent
from app.agents.regulatory_agent import RegulatoryAgent

router = APIRouter(prefix="/api")

_regulatory = RegulatoryAgent()
_climate    = ClimateAgent()
_market     = MarketAgent()


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


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/analyze")
async def analyze(body: AnalyzeRequest) -> dict:
    reg, clim, mkt = await asyncio.gather(
        asyncio.to_thread(
            _regulatory.analyze,
            body.query, body.commodity, body.origin, body.destination,
        ),
        _climate.analyze(body.origin_region, body.commodity),
        _market.analyze(body.commodity, body.destination),
    )

    overall = max(0, min(100, round(
        reg["risk_score"]              * 0.40 +
        clim["climate_risk_score"]     * 0.35 +
        mkt["market_risk_score"]       * 0.25
    )))

    return {
        "regulatory":         reg,
        "climate":            clim,
        "market":             mkt,
        "overall_risk_score": overall,
        "export_readiness":   100 - overall,
        # flat fields kept for frontend compatibility
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
