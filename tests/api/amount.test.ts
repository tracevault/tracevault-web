import { describe, expect, it } from 'vitest';
import { assetIdentity, formatAmount, formatValuationTotal, valuationDifference } from '@/lib/amount';

describe('exact portfolio display', () => {
  it.each([
    ['9007199254740993.123456789', 9, 'USD', '$9,007,199,254,740,993.123456789'],
    ['160075.69425234332113863052797', 23, 'KRW', '₩160,075.69425234332113863052797'],
    ['-0.000000000000000001', 18, undefined, '-0.000000000000000001'],
    ['0.0000000000000000000000000001', 28, undefined, '0.0000000000000000000000000001'],
    ['1', 18, undefined, '1'],
    ['-0.00', 2, 'JPY', '¥0'],
  ] as const)('formats %s without binary floating point', (value, scale, currency, expected) => {
    expect(formatAmount({ value, scale }, currency)).toBe(expected);
  });
  it('never substitutes a successful zero for invalid/missing values', () => {
    expect(formatAmount(undefined)).toBe('—');
    expect(formatAmount({ value: '1e3', scale: 0 })).toBe('잘못된 금액');
    expect(formatAmount({ value: '0.01', scale: 1 })).toBe('잘못된 금액');
  });
  it('subtracts tiny differences between large amounts exactly', () => {
    const before = { value: '9007199254740993.123456789', scale: 9 };
    const after = { value: '9007199254740993.123456788999999999', scale: 18 };
    expect(valuationDifference(before, after)).toEqual({ value: '-0.000000000000000001', scale: 18 });
    expect(valuationDifference({ value: '-1', scale: 0 }, { value: '0.01', scale: 2 })).toEqual({ value: '1.01', scale: 2 });
  });
  it('keeps equal symbols on different contracts separate', () => {
    expect(assetIdentity({ symbol: 'ABC', chain_id: 'ethereum', contract: '0xa' })).not.toBe(assetIdentity({ symbol: 'ABC', chain_id: 'ethereum', contract: '0xb' }));
  });
  it('preserves a product below the smallest wire quantum for display', () => {
    const tiny = { value: '0.0000000000000000000000000001', scale: 28 };
    expect(formatValuationTotal([{ quantity: tiny, price: tiny, currency: 'USD' }]))
      .toBe('$0.' + '0'.repeat(55) + '1');
  });
  it('adds exact products only within the same currency', () => {
    expect(formatValuationTotal([
      { quantity: { value: '0.1', scale: 1 }, price: { value: '0.2', scale: 1 }, currency: 'USD' },
      { quantity: { value: '1', scale: 0 }, price: { value: '9007199254740993', scale: 0 }, currency: 'USD' },
      { quantity: { value: '3', scale: 0 }, price: { value: '0.7', scale: 1 }, currency: 'KRW' },
    ])).toBe('₩2.1 / $9,007,199,254,740,993.02');
  });
  it('distinguishes absent trades, missing prices and a verified zero valuation', () => {
    const quantity = { value: '1', scale: 0 };
    expect(formatValuationTotal([])).toBe('해당 거래 없음');
    expect(formatValuationTotal([{ quantity, currency: 'KRW' }])).toBe('평가액 미확인');
    expect(formatValuationTotal([{ quantity, price: { value: '0', scale: 0 } }])).toBe('평가액 미확인');
    expect(formatValuationTotal([{ quantity, price: { value: '0', scale: 0 }, currency: 'KRW' }])).toBe('₩0');
  });
});
