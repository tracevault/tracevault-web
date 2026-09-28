import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import spec from '../../../tracevault-contracts/http/openapi.json';
import fixture from '../../../tracevault-contracts/http/fixtures/exchange-capabilities-v1.json';
import { parseExchangeCapabilities, capabilityMessage } from '@/lib/exchangeCapabilities';
import { getAllExchanges } from '@/lib/exchanges';

describe('server-sourced collection capabilities', () => {
  it('uses the exact native producer/Gateway golden contract', () => {
    const validate = new Ajv({ strict: false }).compile({ components: spec.components, $ref: '#/components/schemas/ExchangeCapabilitiesResponse' });
    expect(validate(fixture)).toBe(true);
    const data = parseExchangeCapabilities(fixture);
    expect(data.exchanges.filter(row => row.availability === 'available').map(row => row.exchange)).toEqual(['binance', 'kraken', 'coinbase']);
    expect(capabilityMessage(data.exchanges[0])).toContain('권한 검증');
    expect(capabilityMessage(undefined)).toContain('확인할 수 없어');
    expect(capabilityMessage(data.exchanges[2])).toContain('현물');
    expect(capabilityMessage(data.exchanges[4])).toContain('입출금');
    expect(getAllExchanges().every(row => !('features' in row))).toBe(true);
  });
  it('never turns incomplete or conflicting evidence into support', () => {
    const good = fixture.exchanges[2];
    for (const bad of [undefined, {}, { exchanges: null }, { exchanges: [good, good] },
      { exchanges: [{ ...good, availability: 'future' }] },
      { exchanges: [{ ...good, availability: 'permission_unverified' }] },
      { exchanges: [{ ...good, trades: 'true' }] },
      { exchanges: [{ ...good, history_scope: 'all' }] },
      { exchanges: [{ ...good, exchange: 'upbit' }] },
      { exchanges: [{ ...good, withdrawals: undefined }] },
      { exchanges: [{ ...fixture.exchanges[4], deposits: true }] },
    ]) expect(() => parseExchangeCapabilities(bad)).toThrow();
    expect(parseExchangeCapabilities({ exchanges: [] }).exchanges).toEqual([]);
  });
});
