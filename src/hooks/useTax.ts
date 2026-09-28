'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ACCOUNTING_RUNS_KEY } from './useAccountingRuns';
import type {
  TaxProfile,
  TaxCalculationResponse,
  TaxSummary,
  TaxLotListResponse,
  TaxReport,
  TaxReportListResponse,
  CreateTaxProfileRequest,
  UpdateTaxProfileRequest,
  TaxCalculateRequest,
  GenerateTaxReportRequest,
  TaxLotsQueryParams,
  Jurisdiction,
  LegalTaxPolicyCatalog,
  TaxpayerInputSnapshot,
  CreateTaxpayerInputSnapshotRequest,
  PreviewLegalTaxRequest,
  LegalTaxCalculation,
  CreateLegalTaxRunRequest,
  LegalTaxRun,
  LegalTaxRunList,
} from '@/types';

const PROFILES_KEY = ['tax-profiles'] as const;
const SUMMARY_KEY = ['tax-summary'] as const;
const LOTS_KEY = ['tax-lots'] as const;
const REPORTS_KEY = ['tax-reports'] as const;
const LEGAL_POLICIES_KEY = ['legal-tax-policies'] as const;
export const TAXPAYER_INPUTS_KEY = ['taxpayer-input-snapshots'] as const;
export const LEGAL_TAX_RUNS_KEY = ['legal-tax-runs'] as const;

export function useLegalTaxPolicyCatalog(jurisdiction: Jurisdiction, taxYear: number) {
  const query = new URLSearchParams({ jurisdiction, tax_year: String(taxYear) });
  return useQuery({
    queryKey: [...LEGAL_POLICIES_KEY, jurisdiction, taxYear],
    queryFn: () => apiClient<LegalTaxPolicyCatalog>(`/api/v1/tax/legal-policies?${query}`),
    enabled: !!jurisdiction && !!taxYear,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLatestTaxpayerInputSnapshot(jurisdiction: Jurisdiction, taxYear: number) {
  const query = new URLSearchParams({ jurisdiction, tax_year: String(taxYear) });
  return useQuery({
    queryKey: [...TAXPAYER_INPUTS_KEY, 'latest', jurisdiction, taxYear],
    queryFn: () => apiClient<TaxpayerInputSnapshot>(`/api/v1/tax/taxpayer-input-snapshots/latest?${query}`),
    enabled: !!jurisdiction && !!taxYear,
    retry: false,
  });
}

export function useTaxpayerInputSnapshot(snapshotId: string) {
  return useQuery({
    queryKey: [...TAXPAYER_INPUTS_KEY, snapshotId],
    queryFn: () => apiClient<TaxpayerInputSnapshot>(`/api/v1/tax/taxpayer-input-snapshots/${encodeURIComponent(snapshotId)}`),
    enabled: !!snapshotId,
    retry: false,
  });
}

export function useCreateTaxpayerInputSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaxpayerInputSnapshotRequest) =>
      apiClient<TaxpayerInputSnapshot>('/api/v1/tax/taxpayer-input-snapshots', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData([...TAXPAYER_INPUTS_KEY, 'latest', snapshot.jurisdiction, snapshot.tax_year], snapshot);
      queryClient.setQueryData([...TAXPAYER_INPUTS_KEY, snapshot.id], snapshot);
    },
  });
}

export function usePreviewLegalTax() {
  return useMutation({
    mutationFn: (data: PreviewLegalTaxRequest) =>
      apiClient<LegalTaxCalculation>('/api/v1/tax/legal-tax-previews', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateLegalTaxRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLegalTaxRunRequest) =>
      apiClient<LegalTaxRun>('/api/v1/tax/legal-tax-runs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (run) => {
      queryClient.setQueryData([...LEGAL_TAX_RUNS_KEY, run.id, false], run);
      queryClient.invalidateQueries({ queryKey: [...LEGAL_TAX_RUNS_KEY, run.calculation.accounting_run_id] });
    },
  });
}

export function useLegalTaxRuns(accountingRunId: string) {
  const query = new URLSearchParams({ accounting_run_id: accountingRunId, limit: '20' });
  return useQuery({
    queryKey: [...LEGAL_TAX_RUNS_KEY, accountingRunId],
    queryFn: () => apiClient<LegalTaxRunList>(`/api/v1/tax/legal-tax-runs?${query}`),
    enabled: !!accountingRunId,
    retry: false,
  });
}

