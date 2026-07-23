import httpx

USDA_FAS_URL = "https://apps.fas.usda.gov/psdonline/api/v1/data"

_COFFEE_CODE  = "0711100"
_BRAZIL_CODE  = "BR"

_MOCK = {
    "price_trend":          "upward",
    "global_supply_index":  72,
    "demand_eu":            "high",
}

# Fatos estruturais de comércio EUA-China-Brasil (soja). Não são obtidos via API —
# são estimativas públicas (USDA FAS Grain: World Markets and Trade + UN Comtrade,
# safra 2023/24) que mudam em anos, não em horas, então são mantidos como constantes.
GEOPOLITICAL_SOY_DATA = {
    "china_export_share_pct":  72,   # % das exportações brasileiras de soja que vão para a China
    "us_china_tariff_pct":     25,   # tarifa retaliatória chinesa sobre soja dos EUA (imposta em 2018, ainda em vigor)
    "trade_war_since":         2018,
    "us_share_lost_pct":       20,   # queda aprox. na participação dos EUA nas importações chinesas de soja desde 2016 (~40% -> ~20%)
    "diversification_targets": ["European Union", "Vietnam", "Thailand", "United Arab Emirates"],
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


COMMODITY_MARKET_CONTEXT = {
    "coffee": {
        "default": {
            "findings": [
                "Global arabica prices trending upward — ICE futures above 5-year average",
                "Vietnam robusta crop concerns reducing blending options for EU roasters",
                "Brazilian arabica commands 15-20% premium vs Vietnam in specialty segment",
                "BRL/USD depreciation improving export competitiveness in USD-denominated contracts",
            ],
            "recommendations": [
                "Lock forward contracts now to capture current price momentum",
                "Monitor ICE Coffee C futures weekly for pricing strategy",
                "Certify under Rainforest Alliance or UTZ for EU premium market access",
                "Track CEPEA/ESALQ Arabica Index for domestic price benchmarking",
            ],
        },
        "China": {
            "findings": [
                "Chinese coffee market growing 15% annually — specialty segment fastest growing",
                "No EUDR equivalent in China — lower documentation burden vs EU",
                "Chinese importers prefer roasted/processed coffee (NCM 0901.21) over green",
                "Competition from Vietnamese robusta on price — Brazilian arabica positioned as premium",
            ],
            "recommendations": [
                "Target Tier 1 cities (Shanghai, Beijing, Shenzhen) specialty coffee chains",
                "Obtain Chinese food importer registration via CIFER platform",
                "Consider roasting locally (via bonded warehouse) to capture processing margin",
                "Build relationships with Alibaba/JD.com B2B platforms for volume buyers",
            ],
        },
        "United States": {
            "findings": [
                "US specialty coffee market USD 47B — Brazilian single-origin growing demand",
                "FDA FSMA Prior Notice mandatory 8h before sea arrival",
                "No active US tariff on Brazilian green coffee (NCM 0901.11.00) — exempt from Trump tariffs",
                "Strong USD vs BRL improving US buyer purchasing power for Brazilian coffee",
            ],
            "recommendations": [
                "Target SCA (Specialty Coffee Association) member roasters for premium placement",
                "Maintain FDA facility registration current for all supply chain partners",
                "Lock USD-denominated contracts to hedge BRL volatility",
                "Consider Rainforest Alliance certification — US specialty buyers increasingly require it",
            ],
        },
        "Japan": {
            "findings": [
                "Japan 4th largest coffee importer globally — Brazilian origin holds ~30% market share",
                "EPA agreement: green coffee II = 0% (vs 3.5% MFN) — significant tariff advantage",
                "Japanese market values consistency and quality over price — relationship-based trading",
                "MHLW pesticide positive list: unlisted pesticides default to 0.01 ppm — strict compliance required",
            ],
            "recommendations": [
                "Leverage EPA tariff advantage vs non-EPA origins in price negotiation",
                "Obtain JAS organic certification for premium segment access",
                "Build long-term exclusive supply agreements — Japanese buyers prefer stability",
                "Conduct pesticide residue testing against MHLW positive list before shipment",
            ],
        },
    },
    "soybeans": {
        "default": {
            "findings": [
                "Brazil accounts for ~60% of global soybean exports — dominant market position",
                "CBOT soybean futures: key price benchmark for all contracts",
                "Harvest season March-May drives seasonal price and logistics pressure",
                "Argentine drought risk periodically boosts Brazilian competitiveness",
            ],
            "recommendations": [
                "Use CBOT futures for price hedging — lock contracts 90-120 days before shipment",
                "Monitor USDA WASDE monthly reports for global supply/demand signals",
                "Maintain GACC export registration current for Chinese buyer access",
                "Diversify buyer base beyond China to reduce concentration risk",
            ],
        },
        "China": {
            "findings": [
                "China imports ~72% of Brazilian soybean exports — extreme concentration risk",
                "US-China trade war (2018-ongoing): 25% retaliatory tariff on US soybeans benefited Brazil",
                "Risk of normalization: US-China trade deal could erode Brazil's tariff advantage",
                "GACC registration mandatory — 2021 new rules require individual farm-level traceability",
                "African Swine Fever recovery driving Chinese soy meal demand for animal feed",
            ],
            "recommendations": [
                "Diversify to EU, Vietnam, Thailand to reduce China concentration below 50%",
                "Maintain current GACC farm-level registration — inspections intensifying in 2025-2026",
                "Monitor US-China trade negotiations quarterly — normalization would compress margins",
                "Consider soy meal/oil processing in Brazil before export to capture value-added premium",
                "Build 90-day inventory buffer at Santos terminal to hedge logistics disruptions",
            ],
        },
        "European Union": {
            "findings": [
                "EUDR applies to soybeans from December 2024 — deforestation-free proof mandatory",
                "Cerrado biome classified high-risk under EUDR — enhanced due diligence required",
                "EU soy imports from Brazil face strict satellite monitoring via EU Observatory",
                "Organic/non-GMO soy commands 30-40% premium in EU market",
            ],
            "recommendations": [
                "Implement GPS polygon mapping for ALL soy production areas immediately",
                "Register with EU Information System (Article 33) before first shipment",
                "Obtain RTRS (Round Table on Responsible Soy) certification for EU compliance",
                "Separate compliant and non-compliant volumes to avoid full cargo rejection",
            ],
        },
    },
    "fruits": {
        "default": {
            "findings": [
                "Brazilian tropical fruits: mangoes, grapes, melons commanding premium in export markets",
                "Cold chain integrity critical — temperature excursion causes rejection at destination",
                "Phytosanitary certificate from MAPA required for all export destinations",
                "Seasonality: Vale do São Francisco (irrigated) enables year-round production",
            ],
            "recommendations": [
                "Invest in pre-cooling infrastructure at farm level to extend shelf life",
                "Obtain Global G.A.P. certification — required by most EU/US supermarket chains",
                "Monitor destination country pest alerts — new restrictions can close markets overnight",
                "Build contingency routes for alternative destinations during peak season",
            ],
        },
        "European Union": {
            "findings": [
                "EU MRL (Maximum Residue Limits) among strictest globally — zero tolerance for exceedances",
                "EUDR applies to fruits from areas with deforestation risk — Bahia mango areas at risk",
                "EU Rapid Alert System (RASFF): Brazilian fruits historically flagged for pesticide issues",
                "Organic certification commands 40-60% premium in Northern European markets",
            ],
            "recommendations": [
                "Test every lot against EU MRL database before shipment — use accredited lab",
                "Subscribe to RASFF alerts for real-time EU market access monitoring",
                "Implement Integrated Pest Management (IPM) to reduce chemical dependency",
                "Obtain EUDR compliance documentation for orchards in Bahia/MATOPIBA region",
            ],
        },
        "United States": {
            "findings": [
                "USDA APHIS phytosanitary requirements: cold treatment mandatory for some fruits",
                "FDA FSMA Foreign Supplier Verification Program (FSVP) applies to all importers",
                "US market prefers consistent sizing and cosmetic standards — high rejection rate for off-grade",
                "Mango: US largest single market for Brazilian mangoes — direct air/sea options",
            ],
            "recommendations": [
                "Obtain USDA APHIS export certificate — required for each shipment",
                "Comply with FSMA FSVP: US importer must conduct annual supplier verification",
                "Grade and size consistently — US supermarket specs are strict and contractual",
                "Consider air freight for premium mangoes/grapes to capture freshness premium",
            ],
        },
    },
}


def _geopolitical_score(commodity: str, destination: str) -> int | None:
    """Risco de concentração geopolítica. Só se aplica a soja; outras commodities não têm dimensão modelada."""
    if commodity != "soybeans":
        return None

    g = GEOPOLITICAL_SOY_DATA
    # Concentração: quanto mais próximo dos ~72% de dependência da China, maior o risco de choque de demanda.
    concentration_score = min(100, int(g["china_export_share_pct"] * 1.1))
    # Tensão EUA-China: tarifa retaliatória de 25% desde 2018 sustenta a vantagem competitiva do Brasil,
    # mas é também o mesmo mecanismo que pode reverter (normalização EUA-China) e derrubar essa vantagem.
    tension_score = min(100, g["us_china_tariff_pct"] * 2 + g["us_share_lost_pct"])

    if destination == "China":
        # Brasil concentrado no comprador que é parte direta da tensão: risco composto pleno.
        score = int(concentration_score * 0.6 + tension_score * 0.4)
    else:
        # Para outros destinos, o risco é indireto (efeitos de desvio de comércio), atenuado.
        score = int(tension_score * 0.5)

    return max(0, min(100, score))


def _build_geopolitical_findings(destination: str) -> list[str]:
    g = GEOPOLITICAL_SOY_DATA
    findings = [
        f"China absorve aproximadamente {g['china_export_share_pct']}% das exportações brasileiras de soja — "
        "uma concentração de destino bem acima do limiar de diversificação recomendado (25-30%).",
        f"Desde {g['trade_war_since']}, a China mantém tarifa retaliatória de {g['us_china_tariff_pct']}% sobre "
        "a soja dos EUA (resposta às tarifas da Seção 301), o que desviou parte da demanda chinesa para o Brasil "
        f"— participação dos EUA nas importações chinesas de soja caiu cerca de {g['us_share_lost_pct']} pontos "
        "percentuais desde 2016.",
    ]
    if destination == "China":
        findings.append(
            "Esta rota concentra o risco duplamente: o Brasil depende de um único comprador que é também o "
            "epicentro da tensão comercial EUA-China — uma eventual normalização das relações EUA-China (redução "
            "de tarifas) pode reduzir abruptamente a vantagem competitiva brasileira nesse mercado."
        )
    else:
        findings.append(
            "Embora esta rota não seja diretamente para a China, oscilações na tensão comercial EUA-China afetam "
            "os preços globais de soja e a alocação de volumes brasileiros entre destinos."
        )
    return findings


def _build_geopolitical_recommendations(destination: str) -> list[str]:
    g = GEOPOLITICAL_SOY_DATA
    targets = ", ".join(g["diversification_targets"])
    recs = [
        f"Diversificar destinos de exportação além da China (ex.: {targets}) para reduzir exposição a um único comprador.",
        "Monitorar sinais de política comercial EUA-China (USTR, MOFCOM) — mudanças na tarifa retaliatória de "
        f"{g['us_china_tariff_pct']}% sobre a soja americana afetam diretamente a demanda chinesa por soja brasileira.",
    ]
    if destination == "China":
        recs.append(
            "Negociar contratos de longo prazo com compradores chineses para reduzir volatilidade de curto prazo "
            "ligada à conjuntura geopolítica EUA-China."
        )
    return recs


class MarketAgent:
    async def analyze(self, commodity: str, destination: str) -> dict:
        data = await self._fetch_usda()

        base_score = _score_from_supply(data["global_supply_index"], data["price_trend"])
        geo_score = _geopolitical_score(commodity, destination)

        commodity_lower = commodity.lower()
        dest_context = COMMODITY_MARKET_CONTEXT.get(commodity_lower, {})
        specific = dest_context.get(destination, dest_context.get("default", {}))
        base_findings = specific.get("findings", [])
        base_recommendations = specific.get("recommendations", [])

        result = {
            "price_trend": data["price_trend"],
            "supply_demand": {
                "global_supply_index": data["global_supply_index"],
                "demand_eu": data["demand_eu"],
            },
            "findings": list(base_findings),
            "recommendations": list(base_recommendations),
        }

        if geo_score is None:
            score = base_score
            result["market_risk_score"] = score
            result["risk_level"] = _risk_level(score)
            return result

        # Soja: pondera 70% supply/price + 30% geopolítico (dependência da China + tensão EUA-China).
        score = int(base_score * 0.7 + geo_score * 0.3)
        result["market_risk_score"] = score
        result["risk_level"] = _risk_level(score)
        result["geopolitical_risk"] = {
            "geopolitical_risk_score": geo_score,
            "risk_level": _risk_level(geo_score),
            "china_export_share_pct": GEOPOLITICAL_SOY_DATA["china_export_share_pct"],
            "us_china_tariff_pct": GEOPOLITICAL_SOY_DATA["us_china_tariff_pct"],
            "trade_war_since": GEOPOLITICAL_SOY_DATA["trade_war_since"],
            "diversification_targets": GEOPOLITICAL_SOY_DATA["diversification_targets"],
            "findings": _build_geopolitical_findings(destination),
            "recommendations": _build_geopolitical_recommendations(destination),
        }
        result["findings"] = result["findings"] + result["geopolitical_risk"]["findings"]
        result["recommendations"] = result["recommendations"] + result["geopolitical_risk"]["recommendations"]
        return result

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
