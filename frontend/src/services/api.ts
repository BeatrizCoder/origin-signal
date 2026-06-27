import axios from 'axios';
import type { AnalyzeRequest, AnalyzeResponse } from '../types';

const client = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

export async function analyzeRoute(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  const { data } = await client.post<AnalyzeResponse>('/api/analyze', payload);
  return data;
}
