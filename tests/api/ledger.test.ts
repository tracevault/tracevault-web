import { afterEach, expect, it, vi } from 'vitest';
import classification from '../../../tracevault-contracts/http/fixtures/ledger-classification-request.json';
import feeRequest from '../../../tracevault-contracts/http/fixtures/ledger-fee-request.json';
import type { LedgerEventListResponse } from '@/types';

const query = vi.hoisted(() => ({ fn: null as null | (() => Promise<unknown>), mutation: null as null | ((args: unknown) => Promise<unknown>) }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: { mutationFn: (args: unknown) => Promise<unknown> }) => { query.mutation = options.mutationFn; return {}; },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (options: { queryFn: () => Promise<unknown> }) => { query.fn = options.queryFn; return {}; },
}));
vi.mock('@/lib/auth', () => ({
  getSession: () => ({ version: 1, id: 'owned-login', accessToken: 'access-one', refreshToken: null }),
  assertSession: () => ({ version: 1, id: 'owned-login', accessToken: 'access-one', refreshToken: null }),
  getAccessToken: () => 'access-one', getRefreshToken: () => null,
  setAccessToken: vi.fn(), setRefreshToken: vi.fn(), clearTokens: vi.fn(),
}));
import { useLedgerEvents, useReclassifyEvent } from '@/hooks/useLedger';

afterEach(() => vi.unstubAllGlobals());

it('loads the requested real ledger page with canonical decimal fee fields', async () => {
  const data = {
    events: [{ ...feeRequest, id: '00000000-0000-4000-8000-000000000001', user_id: '00000000-0000-4000-8000-000000000002', created_at: '2026-01-01T00:00:00Z' }],
    pagination: { total: 101, limit: 20, offset: 20, has_more: true },
  };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  useLedgerEvents({ event_type: 'BUY', limit: 20, offset: 20 });
  const actual = await query.fn!() as LedgerEventListResponse;
  expect(actual).toEqual(data);
  expect(actual.events[0].fee_amount?.value).toBe('0.000000000000000001');
  expect(actual.pagination.has_more).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/ledger\/events\?event_type=BUY&limit=20&offset=20$/);
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access-one');
});

it('keeps ledger service outages visible instead of returning sample transactions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Ledger unavailable' },
  }), { status: 503 })));
  useLedgerEvents();
  await expect(query.fn!()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
});

it('sends the shared optimistic classification contract through authenticated HTTP', async () => {
  const eventId = '00000000-0000-4000-8000-000000000001';
  const result = { id: '00000000-0000-4000-8000-000000000003', event_type: 'CORRECTION', correction_of: eventId, replacement_event_type: classification.new_event_type, classification_revision: 3, correction_reason: classification.reason };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: result }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  useReclassifyEvent();
  expect(await query.mutation!({eventId, data: classification})).toEqual(result);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(new RegExp('/ledger/events/' + eventId + '/classification$'));
  expect(options.method).toBe('PATCH');
  expect(JSON.parse(options.body)).toEqual(classification);
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access-one');
});
it('preserves revision conflicts instead of treating an unsuccessful correction as saved', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({success:false,error:{code:'CONFLICT',message:'Classification revision conflict'}}), {status:409})));
  useReclassifyEvent();
  await expect(query.mutation!({eventId:'example',data:classification})).rejects.toMatchObject({code:'CONFLICT'});
});
