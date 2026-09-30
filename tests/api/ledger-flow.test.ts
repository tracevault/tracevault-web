import { afterEach, describe, expect, it, vi } from 'vitest';
import trace from '../../../tracevault-contracts/http/fixtures/ledger-trace-success.json';
vi.mock('@/lib/auth', () => ({
  getSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }),
  assertSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }), getAccessToken: () => 'fixture', getRefreshToken: () => null }));
import { getAssetFlow, getEventTrace } from '@/lib/api/ledger-flow';
import { formatAmount } from '@/lib/amount';
afterEach(() => vi.unstubAllGlobals());
describe('Ledger flow HTTP consumer', () => {
  it('preserves shared Gateway output, units, multiple origins and incomplete status', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(trace), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await getEventTrace(trace.data.path.at(-1)!.event_id, { max_depth: 7, max_nodes: 100, max_edges: 200 });
    expect(result).toEqual(trace.data);
    expect(result.origin_event_id).toBeUndefined();
    expect(result.origin_event_ids).toHaveLength(2);
    expect(result.complete).toBe(false);
    expect(result.truncated).toBe(true);
    expect(formatAmount(result.edges[0].amount)).toBe('0.000000000000000001');
    expect(fetcher.mock.calls[0][0]).toContain('/trace?max_depth=7&max_nodes=100&max_edges=200');
  });
  it('sends full identity, inclusive dates and bounds to the canonical flow route', async () => {
    const { path: nodes, origin_event_ids: _origins, ...rest } = trace.data;
    void _origins;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...trace, data: { ...rest, nodes } })));
    vi.stubGlobal('fetch', fetcher);
    const query = { asset_symbol: 'TOKEN', chain_id: 'eip155:1', contract: '0x123', from_date: '2026-01-01T00:00:00Z', to_date: '2026-01-02T00:00:00Z', max_depth: 7, max_nodes: 100, max_edges: 200 };
    expect((await getAssetFlow(query)).nodes).toEqual(nodes);
    const params = new URL(fetcher.mock.calls[0][0], 'http://localhost').searchParams;
    for (const [key, value] of Object.entries(query)) expect(params.get(key)).toBe(String(value));
  });
});
