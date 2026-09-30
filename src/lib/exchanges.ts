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
    requiredFields: {
      apiKey: true,
      secretKey: true,
    },
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    description: '글로벌 디지털 자산 거래소',
    logoUrl: '/exchanges/kraken.svg',
    websiteUrl: 'https://www.kraken.com',
    apiDocsUrl: 'https://docs.kraken.com/api',
    requiredFields: {
      apiKey: true,
      secretKey: true,
    },
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    description: 'Coinbase Advanced Trade 현물 거래소',
    logoUrl: '/exchanges/coinbase.svg',
    websiteUrl: 'https://www.coinbase.com',
    apiDocsUrl: 'https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication',
    requiredFields: {
      apiKey: true,
      secretKey: true,
    },
    credentialFields: {
      apiKeyLabel: 'CDP API Key 이름',
      apiKeyPlaceholder: 'organizations/{organization_id}/apiKeys/{key_id}',
      apiKeyDescription: 'CDP 포털에서 발급한 API Key의 전체 이름을 입력하세요.',
      secretKeyLabel: 'EC Private Key',
      secretKeyPlaceholder: '-----BEGIN EC PRIVATE KEY-----',
      secretKeyDescription: 'API Key와 함께 발급된 P-256 비공개 키 PEM 전체를 입력하세요. 보기 권한만 허용해야 합니다.',
      secretMultiline: true,
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
 * Get public display metadata; availability comes from Collector
 */
export function getAllExchanges(): ExchangeInfo[] {
  return Object.values(EXCHANGES);
}

/**
 * Check if an exchange has known display metadata
 */
export function isExchangeSupported(exchange: string): exchange is ExchangeType {
  return exchange in EXCHANGES;
}
