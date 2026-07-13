_SUPPLIER_PROFILE = {
    "gps_coverage_pct":    70,
    "deforestation_docs":  False,
    "supply_chain_mapped": True,
}

REGION_VOLUMES = {
    'Cerrado Mineiro': 28.5,      # mil toneladas/ano
    'Sul de Minas': 22.0,
    'Chapada Diamantina': 8.5,
    'Mogiana': 15.0,
    'Zona da Mata': 11.0,
    'Norte PR': 6.5,
    'Triângulo MG': 9.0,
    'Serra Gaúcha': 4.5,
    'Rondônia': 12.0,
    'Planalto Sul': 3.5,
    'Oeste da Bahia': 7.0,
    'Sul ES': 5.5,
}

REGION_RISK_SCORES = {
    'Cerrado Mineiro': 88,
    'Sul de Minas': 76,
    'Chapada Diamantina': 91,
    'Mogiana': 45,
    'Zona da Mata': 62,
    'Norte PR': 28,
    'Triângulo MG': 70,
    'Serra Gaúcha': 22,
    'Rondônia': 82,
    'Planalto Sul': 18,
    'Oeste da Bahia': 74,
    'Sul ES': 48,
}


def calculate_hes(commodity: str = 'coffee') -> dict:
    total_volume = sum(REGION_VOLUMES.values())

    low_risk_volume = sum(
        vol for region, vol in REGION_VOLUMES.items()
        if REGION_RISK_SCORES.get(region, 50) < 40
    )
    mid_risk_volume = sum(
        vol for region, vol in REGION_VOLUMES.items()
        if 40 <= REGION_RISK_SCORES.get(region, 50) < 70
    )
    high_risk_volume = sum(
        vol for region, vol in REGION_VOLUMES.items()
        if REGION_RISK_SCORES.get(region, 50) >= 70
    )

    hes = round((low_risk_volume / total_volume) * 100, 1)

    # Células por nível de risco
    low_cells = [r for r, s in REGION_RISK_SCORES.items() if s < 40]
    mid_cells = [r for r, s in REGION_RISK_SCORES.items() if 40 <= s < 70]
    high_cells = [r for r, s in REGION_RISK_SCORES.items() if s >= 70]

    # Células críticas que mais impactam o HES
    critical_cells = sorted(
        [(r, REGION_RISK_SCORES[r], REGION_VOLUMES[r])
         for r in high_cells],
        key=lambda x: x[2], reverse=True
    )[:3]

    # Potencial HES se as 3 células críticas fossem regularizadas
    potential_hes = round(
        ((low_risk_volume + sum(v for _, _, v in critical_cells)) / total_volume) * 100, 1
    )

    return {
        'hes_score': hes,
        'hes_label': 'Critical' if hes < 30 else 'Low' if hes < 50 else 'Moderate' if hes < 70 else 'Good',
        'total_volume_kt': round(total_volume, 1),
        'low_risk_volume_kt': round(low_risk_volume, 1),
        'mid_risk_volume_kt': round(mid_risk_volume, 1),
        'high_risk_volume_kt': round(high_risk_volume, 1),
        'low_risk_cells': len(low_cells),
        'mid_risk_cells': len(mid_cells),
        'high_risk_cells': len(high_cells),
        'total_cells': len(REGION_VOLUMES),
        'critical_cells': [
            {'region': r, 'risk_score': s, 'volume_kt': v}
            for r, s, v in critical_cells
        ],
        'potential_hes': potential_hes,
        'potential_gain': round(potential_hes - hes, 1),
        'insight': f"Only {hes}% of exportable volume is in low-risk cells. "
                   f"Regularizing {critical_cells[0][0] if critical_cells else 'critical regions'} "
                   f"could increase HES to {potential_hes}% (+{round(potential_hes-hes,1)}pp)."
    }


def _risk_level(score: int) -> str:
    if score < 30:  return "Low"
    if score <= 60: return "Medium"
    if score <= 80: return "High"
    return "Critical"


class GapAgent:
    async def analyze(self, regulatory_result: dict, commodity: str) -> dict:
        profile = _SUPPLIER_PROFILE.copy()

        score = 0
        gaps: list[str] = []

        if profile["gps_coverage_pct"] < 100:
            missing = 100 - profile["gps_coverage_pct"]
            score += 40
            gaps.append(
                f"GPS coverage is {profile['gps_coverage_pct']}% — EUDR requires 100% plot-level geolocation. "
                f"{missing}% of production area lacks coordinates (Annex I requirement)."
            )

        if not profile["deforestation_docs"]:
            score += 35
            gaps.append(
                "Deforestation-free documentation is missing — EUDR Article 3 prohibits placing products "
                "on the EU market without verified deforestation-free proof."
            )

        if not profile["supply_chain_mapped"]:
            score += 25
            gaps.append(
                "Supply chain is not fully mapped — EUDR Article 8 requires operators to document all "
                "business entities from production to first placement on EU market."
            )

        score = max(0, min(100, score))

        recommendations = []
        if profile["gps_coverage_pct"] < 100:
            recommendations.append(
                "Deploy GPS mapping initiative across all production plots within 90 days; "
                "use tools like AGROTOOLS or AGROSMART for rapid coverage."
            )
        if not profile["deforestation_docs"]:
            recommendations.append(
                "Obtain deforestation-free certificates from accredited verifiers (e.g., Rainforest Alliance, "
                "4C Association) before next export cycle."
            )
        if not profile["supply_chain_mapped"]:
            recommendations.append(
                "Conduct supply chain mapping exercise with all intermediaries; collect name, address, "
                "and email contacts as required by EUDR Annex I."
            )
        recommendations.append(
            "Implement a digital due diligence management system to track EUDR compliance status continuously."
        )

        gps_days_needed  = round((100 - profile["gps_coverage_pct"]) * 0.38)
        docs_days_needed = 45 if not profile["deforestation_docs"] else 0

        return {
            "gap_risk_score":   score,
            "risk_level":       _risk_level(score),
            "supplier_profile": profile,
            "gaps_identified":  gaps,
            "recommendations":  recommendations,
            "action_timeline": {
                "gps_mapping_days":    gps_days_needed,
                "documentation_days":  docs_days_needed,
            },
        }
