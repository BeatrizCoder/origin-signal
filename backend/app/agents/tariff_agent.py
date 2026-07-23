import httpx

NCM_DATA: dict[str, dict] = {
    "coffee": {
        "green":    {"ncm": "0901.11.00", "ii_tec": 10, "ipi": 0,  "description": "Unroasted coffee"},
        "roasted":  {"ncm": "0901.21.00", "ii_tec": 16, "ipi": 5,  "description": "Roasted coffee"},
        "soluble":  {"ncm": "2101.11.00", "ii_tec": 16, "ipi": 10, "description": "Coffee extracts"},
        "default":  {"ncm": "0901.11.00", "ii_tec": 10, "ipi": 0,  "description": "Coffee (general)"},
    },
    "soybeans": {
        "grain":   {"ncm": "1201.90.00", "ii_tec": 6, "ipi": 0, "description": "Soybeans"},
        "oil":     {"ncm": "1507.10.00", "ii_tec": 8, "ipi": 0, "description": "Soybean oil"},
        "meal":    {"ncm": "2304.00.00", "ii_tec": 8, "ipi": 0, "description": "Soybean meal"},
        "default": {"ncm": "1201.90.00", "ii_tec": 6, "ipi": 0, "description": "Soybeans (general)"},
    },
    "fruits": {
        "banana":  {"ncm": "0803.90.00", "ii_tec": 10, "ipi": 0, "description": "Bananas"},
        "mango":   {"ncm": "0804.50.00", "ii_tec": 10, "ipi": 0, "description": "Mangoes"},
        "orange":  {"ncm": "0805.10.00", "ii_tec": 35, "ipi": 0, "description": "Oranges"},
        "grape":   {"ncm": "0806.10.00", "ii_tec": 12, "ipi": 0, "description": "Grapes"},
        "apple":   {"ncm": "0808.10.00", "ii_tec": 10, "ipi": 0, "description": "Apples"},
        "default": {"ncm": "0810.20.00", "ii_tec": 10, "ipi": 0, "description": "Fruits (general)"},
    },
}

TRADE_AGREEMENTS: dict[str, dict] = {
    "Argentina":        {"name": "Mercosul",              "ii_reduction": 100},
    "Uruguay":          {"name": "Mercosul",               "ii_reduction": 100},
    "Paraguay":         {"name": "Mercosul",               "ii_reduction": 100},
    "Chile":            {"name": "ACE 35",                 "ii_reduction": 95},
    "Colombia":         {"name": "ACE 59",                 "ii_reduction": 50},
    "Peru":             {"name": "ACE 58",                 "ii_reduction": 45},
    "European Union":   {"name": "Mercosul-EU (pending)",  "ii_reduction": 0},
    "Germany":          {"name": "Mercosul-EU (pending)",  "ii_reduction": 0},
    "Netherlands":      {"name": "Mercosul-EU (pending)",  "ii_reduction": 0},
    "France":           {"name": "Mercosul-EU (pending)",  "ii_reduction": 0},
    "United States":    {"name": "WTO/MFN",                "ii_reduction": 0},
    "China":            {"name": "WTO/MFN",                "ii_reduction": 0},
}


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    return "High"


class TariffAgent:
    async def analyze(self, commodity: str, origin: str, cif_value_usd: float = 10000) -> dict:
        ncm_info = NCM_DATA.get(commodity, {}).get("default", NCM_DATA["coffee"]["default"])

        agreement = TRADE_AGREEMENTS.get(origin, {"name": "WTO/MFN", "ii_reduction": 0})
        ii_rate = ncm_info["ii_tec"] * (1 - agreement["ii_reduction"] / 100)

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
                brl_rate = r.json()["rates"]["BRL"]
        except Exception:
            brl_rate = 5.20

        cif_brl = cif_value_usd * brl_rate

        ii = cif_brl * (ii_rate / 100)
        ipi = (cif_brl + ii) * (ncm_info["ipi"] / 100)
        pis_cofins = (cif_brl + ii + ipi) * 0.0965
        icms_base = cif_brl + ii + ipi + pis_cofins
        icms = icms_base / (1 - 0.18) * 0.18
        total_taxes = ii + ipi + pis_cofins + icms
        total_landed = cif_brl + total_taxes
        tax_burden_pct = (total_taxes / cif_brl) * 100

        tariff_risk_score = min(100, int(tax_burden_pct * 0.8))

        return {
            "tariff_risk_score": tariff_risk_score,
            "risk_level": _risk_level(tariff_risk_score),
            "ncm_code": ncm_info["ncm"],
            "ncm_description": ncm_info["description"],
            "trade_agreement": agreement["name"],
            "ii_reduction_pct": agreement["ii_reduction"],
            "calculation": {
                "cif_usd": cif_value_usd,
                "cif_brl": round(cif_brl, 2),
                "usd_brl_rate": round(brl_rate, 4),
                "ii_rate_tec": ncm_info["ii_tec"],
                "ii_rate_applied": round(ii_rate, 2),
                "ii_value": round(ii, 2),
                "ipi_rate": ncm_info["ipi"],
                "ipi_value": round(ipi, 2),
                "pis_cofins_value": round(pis_cofins, 2),
                "icms_value": round(icms, 2),
                "total_taxes_brl": round(total_taxes, 2),
                "total_landed_brl": round(total_landed, 2),
                "tax_burden_pct": round(tax_burden_pct, 1),
            },
            "findings": [
                f"NCM {ncm_info['ncm']}: {ncm_info['description']} — TEC rate {ncm_info['ii_tec']}%",
                f"Trade agreement {agreement['name']}: II reduced to {ii_rate:.1f}% (from {ncm_info['ii_tec']}%)"
                if agreement["ii_reduction"] > 0
                else f"No preferential agreement — full TEC rate {ncm_info['ii_tec']}% applies",
                f"Total tax burden: {tax_burden_pct:.1f}% of CIF value (II + IPI + PIS/COFINS + ICMS)",
                f"Estimated landed cost: R$ {total_landed:,.2f} for US$ {cif_value_usd:,} CIF shipment",
                f"ICMS: R$ {icms:,.2f} (18% — São Paulo/Santos standard rate, varies by destination state: "
                "MG/RJ typically 12%, other states 12-18%)",
            ],
            "recommendations": [
                f"Classify under NCM {ncm_info['ncm']} — verify with despachante aduaneiro",
                f"Obtain {agreement['name']} certificate of origin to secure {agreement['ii_reduction']}% II reduction"
                if agreement["ii_reduction"] > 0
                else "No FTA available — budget full TEC tariff burden",
                "File LI (Licença de Importação) in SISCOMEX before shipment",
                f"Budget total landed cost at {tax_burden_pct:.0f}% above CIF value for margin planning",
                "Verify ICMS rate with destination state tax authority (SEFAZ) — São Paulo rate (18%) used as "
                "reference; actual rate depends on importer's state registration and product classification.",
            ],
        }
