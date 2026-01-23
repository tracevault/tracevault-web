import type { ExchangeInfo, ExchangeType } from '@/types';

/**
 * Exchange metadata for display and configuration
 */
export const EXCHANGES: Record<ExchangeType, ExchangeInfo> = {
  upbit: {
    id: 'upbit',
    name: 'Upbit',
    description: '대한민국 최대 암호화폐 거래소',
    logoUrl: '/exchanges/upbit.svg',
    websiteUrl: 'https://upbit.com',
    apiDocsUrl: 'https://docs.upbit.com',
    features: {
      trades: true,
      deposits: true,
      withdrawals: true,
      balances: true,
    },
    requiredFields: {
      apiKey: true,
      secretKey: true,
    },
  },
  bithumb: {
    id: 'bithumb',
    name: 'Bithumb',
    description: '국내 대표 디지털 자산 거래소',
    logoUrl: '/exchanges/bithumb.svg',
    websiteUrl: 'https://www.bithumb.com',
    apiDocsUrl: 'https://apidocs.bithumb.com',
    features: {
      trades: true,
      deposits: true,
      withdrawals: true,
      balances: true,
    },
    requiredFields: {
      apiKey: true,
      secretKey: true,
    },
  },
  binance: {
    id: 'binance',
    name: 'Binance',
    description: '세계 최대 암호화폐 거래소',
    logoUrl: '/exchanges/binance.svg',
    websiteUrl: 'https://www.binance.com',
    apiDocsUrl: 'https://binance-docs.github.io/apidocs',
    features: {
      trades: true,
      deposits: true,
      withdrawals: true,
      balances: true,
    },
    requiredFields: {
      apiKey: true,
      secretKey: true,
    },
  },
};

/**
 * Get exchange info by type
 */
export function getExchangeInfo(exchange: ExchangeType): ExchangeInfo {
  return EXCHANGES[exchange];
}

/**
 * Get all supported exchanges as array
 */
export function getAllExchanges(): ExchangeInfo[] {
  return Object.values(EXCHANGES);
}

/**
 * Check if an exchange is supported
 */
export function isExchangeSupported(exchange: string): exchange is ExchangeType {
  return exchange in EXCHANGES;
}
