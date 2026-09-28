import type { Amount, AssetId } from '@/types';

const ZERO = BigInt(0);
const TEN = BigInt(10);

function decimal(amount: Amount): { units: bigint; scale: number } {
  if (!Number.isInteger(amount.scale) || amount.scale < 0 || amount.scale > 28 ||
      typeof amount.value !== 'string' || amount.value.length > 100 || !/^-?\d+(\.\d+)?$/.test(amount.value)) {
    throw new Error('잘못된 금액');
  }
  const [integer, fraction = ''] = amount.value.split('.');
  if (fraction.length > amount.scale) throw new Error('잘못된 금액 정밀도');
  return { units: BigInt(integer + fraction), scale: fraction.length };
}

function amountFromUnits(units: bigint, scale: number): Amount {
  const negative = units < ZERO;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  const integer = scale ? digits.slice(0, -scale) : digits;
  return { value: `${negative ? '-' : ''}${integer}${fraction ? '.' + fraction : ''}`, scale: fraction.length };
}

function formatUnits(units: bigint, scale: number, currency?: string): string {
  const value = amountFromUnits(units, scale).value;
  const negative = value.startsWith('-');
  const [integer, fraction] = (negative ? value.slice(1) : value).split('.');
  const prefix = currency === 'KRW' ? '₩' : currency === 'USD' ? '$' : currency === 'JPY' ? '¥' : '';
  const suffix = currency && !prefix ? ` ${currency}` : '';
  return `${negative ? '-' : ''}${prefix}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? '.' + fraction : ''}${suffix}`;
}

/** Exact decimal display. Group digits without ever converting money to Number. */
export function formatAmount(amount: Amount | undefined, currency?: string): string {
  if (!amount) return '—';
  try {
    const parsed = decimal(amount);
    return formatUnits(parsed.units, parsed.scale, currency);
  } catch {
    return '잘못된 금액';
  }
}

export interface ValuationTerm {
  quantity: Amount;
  price?: Amount;
  currency?: string;
}

/** Display-only products/sums may have 56 decimal places. Never send them as wire Amounts. */
export function formatValuationTotal(terms: ValuationTerm[]): string {
  if (!terms.length) return '해당 거래 없음';
  const totals = new Map<string, { units: bigint; scale: number }>();
  try {
    for (const term of terms) {
      if (!term.price || !term.currency) return '평가액 미확인';
      const quantity = decimal(term.quantity), price = decimal(term.price);
      const product = { units: quantity.units * price.units, scale: quantity.scale + price.scale };
      const prior = totals.get(term.currency) || { units: ZERO, scale: 0 };
      const scale = Math.max(prior.scale, product.scale);
      totals.set(term.currency, {
        units: prior.units * TEN ** BigInt(scale - prior.scale) + product.units * TEN ** BigInt(scale - product.scale), scale,
      });
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, total]) => formatUnits(total.units, total.scale, currency)).join(' / ');
  } catch {
    return '잘못된 금액';
  }
}

/** A change in valuation, including deposits/withdrawals; never an investment return. */
export function valuationDifference(before: Amount, after: Amount): Amount {
  const a = decimal(before), b = decimal(after);
  const scale = Math.max(a.scale, b.scale);
  return amountFromUnits(b.units * TEN ** BigInt(scale - b.scale) - a.units * TEN ** BigInt(scale - a.scale), scale);
}

export function assetIdentity(asset: AssetId): string {
  return JSON.stringify([asset.symbol, asset.chain_id || '', asset.contract || '']);
}
