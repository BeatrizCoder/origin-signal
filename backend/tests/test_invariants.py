"""
Invariant tests for the deterministic calculation layer — properties that must
always hold regardless of input, independent of the golden dataset's specific
reference values.
"""
import pytest
from app.agents.tariff_agent import TariffAgent
from app.agents.gap_agent import calculate_hes, optimize_honeycomb

# Mirrors the inline weights in app/api/routes.py (composite score calculation,
# export branch ~line 143-149 / import branch ~line 134-141). Kept as literal
# constants here since routes.py computes them inline rather than exposing a
# single importable source of truth.
EXPORT_WEIGHTS = {'regulatory': 0.30, 'climate': 0.25, 'market': 0.20, 'logistics': 0.15, 'gap': 0.10}
IMPORT_WEIGHTS = {'regulatory': 0.25, 'climate': 0.20, 'market': 0.15, 'logistics': 0.15, 'tariff': 0.15, 'gap': 0.10}


def test_export_weights_sum_to_one():
    total = sum(EXPORT_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9, f"Export weights sum to {total}, expected 1.0"


def test_import_weights_sum_to_one():
    total = sum(IMPORT_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9, f"Import weights sum to {total}, expected 1.0"


def test_hes_bounds():
    for commodity in ['coffee', 'soybeans', 'fruits']:
        for direction in ['export', 'import']:
            result = calculate_hes(commodity, direction)
            assert 0 <= result['hes_score'] <= 100, \
                f"HES out of bounds for {commodity}/{direction}: {result['hes_score']}"
            assert 0 <= result['potential_hes'] <= 100, \
                f"Potential HES out of bounds: {result['potential_hes']}"
            assert result['potential_hes'] >= result['hes_score'], \
                f"Potential HES < current HES for {commodity}/{direction}"


def test_optimizer_monotonic():
    """Maior orcamento nao deve produzir menor cobertura"""
    result_small = optimize_honeycomb(budget_brl=200000)
    result_large = optimize_honeycomb(budget_brl=1000000)
    assert result_large['total_unlock_kt'] >= result_small['total_unlock_kt'], \
        "Larger budget produced less unlocked volume — monotonicity violated"
    assert result_large['projected_hes'] >= result_small['projected_hes'], \
        "Larger budget produced lower HES — monotonicity violated"


@pytest.mark.asyncio
async def test_tariff_invariants():
    agent = TariffAgent()
    test_cases = [
        ('coffee', 'Argentina', 10000),
        ('coffee', 'United States', 10000),
        ('soybeans', 'China', 50000),
    ]
    for commodity, origin, cif in test_cases:
        result = await agent.analyze(commodity, origin, cif)
        calc = result['calculation']

        assert calc['total_landed_brl'] >= calc['cif_brl'], \
            f"Landed cost < CIF for {commodity}/{origin}"

        assert calc['ii_value'] >= 0, f"II negative for {commodity}/{origin}"
        assert calc['pis_cofins_value'] >= 0
        assert calc['icms_value'] >= 0

        assert 0 <= result['tariff_risk_score'] <= 100, \
            f"Tariff risk score out of bounds: {result['tariff_risk_score']}"

        assert 0 <= calc['tax_burden_pct'] <= 100, \
            f"Tax burden out of bounds: {calc['tax_burden_pct']}"

        print(f"OK Invariants: {commodity}/{origin} - landed R${calc['total_landed_brl']:,.2f}")
