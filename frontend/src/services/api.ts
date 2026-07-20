import axios from 'axios';
import type { AnalyzeRequest, AnalyzeResponse, HistoryItem, CompareRequest, CompareResponse, OptimizationResult, AuditPathResult, GlobalRiskResponse } from '../types';

const client = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

export async function analyzeRoute(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  const { data } = await client.post<AnalyzeResponse>('/api/analyze', payload);
  return data;
}

export async function getHistory(limit = 20): Promise<HistoryItem[]> {
  const { data } = await client.get<HistoryItem[]>('/api/history', { params: { limit } });
  return data;
}

export interface HistoryDetail extends HistoryItem {
  full_result: AnalyzeResponse;
}

export async function getAnalysisById(id: string): Promise<HistoryDetail> {
  const { data } = await client.get<HistoryDetail>(`/api/history/${id}`);
  return data;
}

export async function compareRoutes(payload: CompareRequest): Promise<CompareResponse> {
  const { data } = await client.post<CompareResponse>('/api/compare', payload);
  return data;
}

export async function optimizeHoneycomb(budget: number, commodity: string): Promise<OptimizationResult> {
  const { data } = await client.post<OptimizationResult>('/api/optimize', { budget_brl: budget, commodity });
  return data;
}

export async function calculateAuditPath(targetCoverage: number, startRegion: string, commodity: string): Promise<AuditPathResult> {
  const { data } = await client.post<AuditPathResult>('/api/audit-path', {
    target_coverage_pct: targetCoverage,
    start_region: startRegion,
    commodity,
  });
  return data;
}

export async function getGlobalRisk(commodity: string): Promise<GlobalRiskResponse> {
  const { data } = await client.get<GlobalRiskResponse>(`/api/global-risk/${commodity}`);
  return data;
}
