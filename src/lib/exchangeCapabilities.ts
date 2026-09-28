import { z } from 'zod';
import type { ExchangeCapability, ExchangeCapabilitiesResponse } from '@/types';

const capability = z.object({
  exchange: z.enum(['upbit', 'bithumb', 'binance', 'kraken', 'coinbase']),
  availability: z.enum(['available', 'permission_unverified', 'adapter_unavailable', 'capability_unverified']),
  trades: z.boolean(), deposits: z.boolean(), withdrawals: z.boolean(),
  history_scope: z.enum(['', 'binance_spot', 'kraken_spot', 'coinbase_advanced_spot']),
}).strict().refine(row => row.availability === 'available'
  ? ((((row.exchange === 'binance' && row.history_scope === 'binance_spot') ||
      (row.exchange === 'kraken' && row.history_scope === 'kraken_spot')) && row.trades && row.deposits && row.withdrawals) ||
      (row.exchange === 'coinbase' && row.history_scope === 'coinbase_advanced_spot' && row.trades && !row.deposits && !row.withdrawals))
  : row.history_scope === '' && !row.trades && !row.deposits && !row.withdrawals);

const schema = z.object({ exchanges: z.array(capability).max(5) }).strict()
  .refine(result => new Set(result.exchanges.map(row => row.exchange)).size === result.exchanges.length);

export function parseExchangeCapabilities(value: unknown): ExchangeCapabilitiesResponse {
  return schema.parse(value);
}

export function capabilityMessage(value?: ExchangeCapability): string {
  switch (value?.availability) {
    case 'available': return value.history_scope === 'coinbase_advanced_spot'
      ? 'Advanced Trade 현물 체결 이력 수집 · 입출금과 다른 Coinbase 상품은 아직 지원하지 않습니다.'
      : '현물 거래 및 입출금 이력 수집 · 일부 과거 내역과 다른 상품은 별도 지원이 필요합니다.';
    case 'permission_unverified': return '읽기 전용 키의 권한 검증을 지원하지 않아 자동 연결을 준비 중입니다.';
    case 'adapter_unavailable': return '현재 서버에 이 거래소의 연결 기능이 설정되지 않았습니다.';
    default: return '지원 여부를 확인할 수 없어 연결과 동기화를 사용할 수 없습니다.';
  }
}
