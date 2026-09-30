'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LegalTaxReports } from '@/components/tax/legal-tax-reports';
import { useCheckLegalTaxRun, useCreateLegalTaxRun, useLatestTaxpayerInputSnapshot, useLegalTaxPolicyCatalog, useLegalTaxRuns } from '@/hooks/useTax';
import { formatAmount } from '@/lib/amount';
import { ApiRequestError } from '@/types';
import type { AccountingRun, LegalTaxCalculation, LegalTaxPolicy, LegalTaxRun, TaxpayerInputSnapshot } from '@/types/tax';

const fieldClass = 'rounded-md border border-input bg-background px-3 py-2 text-sm';

function ErrorNotice({ error }: { error: unknown }) {
  return <p role="alert" className="text-sm text-red-600 break-words">{error instanceof Error ? error.message : '법정 세액을 계산하지 못했습니다.'}</p>;
}

const freshnessLabel: Record<LegalTaxRun['freshness'], string> = {
  NOT_CHECKED: '현재 상태를 아직 확인하지 않음',
  CURRENT: '현재 정책·회계·납세자 입력과 일치',
  STALE_ACCOUNTING_PROFILE: '회계 설정이 변경됨',
  STALE_ACCOUNTING_SOURCE: '원장 입력이 변경됨',
  STALE_ACCOUNTING_FX: '가격 또는 환율 근거가 변경됨',
  STALE_ACCOUNTING_PROJECTION: '회계 계산 버전이 변경됨',
  STALE_TAXPAYER_INPUT: '납세자 확인 입력이 변경됨',
  STALE_POLICY: '법률 정책이 변경되거나 철회됨',
};

function CalculationResult({ run, calculation, onCheck, checking }: { run: LegalTaxRun; calculation: LegalTaxCalculation; onCheck: () => void; checking: boolean }) {
  return <div className="space-y-4" aria-live="polite">
    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"><p>이 결과는 선택한 정책과 불변 입력으로 보존한 재현 가능한 세액 계산입니다. 세무 신고 접수나 과세관청의 확정을 의미하지 않습니다.</p><p className="mt-2 text-xs">실행 번호 {run.id} · {new Date(run.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p><p className="mt-1 text-xs">{freshnessLabel[run.freshness]}</p></div>
    <Button variant="outline" disabled={checking} onClick={onCheck}>{checking ? '현재 자료와 비교 중…' : '현재 정책·자료와 비교'}</Button>
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[
        ['가상자산 총수입', calculation.gross_receipts],
        ['인정 취득가액', calculation.allowable_acquisition_cost],
        ['인정 부대비용', calculation.allowable_incidental_expenses],
        ['공제 전 소득', calculation.income_before_deduction],
        ['기본공제 적용', calculation.deduction_applied],
        ['과세표준', calculation.taxable_base],
        [`국세 (${calculation.national_tax_rate})`, calculation.national_tax],
        [`지방소득세 (${calculation.local_tax_rate})`, calculation.local_tax],
        ['합계 세액', calculation.total_tax],
      ].map(([label, amount]) => <div key={label as string} className="rounded-lg bg-muted/50 p-4"><dt className="text-sm text-muted-foreground">{label as string}</dt><dd className="mt-2 break-all font-semibold">{formatAmount(amount as typeof calculation.total_tax, calculation.currency)}</dd></div>)}
    </dl>
    {calculation.annual_assets.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">연평균·간주취득가액 계산 근거</summary><ul className="mt-3 space-y-3">{calculation.annual_assets.map(item => <li key={`${item.year}:${item.asset_id.symbol}:${item.asset_id.chain_id ?? ''}:${item.asset_id.contract ?? ''}`} className="rounded-md border border-border p-3 text-xs"><p className="font-medium">{item.year}년 · {item.asset_id.symbol}</p><p className="mt-1">실제 기초원가 {formatAmount(item.actual_opening_cost_basis, calculation.currency)} · 선택 기초원가 {formatAmount(item.selected_opening_cost_basis, calculation.currency)}</p>{item.deemed_unit_market_value && <p className="mt-1">간주 1개당 시가 {formatAmount(item.deemed_unit_market_value, calculation.currency)}</p>}<p className="mt-1">처분 수량 {formatAmount(item.disposed_quantity)} · 인정 처분원가 {formatAmount(item.allowable_disposed_cost_basis, calculation.currency)}</p></li>)}</ul></details>}
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">재현·검증 정보</summary><dl className="mt-2 grid gap-2 break-all sm:grid-cols-[10rem_1fr]"><dt>계산 버전</dt><dd>{calculation.calculation_version}</dd><dt>계산 검증값</dt><dd>{calculation.calculation_digest}</dd><dt>회계 실행 검증값</dt><dd>{calculation.accounting_run_digest}</dd><dt>납세자 입력 검증값</dt><dd>{calculation.taxpayer_input_digest}</dd><dt>절사 규칙</dt><dd>{calculation.rounding_rule}</dd></dl></details>
    <LegalTaxReports run={run} />
  </div>;
}

