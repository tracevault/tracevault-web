'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  EntryAccount,
  EntryAccountListResponse,
  CreateEntryAccountRequest,
  LedgerEvent,
  LedgerEventListResponse,
  CreateLedgerEventRequest,
  ReclassifyEventRequest,
  BalanceListResponse,
  EventsQueryParams,
  AssetFlowResponse,
  EventTraceResponse,
} from '@/types';

const ACCOUNTS_KEY = ['entry-accounts'] as const;
const EVENTS_KEY = ['ledger-events'] as const;
const BALANCES_KEY = ['balances'] as const;

// ============================================
// Entry Account Hooks
// ============================================

/**
 * Fetch all entry accounts for the current user
 */
export function useEntryAccounts(limit = 100, offset = 0) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, { limit, offset }],
    queryFn: async () => {
      const response = await apiClient<EntryAccountListResponse>(
        `/api/v1/ledger/accounts?limit=${limit}&offset=${offset}`
      );
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Create a new entry account
 */
export function useCreateEntryAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEntryAccountRequest) =>
      apiClient<EntryAccount>('/api/v1/ledger/accounts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}

/**
 * Update an entry account label
 */
export function useUpdateEntryAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      apiClient<EntryAccount>(`/api/v1/ledger/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}

/**
 * Delete an entry account
 */
export function useDeleteEntryAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/v1/ledger/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}

// ============================================
// Ledger Event Hooks
// ============================================

/**
 * Fetch ledger events with optional filters
 */
export function useLedgerEvents(params: EventsQueryParams = {}) {
  const queryParams = new URLSearchParams();

  if (params.asset_symbol) queryParams.set('asset_symbol', params.asset_symbol);
  if (params.event_type) queryParams.set('event_type', params.event_type);
  if (params.from_date) queryParams.set('from_date', params.from_date);
  if (params.to_date) queryParams.set('to_date', params.to_date);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());

  const queryString = queryParams.toString();

  return useQuery({
    queryKey: [...EVENTS_KEY, params],
    queryFn: async () => {
      const url = `/api/v1/ledger/events${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient<LedgerEventListResponse>(url);
      return response;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Fetch a single ledger event
 */
export function useLedgerEvent(eventId: string) {
  return useQuery({
    queryKey: [...EVENTS_KEY, eventId],
    queryFn: () =>
      apiClient<LedgerEvent>(`/api/v1/ledger/events/${eventId}`),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000, // 5 minutes (events are immutable)
  });
}

/**
 * Create a new ledger event
 */
export function useCreateLedgerEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLedgerEventRequest) =>
      apiClient<LedgerEvent>('/api/v1/ledger/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
    },
  });
}

/**
 * Reclassify a ledger event (creates a correction event)
 */
export function useReclassifyEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: ReclassifyEventRequest }) =>
      apiClient<LedgerEvent>(`/api/v1/ledger/events/${eventId}/classification`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
    },
  });
}

// ============================================
// Balance Hooks
// ============================================

/**
 * Fetch current balances for the user
 */
export function useBalances(asOf?: string) {
  return useQuery({
    queryKey: [...BALANCES_KEY, { asOf }],
    queryFn: async () => {
      const url = asOf
        ? `/api/v1/ledger/balances?as_of=${encodeURIComponent(asOf)}`
        : '/api/v1/ledger/balances';
      const response = await apiClient<BalanceListResponse>(url);
      return response.balances;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================
// Asset Flow / Tracing Hooks
// ============================================

/**
 * Fetch asset flow DAG
 */
export function useAssetFlow(assetSymbol: string, fromDate?: string, toDate?: string) {
  const queryParams = new URLSearchParams();
  queryParams.set('asset_symbol', assetSymbol);
  if (fromDate) queryParams.set('from_date', fromDate);
  if (toDate) queryParams.set('to_date', toDate);

  return useQuery({
    queryKey: ['asset-flow', assetSymbol, fromDate, toDate],
    queryFn: () =>
      apiClient<AssetFlowResponse>(`/api/v1/ledger/flow?${queryParams.toString()}`),
    enabled: !!assetSymbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Trace an event to its origin
 */
export function useEventTrace(eventId: string) {
  return useQuery({
    queryKey: ['event-trace', eventId],
    queryFn: () =>
      apiClient<EventTraceResponse>(`/api/v1/ledger/events/${eventId}/trace`),
    enabled: !!eventId,
    staleTime: 10 * 60 * 1000, // 10 minutes (historical data)
  });
}

/**
 * Refresh ledger data
 */
export function useRefreshLedger() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
  };
}
