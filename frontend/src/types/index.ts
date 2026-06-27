export interface AnalyzeRequest {
  query: string;
  commodity: string;
  origin: string;
  destination: string;
}

export interface AnalyzeResponse {
  risk_score: number;
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
  if (score < 0.3) return 'LOW';
  if (score <= 0.6) return 'MEDIUM';
  return 'HIGH';
}
