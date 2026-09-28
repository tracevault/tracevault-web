'use client';

import { useState } from 'react';
import { AccountingReports } from '@/components/tax/accounting-reports';
import { TaxpayerInputs } from '@/components/tax/taxpayer-inputs';
import { LegalTaxPreview } from '@/components/tax/legal-tax-preview';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/lib/amount';
import { ApiRequestError } from '@/types';
import { ACCOUNTING_POLICY_V2 } from '@/types/tax';
import type { AccountingRun, AccountingRunEntries, AccountingRunEntryKind, AccountingRunResult, CostBasisMethod, Jurisdiction, TaxProfile } from '@/types/tax';
import { useTaxProfile, useCreateTaxProfile, useUpdateTaxProfile, useLegalTaxPolicyCatalog } from '@/hooks/useTax';
import { useAccountingRun, useAccountingRunEntries, useAccountingRuns, useCreateAccountingRun } from '@/hooks/useAccountingRuns';

const methods: Record<CostBasisMethod, string> = { FIFO: '선입선출', LIFO: '후입선출', MOVING_AVERAGE: '이동평균', TOTAL_AVERAGE: '연간 총평균' };
const kinds: Record<AccountingRunEntryKind, string> = { LOT: '취득 내역', DISPOSITION: '처분 내역', CONSUMPTION: '취득·처분 연결', ANNUAL_POOL: '연간 평균 계산', FX: '환율 근거', SOURCE_EVENT: '계산에 사용한 거래', INCOME: '보상·에어드롭 수익', EXPENSE: '법정화폐 이전 수수료' };
const freshness: Record<AccountingRunResult['freshness'], string> = {
  NOT_CHECKED: '저장된 결과입니다. 현재 거래·설정과 같은지 확인하지 않았습니다.',
  CURRENT: '확인 시점의 거래·설정·환율과 일치합니다.',
  STALE_PROFILE: '계산 설정이 변경되었습니다. 새 결과를 생성하세요.',
  STALE_SOURCE: '거래 내역이 변경되었습니다. 새 결과를 생성하세요.',
  STALE_VALUATION: '환율 근거가 변경되었습니다. 새 결과를 생성하세요.',
  STALE_PROJECTION: '계산 방식이 업데이트되었습니다. 새 결과를 생성하세요.',
};
const fieldClass = 'rounded-md border border-input bg-background px-3 py-2 text-sm';
const panelClass = 'rounded-xl border border-border bg-card p-5 space-y-4';
function date(value: string) { return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }); }
function ErrorNotice({ error }: { error: unknown }) {
  return <p role="alert" className="text-sm text-red-600 break-words">{error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'}</p>;
}
function MethodSelect({ value, onChange }: { value: CostBasisMethod; onChange: (value: CostBasisMethod) => void }) {
  return <label className="flex flex-col gap-2 text-sm">취득 원가 계산 방식<select className={fieldClass} value={value} onChange={e => onChange(e.target.value as CostBasisMethod)}>{Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>;
}

export default function TaxPage() {
  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()));
  const [year, setYear] = useState(currentYear);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">세금 · 거래 손익</h1><p className="mt-2 text-sm text-muted-foreground">연도별 계산 설정과 근거가 보존된 거래 손익을 확인합니다.</p></div>
      <label className="flex flex-col gap-2 text-sm">보고 연도<select className={fieldClass} value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: currentYear - 2009 + 2 }, (_, i) => currentYear + 1 - i).map(y => <option key={y} value={y}>{y}년</option>)}</select></label></div>
    <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">현재 결과는 거래 원가와 손익 계산입니다. 국가별 과세 요건·공제·세율을 적용한 확정 세액이나 신고서가 아닙니다. 계산 방식 선택이 법적 신고 방식의 승인을 의미하지 않습니다.</p>
    <YearWorkspace key={year} year={year} />
  </div>;
}
function YearWorkspace({ year }: { year: number }) {
  const profile = useTaxProfile(year);
  if (profile.isLoading) return <p role="status">계산 설정을 불러오는 중…</p>;
  if (profile.error) {
    if (profile.error instanceof ApiRequestError && profile.error.code === 'NOT_FOUND') return <CreateProfile year={year} />;
    return <section className={panelClass}><ErrorNotice error={profile.error} /><Button onClick={() => profile.refetch()}>설정 다시 불러오기</Button></section>;
  }
  return profile.data ? <><ProfileWorkspace profile={profile.data} /><LegalTaxAvailability jurisdiction={profile.data.jurisdiction} year={profile.data.tax_year} /></> : null;
}

