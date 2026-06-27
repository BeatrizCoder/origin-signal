export interface AnalyzeRequest {
  query: string;
  commodity: string;
  origin: string;
  destination: string;
  origin_region?: string;
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
  executive: ExecutiveResult;
  overall_risk_score: number;
  export_readiness: number;
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
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  return 'HIGH';
}
