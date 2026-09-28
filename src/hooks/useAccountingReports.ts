'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiFile } from '@/lib/api';
import type { AccountingReport, AccountingReportList, CreateAccountingReportRequest } from '@/types/tax';

export const ACCOUNTING_REPORTS_KEY = ['accounting-reports'] as const;
export function useCreateAccountingReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountingReportRequest) => apiClient<AccountingReport>('/api/v1/tax/accounting-reports', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ACCOUNTING_REPORTS_KEY }); },
  });
}
export function useAccountingReports(runId: string, beforeReportId?: string) {
  const query = new URLSearchParams({ run_id: runId, limit: '20' });
  if (beforeReportId) query.set('before_report_id', beforeReportId);
  return useQuery({
    queryKey: [...ACCOUNTING_REPORTS_KEY, runId, beforeReportId],
    queryFn: ({ signal }) => apiClient<AccountingReportList>(`/api/v1/tax/accounting-reports?${query}`, { signal }),
    enabled: !!runId,
    staleTime: 0,
    retry: false,
  });
}
export function downloadAccountingReport(report: AccountingReport, signal?: AbortSignal) {
  return apiFile(`/api/v1/tax/accounting-reports/${encodeURIComponent(report.id)}/download`, report, signal);
}
