import math

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

# Mapa de adjacência — cada região e suas vizinhas geográficas reais
REGION_ADJACENCY = {
    'Cerrado Mineiro': ['Triângulo MG', 'Sul de Minas', 'Zona da Mata', 'Oeste da Bahia'],
    'Sul de Minas': ['Cerrado Mineiro', 'Mogiana', 'Zona da Mata'],
    'Chapada Diamantina': ['Oeste da Bahia'],
    'Mogiana': ['Sul de Minas', 'Norte PR'],
    'Zona da Mata': ['Cerrado Mineiro', 'Sul de Minas', 'Sul ES'],
    'Norte PR': ['Mogiana', 'Serra Gaúcha'],
    'Triângulo MG': ['Cerrado Mineiro', 'Rondônia'],
    'Serra Gaúcha': ['Norte PR', 'Planalto Sul'],
    'Rondônia': ['Triângulo MG'],
    'Planalto Sul': ['Serra Gaúcha'],
    'Oeste da Bahia': ['Cerrado Mineiro', 'Chapada Diamantina'],
    'Sul ES': ['Zona da Mata'],
}

# Fatores de propagação por tipo de risco
PROPAGATION_FACTORS = {
    'climate': 0.35,      # seca/chuva se propaga forte entre vizinhos
    'regulatory': 0.10,   # regulação tem algum efeito regional
    'market': 0.20,       # preço de mercado propaga moderadamente
    'logistics': 0.05,    # logística pouco se propaga
}


def calculate_propagation(
    region_scores: dict,  # {region: {regulatory, climate, market, logistics}}
    commodity: str = 'coffee'
) -> dict:

    propagated = {}

    for region in REGION_ADJACENCY:
        neighbors = REGION_ADJACENCY[region]
        base = region_scores.get(region, {
            'regulatory': REGION_RISK_SCORES.get(region, 50),
            'climate': 50, 'market': 50, 'logistics': 20
        })

        # Calcula impacto dos vizinhos
        neighbor_impact = {'regulatory': 0, 'climate': 0, 'market': 0, 'logistics': 0}

        for neighbor in neighbors:
            n_scores = region_scores.get(neighbor, {
                'regulatory': REGION_RISK_SCORES.get(neighbor, 50),
                'climate': 50, 'market': 50, 'logistics': 20
            })
            for dim in ['regulatory', 'climate', 'market', 'logistics']:
                factor = PROPAGATION_FACTORS[dim]
                n_score = n_scores.get(dim, 50)
                base_score = base.get(dim, 50)
                # Propaga apenas se vizinho tem score MAIOR (risco mais alto)
                if n_score > base_score:
                    neighbor_impact[dim] += (n_score - base_score) * factor / len(neighbors)

        # Score propagado = base + impacto dos vizinhos (max 100)
        propagated[region] = {
            dim: min(100, round(base.get(dim, 50) + neighbor_impact[dim]))
            for dim in ['regulatory', 'climate', 'market', 'logistics']
        }
        propagated[region]['composite'] = round(
            propagated[region]['regulatory'] * 0.30 +
            propagated[region]['climate'] * 0.25 +
            propagated[region]['market'] * 0.20 +
            propagated[region]['logistics'] * 0.15 +
            base.get('gap', 50) * 0.10
        )

        # Identifica quais vizinhos estão propagando risco
        propagated[region]['risk_sources'] = [
            n for n in neighbors
            if REGION_RISK_SCORES.get(n, 50) > REGION_RISK_SCORES.get(region, 50) + 10
        ]
        propagated[region]['propagation_alert'] = len(propagated[region]['risk_sources']) > 0

    # Regiões mais afetadas por propagação
    most_affected = sorted(
        [(r, propagated[r]['composite']) for r in propagated],
        key=lambda x: x[1], reverse=True
    )[:3]

    return {
        'region_scores': propagated,
        'most_affected_by_propagation': [
            {'region': r, 'composite_score': s,
             'risk_sources': propagated[r]['risk_sources']}
            for r, s in most_affected
        ],
        'propagation_active': any(
            propagated[r]['propagation_alert'] for r in propagated
        ),
        'insight': generate_propagation_insight(propagated, most_affected)
    }


