import asyncio
from datetime import datetime, timedelta, timezone

import httpx

from app.agents.gap_agent import EUDR_APPLICABLE_DESTINATIONS

EUR_LEX_RSS_URL = "https://eur-lex.europa.eu/rss-eur-lex.xml"
RASFF_API_URL = "https://webgate.ec.europa.eu/rasff-window/api/notification/list"

ALERT_WINDOW_DAYS = 30

_SEVERITY_WEIGHT = {"High": 30, "Medium": 15, "Low": 5}
_SEVERITY_RANK = {"High": 3, "Medium": 2, "Low": 1}

# EUR-Lex has no public, unauthenticated RSS for arbitrary keyword searches — its RSS feeds
# are per-saved-search (myRssId) and require an EU Login account. RASFF's REST API rejects
# generic HTTP clients ("can only be accessed programmatically") — it's the undocumented
# backend for their own Angular portal, not a public contract. fetch_eurlex_alerts and
# fetch_rasff_alerts still attempt the real calls below (so this works automatically if
# either becomes reachable — e.g. a saved-search myRssId or official RASFF API access), but
# in practice they fall through to the curated fallback / empty list every time today.
_EUR_LEX_FALLBACK = [
    {
        "title": "EUDR application postponed to 30 Dec 2026 (large/medium) / 30 Jun 2027 (micro/small)",
        "date": "2025-12-18",
        "source": "EUR-Lex (curated reference)",
        "url": "https://www.consilium.europa.eu/en/press/press-releases/2025/12/18/deforestation-council-signs-off-targeted-revision-to-simplify-and-postpone-the-regulation/",
        "summary": "Council and Parliament adopted a second one-year postponement of EUDR market-obligation "
                   "deadlines. Large/medium operators now have until 30 Dec 2026; micro/small operators until "
                   "30 Jun 2027.",
        "severity": "High",
        "commodities": {"coffee", "soybeans"},
        "live": False,
    },
    {
        "title": "EUDR scope clarification: soluble/instant coffee added to scope",
        "date": "2026-05-01",
        "source": "EUR-Lex (curated reference)",
        "url": "https://agrinfo.eu/book-of-reports/eu-deforestation-regulation-eudr-clarifications-may-2026/",
        "summary": "European Commission clarifications proposed adding soluble (instant) coffee and certain "
                   "palm oil derivatives to EUDR scope, to prevent deforestation-risk relocation via processed "
                   "products.",
        "severity": "Medium",
        "commodities": {"coffee"},
        "live": False,
    },
]


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    if score <= 80: return "High"
    return "Critical"


def _within_window(date_str: str, days: int = ALERT_WINDOW_DAYS) -> bool:
    try:
        item_date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    return item_date >= datetime.now(timezone.utc) - timedelta(days=days)


class AlertsAgent:
    async def fetch_eurlex_alerts(self, commodity: str) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(EUR_LEX_RSS_URL)
            resp.raise_for_status()
            # EUR-Lex has no generic keyword-search RSS today (see module docstring) —
            # a real response here would need real RSS-item parsing, not implemented since
            # there is nothing reachable to parse against.
            return []
        except Exception:
            return [
                {
                    "title": item["title"],
                    "date": item["date"],
                    "source": item["source"],
                    "url": item["url"],
                    "summary": item["summary"],
                    "severity": item["severity"],
                    "live": item["live"],
                }
                for item in _EUR_LEX_FALLBACK
                if commodity in item["commodities"]
            ]

    async def fetch_rasff_alerts(self, commodity: str, origin: str = "Brazil") -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(RASFF_API_URL)
            resp.raise_for_status()
            return []
        except Exception:
            # No verifiable, real, dated RASFF notification for Brazil/coffee/soybeans could be
            # sourced publicly (the API blocks generic clients and the portal is a JS SPA with
            # no server-rendered listing) — returning an empty list rather than fabricating one.
            return []

    async def analyze(self, commodity: str, destination: str, origin: str = "Brazil") -> dict:
        eurlex_alerts, rasff_alerts = await asyncio.gather(
            self.fetch_eurlex_alerts(commodity),
            self.fetch_rasff_alerts(commodity, origin),
        )

        combined: list[dict] = []
        for a in eurlex_alerts:
            combined.append({**a, "source": a.get("source") or "EUR-Lex"})
        for a in rasff_alerts:
            combined.append({**a, "source": a.get("source") or "RASFF"})

        eudr_applies = destination in EUDR_APPLICABLE_DESTINATIONS
        if not eudr_applies:
            combined = [a for a in combined if not a.get("source", "").startswith("EUR-Lex")]

        combined = [
            a for a in combined
            if a.get("live") is False or _within_window(a["date"])
        ]

        combined.sort(key=lambda a: (_SEVERITY_RANK.get(a["severity"], 0), a["date"]), reverse=True)

        score = min(100, sum(_SEVERITY_WEIGHT.get(a["severity"], 0) for a in combined))
        most_critical = combined[0] if combined else None

        if not combined:
            insight = f"No regulatory alerts in the last {ALERT_WINDOW_DAYS} days for this commodity/route."
        else:
            insight = (
                f"{len(combined)} active alert(s) — most critical: \"{most_critical['title']}\" "
                f"({most_critical['severity']})."
            )

        return {
            "alerts": combined,
            "alert_score": score,
            "risk_level": _risk_level(score),
            "alert_count": len(combined),
            "most_critical": most_critical,
            "insight": insight,
        }
