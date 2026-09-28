import { afterEach, expect, it, vi } from 'vitest';
import portfolio from '../../../tracevault-contracts/http/fixtures/portfolio-success.json';
import type { PortfolioResponse } from '@/types';

const query = vi.hoisted(() => ({ fn: null as null | (() => Promise<unknown>) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> }) => { query.fn = options.queryFn; return {}; },
}));
vi.mock('@/lib/auth', () => ({
  getSession: () => ({ version: 1, id: 'owned-login', accessToken: 'access-one', refreshToken: null }),
  assertSession: () => ({ version: 1, id: 'owned-login', accessToken: 'access-one', refreshToken: null }),
  getAccessToken: () => 'access-one', getRefreshToken: () => null,
  setAccessToken: vi.fn(), setRefreshToken: vi.fn(), clearTokens: vi.fn(),
}));
import { usePortfolio } from '@/hooks/useValuation';

afterEach(() => vi.unstubAllGlobals());
it('portfolio query uses authenticated HTTP and preserves the shared Gateway decimal fixture', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(portfolio), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  usePortfolio('KRW');
  const actual = await query.fn!() as PortfolioResponse;
  expect(actual).toEqual(portfolio.data);
  expect(actual.total_value_local.value).toBe('160075.69425234332113863052797');
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/valuation\/portfolio\?local_currency=KRW$/);
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access-one');
});
it('portfolio price outages remain errors instead of fallback mock balances', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Required price unavailable' },
  }), { status: 503 })));
  usePortfolio('KRW');
  await expect(query.fn!()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
});
