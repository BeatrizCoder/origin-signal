_SUPPLIER_PROFILE = {
    "gps_coverage_pct":    70,
    "deforestation_docs":  False,
    "supply_chain_mapped": True,
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

        return {
            "gap_risk_score":   score,
            "risk_level":       _risk_level(score),
            "supplier_profile": profile,
            "gaps_identified":  gaps,
            "recommendations":  recommendations,
        }
