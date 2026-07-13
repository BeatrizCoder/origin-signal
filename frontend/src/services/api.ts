import axios from 'axios';
import type { AnalyzeRequest, AnalyzeResponse, HistoryItem, CompareRequest, CompareResponse } from '../types';

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
