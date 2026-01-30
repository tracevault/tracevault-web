// Valuation Types - Pricing and Portfolio

import type { Amount, AssetId } from './ledger';

export type PriceGranularity = 'MINUTE' | 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';

export interface PriceData {
  asset_id: AssetId;
  price_usd: Amount;
  price_local: Amount;
  local_currency: string;
  exchange_rate: Amount;
  source: string;
  timestamp: string;
}

export interface PriceHistoryPoint {
  timestamp: string;
  price_usd: Amount;
  price_local: Amount;
  local_currency: string;
  source: string;
}

export interface PriceHistoryResponse {
  asset_id: AssetId;
  prices: PriceHistoryPoint[];
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: Amount;
  timestamp: string;
}

export interface PortfolioAsset {
  asset_id: AssetId;
  balance: Amount;
  price_usd: Amount;
  value_usd: Amount;
  value_local: Amount;
  percentage: number;
}

export interface PortfolioResponse {
  total_value_usd: Amount;
  total_value_local: Amount;
  local_currency: string;
  assets: PortfolioAsset[];
  timestamp: string;
}

export interface PortfolioSnapshot {
  timestamp: string;
  total_value_usd: Amount;
  total_value_local: Amount;
  local_currency: string;
}

export interface PortfolioHistoryResponse {
  snapshots: PortfolioSnapshot[];
}

export interface SupportedAsset {
  asset_id: AssetId;
  name: string;
  decimals: number;
  sources: string[];
}

export interface SupportedAssetsResponse {
  assets: SupportedAsset[];
}

// Query params
export interface PriceQueryParams {
  symbol: string;
  chain_id?: string;
  contract?: string;
  local_currency?: string;
}

export interface PriceHistoryQueryParams extends PriceQueryParams {
  from_date: string;
  to_date: string;
  granularity?: PriceGranularity;
}

export interface PortfolioHistoryQueryParams {
  from_date: string;
  to_date: string;
  granularity?: PriceGranularity;
  local_currency?: string;
}
