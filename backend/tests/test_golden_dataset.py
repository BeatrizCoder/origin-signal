"""
Golden dataset — reference scenarios for the deterministic tariff calculation layer.

Expected tax_burden_pct values are calibrated against the actual formula in
TariffAgent.analyze() (app/agents/tariff_agent.py), which applies a gross-up
ICMS calculation (icms_base / (1 - 0.18) * 0.18) on top of II + IPI + PIS/COFINS.
Because every tax component scales linearly with cif_brl, tax_burden_pct is
independent of the USD/BRL exchange rate — these ranges are stable regardless
of the live rate fetched at runtime (or its 5.20 fallback).
"""
import pytest
from app.agents.tariff_agent import TariffAgent

GOLDEN_TARIFF_SCENARIOS = [
    {
        'name': 'Coffee green - Argentina (Mercosul 100% reduction)',
        'commodity': 'coffee',
        'origin': 'Argentina',
        'cif_usd': 10000,
        'expected_ii_reduction_pct': 100,
        'expected_ii_brl': 0,
        'expected_tax_burden_pct_range': (32, 35),  # PIS/COFINS + gross-up ICMS, no II
    },
    {
        'name': 'Coffee green - Colombia (ACE 59 50% reduction)',
        'commodity': 'coffee',
        'origin': 'Colombia',
        'cif_usd': 10000,
        'expected_ii_reduction_pct': 50,
        'expected_tax_burden_pct_range': (39, 42),
    },
    {
        'name': 'Coffee green - United States (WTO/MFN full tariff)',
        'commodity': 'coffee',
        'origin': 'United States',
        'cif_usd': 10000,
        'expected_ii_reduction_pct': 0,
        'expected_tax_burden_pct_range': (45, 49),
    },
    {
        'name': 'Coffee green - China (WTO/MFN full tariff)',
        'commodity': 'coffee',
        'origin': 'China',
        'cif_usd': 10000,
        'expected_ii_reduction_pct': 0,
        'expected_tax_burden_pct_range': (45, 49),
    },
    {
        'name': 'Coffee green - European Union (WTO/MFN)',
        'commodity': 'coffee',
        'origin': 'European Union',
        'cif_usd': 10000,
        'expected_ii_reduction_pct': 0,
        'expected_tax_burden_pct_range': (45, 49),
    },
    {
        'name': 'Soybeans - Argentina (Mercosul 100%)',
        'commodity': 'soybeans',
        'origin': 'Argentina',
        'cif_usd': 10000,
        'expected_ii_reduction_pct': 100,
        'expected_tax_burden_pct_range': (32, 35),
    },
]


@pytest.mark.asyncio
async def test_golden_tariff_scenarios():
    agent = TariffAgent()
    for scenario in GOLDEN_TARIFF_SCENARIOS:
        result = await agent.analyze(
            commodity=scenario['commodity'],
            origin=scenario['origin'],
            cif_value_usd=scenario['cif_usd'],
        )
        calc = result['calculation']

        assert result['ii_reduction_pct'] == scenario['expected_ii_reduction_pct'], \
            f"{scenario['name']}: expected II reduction {scenario['expected_ii_reduction_pct']}%, got {result['ii_reduction_pct']}%"

        if 'expected_ii_brl' in scenario:
            assert calc['ii_value'] == scenario['expected_ii_brl'], \
                f"{scenario['name']}: expected II value {scenario['expected_ii_brl']}, got {calc['ii_value']}"

        low, high = scenario['expected_tax_burden_pct_range']
        burden = calc['tax_burden_pct']
        assert low <= burden <= high, \
            f"{scenario['name']}: tax burden {burden:.1f}% outside expected range [{low}%, {high}%]"

        print(f"OK {scenario['name']}: II reduction={result['ii_reduction_pct']}%, burden={burden:.1f}%")
