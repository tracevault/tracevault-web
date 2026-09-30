import { afterEach, expect, it, vi } from 'vitest';
import fixtures from '../../../tracevault-contracts/http/fixtures/accounting-runs.json';
import type { AccountingRun, AccountingRunEntries, AccountingRunEntryKind, AccountingRunResult } from '@/types/tax';
const state = vi.hoisted(() => ({
  query: null as null | (() => Promise<unknown>), key: [] as readonly unknown[],
  mutate: null as null | ((input: unknown) => Promise<unknown>), success: null as null | (() => void),
  invalidate: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<unknown>; queryKey: readonly unknown[] }) => { state.query = options.queryFn; state.key = options.queryKey; return {}; },
  useMutation: (options: { mutationFn: (input: unknown) => Promise<unknown>; onSuccess: () => void }) => { state.mutate = options.mutationFn; state.success = options.onSuccess; return {}; },
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
}));
vi.mock('@/lib/auth', () => ({
  getSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }),
  assertSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }), getAccessToken: () => 'owned-access', getRefreshToken: () => null, setAccessToken: vi.fn(), setRefreshToken: vi.fn(), clearTokens: vi.fn() }));
import { useCreateAccountingRun, useAccountingRuns, useAccountingRun, useAccountingRunEntries } from '@/hooks/useAccountingRuns';
import { useUpdateTaxProfile } from '@/hooks/useTax';
afterEach(() => { vi.unstubAllGlobals(); state.invalidate.mockClear(); });
function response(data: unknown) { const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))); vi.stubGlobal('fetch', fetcher); return fetcher; }
it('creates against the requested profile revision and preserves signed exact money and 64-bit counts', async () => {
  const fetcher = response(fixtures.create); useCreateAccountingRun();
  const input = { profile_id: fixtures.create.data.profile.id, expected_revision: 8 };
  const result = await state.mutate!(input) as AccountingRun;
  expect(result).toEqual(fixtures.create.data);
  expect(result.summary.net_gain.value).toBe('-123.000000000000000001');
  expect(result.entry_counts[0].count).toBe('9007199254740993');
  const [url, options] = fetcher.mock.calls[0]; expect(url).toMatch(/\/tax\/accounting-runs$/); expect(JSON.parse(options.body)).toEqual(input);
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer owned-access');
  state.success!(); expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ['accounting-runs'] });
});
it('lists only the selected profile and carries the explicit run cursor', async () => {
  const fetcher = response(fixtures.list); useAccountingRuns(fixtures.create.data.profile.id, fixtures.create.data.id);
  expect(await state.query!()).toEqual(fixtures.list.data);
  const url = new URL(fetcher.mock.calls[0][0]); expect(url.searchParams.get('profile_id')).toBe(fixtures.create.data.profile.id); expect(url.searchParams.get('before_run_id')).toBe(fixtures.create.data.id);
  expect(state.key).toContain(fixtures.create.data.profile.id);
});
it('keeps historical retrieval and currentness checks in different cache entries', async () => {
  const fetcher = response(fixtures.get); useAccountingRun(fixtures.create.data.id, false); const unchecked = [...state.key];
  useAccountingRun(fixtures.create.data.id, true); expect(state.key).not.toEqual(unchecked);
  const result = await state.query!() as AccountingRunResult; expect(result.freshness).toBe('STALE_SOURCE'); expect(result.checked_at).toBe('2024-01-01T00:00:00.123456789Z');
  expect(fetcher.mock.calls[0][0]).toMatch(/check_current=true$/);
});
it.each(['LOT','DISPOSITION','CONSUMPTION','ANNUAL_POOL','FX','SOURCE_EVENT'] as AccountingRunEntryKind[])('preserves %s details and uses the returned string cursor without Number conversion', async kind => {
  const fetcher = response(fixtures[kind]); useAccountingRunEntries(fixtures.create.data.id, kind, '9007199254740993');
  const page = await state.query!() as AccountingRunEntries; expect(page).toEqual(fixtures[kind].data); expect(page.total_count).toBe('18446744073709551615');
  const url = new URL(fetcher.mock.calls[0][0]); expect(url.searchParams.get('kind')).toBe(kind); expect(url.searchParams.get('after_index')).toBe('9007199254740993');
  expect(state.key).toContain('9007199254740993');
});
it('does not convert a failed freshness check into a current or cached successful result', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'FX unavailable' } }), { status: 503 })));
  useAccountingRun(fixtures.create.data.id, true); await expect(state.query!()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
});
it('profile edits invalidate cached run metadata and freshness', () => {
  useUpdateTaxProfile(); state.success!(); expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ['accounting-runs'] });
});
