import asyncio
import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

REGION_COORDS: dict[str, tuple[float, float]] = {
    "Cerrado Mineiro":    (-19.1, -46.5),
    "Sul de Minas":       (-21.5, -45.3),
    "Chapada Diamantina": (-12.4, -41.6),
    "Mogiana":            (-20.7, -47.1),
    "Zona da Mata":       (-20.3, -42.4),
    "Norte PR":           (-23.1, -50.2),
    "Triângulo MG":       (-18.5, -48.2),
    "Serra Gaúcha":       (-29.1, -51.5),
    "Rondônia":           (-10.8, -62.4),
    "Planalto Sul":       (-27.5, -50.8),
    "Oeste da Bahia":     (-12.2, -44.9),
    "Sul ES":             (-20.6, -41.0),
    # Soybean producing regions
    "Mato Grosso":        (-12.6, -55.9),
    "Mato Grosso do Sul": (-20.4, -54.6),
    "Paraná":             (-24.7, -51.0),
    "Rio Grande do Sul":  (-29.7, -53.8),
    "Goiás":              (-15.9, -49.8),
    "Bahia Oeste":        (-12.0, -45.0),
}

COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "United States":  (39.5,  -98.0),
    "China":          (35.0,  105.0),
    "European Union": (51.0,   10.0),
    "Germany":        (51.2,   10.4),
    "Netherlands":    (52.1,    5.3),
    "France":         (46.2,    2.2),
    "Argentina":      (-34.6, -58.4),
    "Colombia":        (4.6,  -74.1),
    "Peru":            (-9.2, -75.0),
    "Chile":          (-30.0, -71.0),
}

_DAILY = "precipitation_sum,temperature_2m_max,temperature_2m_min"


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    if score <= 80: return "High"
    return "Critical"


def _compute_risk(forecast: dict, historical: dict) -> tuple[int, dict]:
    f_daily = forecast.get("daily", {})
    h_daily = historical.get("daily", {})

    f_precip   = [v for v in (f_daily.get("precipitation_sum") or []) if v is not None]
    h_precip   = [v for v in (h_daily.get("precipitation_sum") or []) if v is not None]
    f_temp_max = [v for v in (f_daily.get("temperature_2m_max") or []) if v is not None]
    f_temp_min = [v for v in (f_daily.get("temperature_2m_min") or []) if v is not None]

    avg_hist   = (sum(h_precip) / len(h_precip)) if h_precip else 3.0
    avg_fore   = (sum(f_precip) / len(f_precip)) if f_precip else avg_hist
    avg_tmax   = (sum(f_temp_max) / len(f_temp_max)) if f_temp_max else 28.0
    avg_tmin   = (sum(f_temp_min) / len(f_temp_min)) if f_temp_min else 16.0
    days_hot   = sum(1 for t in f_temp_max if t > 35)
    total_fore = sum(f_precip)

    score = 20
    if avg_hist > 0:
        ratio = avg_fore / avg_hist
        if ratio < 0.5:
            score += 35
        elif ratio < 0.7:
            score += 20
        elif ratio > 1.5:
            score += 10
    score += min(30, days_hot * 2)

    conditions = {
        "temp_max": round(avg_tmax, 1),
        "temp_min": round(avg_tmin, 1),
        "precipitation_forecast": round(total_fore, 1),
        "days_above_35c": days_hot,
    }
    return max(0, min(100, score)), conditions


def _build_findings(score: int, conditions: dict, region: str, is_import: bool = False) -> list[str]:
    findings = []
    context = f"supply region {region}" if is_import else region
    if conditions["days_above_35c"] > 5:
        findings.append(
            f"{context} has {conditions['days_above_35c']} days forecast above 35°C in the next 16 days, "
            f"{'which may affect agricultural output and logistics.' if is_import else 'increasing heat stress risk for coffee crops.'}"
        )
    if conditions["precipitation_forecast"] < 20:
        findings.append(
            f"Low precipitation forecast ({conditions['precipitation_forecast']} mm over 16 days) in {region} "
            f"{'may reduce available supply volumes.' if is_import else 'indicates drought risk that may affect yield and quality.'}"
        )
    elif conditions["precipitation_forecast"] > 200:
        findings.append(
            f"Excessive precipitation forecast ({conditions['precipitation_forecast']} mm) in {region} "
            f"{'raises risk of harvest delays and logistics disruption.' if is_import else 'raises risk of fungal disease and harvest delays.'}"
        )
    else:
        findings.append(
            f"Precipitation forecast of {conditions['precipitation_forecast']} mm over 16 days in {region} "
            "is within acceptable range for agricultural production."
        )
    findings.append(
        f"Average maximum temperature of {conditions['temp_max']}°C forecast "
        f"for {region} in the next 16 days."
    )
    return findings


def _build_recommendations(score: int, conditions: dict, is_import: bool = False) -> list[str]:
    recs = []
    if conditions["days_above_35c"] > 3:
        if is_import:
            recs.append("Monitor supply availability from this origin — heat stress may reduce harvest volumes and delay shipments.")
        else:
            recs.append("Implement shading systems or adjust harvest scheduling to mitigate heat stress impact.")
    if conditions["precipitation_forecast"] < 20:
        if is_import:
            recs.append("Assess alternative sourcing options — drought conditions in origin country may constrain supply.")
        else:
            recs.append("Activate supplemental irrigation protocols and monitor soil moisture levels closely.")
    if conditions["precipitation_forecast"] > 200:
        if is_import:
            recs.append("Build safety stock and plan for potential supply delays due to adverse weather at origin.")
        else:
            recs.append("Ensure adequate drainage and apply preventive fungicide treatment to protect crop health.")
    if is_import:
        recs.append("Monitor WMO and origin-country meteorological bulletins for updated supply risk signals.")
    else:
        recs.append("Monitor INMET and CPTEC climate bulletins weekly for updated forecasts.")
    return recs


class ClimateAgent:
    async def analyze(self, region: str, commodity: str, is_import: bool = False) -> dict:
        if is_import:
            lat, lon = COUNTRY_COORDS.get(region, (0.0, 0.0))
        else:
            lat, lon = REGION_COORDS.get(region, (-19.1, -46.5))
        base_params = {
            "latitude": lat,
            "longitude": lon,
            "daily": _DAILY,
            "timezone": "America/Sao_Paulo",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                forecast_resp, historical_resp = await asyncio.gather(
                    client.get(OPEN_METEO_URL, params={**base_params, "forecast_days": 16}),
                    client.get(OPEN_METEO_URL, params={**base_params, "past_days": 30, "forecast_days": 1}),
                )
            forecast   = forecast_resp.json()
            historical = historical_resp.json()
        except Exception:
            forecast   = {}
            historical = {}

        score, conditions = _compute_risk(forecast, historical)
        level = _risk_level(score)

        return {
            "climate_risk_score": score,
            "risk_level": level,
            "current_conditions": conditions,
            "findings": _build_findings(score, conditions, region, is_import),
            "recommendations": _build_recommendations(score, conditions, is_import),
            "region_coords": {"lat": lat, "lon": lon},
        }
