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

IMPORT_ROUTES: dict[str, dict] = {
    "United States":  {"origin_port": "Port of Miami",         "destination_port": "Porto de Santos", "transit_days": 16, "dhl_index": 58},
    "China":          {"origin_port": "Port of Shanghai",      "destination_port": "Porto de Santos", "transit_days": 32, "dhl_index": 71},
    "European Union": {"origin_port": "Port of Hamburg",       "destination_port": "Porto de Santos", "transit_days": 32, "dhl_index": 62},
    "Germany":        {"origin_port": "Port of Hamburg",       "destination_port": "Porto de Santos", "transit_days": 32, "dhl_index": 62},
    "Netherlands":    {"origin_port": "Port of Rotterdam",     "destination_port": "Porto de Santos", "transit_days": 28, "dhl_index": 45},
    "France":         {"origin_port": "Port of Le Havre",      "destination_port": "Porto de Santos", "transit_days": 32, "dhl_index": 52},
    "Argentina":      {"origin_port": "Port of Buenos Aires",  "destination_port": "Porto de Santos", "transit_days":  4, "dhl_index": 48},
    "Uruguay":        {"origin_port": "Port of Montevideo",    "destination_port": "Porto de Santos", "transit_days":  3, "dhl_index": 42},
    "Paraguay":       {"origin_port": "Port of Asunción",      "destination_port": "Porto de Santos", "transit_days":  3, "dhl_index": 45},
    "Colombia":       {"origin_port": "Port of Cartagena",     "destination_port": "Porto de Santos", "transit_days":  8, "dhl_index": 52},
    "Peru":           {"origin_port": "Port of Callao",        "destination_port": "Porto de Santos", "transit_days": 12, "dhl_index": 50},
    "Chile":          {"origin_port": "Port of Valparaíso",    "destination_port": "Porto de Santos", "transit_days":  6, "dhl_index": 44},
}

_SANTOS_DHL_INDEX = 55


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    if score <= 80: return "High"
    return "Critical"


class LogisticsAgent:
    async def analyze(self, origin: str, destination: str, commodity: str, trade_direction: str = "export") -> dict:
        is_import = trade_direction == "import"

        if is_import:
            route = IMPORT_ROUTES.get(origin, {
                "origin_port": "Origin Port", "destination_port": "Porto de Santos",
                "transit_days": 20, "dhl_index": 55,
            })
            origin_port_name  = route["origin_port"]
            dest_port_name    = route["destination_port"]
            transit_days      = route["transit_days"]
            origin_dhl        = route["dhl_index"]

            score = 20
            if origin_dhl > 70:
                score += 20
            elif origin_dhl > 60:
                score += 10
            if _SANTOS_DHL_INDEX > 60:
                score += 10
            if commodity.lower() in ("fruits", "fruit"):
                score += 10
            score = max(0, min(100, score))

            findings = [
                f"Import origin port: {origin_port_name} — DHL Logistics Performance Index {origin_dhl}/100 "
                f"({'high congestion' if origin_dhl > 70 else 'moderate congestion' if origin_dhl > 60 else 'minimal congestion'}).",
                f"Destination port: {dest_port_name} — DHL index {_SANTOS_DHL_INDEX}/100.",
                f"Estimated total transit time: {transit_days} days from {origin} to Porto de Santos.",
            ]
            if commodity.lower() in ("fruits", "fruit"):
                findings.append("Perishable commodity — cold chain and transit time are critical for import quality compliance.")

            recommendations = [
                f"Book container slots at {origin_port_name} at least 21 days in advance.",
                "Obtain Brazilian import license (LI) via SISCOMEX before shipment.",
                "Engage a licensed customs broker (despachante aduaneiro) for clearance at Santos.",
            ]
            if transit_days > 25:
                recommendations.append(
                    f"Long transit (~{transit_days} days) — build adequate safety stock and consider split shipments."
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

        if is_import:
            op_name = origin_port_name
            dp_name = dest_port_name
        else:
            op_name = origin_port["name"]
            dp_name = dest_port["name"]

        return {
            "logistics_risk_score":   score,
            "risk_level":             _risk_level(score),
            "origin_port":            op_name,
            "destination_port":       dp_name,
            "estimated_transit_days": transit_days,
            "findings":               findings,
            "recommendations":        recommendations,
        }