def generate_propagation_insight(propagated, most_affected):
    alerts = [r for r in propagated if propagated[r]['propagation_alert']]
    if not alerts:
        return "No significant risk propagation detected between adjacent regions."
    top = most_affected[0] if most_affected else None
    sources = propagated[top[0]]['risk_sources'] if top else []
    return (
        f"{len(alerts)} regions affected by neighbor propagation. "
        f"{top[0] if top else ''} shows elevated composite risk ({top[1] if top else 0}/100) "
        f"influenced by adjacent {', '.join(sources[:2]) if sources else 'regions'}."
    )


# Custo estimado de regularização por região (R$ mil)
REGION_REGULARIZATION_COST = {
    'Cerrado Mineiro': 180,      # grande área, alto custo GPS + docs
    'Sul de Minas': 140,
    'Chapada Diamantina': 95,
    'Mogiana': 80,
    'Zona da Mata': 75,
    'Norte PR': 45,
    'Triângulo MG': 110,
    'Serra Gaúcha': 40,
    'Rondônia': 200,             # logística difícil, alto custo
    'Planalto Sul': 35,
    'Oeste da Bahia': 120,
    'Sul ES': 55,
}

# Volume que seria desbloqueado ao regularizar cada região
# (volume da região × % não conforme estimada)
REGION_UNLOCK_POTENTIAL = {
    'Cerrado Mineiro': 20.0,    # 70% de 28.5kt não conformes
    'Sul de Minas': 15.4,
    'Chapada Diamantina': 8.5,
    'Mogiana': 3.0,
    'Zona da Mata': 5.5,
    'Norte PR': 0.5,
    'Triângulo MG': 7.2,
    'Serra Gaúcha': 0.5,
    'Rondônia': 10.8,
    'Planalto Sul': 0.3,
    'Oeste da Bahia': 6.3,
    'Sul ES': 2.2,
}


# Coordenadas reais das regiões (lat, lon)
REGION_COORDS = {
    'Cerrado Mineiro': (-19.1, -46.5),
    'Sul de Minas': (-21.5, -45.3),
    'Chapada Diamantina': (-12.4, -41.6),
    'Mogiana': (-20.7, -47.1),
    'Zona da Mata': (-20.3, -42.4),
    'Norte PR': (-23.1, -50.2),
    'Triângulo MG': (-18.5, -48.2),
    'Serra Gaúcha': (-29.1, -51.5),
    'Rondônia': (-10.8, -62.4),
    'Planalto Sul': (-27.5, -50.8),
    'Oeste da Bahia': (-12.2, -44.9),
    'Sul ES': (-20.6, -41.0),
}


