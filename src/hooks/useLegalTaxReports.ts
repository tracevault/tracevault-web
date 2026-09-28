'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiFile } from '@/lib/api';
import type { CreateLegalTaxReportRequest, LegalTaxReport, LegalTaxReportList } from '@/types/tax';

export const LEGAL_TAX_REPORTS_KEY = ['legal-tax-reports'] as const;

export function useCreateLegalTaxReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLegalTaxReportRequest) => apiClient<LegalTaxReport>('/api/v1/tax/legal-tax-reports', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: LEGAL_TAX_REPORTS_KEY }); },
  });
}

export function useLegalTaxReports(runId: string, beforeReportId?: string) {
  const query = new URLSearchParams({ legal_tax_run_id: runId, limit: '20' });
  if (beforeReportId) query.set('before_report_id', beforeReportId);
  return useQuery({
    queryKey: [...LEGAL_TAX_REPORTS_KEY, runId, beforeReportId],
    queryFn: ({ signal }) => apiClient<LegalTaxReportList>(`/api/v1/tax/legal-tax-reports?${query}`, { signal }),
    enabled: !!runId,
    staleTime: 0,
    retry: false,
  });
}

export function downloadLegalTaxReport(report: LegalTaxReport, signal?: AbortSignal) {
  return apiFile(`/api/v1/tax/legal-tax-reports/${encodeURIComponent(report.id)}/download`, report, signal);
}
