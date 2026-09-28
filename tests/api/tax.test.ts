import { afterEach, expect, it, vi } from 'vitest';
import profile from '../../../tracevault-contracts/http/fixtures/tax-profile-success.json';
import calculation from '../../../tracevault-contracts/http/fixtures/tax-calculation-success.json';
import legalPolicyCatalog from '../../../tracevault-contracts/http/fixtures/legal-tax-policy-catalog-empty.json';
import taxpayerInput from '../../../tracevault-contracts/http/fixtures/taxpayer-input-snapshot.json';
import legalTaxCalculation from '../../../tracevault-contracts/http/fixtures/legal-tax-calculation.json';
import legalTaxRun from '../../../tracevault-contracts/http/fixtures/legal-tax-run.json';
import type { CreateLegalTaxRunRequest, CreateTaxpayerInputSnapshotRequest, LegalTaxCalculation, LegalTaxPolicyCatalog, LegalTaxRun, LegalTaxRunList, PreviewLegalTaxRequest, TaxCalculationResponse, TaxCalculateRequest, TaxpayerInputSnapshot, TaxProfile } from '@/types';

const captured = vi.hoisted(() => ({
  query: null as null | (() => Promise<unknown>),
  mutation: null as null | ((value: unknown) => Promise<unknown>),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> }) => { captured.query = options.queryFn; return {}; },
  useMutation: (options: { mutationFn: (value: unknown) => Promise<unknown> }) => { captured.mutation = options.mutationFn; return {}; },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/auth', () => ({
  getSession: () => ({ version: 1, id: 'owned-login', accessToken: 'access-one', refreshToken: null }),
  assertSession: () => ({ version: 1, id: 'owned-login', accessToken: 'access-one', refreshToken: null }),
  getAccessToken: () => 'access-one', getRefreshToken: () => null,
  setAccessToken: vi.fn(), setRefreshToken: vi.fn(), clearTokens: vi.fn(),
}));
import { useTaxProfile, useUpdateTaxProfile, useCalculateTax, useTaxSummary, useTaxLots, useTaxReports, useLegalTaxPolicyCatalog, useLatestTaxpayerInputSnapshot, useTaxpayerInputSnapshot, useCreateTaxpayerInputSnapshot, usePreviewLegalTax, useCreateLegalTaxRun, useLegalTaxRuns, useCheckLegalTaxRun } from '@/hooks/useTax';