function LegalTaxAvailability({ jurisdiction, year }: { jurisdiction: Jurisdiction; year: number }) {
  const catalog = useLegalTaxPolicyCatalog(jurisdiction, year);
  return <section className={panelClass}><h2 className="font-semibold">세액 및 신고서</h2>
    {catalog.isLoading && <p role="status" className="text-sm">법률 정책 등록 상태를 확인하는 중…</p>}
    {catalog.error && <><ErrorNotice error={catalog.error} /><Button variant="outline" onClick={() => catalog.refetch()}>정책 상태 다시 확인</Button></>}
    {catalog.data && (catalog.data.calculation_available
      ? <><p className="text-sm">검토를 마친 적용 가능한 법률 정책 {catalog.data.policies.filter(policy => policy.release_state === 'ACTIVE' && policy.calculation_available).length}개가 등록되어 있습니다.</p><p className="text-sm text-muted-foreground">저장된 회계 결과와 납세자 확인 입력을 선택해 아래에서 재현 가능한 세액 미리보기를 만들 수 있습니다.</p></>
      : <p className="text-sm text-muted-foreground">{year}년 {jurisdiction === 'KOREA' ? '한국' : '일본'}에 적용할 활성 법률 정책이 아직 등록되지 않았습니다. 거래 손익 보고서는 계산 근거를 보존하지만 신고 세액을 산출하지 않습니다.</p>)}
  </section>;
}
function CreateProfile({ year }: { year: number }) {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>('KOREA');
  const [method, setMethod] = useState<CostBasisMethod>('FIFO');
  const create = useCreateTaxProfile();
  return <form className={panelClass} onSubmit={e => { e.preventDefault(); create.mutate({ tax_year: year, jurisdiction, cost_basis_method: method, accounting_policy: ACCOUNTING_POLICY_V2 }); }}>
    <h2 className="font-semibold">{year}년 계산 설정 만들기</h2><p className="text-sm text-muted-foreground">보고 국가는 저장 후 바꿀 수 없습니다. 계산 방식은 나중에 변경할 수 있으며 이전 결과는 보존됩니다. 연도 구분은 한국·일본 시간(UTC+9)을 사용합니다.</p><p className="rounded-md bg-muted p-3 text-sm">회계 정책 v2: 보상·에어드롭은 수령 시점 가치로 취득 원가와 별도 수익을 기록합니다. 가상자산 이전 수수료는 당시 가치의 별도 자산 처분으로, 법정화폐 이전 수수료는 손익과 분리된 비용으로 기록합니다. 법적 과세 판단은 포함하지 않습니다.</p>
    <div className="flex flex-wrap gap-4"><label className="flex flex-col gap-2 text-sm">보고 국가<select className={fieldClass} value={jurisdiction} onChange={e => setJurisdiction(e.target.value as Jurisdiction)}><option value="KOREA">한국 · KRW</option><option value="JAPAN">일본 · JPY</option></select></label><MethodSelect value={method} onChange={setMethod} /></div>
    {create.error && <ErrorNotice error={create.error} />}<Button type="submit" disabled={create.isPending}>{create.isPending ? '저장 중…' : '계산 설정 저장'}</Button>
  </form>;
}
function ProfileWorkspace({ profile }: { profile: TaxProfile }) {
  const [runId, setRunId] = useState('');
  const create = useCreateAccountingRun();
  return <>
    <section className={panelClass}><h2 className="font-semibold">{profile.tax_year}년 · {profile.jurisdiction === 'KOREA' ? '한국' : '일본'} · {profile.local_currency}</h2>
      <EditProfile key={profile.revision} profile={profile} />
      {profile.accounting_policy.version === 2 && <p className="rounded-md bg-muted p-3 text-sm">회계 정책 v2 적용 중: 보상·에어드롭 수익, 가상자산 이전 수수료 처분, 법정화폐 이전 수수료 비용을 서로 분리해 기록합니다.</p>}
      <p className="text-sm text-muted-foreground">이전 연도의 취득 내역을 포함해 해당 연도 말까지 계산합니다. 동일한 입력으로 다시 계산하면 기존 결과를 반환합니다. 처리할 수 없는 거래가 있으면 오류를 표시합니다.</p>
      <Button disabled={create.isPending} onClick={() => create.mutate({ profile_id: profile.id, expected_revision: profile.revision }, { onSuccess: run => setRunId(run.id) })}>{create.isPending ? '거래와 환율을 확인하여 계산 중…' : '새 계산 결과 생성'}</Button>
      {create.error && <ErrorNotice error={create.error} />}
    </section>
    <TaxpayerInputs jurisdiction={profile.jurisdiction} year={profile.tax_year} />
    <RunList profileId={profile.id} selected={runId} onSelect={setRunId} />
    {runId && <RunDetail key={runId} runId={runId} />}
  </>;
}
function EditProfile({ profile }: { profile: TaxProfile }) {
  const [method, setMethod] = useState(profile.cost_basis_method);
  const update = useUpdateTaxProfile();
  const policyCurrent = profile.accounting_policy.version === 2;
  return <form className="space-y-3" onSubmit={e => { e.preventDefault(); update.mutate({ id: profile.id, data: { cost_basis_method: method, expected_revision: profile.revision, accounting_policy: ACCOUNTING_POLICY_V2 } }); }}>
    {!policyCurrent && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">이전 계산 설정에는 법정화폐 이전 수수료 비용 규칙이 없습니다. 정책 v2를 저장한 뒤 새 결과를 만들 수 있습니다.</p>}
    <div className="flex flex-wrap items-end gap-3"><MethodSelect value={method} onChange={setMethod} /><Button type="submit" variant="outline" disabled={update.isPending || (method === profile.cost_basis_method && policyCurrent)}>{update.isPending ? '저장 중…' : policyCurrent ? '계산 방식 변경' : '회계 정책 v2 적용'}</Button></div>
    {update.error && <ErrorNotice error={update.error} />}
  </form>;
}
function RunList({ profileId, selected, onSelect }: { profileId: string; selected: string; onSelect: (id: string) => void }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const list = useAccountingRuns(profileId, cursors.at(-1));
  return <section className={panelClass}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">저장된 계산 이력</h2><Button variant="outline" onClick={() => list.refetch()} disabled={list.isFetching}>이력 새로고침</Button></div>
    {list.isLoading && <p role="status">이력을 불러오는 중…</p>}{list.error && <ErrorNotice error={list.error} />}
    {list.data && <>{list.data.runs.length === 0 ? <p className="text-sm text-muted-foreground">저장된 계산 결과가 없습니다.</p> : <ul className="space-y-2">{list.data.runs.map(run => <li key={run.id}><button type="button" aria-pressed={selected === run.id} className={`w-full rounded-lg border p-3 text-left text-sm ${selected === run.id ? 'border-primary bg-muted' : 'border-border'}`} onClick={() => onSelect(run.id)}><span className="block">{date(run.created_at)} · {methods[run.profile.cost_basis_method]}</span><span className="block mt-1 break-all">거래 순손익 {formatAmount(run.summary.net_gain, run.summary.currency)}</span><span className="block mt-1 text-xs text-muted-foreground">결과 번호 {run.id}</span></button></li>)}</ul>}
      <div className="flex gap-2"><Button variant="outline" disabled={!cursors.length || list.isFetching} onClick={() => setCursors(c => c.slice(0, -1))}>더 최근 이력</Button><Button variant="outline" disabled={!list.data.has_more || list.isFetching} onClick={() => { if (list.data?.next_before_run_id) setCursors(c => [...c, list.data.next_before_run_id!]); }}>더 오래된 이력</Button></div></>}
  </section>;
}
function RunDetail({ runId }: { runId: string }) {
  const historical = useAccountingRun(runId);
  const [checkRequested, setCheckRequested] = useState(false);
  const checked = useAccountingRun(checkRequested ? runId : '', true);
  const [kind, setKind] = useState<AccountingRunEntryKind>('DISPOSITION');
  const run = historical.data?.run;
  return <section className={panelClass}><h2 className="font-semibold">선택한 계산 결과</h2>
    {historical.isLoading && <p role="status">결과를 불러오는 중…</p>}{historical.error && <><ErrorNotice error={historical.error} /><Button onClick={() => historical.refetch()}>결과 다시 불러오기</Button></>}
    {run && <><p className="text-sm">{run.profile.tax_year}년 · {methods[run.profile.cost_basis_method]} · {date(run.created_at)} 저장</p>
      <div className="rounded-lg bg-muted p-4 space-y-2" aria-live="polite"><p className="text-sm">{checked.isFetching ? '현재 거래·설정·환율을 확인 중…' : checked.error ? '변경 여부를 확인하지 못했습니다. 아래 내용은 저장 당시의 결과입니다.' : freshness[checked.data?.freshness ?? 'NOT_CHECKED']}</p>
        {checked.data?.checked_at && !checked.isFetching && !checked.error && <p className="text-xs text-muted-foreground">확인 시각: {date(checked.data.checked_at)} (이 시각 이후의 변경은 재확인이 필요합니다.)</p>}
        {checked.error && <ErrorNotice error={checked.error} />}<Button variant="outline" disabled={checked.isFetching} onClick={() => { if (checkRequested) checked.refetch(); else setCheckRequested(true); }}>현재 데이터와 비교</Button></div>
      <dl className="grid gap-4 sm:grid-cols-2">{[['처분 대가 (수수료 지급 포함)', run.summary.total_proceeds], ['처분한 자산의 취득 원가', run.summary.total_cost_basis], ['처분 수수료', run.summary.total_disposal_fees], ['거래 순손익', run.summary.net_gain], ['보상·에어드롭 수익', run.summary.total_income], ['법정화폐 이전 수수료 비용', run.summary.total_expenses]].map(([label, amount]) => <div key={label as string} className="rounded-lg bg-muted/50 p-4"><dt className="text-sm text-muted-foreground">{label as string}</dt><dd className="mt-2 break-all font-semibold">{formatAmount(amount as AccountingRun['summary']['net_gain'], run.summary.currency)}</dd></div>)}</dl>
      <label className="flex flex-col gap-2 text-sm">상세 내역<select className={fieldClass} value={kind} onChange={e => setKind(e.target.value as AccountingRunEntryKind)}>{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label} ({run.entry_counts.find(c => c.kind === key)?.count ?? '—'}건)</option>)}</select></label>
      <EntryList key={kind} run={run} kind={kind} />
      <AccountingReports key={run.id} run={run} />
      <LegalTaxPreview run={run} />
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">재현·대조 정보</summary><dl className="mt-2 space-y-2 break-all"><dt>결과 번호</dt><dd>{run.id}</dd><dt>계산 버전</dt><dd>{run.summary.projection_version}</dd><dt>내용 검증값</dt><dd>{run.content_digest}</dd></dl></details>
    </>}
  </section>;
}
function EntryList({ run, kind }: { run: AccountingRun; kind: AccountingRunEntryKind }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const entries = useAccountingRunEntries(run.id, kind, cursors.at(-1) ?? '0');
  return <div className="space-y-3">{entries.isLoading && <p role="status">상세 내역을 불러오는 중…</p>}{entries.error && <><ErrorNotice error={entries.error} /><Button onClick={() => entries.refetch()}>상세 내역 다시 불러오기</Button></>}
    {entries.data && <><p className="text-xs text-muted-foreground">전체 {entries.data.total_count}건 · 현재 {entries.data.entries.length}건 표시</p>{entries.data.entries.length === 0 ? <p className="text-sm">이 종류의 내역이 없습니다.</p> : <ol className="space-y-3">{entries.data.entries.map(entry => <li key={entry.index} className="rounded-lg border border-border p-4"><p className="mb-2 text-xs text-muted-foreground">내역 {entry.index}</p><Entry entry={entry} currency={run.summary.currency} /></li>)}</ol>}
      <div className="flex gap-2"><Button variant="outline" disabled={!cursors.length || entries.isFetching} onClick={() => setCursors(c => c.slice(0, -1))}>이전 상세</Button><Button variant="outline" disabled={!entries.data.has_more || entries.isFetching} onClick={() => setCursors(c => [...c, entries.data!.next_after_index])}>다음 상세</Button></div></>}
  </div>;
}
function Entry({ entry, currency }: { entry: AccountingRunEntries['entries'][number]; currency: string }) {
  let values: [string, string][];
  const money = (a: AccountingRun['summary']['net_gain']) => formatAmount(a, currency);
  const asset = (a: { symbol: string; chain_id?: string; contract?: string }) => [a.symbol, a.chain_id, a.contract].filter(Boolean).join(' · ');
  if ('lot' in entry) { const x = entry.lot; values = [['자산', asset(x.asset_id)], ['취득 시각', date(x.acquired_at)], ['취득 수량', formatAmount(x.acquired_quantity)], ['취득 원가', money(x.acquisition_cost)], ['포함된 취득 수수료', money(x.capitalized_fee)], ['남은 수량', formatAmount(x.remaining_quantity)], ['남은 원가', money(x.remaining_cost_basis)], ['취득 거래', x.acquisition_event_id], ['취득 내역 번호', x.lot_key]]; }
  else if ('disposition' in entry) { const x = entry.disposition; values = [['자산', asset(x.asset_id)], ['처분 시각', date(x.event_time)], ['거래 종류', x.leg === 'fee' ? '수수료 지급' : x.event_type === 'SELL' ? '매도' : '교환'], ['수량', formatAmount(x.quantity)], ['처분 대가', money(x.proceeds)], ['취득 원가', money(x.cost_basis)], ['처분 수수료', money(x.disposal_fee)], ['수수료 차감 대가', money(x.net_proceeds)], ['손익', money(x.gain_loss)], ['처분 거래', x.event_id], ...(x.disposition_key ? [['처분 구분 번호', x.disposition_key] as [string, string]] : [])]; }
  else if ('consumption' in entry) { const x = entry.consumption; values = [['처분 거래', x.disposition_event_id], ['취득 거래', x.consumption.acquisition_event_id], ['취득 내역 번호', x.consumption.lot_key], ['취득 시각', date(x.consumption.acquired_at)], ['사용 수량', formatAmount(x.consumption.quantity)], ['배분한 원가', money(x.consumption.cost_basis)], ...(x.disposition_key ? [['처분 구분 번호', x.disposition_key] as [string, string]] : [])]; }
  else if ('annual_pool' in entry) { const x = entry.annual_pool; values = [['연도', String(x.year)], ['자산', asset(x.asset_id)], ['기초 수량', formatAmount(x.opening_quantity)], ['기초 원가', money(x.opening_cost_basis)], ['취득 수량', formatAmount(x.acquired_quantity)], ['취득 원가', money(x.acquisition_cost)], ['처분 수량', formatAmount(x.disposed_quantity)], ['배분한 원가', money(x.disposed_cost_basis)], ['기말 수량', formatAmount(x.closing_quantity)], ['기말 원가', money(x.closing_cost_basis)]]; }
  else if ('fx' in entry) { const x = entry.fx; values = [['거래', x.event_id], ['대상', x.leg === 'fee' ? '수수료' : '거래 대가'], ['환산', `${x.from_currency} → ${x.to_currency}`], ['원래 수량 또는 금액', formatAmount(x.source_amount)], ['원래 단가', formatAmount(x.source_unit_price, x.from_currency)], ['적용 환율', formatAmount(x.rate)], ['환산 금액', formatAmount(x.converted_amount, x.to_currency)], ['환율 기준일 (UTC)', x.observed_at], ['환율 제공자', x.source], ...(x.price_input ? [['수수료 자산', asset(x.price_input.asset_id)], ['당시 자산 단가', formatAmount(x.price_input.price_usd, 'USD')], ['시세 기준일 (UTC)', x.price_input.observed_at], ['시세 제공자', x.price_input.source]] as [string, string][] : [])]; }
  else if ('income' in entry) { const x = entry.income; values = [['자산', asset(x.asset_id)], ['수령 시각', date(x.event_time)], ['거래 종류', x.event_type === 'REWARD' ? '보상' : '에어드롭'], ['수량', formatAmount(x.quantity)], ['수령 시점 가치', money(x.income)], ['가치 근거', x.valuation_source], ['수익 거래', x.event_id], ['수익 내역 번호', x.income_key]]; }
  else if ('expense' in entry) { const x = entry.expense; values = [['수수료 통화', asset(x.asset_id)], ['지급 시각', date(x.event_time)], ['거래 종류', '이전 수수료'], ['원래 수수료', formatAmount(x.quantity, x.asset_id.symbol)], ['환산 비용', money(x.expense)], ['가치 근거', x.valuation_source], ['이전 거래', x.event_id], ['비용 내역 번호', x.expense_key]]; }
  else { const x = entry.source_event; values = [['거래 번호', x.id], ['거래 종류', x.event_type], ['거래 시각', date(x.event_time)], ['자산', asset(x.asset_id)], ['수량', formatAmount(x.amount)], ['출처', x.source]]; }
  return <><dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,1fr)_3fr]">{values.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl>{'source_event' in entry && <details className="mt-3 text-xs"><summary className="cursor-pointer">보존된 거래 전체 보기</summary><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(entry.source_event, null, 2)}</pre></details>}</>;
}
