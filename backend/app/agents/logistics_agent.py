ORIGIN_PORTS: dict[str, dict] = {
    "Brazil":    {"name": "Porto de Santos",         "capacity": "normal",   "avg_days": 3},
    "Santos":    {"name": "Porto de Santos",         "capacity": "normal",   "avg_days": 3},
    "Paranaguá": {"name": "Porto de Paranaguá",      "capacity": "normal",   "avg_days": 4},
    "Rio":       {"name": "Porto do Rio de Janeiro", "capacity": "moderate", "avg_days": 5},
}

# Sea transit days from Santos per destination (port-to-port, realistic ocean freight)
_SEA_DAYS: dict[str, int] = {
    "Hamburg":    25,  # Santos → Hamburg ≈ 25 days sailing
    "Rotterdam":  22,  # Santos → Rotterdam ≈ 22 days sailing
    "Antuérpia":  23,  # Santos → Antwerp ≈ 23 days sailing
    "Le Havre":   20,
    "Genoa":      18,
}

DESTINATION_PORTS: dict[str, dict] = {
    "Germany":        {"name": "Hamburg",   "dhl_index": 62, "handling_days": 3},
    "European Union": {"name": "Hamburg",   "dhl_index": 62, "handling_days": 3},
    "Netherlands":    {"name": "Rotterdam", "dhl_index": 45, "handling_days": 3},
    "Belgium":        {"name": "Antuérpia", "dhl_index": 48, "handling_days": 3},
    "France":         {"name": "Le Havre",  "dhl_index": 55, "handling_days": 3},
    "Italy":          {"name": "Genoa",     "dhl_index": 58, "handling_days": 3},
}

_DEST_HANDLING_DAYS = 3


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    if score <= 80: return "High"
    return "Critical"


class LogisticsAgent:
    async def analyze(self, origin: str, destination: str, commodity: str) -> dict:
        origin_port = ORIGIN_PORTS.get(origin, ORIGIN_PORTS["Brazil"])
        dest_port   = DESTINATION_PORTS.get(destination, DESTINATION_PORTS["European Union"])

        score = 20
        if origin_port["capacity"] in ("reduced", "moderate"):
            score += 15
        if dest_port["dhl_index"] > 70:
            score += 20
        if commodity.lower() in ("fruits", "fruit"):
            score += 10
        score = max(0, min(100, score))

        sea_days     = _SEA_DAYS.get(dest_port["name"], 24)
        transit_days = origin_port["avg_days"] + sea_days + _DEST_HANDLING_DAYS

        findings = [
            f"Primary export port: {origin_port['name']} — capacity status '{origin_port['capacity']}', "
            f"average loading time {origin_port['avg_days']} days.",
            f"Destination port: {dest_port['name']} — DHL Logistics Performance Index {dest_port['dhl_index']}/100 "
            f"({'moderate congestion' if dest_port['dhl_index'] > 60 else 'minimal congestion'}).",
            f"Estimated total transit time: {transit_days} days from farm gate to EU port.",
        ]
        if commodity.lower() in ("fruits", "fruit"):
            findings.append("Perishable commodity — cold chain integrity and transit time are critical risk factors.")

        recommendations = [
            f"Book container slots at {origin_port['name']} at least 21 days in advance to avoid delays.",
            f"Coordinate with {dest_port['name']} customs agents to pre-clear EUDR documentation.",
            "Use reefer containers with temperature logging for cold chain compliance evidence.",
        ]
        if dest_port["dhl_index"] > 60:
            recommendations.append(
                f"Consider alternative routing via Rotterdam (DHL Index 45) to reduce port congestion risk."
            )

        return {
            "logistics_risk_score": score,
            "risk_level":           _risk_level(score),
            "origin_port":          origin_port["name"],
            "destination_port":     dest_port["name"],
            "estimated_transit_days": transit_days,
            "findings":             findings,
            "recommendations":      recommendations,
        }
