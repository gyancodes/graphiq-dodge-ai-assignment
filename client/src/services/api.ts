import axios from 'axios';
import { API_BASE_URL } from '../constants/graph';
import type { GraphPayload, NodeDetailResponse, QueryResponse, Stats } from '../types/app';

export async function fetchGraphData(): Promise<GraphPayload> {
  const response = await axios.get<GraphPayload>(`${API_BASE_URL}/graph`);
  return response.data;
}

export async function fetchStatsData(): Promise<Stats> {
  const response = await axios.get<Stats>(`${API_BASE_URL}/stats`);
  return response.data;
}

export async function fetchSuggestionsData(): Promise<string[]> {
  const response = await axios.get<{ suggestions: string[] }>(`${API_BASE_URL}/suggestions`);
  return response.data.suggestions;
}

export async function fetchNodeDetailData(nodeId: string): Promise<NodeDetailResponse> {
  const response = await axios.get<NodeDetailResponse>(`${API_BASE_URL}/node/${encodeURIComponent(nodeId)}`);
  return response.data;
}

export async function expandGraphNode(nodeId: string): Promise<GraphPayload> {
  const response = await axios.get<GraphPayload>(`${API_BASE_URL}/graph/expand/${encodeURIComponent(nodeId)}`);
  return response.data;
}

export async function submitQuery(question: string, sessionId: string): Promise<QueryResponse> {
  const response = await axios.post<QueryResponse>(`${API_BASE_URL}/query`, {
    question,
    sessionId,
  });
  return response.data;
}
