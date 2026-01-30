'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  PriceData,
  PriceHistoryResponse,
  ExchangeRate,
  PortfolioResponse,
  PortfolioHistoryResponse,
  SupportedAssetsResponse,
  PriceQueryParams,
  PriceHistoryQueryParams,
  PortfolioHistoryQueryParams,
} from '@/types';

const PRICE_KEY = ['price'] as const;
const PORTFOLIO_KEY = ['portfolio'] as const;
const ASSETS_KEY = ['supported-assets'] as const;

// ============================================
// Price Hooks
// ============================================

/**
 * Fetch current price for an asset
 */
export function useCurrentPrice(params: PriceQueryParams) {
  const queryParams = new URLSearchParams();
  queryParams.set('symbol', params.symbol);
  if (params.chain_id) queryParams.set('chain_id', params.chain_id);
  if (params.contract) queryParams.set('contract', params.contract);
  if (params.local_currency) queryParams.set('local_currency', params.local_currency);

  return useQuery({
    queryKey: [...PRICE_KEY, 'current', params],
    queryFn: () =>
      apiClient<PriceData>(`/api/v1/valuation/price?${queryParams.toString()}`),
    enabled: !!params.symbol,
    staleTime: 30 * 1000, // 30 seconds (prices change frequently)
  });
}

/**
 * Fetch historical price for an asset at a specific timestamp
 */
export function useHistoricalPrice(params: PriceQueryParams & { timestamp: string }) {
  const queryParams = new URLSearchParams();
  queryParams.set('symbol', params.symbol);
  queryParams.set('timestamp', params.timestamp);
  if (params.chain_id) queryParams.set('chain_id', params.chain_id);
  if (params.contract) queryParams.set('contract', params.contract);
  if (params.local_currency) queryParams.set('local_currency', params.local_currency);

  return useQuery({
    queryKey: [...PRICE_KEY, 'historical', params],
    queryFn: () =>
      apiClient<PriceData>(`/api/v1/valuation/price/historical?${queryParams.toString()}`),
    enabled: !!params.symbol && !!params.timestamp,
    staleTime: 60 * 60 * 1000, // 1 hour (historical data doesn't change)
  });
}

/**
 * Fetch price history for an asset
 */
export function usePriceHistory(params: PriceHistoryQueryParams) {
  const queryParams = new URLSearchParams();
  queryParams.set('symbol', params.symbol);
  queryParams.set('from_date', params.from_date);
  queryParams.set('to_date', params.to_date);
  if (params.chain_id) queryParams.set('chain_id', params.chain_id);
  if (params.contract) queryParams.set('contract', params.contract);
  if (params.granularity) queryParams.set('granularity', params.granularity);
  if (params.local_currency) queryParams.set('local_currency', params.local_currency);

  return useQuery({
    queryKey: [...PRICE_KEY, 'history', params],
    queryFn: () =>
      apiClient<PriceHistoryResponse>(`/api/v1/valuation/price/history?${queryParams.toString()}`),
    enabled: !!params.symbol && !!params.from_date && !!params.to_date,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Exchange Rate Hooks
// ============================================

/**
 * Fetch current exchange rate
 */
export function useExchangeRate(from: string, to: string) {
  return useQuery({
    queryKey: ['exchange-rate', 'current', from, to],
    queryFn: () =>
      apiClient<ExchangeRate>(`/api/v1/valuation/exchange-rate?from=${from}&to=${to}`),
    enabled: !!from && !!to,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch historical exchange rate
 */
export function useHistoricalExchangeRate(from: string, to: string, timestamp: string) {
  return useQuery({
    queryKey: ['exchange-rate', 'historical', from, to, timestamp],
    queryFn: () =>
      apiClient<ExchangeRate>(
        `/api/v1/valuation/exchange-rate/historical?from=${from}&to=${to}&timestamp=${encodeURIComponent(timestamp)}`
      ),
    enabled: !!from && !!to && !!timestamp,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

// ============================================
// Portfolio Hooks
// ============================================

/**
 * Fetch current portfolio valuation
 */
export function usePortfolio(localCurrency?: string) {
  const queryParams = localCurrency ? `?local_currency=${localCurrency}` : '';

  return useQuery({
    queryKey: [...PORTFOLIO_KEY, 'current', localCurrency],
    queryFn: () =>
      apiClient<PortfolioResponse>(`/api/v1/valuation/portfolio${queryParams}`),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch portfolio history
 */
export function usePortfolioHistory(params: PortfolioHistoryQueryParams) {
  const queryParams = new URLSearchParams();
  queryParams.set('from_date', params.from_date);
  queryParams.set('to_date', params.to_date);
  if (params.granularity) queryParams.set('granularity', params.granularity);
  if (params.local_currency) queryParams.set('local_currency', params.local_currency);

  return useQuery({
    queryKey: [...PORTFOLIO_KEY, 'history', params],
    queryFn: () =>
      apiClient<PortfolioHistoryResponse>(`/api/v1/valuation/portfolio/history?${queryParams.toString()}`),
    enabled: !!params.from_date && !!params.to_date,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Supported Assets
// ============================================

/**
 * Fetch list of supported assets
 */
export function useSupportedAssets(chainId?: string) {
  const queryParams = chainId ? `?chain_id=${chainId}` : '';

  return useQuery({
    queryKey: [...ASSETS_KEY, chainId],
    queryFn: async () => {
      const response = await apiClient<SupportedAssetsResponse>(
        `/api/v1/valuation/assets${queryParams}`
      );
      return response.assets;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