afterEach(() => vi.unstubAllGlobals());
it('consumes the shared profile fixture without changing total-average or jurisdiction names', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  useTaxProfile(2024);
  const result = await captured.query!() as TaxProfile;
  expect(result).toEqual(profile.data);
  expect(result.cost_basis_method).toBe('TOTAL_AVERAGE');
  expect(result.jurisdiction).toBe('JAPAN');
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/v1\/tax\/profiles\?tax_year=2024$/);
});
it('calculation sends the selected method and preserves exact decimal/percentage response values', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(calculation), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  useCalculateTax();
  const request: TaxCalculateRequest = { jurisdiction: 'JAPAN', tax_year: 2024, cost_basis_method: 'TOTAL_AVERAGE' };
  const result = await captured.mutation!(request) as TaxCalculationResponse;
  expect(result).toEqual(calculation.data);
  expect(result.summary.tax_rate).toBe('20.315%');
  expect(result.summary.total_cost_basis.value).toBe('123.000000000000000001');
  expect(result.events[0].asset_id.chain_id).toBe('eip155:1');
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/api\/v1\/tax\/calculate$/);
  expect(JSON.parse(options.body)).toEqual(request);
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access-one');
});
it('reads the explicit empty legal-policy catalog without inventing a default', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(legalPolicyCatalog), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  useLegalTaxPolicyCatalog('KOREA', 2027);
  const result = await captured.query!() as LegalTaxPolicyCatalog;
  expect(result).toEqual(legalPolicyCatalog.data);
  expect(result.calculation_available).toBe(false);
  expect(result.policies).toEqual([]);
  expect(result.unavailable_reason).toBe('NO_ACTIVE_REVIEWED_POLICY');
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/v1\/tax\/legal-policies\?jurisdiction=KOREA&tax_year=2027$/);
});
it('reads immutable taxpayer inputs by scope and ID and preserves optional false values', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(taxpayerInput), { status: 200 })));
  vi.stubGlobal('fetch', fetcher);
  useLatestTaxpayerInputSnapshot('KOREA', 2027);
  const latest = await captured.query!() as TaxpayerInputSnapshot;
  expect(latest).toEqual(taxpayerInput.data);
  expect(latest.payload.business_related_activity).toBe(false);
  expect(fetcher.mock.calls[0][0]).toMatch(/taxpayer-input-snapshots\/latest\?jurisdiction=KOREA&tax_year=2027$/);
  useTaxpayerInputSnapshot(taxpayerInput.data.id);
  expect(await captured.query!()).toEqual(taxpayerInput.data);
  expect(fetcher.mock.calls[1][0]).toMatch(new RegExp(`/taxpayer-input-snapshots/${taxpayerInput.data.id}$`));
});
it('creates the exact typed taxpayer input payload with an optimistic revision', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(taxpayerInput), { status: 201 }));
  vi.stubGlobal('fetch', fetcher);
  useCreateTaxpayerInputSnapshot();
  const request: CreateTaxpayerInputSnapshotRequest = {
    jurisdiction: 'KOREA', tax_year: 2027, expected_latest_revision: 0,
    payload: taxpayerInput.data.payload as TaxpayerInputSnapshot['payload'],
  };
  expect(await captured.mutation!(request)).toEqual(taxpayerInput.data);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/tax\/taxpayer-input-snapshots$/);
  expect(JSON.parse(options.body)).toEqual(request);
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access-one');
});
it('binds legal preview to exact immutable run and taxpayer-input digests', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(legalTaxCalculation), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  usePreviewLegalTax();
  const request: PreviewLegalTaxRequest = {
    policy_id: legalTaxCalculation.data.policy.policy_id,
    accounting_run_id: legalTaxCalculation.data.accounting_run_id,
    expected_accounting_run_digest: legalTaxCalculation.data.accounting_run_digest,
    taxpayer_input_snapshot_id: legalTaxCalculation.data.taxpayer_input_snapshot_id,
    expected_taxpayer_input_digest: legalTaxCalculation.data.taxpayer_input_digest,
  };
  const result = await captured.mutation!(request) as LegalTaxCalculation;
  expect(result).toEqual(legalTaxCalculation.data);
  expect(result.total_tax.value).toBe('1188000');
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/tax\/legal-tax-previews$/);
  expect(JSON.parse(options.body)).toEqual(request);
});
it('creates, lists and freshness-checks retained legal-tax runs by immutable identity', async () => {
  const list = { success: true, data: { runs: [legalTaxRun.data], has_more: false }, meta: legalTaxRun.meta };
  const fetcher = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const body = String(url).includes('?accounting_run_id=') ? list : legalTaxRun;
    return Promise.resolve(new Response(JSON.stringify(body), { status: options?.method === 'POST' ? 201 : 200 }));
  });
  vi.stubGlobal('fetch', fetcher);
  useCreateLegalTaxRun();
  const request: CreateLegalTaxRunRequest = {
    policy_id: legalTaxRun.data.calculation.policy.policy_id,
    accounting_run_id: legalTaxRun.data.calculation.accounting_run_id,
    expected_accounting_run_digest: legalTaxRun.data.calculation.accounting_run_digest,
    taxpayer_input_snapshot_id: legalTaxRun.data.calculation.taxpayer_input_snapshot_id,
    expected_taxpayer_input_digest: legalTaxRun.data.calculation.taxpayer_input_digest,
  };
  expect(await captured.mutation!(request)).toEqual(legalTaxRun.data as LegalTaxRun);
  expect(fetcher.mock.calls[0][0]).toMatch(/\/tax\/legal-tax-runs$/);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(request);

  useLegalTaxRuns(request.accounting_run_id);
  expect(await captured.query!()).toEqual(list.data as LegalTaxRunList);
  expect(fetcher.mock.calls[1][0]).toMatch(new RegExp(`/tax/legal-tax-runs\\?accounting_run_id=${request.accounting_run_id}&limit=20$`));

  useCheckLegalTaxRun();
  expect(await captured.mutation!(legalTaxRun.data.id)).toEqual(legalTaxRun.data as LegalTaxRun);
  expect(fetcher.mock.calls[2][0]).toMatch(new RegExp(`/tax/legal-tax-runs/${legalTaxRun.data.id}\\?check_current=true$`));
});
it('unavailable summaries, lots and reports never fall back to mock tax records', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
    success: false, error: { code: 'FAILED_PRECONDITION', message: 'Calculation prerequisites missing' },
  }), { status: 412 })));
  vi.stubGlobal('fetch', fetcher);
  for (const hook of [() => useTaxSummary(2024), () => useTaxLots({ include_consumed: true }), () => useTaxReports(2024)]) {
    hook();
    await expect(captured.query!()).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
  }
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
    expect.stringMatching(/\/tax\/summary\?tax_year=2024$/),
    expect.stringMatching(/\/tax\/lots\?include_consumed=true$/),
    expect.stringMatching(/\/tax\/reports\?tax_year=2024$/),
  ]);
});

it('profile updates preserve the requested ID and optimistic revision', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  useUpdateTaxProfile();
  const result = await captured.mutation!({ id: profile.data.id, data: { cost_basis_method: 'TOTAL_AVERAGE', expected_revision: 7 } }) as TaxProfile;
  expect(result.revision).toBe(8);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toMatch(new RegExp(`/tax/profiles/${profile.data.id}$`));
  expect(JSON.parse(options.body)).toEqual({ cost_basis_method: 'TOTAL_AVERAGE', expected_revision: 7 });
});
