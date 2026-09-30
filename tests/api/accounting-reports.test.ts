import { afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import fixtures from '../../../tracevault-contracts/http/fixtures/accounting-reports.json';
import type { AccountingReport } from '@/types/tax';
const state = vi.hoisted(() => ({ query: null as null | ((context: { signal?: AbortSignal }) => Promise<unknown>), key: [] as readonly unknown[], mutate: null as null | ((input: unknown) => Promise<unknown>), success: null as null | (() => void), invalidate: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: typeof state.query; queryKey: readonly unknown[] }) => { state.query = options.queryFn; state.key = options.queryKey; return {}; },
  useMutation: (options: { mutationFn: typeof state.mutate; onSuccess: () => void }) => { state.mutate = options.mutationFn; state.success = options.onSuccess; return {}; },
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
}));
vi.mock('@/lib/auth', () => ({
  getSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }),
  assertSession: () => ({ version: 1, id: 'owned-login', accessToken: 'owned-access', refreshToken: null }), getAccessToken: () => 'owned-access', getRefreshToken: () => null, setAccessToken: vi.fn(), setRefreshToken: vi.fn(), clearTokens: vi.fn() }));
import { downloadAccountingReport, useCreateAccountingReport, useAccountingReports } from '@/hooks/useAccountingReports';
afterEach(() => { vi.unstubAllGlobals(); state.invalidate.mockClear(); });
const envelope = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
it('creates the explicit format and owned run digest and keeps large sizes as strings', async () => {
  const fetcher = vi.fn().mockResolvedValue(envelope(fixtures.create, 201)); vi.stubGlobal('fetch', fetcher);
  useCreateAccountingReport(); const input = { run_id: fixtures.create.data.run_id, expected_run_digest: fixtures.create.data.run_digest, format: 'JSON' };
  const report = await state.mutate!(input) as AccountingReport; expect(report).toEqual(fixtures.create.data); expect(report.size_bytes).toBe('9007199254740993');
  const [url, init] = fetcher.mock.calls[0]; expect(url).toMatch(/\/tax\/accounting-reports$/); expect(JSON.parse(init.body)).toEqual(input); expect(new Headers(init.headers).get('Authorization')).toBe('Bearer owned-access');
  state.success!(); expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ['accounting-reports'] });
});
it('lists retained reports for the selected run and preserves the exclusive report cursor', async () => {
  const fetcher = vi.fn().mockResolvedValue(envelope(fixtures.list)); vi.stubGlobal('fetch', fetcher);
  useAccountingReports(fixtures.create.data.run_id, fixtures.create.data.id); expect(await state.query!({})).toEqual(fixtures.list.data);
  const url = new URL(fetcher.mock.calls[0][0]); expect(url.searchParams.get('run_id')).toBe(fixtures.create.data.run_id); expect(url.searchParams.get('before_report_id')).toBe(fixtures.create.data.id); expect(state.key).toContain(fixtures.create.data.run_id);
});
async function fileFixture() {
  vi.stubGlobal('crypto', webcrypto);
  const data = new TextEncoder().encode('회계 보고서\n-0.000000000000000001\n');
  const sha = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', data)), byte => byte.toString(16).padStart(2, '0')).join('');
  const report = { ...fixtures.create.data, size_bytes: String(data.length), sha256: sha } as AccountingReport;
  const headers: Record<string, string> = { 'Content-Type': report.media_type, 'Content-Length': report.size_bytes, 'Content-Disposition': `attachment; filename="${report.filename}"`, 'X-Content-SHA256': sha };
  return { data, report, headers };
}
it('offers only exact authenticated file bytes after independently checking SHA-256', async () => {
  const { data, report, headers } = await fileFixture(); const fetcher = vi.fn().mockResolvedValue(new Response(data, { headers })); vi.stubGlobal('fetch', fetcher);
  const blob = await downloadAccountingReport(report); expect(new Uint8Array(await blob.arrayBuffer())).toEqual(data);
  expect(fetcher.mock.calls[0][0]).toMatch(new RegExp(`/accounting-reports/${report.id}/download$`)); expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer owned-access');
});
it.each(['bytes','truncated','digest-header','length-header','filename','media','missing-header','partial-status'])('rejects a %s mismatch instead of saving a damaged report', async mode => {
  const { data, report, headers } = await fileFixture(); let bytes = data; let status = 200;
  if (mode === 'bytes') { bytes = data.slice(); bytes[0] ^= 1; }
  if (mode === 'truncated') bytes = data.slice(1);
  if (mode === 'digest-header') headers['X-Content-SHA256'] = 'a'.repeat(64);
  if (mode === 'length-header') headers['Content-Length'] = '9007199254740993';
  if (mode === 'filename') headers['Content-Disposition'] = 'attachment; filename="wrong.json"';
  if (mode === 'media') headers['Content-Type'] = 'text/html';
  if (mode === 'missing-header') headers['X-Content-SHA256'] = '';
  if (mode === 'partial-status') status = 206;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, { headers, status })));
  await expect(downloadAccountingReport(report)).rejects.toMatchObject({ code: 'INVALID_REPORT' });
});
it('preserves owner/dependency errors and cancels a download when its screen is left', async () => {
  const { data, report, headers } = await fileFixture();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope({ success: false, error: { code: 'NOT_FOUND', message: 'report not found' } }, 404)));
  await expect(downloadAccountingReport(report)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const controller = new AbortController(); controller.abort();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(data, { headers })));
  await expect(downloadAccountingReport(report, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
