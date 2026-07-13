export interface AnalyzeRequest {
  query: string;
  commodity: string;
  origin: string;
  destination: string;
  origin_region?: string;
  trade_direction?: 'export' | 'import';
}

export interface RegulationResult {
  risk_score: number;
  risk_level: string;
  findings: string[];
  articles_cited: string[];
  recommendations: string[];
}

export interface ClimateResult {
  climate_risk_score: number;
  risk_level: string;
  current_conditions: {
    temp_max: number;
    temp_min: number;
    precipitation_forecast: number;
    days_above_35c: number;
  };
  findings: string[];
  recommendations: string[];
  region_coords: { lat: number; lon: number };
}

export interface MarketResult {
  market_risk_score: number;
  risk_level: string;
  price_trend: string;
  supply_demand: {
    global_supply_index: number;
    demand_eu: string;
  };
  findings: string[];
  recommendations: string[];
}

export interface LogisticsResult {
  logistics_risk_score: number;
  risk_level: string;
  origin_port: string;
  destination_port: string;
  estimated_transit_days: number;
  findings: string[];
  recommendations: string[];
}

export interface TariffCalculation {
  cif_usd: number;
  cif_brl: number;
  usd_brl_rate: number;
  ii_rate_tec: number;
  ii_rate_applied: number;
  ii_value: number;
  ipi_rate: number;
  ipi_value: number;
  pis_cofins_value: number;
  icms_value: number;
  total_taxes_brl: number;
  total_landed_brl: number;
  tax_burden_pct: number;
}

export interface TariffResult {
  tariff_risk_score: number;
  risk_level: string;
  ncm_code: string | null;
  ncm_description: string | null;
  trade_agreement: string | null;
  ii_reduction_pct: number;
  calculation: TariffCalculation | Record<string, never>;
  findings: string[];
  recommendations: string[];
}

export interface GapResult {
  gap_risk_score: number;
  risk_level: string;
  supplier_profile: {
    gps_coverage_pct: number;
    deforestation_docs: boolean;
    supply_chain_mapped: boolean;
  };
  gaps_identified: string[];
  recommendations: string[];
}

export interface KeyRisk {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface RecommendedAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  timeline: string;
}

export interface ExecutiveResult {
  executive_summary: string;
  key_risks: KeyRisk[];
  recommended_actions: RecommendedAction[];
  trade_window: string;
  overall_verdict: 'Go' | 'Caution' | 'Hold';
}

export interface AnalyzeResponse {
  regulatory: RegulationResult;
  climate: ClimateResult;
  market: MarketResult;
  logistics: LogisticsResult;
  gap: GapResult;
  tariff?: TariffResult;
  honeycomb?: HoneycombResult;
  executive: ExecutiveResult;
  overall_risk_score: number;
  export_readiness: number;
  supply_reliability?: number;
  trade_direction?: 'export' | 'import';
  // flat fields for backwards compatibility
  risk_score: number;
  risk_level: string;
  findings: string[];
  articles_cited: string[];
  recommendations: string[];
  query: string;
  commodity: string;
  origin: string;
  destination: string;
  analysis_id?: string | null;
}

export interface HistoryItem {
  id: string;
  created_at: string;
  commodity: string;
  origin: string;
  destination: string;
  trade_direction: 'export' | 'import';
  overall_risk_score: number;
  export_readiness: number;
  risk_level: string;
  query: string;
  executive_summary: string;
  overall_verdict: string;
  regulatory_score: number;
  climate_score: number;
  market_score: number;
  logistics_score: number;
  tariff_score: number;
}

export interface HoneycombCriticalCell {
  region: string;
  risk_score: number;
  volume_kt: number;
}

export interface HoneycombResult {
  hes_score: number;
  hes_label: 'Critical' | 'Low' | 'Moderate' | 'Good';
  total_volume_kt: number;
  low_risk_volume_kt: number;
  mid_risk_volume_kt: number;
  high_risk_volume_kt: number;
  low_risk_cells: number;
  mid_risk_cells: number;
  high_risk_cells: number;
  total_cells: number;
  critical_cells: HoneycombCriticalCell[];
  potential_hes: number;
  potential_gain: number;
  insight: string;
}

export interface RouteComparison {
  origin: string;
  tariff: TariffResult;
  logistics: LogisticsResult;
  total_risk_score: number;
  landed_cost_brl: number;
  transit_days: number;
  trade_agreement: string;
  ii_reduction_pct: number;
  savings_vs_worst?: number;
  verdict: 'best' | 'mid' | 'worst' | 'only';
}

export interface CompareRequest {
  commodity: string;
  destination: string;
  origins: string[];
  trade_direction: string;
  cif_value_usd: number;
}

export interface CompareResponse {
  comparisons: RouteComparison[];
  commodity: string;
  destination: string;
  cif_value_usd: number;
  recommendation: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  return 'HIGH';
}