function PreviewAction({ run, snapshot, policies }: { run: AccountingRun; snapshot: TaxpayerInputSnapshot; policies: LegalTaxPolicy[] }) {
  const [selected, setSelected] = useState(policies[0]?.policy_id ?? '');
  const [selectedRunID, setSelectedRunID] = useState('');
  const create = useCreateLegalTaxRun();
  const history = useLegalTaxRuns(run.id);
  const check = useCheckLegalTaxRun();
  const policy = policies.find(item => item.policy_id === selected);
  const retained = check.data?.id === selectedRunID
    ? check.data
    : create.data?.id === selectedRunID || (!selectedRunID && create.data)
      ? create.data
      : history.data?.runs.find(item => item.id === selectedRunID) ?? (!selectedRunID ? history.data?.runs[0] : undefined);
  const calculation = retained?.calculation;

  return <div className="space-y-4">
    <label className="flex flex-col gap-2 text-sm">적용 법률 정책<select className={fieldClass} value={selected} onChange={event => setSelected(event.target.value)}>{policies.map(item => <option key={item.policy_id} value={item.policy_id}>{item.policy_id} · v{item.semantic_version}</option>)}</select></label>
    {policy && <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground"><p>적용 기간: {policy.effective_from_year}년부터{policy.effective_to_year ? ` ${policy.effective_to_year}년까지` : ''}</p><p className="mt-1">정책 검증값: <span className="break-all">{policy.content_sha256}</span></p>{policy.limitations.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{policy.limitations.map(item => <li key={item}>{item}</li>)}</ul>}</div>}
    <Button disabled={!selected || create.isPending} onClick={() => create.mutate({
      policy_id: selected,
      accounting_run_id: run.id,
      expected_accounting_run_digest: run.content_digest,
      taxpayer_input_snapshot_id: snapshot.id,
      expected_taxpayer_input_digest: snapshot.content_digest,
    }, { onSuccess: created => setSelectedRunID(created.id) })}>{create.isPending ? '불변 자료를 검증하고 저장 중…' : '법정 세액 실행 생성'}</Button>
    {create.error && <ErrorNotice error={create.error} />}
    {history.error && <ErrorNotice error={history.error} />}
    {check.error && <ErrorNotice error={check.error} />}
    {history.data && history.data.runs.length > 0 && <div><p className="text-sm font-medium">보존된 세액 실행</p><div className="mt-2 flex flex-wrap gap-2">{history.data.runs.map(item => <Button key={item.id} variant={retained?.id === item.id ? 'default' : 'outline'} onClick={() => setSelectedRunID(item.id)}>{new Date(item.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · {formatAmount(item.calculation.total_tax, item.calculation.currency)}</Button>)}</div></div>}
    {retained && calculation && <CalculationResult run={retained} calculation={calculation} checking={check.isPending} onCheck={() => check.mutate(retained.id, { onSuccess: checked => setSelectedRunID(checked.id) })} />}
  </div>;
}

export function LegalTaxPreview({ run }: { run: AccountingRun }) {
  const catalog = useLegalTaxPolicyCatalog(run.profile.jurisdiction, run.profile.tax_year);
  const latest = useLatestTaxpayerInputSnapshot(run.profile.jurisdiction, run.profile.tax_year);
  const policies = catalog.data?.policies.filter(policy => policy.release_state === 'ACTIVE' && policy.calculation_available) ?? [];
  const inputMissing = latest.error instanceof ApiRequestError && latest.error.code === 'NOT_FOUND';

  return <section className="rounded-lg border border-border p-4 space-y-3"><h3 className="font-medium">법정 세액 실행</h3>
    <p className="text-sm text-muted-foreground">선택한 불변 회계 결과와 최신 납세자 입력의 검증값을 묶어 계산하고 보존합니다. 이후 정책·원장·환율·납세자 입력의 변경 여부를 별도로 확인할 수 있습니다.</p>
    {(catalog.isLoading || latest.isLoading) && <p role="status" className="text-sm">정책과 납세자 입력을 확인하는 중…</p>}
    {catalog.error && <ErrorNotice error={catalog.error} />}
    {latest.error && !inputMissing && <ErrorNotice error={latest.error} />}
    {inputMissing && <p className="text-sm text-muted-foreground">먼저 위의 납세자 확인 입력을 저장하세요.</p>}
    {catalog.data && policies.length === 0 && <p className="text-sm text-muted-foreground">이 국가·연도에 실행 가능한 검토 정책이 없습니다.</p>}
    {latest.data && policies.length > 0 && <PreviewAction key={`${run.id}:${latest.data.id}`} run={run} snapshot={latest.data} policies={policies} />}
  </section>;
}
