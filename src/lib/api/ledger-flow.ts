import type { operations } from '@/types/generated/http';
import type { AssetFlowResponse, EventTraceResponse } from '@/types/ledger';
import { apiClient } from './client';

export type FlowQuery = NonNullable<operations['getAssetFlow']['parameters']['query']>;
export type TraceQuery = NonNullable<operations['traceLedgerEvent']['parameters']['query']>;
function queryString(query: FlowQuery | TraceQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}
export function getAssetFlow(query: FlowQuery) {
  return apiClient<AssetFlowResponse>(`/api/v1/ledger/flow?${queryString(query)}`);
}
export function getEventTrace(eventId: string, query: TraceQuery = {}) {
  return apiClient<EventTraceResponse>(`/api/v1/ledger/events/${encodeURIComponent(eventId)}/trace?${queryString(query)}`);
}
