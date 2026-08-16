"""Validates /api/analyze input before it enters the agent pipeline.

Blocking problems go in `issues` (422). Non-blocking oddities go in
`warnings` and are surfaced to the UI but don't stop the analysis.
"""


class DataQualityAgent:

    VALID_COMMODITIES = ['coffee', 'soybeans', 'fruits']

    VALID_EXPORT_DESTINATIONS = [
        'European Union', 'Germany', 'Netherlands', 'France', 'Norway',
        'Switzerland', 'United Kingdom', 'United States', 'China', 'Japan',
        'South Korea', 'Saudi Arabia', 'UAE', 'Argentina', 'Uruguay',
        'Paraguay', 'Colombia', 'Peru', 'Chile', 'Mexico',
    ]

    VALID_IMPORT_ORIGINS = [
        'United States', 'China', 'European Union', 'Norway', 'Switzerland',
        'United Kingdom', 'Argentina', 'Colombia', 'Peru', 'Chile',
        'Uruguay', 'Paraguay', 'Vietnam', 'Ethiopia',
    ]

    VALID_TIME_HORIZONS = ['30', '90', '365']

    CIF_BOUNDS = {'min': 100, 'max': 50_000_000}

    def validate(self, payload: dict) -> dict:
        issues = []
        warnings = []

        commodity = (payload.get('commodity') or '').lower()
        if commodity not in self.VALID_COMMODITIES:
            issues.append(f"Invalid commodity '{commodity}'. Valid: {self.VALID_COMMODITIES}")

        direction = payload.get('trade_direction', '')
        if direction not in ['export', 'import']:
            issues.append(f"Invalid trade_direction '{direction}'. Must be 'export' or 'import'")

        if direction == 'import':
            origin = payload.get('origin', '')
            if origin not in self.VALID_IMPORT_ORIGINS:
                warnings.append(f"Origin '{origin}' not in standard import origins list — limited regulatory data available")

        if direction == 'export':
            destination = payload.get('destination', '')
            if destination not in self.VALID_EXPORT_DESTINATIONS:
                warnings.append(f"Destination '{destination}' not in standard export destinations — limited data available")

        # Only checked when the caller actually sends a time horizon — the
        # /analyze request schema doesn't collect one today, so a missing
        # key is not itself a quality problem.
        if 'time_horizon' in payload:
            horizon = str(payload.get('time_horizon', ''))
            if horizon not in self.VALID_TIME_HORIZONS:
                warnings.append(f"Time horizon '{horizon}' unusual. Standard: 30, 90, 365 days")
        else:
            horizon = ''

        cif = payload.get('cif_value_usd', 10000)
        if not isinstance(cif, (int, float)):
            issues.append(f"CIF value must be numeric, got {type(cif)}")
        elif cif < self.CIF_BOUNDS['min']:
            warnings.append(f"CIF value {cif} seems very low (min expected: {self.CIF_BOUNDS['min']})")
        elif cif > self.CIF_BOUNDS['max']:
            warnings.append(f"CIF value {cif} seems very high (max expected: {self.CIF_BOUNDS['max']:,})")

        if direction == 'export' and payload.get('origin') == payload.get('destination'):
            issues.append("Origin and destination cannot be the same country")

        if commodity == 'soybeans' and direction == 'import':
            origin = payload.get('origin', '')
            if origin not in ['United States', 'Argentina', 'Paraguay']:
                warnings.append(f"Soybeans import from {origin} is unusual — Brazil is typically an exporter")

        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'quality_score': 1.0 if not issues and not warnings else 0.8 if not issues else 0.4,
            'payload_summary': {
                'commodity': commodity,
                'direction': direction,
                'origin': payload.get('origin', 'Brazil'),
                'destination': payload.get('destination', ''),
                'time_horizon': horizon,
                'cif_value': cif,
            },
        }
