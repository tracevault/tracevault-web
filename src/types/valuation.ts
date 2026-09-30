import type { components } from './generated/http';

export type PriceGranularity = components['schemas']['PriceGranularity'];
export type PriceData = components['schemas']['PriceData'];
export type PriceHistoryPoint = components['schemas']['PriceHistoryPoint'];
export type PriceHistoryResponse = components['schemas']['PriceHistoryResponse'];
export type ExchangeRate = components['schemas']['ExchangeRate'];
export type PortfolioAsset = components['schemas']['PortfolioAsset'];
export type PortfolioResponse = components['schemas']['PortfolioResponse'];
export type PortfolioSnapshot = components['schemas']['PortfolioSnapshot'];
export type PortfolioHistoryResponse = components['schemas']['PortfolioHistoryResponse'];
export type SupportedAsset = components['schemas']['SupportedAsset'];
export type SupportedAssetsResponse = components['schemas']['SupportedAssetsResponse'];

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
  page_size?: number;
  page_token?: string;
}