export function useCheckLegalTaxRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<LegalTaxRun>(`/api/v1/tax/legal-tax-runs/${encodeURIComponent(id)}?check_current=true`),
    onSuccess: (run) => {
      queryClient.setQueryData([...LEGAL_TAX_RUNS_KEY, run.id, true], run);
      queryClient.invalidateQueries({ queryKey: [...LEGAL_TAX_RUNS_KEY, run.calculation.accounting_run_id] });
    },
  });
}

// ============================================
// Tax Profile Hooks
// ============================================

/**
 * Fetch tax profile for a specific year
 */
export function useTaxProfile(taxYear: number) {
  return useQuery({
    queryKey: [...PROFILES_KEY, taxYear],
    queryFn: () =>
      apiClient<TaxProfile>(`/api/v1/tax/profiles?tax_year=${taxYear}`),
    enabled: !!taxYear,
    retry: false, // A missing profile opens setup; other failures have an explicit retry.
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Create a new tax profile
 */
export function useCreateTaxProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaxProfileRequest) =>
      apiClient<TaxProfile>('/api/v1/tax/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...PROFILES_KEY, variables.tax_year] });
    },
  });
}

/**
 * Update a tax profile
 */
export function useUpdateTaxProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaxProfileRequest }) =>
      apiClient<TaxProfile>(`/api/v1/tax/profiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
      queryClient.invalidateQueries({ queryKey: ACCOUNTING_RUNS_KEY });
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: LOTS_KEY });
      queryClient.invalidateQueries({ queryKey: REPORTS_KEY });
    },
  });
}

// ============================================
// Tax Calculation Hooks
// ============================================

/**
 * @deprecated The legal-tax endpoint is fail-closed. Use immutable accounting runs.
 */
export function useCalculateTax() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TaxCalculateRequest) =>
      apiClient<TaxCalculationResponse>('/api/v1/tax/calculate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...SUMMARY_KEY, variables.tax_year] });
      queryClient.invalidateQueries({ queryKey: LOTS_KEY });
    },
  });
}

/**
 * @deprecated The legacy summary endpoint is fail-closed. Read an immutable accounting run.
 */
export function useTaxSummary(taxYear: number) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, taxYear],
    queryFn: async () => {
      return apiClient<TaxSummary>(`/api/v1/tax/summary?tax_year=${taxYear}`);
    },
    enabled: !!taxYear,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Tax Lot Hooks
// ============================================

/**
 * @deprecated The legacy lot endpoint is fail-closed. Read immutable accounting run entries.
 */
export function useTaxLots(params: TaxLotsQueryParams = {}) {
  const queryParams = new URLSearchParams();

  if (params.asset_symbol) queryParams.set('asset_symbol', params.asset_symbol);
  if (params.include_consumed !== undefined) {
    queryParams.set('include_consumed', params.include_consumed.toString());
  }
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());

  const queryString = queryParams.toString();

  return useQuery({
    queryKey: [...LOTS_KEY, params],
    queryFn: async () => {
      const url = `/api/v1/tax/lots${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient<TaxLotListResponse>(url);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Tax Report Hooks
// ============================================

/**
 * @deprecated The legal-report endpoint is fail-closed. Generate a retained accounting report.
 */
export function useGenerateTaxReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateTaxReportRequest) =>
      apiClient<TaxReport>('/api/v1/tax/reports', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORTS_KEY });
    },
  });
}

/**
 * @deprecated The legacy report endpoint is fail-closed. List retained accounting reports.
 */
export function useTaxReports(taxYear?: number) {
  const queryParams = taxYear ? `?tax_year=${taxYear}` : '';

  return useQuery({
    queryKey: [...REPORTS_KEY, taxYear],
    queryFn: async () => {
      const response = await apiClient<TaxReportListResponse>(
        `/api/v1/tax/reports${queryParams}`
      );
      return response.reports;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Download a tax report (returns download URL)
 */
export function downloadTaxReport(report: TaxReport) {
  // Open download URL in new tab
  window.open(report.download_url, '_blank');
}
