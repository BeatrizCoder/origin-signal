ORIGIN_PORTS: dict[str, dict] = {
    "Brazil":    {"name": "Porto de Santos",         "capacity": "normal",   "avg_days": 3},
    "Santos":    {"name": "Porto de Santos",         "capacity": "normal",   "avg_days": 3},
    "Paranaguá": {"name": "Porto de Paranaguá",      "capacity": "normal",   "avg_days": 4},
    "Rio":       {"name": "Porto do Rio de Janeiro", "capacity": "moderate", "avg_days": 5},
}

# Sea transit days from Santos per export destination (port-to-port)
_SEA_DAYS: dict[str, int] = {
    "Hamburg":      25,
    "Rotterdam":    22,
    "Antuérpia":    23,
    "Le Havre":     26,
    "Genoa":        18,
    "Oslo":         29,
    "Felixstowe":   23,
    "Zurich":       25,
}

DESTINATION_PORTS: dict[str, dict] = {
    "Germany":        {"name": "Hamburg",    "dhl_index": 62, "handling_days": 3},
    "European Union": {"name": "Hamburg",    "dhl_index": 62, "handling_days": 3},
    "Netherlands":    {"name": "Rotterdam",  "dhl_index": 45, "handling_days": 3},
    "Belgium":        {"name": "Antuérpia",  "dhl_index": 48, "handling_days": 3},
    "France":         {"name": "Le Havre",   "dhl_index": 52, "handling_days": 3},
    "Italy":          {"name": "Genoa",      "dhl_index": 58, "handling_days": 3},
    "Norway":         {"name": "Oslo",       "dhl_index": 38, "handling_days": 3},
    "Switzerland":    {"name": "Zurich",     "dhl_index": 41, "handling_days": 6},
    "United Kingdom": {"name": "Felixstowe", "dhl_index": 55, "handling_days": 3},
}

_DEST_HANDLING_DAYS = 3

# ── Import route data ──────────────────────────────────────────────────────────

IMPORT_ORIGIN_PORTS: dict[str, dict] = {
    "United States":  {"name": "Port of Houston",      "capacity": "normal",   "avg_days": 5},
    "China":          {"name": "Port of Shanghai",     "capacity": "normal",   "avg_days": 5},
    "European Union": {"name": "Port of Hamburg",      "capacity": "normal",   "avg_days": 4},
    "Germany":        {"name": "Port of Hamburg",      "capacity": "normal",   "avg_days": 4},
    "Netherlands":    {"name": "Port of Rotterdam",    "capacity": "normal",   "avg_days": 3},
    "France":         {"name": "Port of Le Havre",     "capacity": "normal",   "avg_days": 4},
    "Argentina":      {"name": "Port of Buenos Aires", "capacity": "normal",   "avg_days": 2},
    "Colombia":       {"name": "Port of Cartagena",    "capacity": "normal",   "avg_days": 2},
    "Peru":           {"name": "Port of Callao",       "capacity": "normal",   "avg_days": 4},
    "Chile":          {"name": "Port of Valparaíso",   "capacity": "normal",   "avg_days": 3},
}

# Sea transit days from import origin port → Porto de Santos
_SEA_DAYS_TO_SANTOS: dict[str, int] = {
    "Port of Houston":      16,
    "Port of Shanghai":     30,
    "Port of Hamburg":      25,
    "Port of Rotterdam":    22,
    "Port of Le Havre":     26,
    "Port of Buenos Aires":  2,
    "Port of Cartagena":     8,
    "Port of Callao":       10,
    "Port of Valparaíso":    7,
}

_SANTOS_DEST = {"name": "Porto de Santos", "dhl_index": 55, "handling_days": 3}


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    if score <= 80: return "High"
    return "Critical"


class LogisticsAgent:
    async def analyze(self, origin: str, destination: str, commodity: str, trade_direction: str = "export") -> dict:
        is_import = trade_direction == "import"

        if is_import:
            origin_port  = IMPORT_ORIGIN_PORTS.get(origin, {"name": "Origin Port", "capacity": "normal", "avg_days": 4})
            dest_port    = _SANTOS_DEST
            sea_days     = _SEA_DAYS_TO_SANTOS.get(origin_port["name"], 20)
            transit_days = origin_port["avg_days"] + sea_days + dest_port["handling_days"]

            score = 20
            if origin_port["capacity"] in ("reduced", "moderate"):
                score += 15
            if dest_port["dhl_index"] > 60:
                score += 15
            if commodity.lower() in ("fruits", "fruit"):
                score += 10
            score = max(0, min(100, score))

            findings = [
                f"Import origin port: {origin_port['name']} — capacity '{origin_port['capacity']}', "
                f"average loading time {origin_port['avg_days']} days.",
                f"Destination port: {dest_port['name']} — DHL Logistics Performance Index {dest_port['dhl_index']}/100 "
                f"({'moderate congestion' if dest_port['dhl_index'] > 60 else 'minimal congestion'}).",
                f"Estimated total transit time: {transit_days} days from {origin} to Porto de Santos.",
            ]
            if commodity.lower() in ("fruits", "fruit"):
                findings.append("Perishable commodity — cold chain and transit time are critical for import quality compliance.")

            recommendations = [
                f"Book container slots at {origin_port['name']} at least 21 days in advance.",
                "Obtain Brazilian import license (LI) via SISCOMEX before shipment.",
                "Engage a licensed customs broker (despachante aduaneiro) for clearance at Santos.",
            ]
            if sea_days > 20:
                recommendations.append(
                    f"Consider air freight for time-sensitive volumes — sea transit from {origin} is ~{sea_days} days."
                )

        else:
            origin_port  = ORIGIN_PORTS.get(origin, ORIGIN_PORTS["Brazil"])
            dest_port    = DESTINATION_PORTS.get(destination, DESTINATION_PORTS["European Union"])
            sea_days     = _SEA_DAYS.get(dest_port["name"], 24)
            transit_days = origin_port["avg_days"] + sea_days + _DEST_HANDLING_DAYS

            score = 20
            if origin_port["capacity"] in ("reduced", "moderate"):
                score += 15
            if dest_port["dhl_index"] > 70:
                score += 20
            if commodity.lower() in ("fruits", "fruit"):
                score += 10
            score = max(0, min(100, score))

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
            "logistics_risk_score":   score,
            "risk_level":             _risk_level(score),
            "origin_port":            origin_port["name"],
            "destination_port":       dest_port["name"],
            "estimated_transit_days": transit_days,
            "findings":               findings,
            "recommendations":        recommendations,
        }