def optimize_honeycomb(budget_brl: float, commodity: str = 'coffee') -> dict:
    """
    Algoritmo greedy de otimização — maximiza volume desbloqueado por R$ investido.
    Seleciona regiões por ROI (kt desbloqueado / R$ mil investido) até esgotar orçamento.
    """

    # Calcula ROI por região
    regions_roi = []
    for region in REGION_REGULARIZATION_COST:
        cost = REGION_REGULARIZATION_COST[region]
        unlock = REGION_UNLOCK_POTENTIAL.get(region, 0)
        risk = REGION_RISK_SCORES.get(region, 50)

        # Só considera regiões com risco alto (>= 40) e volume significativo
        if risk >= 40 and unlock > 0:
            roi = unlock / cost  # kt por R$ mil
            regions_roi.append({
                'region': region,
                'cost_brl_k': cost,
                'unlock_kt': unlock,
                'current_risk': risk,
                'roi': round(roi, 4),
                'priority': 0
            })

    # Ordena por ROI decrescente (greedy)
    regions_roi.sort(key=lambda x: x['roi'], reverse=True)

    # Seleciona regiões dentro do orçamento
    selected = []
    remaining_budget = budget_brl / 1000  # converte para R$ mil
    total_unlock = 0
    total_cost = 0

    for region in regions_roi:
        if remaining_budget >= region['cost_brl_k']:
            region['priority'] = len(selected) + 1
            selected.append(region)
            remaining_budget -= region['cost_brl_k']
            total_unlock += region['unlock_kt']
            total_cost += region['cost_brl_k']

    # Calcula HES atual e pós-otimização
    current_hes = calculate_hes(commodity)
    total_volume = current_hes['total_volume_kt']
    current_safe = current_hes['low_risk_volume_kt']
    projected_safe = min(total_volume, current_safe + total_unlock)
    projected_hes = round((projected_safe / total_volume) * 100, 1)

    # Regiões excluídas por orçamento insuficiente
    excluded = [r for r in regions_roi if r['priority'] == 0]

    return {
        'budget_brl': budget_brl,
        'budget_used_brl': round(total_cost * 1000, 2),
        'budget_remaining_brl': round((budget_brl / 1000 - total_cost) * 1000, 2),
        'selected_regions': selected,
        'excluded_regions': excluded[:3],  # top 3 excluídas
        'total_regions_selected': len(selected),
        'total_unlock_kt': round(total_unlock, 1),
        'current_hes': current_hes['hes_score'],
        'projected_hes': projected_hes,
        'hes_gain': round(projected_hes - current_hes['hes_score'], 1),
        'roi_summary': f"R$ {budget_brl:,.0f} investment unlocks {total_unlock:.1f}kt of safe exports, "
                      f"improving HES from {current_hes['hes_score']}% to {projected_hes}%",
        'mathematical_basis': 'Greedy optimization over hexagonal adjacency graph — maximizes coverage efficiency per unit of resource (Honeycomb Conjecture applied to resource allocation)'
    }


def haversine_distance(coord1, coord2):
    """Distância em km entre dois pontos geográficos"""
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371 * 2 * math.asin(math.sqrt(a))


