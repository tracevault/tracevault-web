'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { AccountingRun, AccountingRunResult, AccountingRunList, AccountingRunEntries, AccountingRunEntryKind, CreateAccountingRunRequest } from '@/types/tax';
export const ACCOUNTING_RUNS_KEY = ['accounting-runs'] as const;
export function useCreateAccountingRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountingRunRequest) => apiClient<AccountingRun>('/api/v1/tax/accounting-runs', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ACCOUNTING_RUNS_KEY }); },
  });
}
export function useAccountingRuns(profileId: string, beforeRunId?: string) {
  const query = new URLSearchParams({ profile_id: profileId, limit: '20' });
  if (beforeRunId) query.set('before_run_id', beforeRunId);
  return useQuery({
    queryKey: [...ACCOUNTING_RUNS_KEY, 'list', profileId, beforeRunId],
    queryFn: () => apiClient<AccountingRunList>(`/api/v1/tax/accounting-runs?${query}`),
    enabled: !!profileId,
    staleTime: 0,
  });
}
export function useAccountingRun(runId: string, checkCurrent = false) {
  return useQuery({
    queryKey: [...ACCOUNTING_RUNS_KEY, 'run', runId, checkCurrent],
    queryFn: () => apiClient<AccountingRunResult>(`/api/v1/tax/accounting-runs/${encodeURIComponent(runId)}?check_current=${checkCurrent}`),
    enabled: !!runId,
    staleTime: 0,
    retry: false,
  });
}
export function useAccountingRunEntries(runId: string, kind: AccountingRunEntryKind, afterIndex = '0') {
  const query = new URLSearchParams({ kind, after_index: afterIndex, limit: '100' });
  return useQuery({
    queryKey: [...ACCOUNTING_RUNS_KEY, 'entries', runId, kind, afterIndex],
    queryFn: () => apiClient<AccountingRunEntries>(`/api/v1/tax/accounting-runs/${encodeURIComponent(runId)}/entries?${query}`),
    enabled: !!runId,
    staleTime: Infinity, // An owned run's retained rows never change; logout clears the query cache.
  });
}
