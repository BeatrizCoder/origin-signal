import httpx

USDA_FAS_URL = "https://apps.fas.usda.gov/psdonline/api/v1/data"

_COFFEE_CODE  = "0711100"
_BRAZIL_CODE  = "BR"

_MOCK = {
    "price_trend":          "upward",
    "global_supply_index":  72,
    "demand_eu":            "high",
}


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    if score <= 80: return "High"
    return "Critical"


def _score_from_supply(supply_index: int, price_trend: str) -> int:
    if supply_index > 80:
        score = 20
    elif supply_index >= 50:
        score = 40
    else:
        score = 65
    if price_trend == "upward":
        score += 10
    elif price_trend == "downward":
        score -= 5
    return max(0, min(100, score))


def _build_findings(score: int, data: dict) -> list[str]:
    trend   = data["price_trend"]
    supply  = data["global_supply_index"]
    demand  = data["demand_eu"]
    return [
        f"Global coffee supply index is {supply}/100 — "
        + ("tight supply may constrain export volumes." if supply < 60 else "supply levels are adequate for current demand."),
        f"EU demand is classified as '{demand}', "
        + ("supporting favorable export conditions." if demand == "high" else "indicating potential market softening."),
        f"Price trend is '{trend}' — "
        + ("exporters may benefit from higher margins, but buyers face cost pressure." if trend == "upward"
           else "competitive pricing may be required to maintain market share."),
        "EUDR compliance documentation is increasingly a market differentiator for EU buyers.",
    ]


def _build_recommendations(score: int, data: dict) -> list[str]:
    recs = [
        "Lock in forward contracts with EU buyers early to hedge against price volatility.",
        "Maintain EUDR-compliant traceability documentation as a premium market differentiator.",
    ]
    if data["global_supply_index"] < 60:
        recs.append("Prioritize highest-quality lots for EU export given tight supply premiums.")
    if data["price_trend"] == "upward":
        recs.append("Review export pricing strategy to capture current upward price momentum.")
    return recs


class MarketAgent:
    async def analyze(self, commodity: str, destination: str) -> dict:
        data = await self._fetch_usda()

        score = _score_from_supply(data["global_supply_index"], data["price_trend"])
        level = _risk_level(score)

        return {
            "market_risk_score": score,
            "risk_level": level,
            "price_trend": data["price_trend"],
            "supply_demand": {
                "global_supply_index": data["global_supply_index"],
                "demand_eu": data["demand_eu"],
            },
            "findings": _build_findings(score, data),
            "recommendations": _build_recommendations(score, data),
        }

    async def _fetch_usda(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    USDA_FAS_URL,
                    params={"commodityCode": _COFFEE_CODE, "countryCode": _BRAZIL_CODE},
                )
            rows = resp.json()
            if not rows or not isinstance(rows, list):
                return _MOCK.copy()

            latest = sorted(rows, key=lambda r: r.get("marketYear", 0), reverse=True)[:3]
            prod_vals = [r.get("value", 0) for r in latest if r.get("attributeId") == 20]
            exp_vals  = [r.get("value", 0) for r in latest if r.get("attributeId") == 88]

            if not prod_vals:
                return _MOCK.copy()

            avg_prod = sum(prod_vals) / len(prod_vals)
            avg_exp  = sum(exp_vals) / len(exp_vals) if exp_vals else avg_prod * 0.4

            supply_index = min(100, int((avg_exp / avg_prod) * 100)) if avg_prod else 72
            trend = "upward" if len(prod_vals) > 1 and prod_vals[0] > prod_vals[-1] else "stable"

            return {"price_trend": trend, "global_supply_index": supply_index, "demand_eu": "high"}
        except Exception:
            return _MOCK.copy()