def calculate_minimum_coverage_path(
    target_coverage_pct: float = 80.0,
    start_region: str = 'Cerrado Mineiro',
    commodity: str = 'coffee'
) -> dict:
    """
    Nearest neighbor heuristic para TSP sobre malha hexagonal.
    Seleciona regiões de alto risco+volume e encontra rota mínima entre elas.
    """

    total_volume = sum(REGION_VOLUMES.values())
    target_volume = total_volume * (target_coverage_pct / 100)

    # Regiões prioritárias para auditoria (alto risco E alto volume)
    audit_candidates = [
        {
            'region': r,
            'risk': REGION_RISK_SCORES.get(r, 50),
            'volume': REGION_VOLUMES.get(r, 0),
            'unlock': REGION_UNLOCK_POTENTIAL.get(r, 0),
            'coords': REGION_COORDS.get(r, (-15, -47)),
            'priority_score': REGION_RISK_SCORES.get(r, 50) * 0.6 +
                            (REGION_VOLUMES.get(r, 0) / max(REGION_VOLUMES.values())) * 40
        }
        for r in REGION_RISK_SCORES
        if REGION_RISK_SCORES.get(r, 50) >= 40
    ]

    # Ordena por priority_score
    audit_candidates.sort(key=lambda x: x['priority_score'], reverse=True)

    # Seleciona regiões até atingir cobertura alvo
    selected = []
    covered_volume = 0
    remaining = audit_candidates.copy()
    current_pos = REGION_COORDS.get(start_region, (-19.1, -46.5))
    current_region = start_region

    # Adiciona start_region se não estiver nos candidatos
    start_data = next((c for c in audit_candidates if c['region'] == start_region), None)
    if start_data:
        selected.append(start_data)
        covered_volume += start_data['volume']
        remaining = [r for r in remaining if r['region'] != start_region]

    # Nearest neighbor com peso de prioridade
    while covered_volume < target_volume and remaining:
        # Escolhe próximo por: menor distância E maior prioridade
        best = min(remaining, key=lambda r: (
            haversine_distance(current_pos, r['coords']) * 0.4 -
            r['priority_score'] * 0.6
        ))
        selected.append(best)
        covered_volume += best['volume']
        current_pos = best['coords']
        current_region = best['region']
        remaining = [r for r in remaining if r['region'] != best['region']]

    # Calcula distância total da rota
    total_distance = 0
    route_segments = []
    for i in range(len(selected) - 1):
        dist = haversine_distance(
            selected[i]['coords'],
            selected[i+1]['coords']
        )
        total_distance += dist
        route_segments.append({
            'from': selected[i]['region'],
            'to': selected[i+1]['region'],
            'distance_km': round(dist),
            'transport': 'road' if dist < 500 else 'flight'
        })

    # Estima dias de auditoria (2 dias por região + viagem)
    audit_days = len(selected) * 2 + len([s for s in route_segments if s['transport'] == 'flight'])

    # Custo estimado da missão de auditoria
    flight_cost = len([s for s in route_segments if s['transport'] == 'flight']) * 800
    daily_cost = audit_days * 450  # R$ 450/dia auditor
    total_mission_cost = flight_cost + daily_cost

    # Vs custo de não regularizar (multas EUDR estimadas)
    eudr_fine_risk = covered_volume * 50000  # R$ 50k por kt de risco

    volume_covered_kt = sum(r['volume'] for r in selected)
    volume_unlocked_kt = sum(r['unlock'] for r in selected)
    achieved_coverage_pct = round((volume_covered_kt / total_volume) * 100, 1)

    return {
        'target_coverage_pct': target_coverage_pct,
        'achieved_coverage_pct': achieved_coverage_pct,
        'start_region': start_region,
        'route': [
            {
                'stop': i + 1,
                'region': r['region'],
                'risk_score': r['risk'],
                'volume_kt': r['volume'],
                'unlock_kt': r['unlock'],
                'coords': {'lat': r['coords'][0], 'lon': r['coords'][1]},
                'days_on_site': 2
            }
            for i, r in enumerate(selected)
        ],
        'route_segments': route_segments,
        'total_distance_km': round(total_distance),
        'total_stops': len(selected),
        'audit_days': audit_days,
        'mission_cost_brl': round(total_mission_cost),
        'eudr_fine_risk_brl': round(eudr_fine_risk),
        'roi_ratio': round(eudr_fine_risk / max(total_mission_cost, 1), 1),
        'volume_covered_kt': round(volume_covered_kt, 1),
        'volume_unlocked_kt': round(volume_unlocked_kt, 1),
        'mathematical_basis': 'Nearest-neighbor heuristic for TSP on hexagonal adjacency graph — minimizes total audit path while maximizing EUDR compliance coverage (Honeycomb Conjecture applied to audit logistics)',
        'insight': (
            f"Audit covers {volume_covered_kt:.1f}kt ({achieved_coverage_pct:.1f}% of total volume) "
            f"across {len(selected)} regions in {audit_days} days. "
            f"Expected regularization: {volume_unlocked_kt:.1f}kt unlocked for safe export. "
            f"Mission cost R$ {total_mission_cost:,.0f} vs R$ {eudr_fine_risk:,.0f} EUDR fine risk "
            f"(ROI: {round(eudr_fine_risk/max(total_mission_cost,1), 1)}x)."
        )
    }


COFFEE_VOLUMES = REGION_VOLUMES
COFFEE_RISK_SCORES = REGION_RISK_SCORES

SOYBEAN_VOLUMES = {
    'Mato Grosso': 35.8, 'Mato Grosso do Sul': 12.4, 'Paraná': 22.1,
    'Rio Grande do Sul': 18.6, 'Goiás': 14.2, 'Bahia Oeste': 8.9,
    'Maranhão': 5.4, 'Tocantins': 4.8, 'Minas Gerais': 6.2,
}

SOYBEAN_RISK_SCORES = {
    'Mato Grosso': 72, 'Mato Grosso do Sul': 58, 'Paraná': 35,
    'Rio Grande do Sul': 28, 'Goiás': 62, 'Bahia Oeste': 85,
    'Maranhão': 88, 'Tocantins': 75, 'Minas Gerais': 48,
}

