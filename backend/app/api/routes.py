from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.regulatory_agent import RegulatoryAgent

router = APIRouter(prefix="/api")

_agent = RegulatoryAgent()


class AnalyzeRequest(BaseModel):
    query: str
    commodity: str
    origin: str
    destination: str


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/analyze")
async def analyze(body: AnalyzeRequest) -> dict:
    result = _agent.analyze(
        query=body.query,
        commodity=body.commodity,
        origin=body.origin,
        destination=body.destination,
    )
    return result
