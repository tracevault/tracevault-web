'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { mockTaxSummary, mockTaxLots, mockTaxReports } from '@/lib/mockData';
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
} from '@/types';

// TEMPORARY: Enable mock data for UI testing without backend
const USE_MOCK_DATA = true;

const PROFILES_KEY = ['tax-profiles'] as const;
const SUMMARY_KEY = ['tax-summary'] as const;
const LOTS_KEY = ['tax-lots'] as const;
const REPORTS_KEY = ['tax-reports'] as const;

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
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

// ============================================
// Tax Calculation Hooks
// ============================================

/**
 * Calculate taxes for a specific year
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
 * Fetch tax summary for a specific year
 */
export function useTaxSummary(taxYear: number) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, taxYear],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return mockTaxSummary;
      }
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
 * Fetch tax lots with optional filters
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
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        let filteredLots = [...mockTaxLots.lots];
        if (params.asset_symbol) {
          filteredLots = filteredLots.filter(
            (lot) => lot.asset_id.symbol === params.asset_symbol
          );
        }
        if (params.include_consumed === false) {
          filteredLots = filteredLots.filter((lot) => !lot.is_consumed);
        }
        return {
          lots: filteredLots,
          pagination: {
            ...mockTaxLots.pagination,
            total: filteredLots.length,
          },
        };
      }
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
 * Generate a new tax report
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
 * Fetch list of generated tax reports
 */
export function useTaxReports(taxYear?: number) {
  const queryParams = taxYear ? `?tax_year=${taxYear}` : '';

  return useQuery({
    queryKey: [...REPORTS_KEY, taxYear],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (taxYear) {
          return mockTaxReports.filter((r) => r.tax_year === taxYear);
        }
        return mockTaxReports;
      }
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