FRUITS_VOLUMES = {
    'São Paulo': 18.4, 'Vale São Francisco': 22.6, 'Santa Catarina': 8.2,
    'Espírito Santo': 7.5, 'Bahia': 12.8, 'Rio Grande do Norte': 6.4,
    'Pernambuco': 9.2, 'Ceará': 5.8,
}

FRUITS_RISK_SCORES = {
    'São Paulo': 42, 'Vale São Francisco': 55, 'Santa Catarina': 25,
    'Espírito Santo': 48, 'Bahia': 65, 'Rio Grande do Norte': 50,
    'Pernambuco': 58, 'Ceará': 52,
}

# Import mode — países como células
IMPORT_ORIGIN_VOLUMES = {
    'Argentina': 45.0, 'Colombia': 28.5, 'Peru': 12.4,
    'Chile': 18.6, 'United States': 22.8, 'China': 35.2,
    'European Union': 42.1, 'Uruguay': 8.4, 'Paraguay': 15.6,
}

IMPORT_ORIGIN_RISK_SCORES = {
    'Argentina': 25, 'Colombia': 45, 'Peru': 48,
    'Chile': 30, 'United States': 62, 'China': 75,
    'European Union': 35, 'Uruguay': 20, 'Paraguay': 22,
}


def calculate_hes(commodity: str = 'coffee', trade_direction: str = 'export') -> dict:
    # Seleciona dataset baseado em commodity e direção
    if trade_direction == 'import':
        volumes = IMPORT_ORIGIN_VOLUMES
        risk_scores = IMPORT_ORIGIN_RISK_SCORES
        context_label = 'Import Origins'
    elif commodity == 'soybeans':
        volumes = SOYBEAN_VOLUMES
        risk_scores = SOYBEAN_RISK_SCORES
        context_label = 'Soybean Regions'
    elif commodity == 'fruits':
        volumes = FRUITS_VOLUMES
        risk_scores = FRUITS_RISK_SCORES
        context_label = 'Fruit Regions'
    else:  # coffee (default)
        volumes = COFFEE_VOLUMES
        risk_scores = COFFEE_RISK_SCORES
        context_label = 'Coffee Regions'

    total_volume = sum(volumes.values())

    low_risk_volume = sum(
        vol for region, vol in volumes.items()
        if risk_scores.get(region, 50) < 40
    )
    mid_risk_volume = sum(
        vol for region, vol in volumes.items()
        if 40 <= risk_scores.get(region, 50) < 70
    )
    high_risk_volume = sum(
        vol for region, vol in volumes.items()
        if risk_scores.get(region, 50) >= 70
    )

    hes = round((low_risk_volume / total_volume) * 100, 1)

    # Células por nível de risco
    low_cells = [r for r, s in risk_scores.items() if s < 40]
    mid_cells = [r for r, s in risk_scores.items() if 40 <= s < 70]
    high_cells = [r for r, s in risk_scores.items() if s >= 70]

    # Células críticas que mais impactam o HES
    critical_cells = sorted(
        [(r, risk_scores[r], volumes[r])
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
        'context_label': context_label,
        'commodity': commodity,
        'trade_direction': trade_direction,
        'total_volume_kt': round(total_volume, 1),
        'low_risk_volume_kt': round(low_risk_volume, 1),
        'mid_risk_volume_kt': round(mid_risk_volume, 1),
        'high_risk_volume_kt': round(high_risk_volume, 1),
        'low_risk_cells': len(low_cells),
        'mid_risk_cells': len(mid_cells),
        'high_risk_cells': len(high_cells),
        'total_cells': len(volumes),
        'critical_cells': [
            {'region': r, 'risk_score': s, 'volume_kt': v}
            for r, s, v in critical_cells
        ],
        'potential_hes': potential_hes,
        'potential_gain': round(potential_hes - hes, 1),
        'insight': f"Only {hes}% of {'importable' if trade_direction == 'import' else 'exportable'} volume "
                   f"is in low-risk {'origins' if trade_direction == 'import' else 'cells'}. "
                   f"{'Diversifying away from' if trade_direction == 'import' else 'Regularizing'} "
                   f"{critical_cells[0][0] if critical_cells else 'critical regions'} "
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
