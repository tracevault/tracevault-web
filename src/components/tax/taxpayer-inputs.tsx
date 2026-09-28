'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateTaxpayerInputSnapshot, useLatestTaxpayerInputSnapshot } from '@/hooks/useTax';
import { ApiRequestError } from '@/types';
import type { CreateTaxpayerInputSnapshotRequest, Jurisdiction, TaxpayerInputPayload, TaxpayerInputSnapshot } from '@/types/tax';

const fieldClass = 'rounded-md border border-input bg-background px-3 py-2 text-sm';
const amountPattern = '(0|[1-9][0-9]*)(\\.[0-9]+)?';

function scale(value: string) {
  return value.includes('.') ? value.length - value.indexOf('.') - 1 : 0;
}

function declaredBoolean(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function displayedBoolean(value: boolean | undefined) {
  return value === undefined ? 'unknown' : String(value);
}

type DeemedValueDraft = {
  symbol: string;
  chain_id: string;
  contract: string;
  market_value: string;
};

function ErrorNotice({ error }: { error: unknown }) {
  return <p role="alert" className="text-sm text-red-600 break-words">{error instanceof Error ? error.message : '납세자 입력을 처리하지 못했습니다.'}</p>;
}

function TaxpayerInputForm({ jurisdiction, year, snapshot }: { jurisdiction: Jurisdiction; year: number; snapshot?: TaxpayerInputSnapshot }) {
  const create = useCreateTaxpayerInputSnapshot();
  const current = snapshot?.payload;
  const initialSourceID = current?.crypto_gross_receipts?.source_id
    ?? current?.no_virtual_asset_lending_income?.source_id
    ?? current?.other_comprehensive_income?.source_id
    ?? current?.deductions?.source_id
    ?? current?.sources[0]?.source_id
    ?? `declaration-${year}`;
  const initialSource = current?.sources.find(source => source.source_id === initialSourceID) ?? current?.sources[0];
  const currency = jurisdiction === 'KOREA' ? 'KRW' : 'JPY';
  const [residency, setResidency] = useState<'RESIDENT' | 'NON_RESIDENT'>(current?.residency_status ?? 'RESIDENT');
  const [classification, setClassification] = useState<TaxpayerInputPayload['income_classification']>(current?.income_classification ?? 'UNDETERMINED');
  const [records, setRecords] = useState(displayedBoolean(current?.records_retained));
  const [business, setBusiness] = useState(displayedBoolean(current?.business_related_activity));
  const [noLendingIncome, setNoLendingIncome] = useState(displayedBoolean(current?.no_virtual_asset_lending_income?.value));
  const [gross, setGross] = useState(current?.crypto_gross_receipts?.amount.value ?? '');
  const [otherIncome, setOtherIncome] = useState(current?.other_comprehensive_income?.amount.value ?? '');
  const [deductions, setDeductions] = useState(current?.deductions?.amount.value ?? '');
  const [sourceID, setSourceID] = useState(initialSourceID);
  const [sourceTitle, setSourceTitle] = useState(initialSource?.title ?? `${year}년 납세자 확인 자료`);
  const [issuer, setIssuer] = useState(initialSource?.issuer ?? 'taxpayer');
  const [documentDate, setDocumentDate] = useState(initialSource?.document_date ?? '');
  const [contentHash, setContentHash] = useState(initialSource?.content_sha256 ?? '');
  const [deemedValues, setDeemedValues] = useState<DeemedValueDraft[]>(
    current?.deemed_acquisition_values.map(item => ({
      symbol: item.asset_id.symbol,
      chain_id: item.asset_id.chain_id ?? '',
      contract: item.asset_id.contract ?? '',
      market_value: item.market_value.value,
    })) ?? [],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const sourced = (value: string, existing: TaxpayerInputPayload['crypto_gross_receipts']) => {
      if (value === '') return undefined;
      if (existing?.amount.value === value && (existing.source_id !== initialSourceID || sourceID === initialSourceID)) return existing;
      return { amount: { value, scale: scale(value) }, source_id: sourceID };
    };
    const retainedSources = current?.sources.filter(source => source.source_id !== initialSourceID) ?? [];
    const payload: TaxpayerInputPayload = {
      ...current,
      taxpayer_type: 'INDIVIDUAL',
      residency_status: residency,
      income_classification: classification,
      currency,
      records_retained: declaredBoolean(records),
      business_related_activity: declaredBoolean(business),
      no_virtual_asset_lending_income: declaredBoolean(noLendingIncome) === undefined ? undefined : {
        value: declaredBoolean(noLendingIncome)!,
        source_id: sourceID,
      },
      crypto_gross_receipts: sourced(gross, current?.crypto_gross_receipts),
      other_comprehensive_income: sourced(otherIncome, current?.other_comprehensive_income),
      deductions: sourced(deductions, current?.deductions),
      cost_basis_elections: current?.cost_basis_elections ?? [],
      deemed_acquisition_values: jurisdiction === 'KOREA' && year >= 2027
        ? deemedValues.map(item => ({
          asset_id: {
            symbol: item.symbol,
            ...(item.chain_id ? { chain_id: item.chain_id } : {}),
            ...(item.contract ? { contract: item.contract } : {}),
          },
          market_value: { value: item.market_value, scale: scale(item.market_value) },
          observed_at: '2026-12-31T15:00:00Z',
          source_id: sourceID,
        }))
        : current?.deemed_acquisition_values ?? [],
      adjustments: current?.adjustments ?? [],
      sources: [...retainedSources, { source_id: sourceID, kind: 'USER_DECLARATION', title: sourceTitle, issuer, document_date: documentDate, content_sha256: contentHash }],
    };
    const request: CreateTaxpayerInputSnapshotRequest = {
      jurisdiction,
      tax_year: year,
      expected_latest_revision: snapshot?.revision ?? 0,
      payload,
    };
    create.mutate(request);
  };

  return <form className="space-y-4" onSubmit={submit}>
    <p className="text-sm">{snapshot ? '새 사실이나 근거가 생겼을 때 다음 버전을 추가합니다. 같은 내용의 재시도는 기존 버전을 반환합니다.' : '첫 입력 버전을 만듭니다.'}</p>
    <div className="grid gap-4 md:grid-cols-3">
      <label className="flex flex-col gap-2 text-sm">거주 상태<select className={fieldClass} value={residency} onChange={e => setResidency(e.target.value as typeof residency)}><option value="RESIDENT">거주자</option><option value="NON_RESIDENT">비거주자</option></select></label>
      <label className="flex flex-col gap-2 text-sm">소득 분류<select className={fieldClass} value={classification} onChange={e => setClassification(e.target.value as typeof classification)}><option value="UNDETERMINED">미결정</option><option value="MISCELLANEOUS">기타소득 분류</option><option value="BUSINESS">사업소득 분류</option><option value="OTHER_INCOME">그 밖의 소득 분류</option></select></label>
      <label className="flex flex-col gap-2 text-sm">기록 보관 여부<select className={fieldClass} value={records} onChange={e => setRecords(e.target.value)}><option value="unknown">확인하지 않음</option><option value="true">보관함</option><option value="false">보관하지 않음</option></select></label>
      <label className="flex flex-col gap-2 text-sm">사업 관련 활동<select className={fieldClass} value={business} onChange={e => setBusiness(e.target.value)}><option value="unknown">확인하지 않음</option><option value="true">해당함</option><option value="false">해당하지 않음</option></select></label>
      <label className="flex flex-col gap-2 text-sm">가상자산 대여소득 없음<select className={fieldClass} value={noLendingIncome} onChange={e => setNoLendingIncome(e.target.value)}><option value="unknown">확인하지 않음</option><option value="true">대여소득 없음</option><option value="false">대여소득 있음</option></select></label>
      <label className="flex flex-col gap-2 text-sm">가상자산 총수입 ({currency}, 선택)<input className={fieldClass} inputMode="decimal" pattern={amountPattern} value={gross} onChange={e => setGross(e.target.value)} placeholder="3000000" /></label>
      <label className="flex flex-col gap-2 text-sm">기타 종합소득 ({currency}, 선택)<input className={fieldClass} inputMode="decimal" pattern={amountPattern} value={otherIncome} onChange={e => setOtherIncome(e.target.value)} placeholder="0" /></label>
      <label className="flex flex-col gap-2 text-sm">공제 입력 ({currency}, 선택)<input className={fieldClass} inputMode="decimal" pattern={amountPattern} value={deductions} onChange={e => setDeductions(e.target.value)} placeholder="0" /></label>
    </div>
    {jurisdiction === 'KOREA' && year >= 2027 && <fieldset className="space-y-3 rounded-lg border border-border p-4"><legend className="px-2 text-sm font-medium">2027년 이전 보유분 기준가</legend>
      <p className="text-xs text-muted-foreground">2027년 1월 1일 0시(한국 시간)에 보유한 자산마다 2026년 말 1개당 시가를 입력합니다. 계산에서는 실제 취득가액과 비교해 큰 금액을 사용합니다.</p>
      {deemedValues.map((item, index) => <div key={index} className="grid gap-3 rounded-md bg-muted/50 p-3 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs">자산 기호<input className={fieldClass} required maxLength={50} value={item.symbol} onChange={e => setDeemedValues(values => values.map((value, i) => i === index ? { ...value, symbol: e.target.value } : value))} placeholder="BTC" /></label>
        <label className="flex flex-col gap-1 text-xs">체인<input className={fieldClass} maxLength={50} value={item.chain_id} onChange={e => setDeemedValues(values => values.map((value, i) => i === index ? { ...value, chain_id: e.target.value } : value))} placeholder="bitcoin" /></label>
        <label className="flex flex-col gap-1 text-xs md:col-span-2">계약 주소<input className={fieldClass} maxLength={255} value={item.contract} onChange={e => setDeemedValues(values => values.map((value, i) => i === index ? { ...value, contract: e.target.value } : value))} /></label>
        <label className="flex flex-col gap-1 text-xs">1개당 시가 (KRW)<input className={fieldClass} required inputMode="decimal" pattern={amountPattern} value={item.market_value} onChange={e => setDeemedValues(values => values.map((value, i) => i === index ? { ...value, market_value: e.target.value } : value))} /></label>
        <Button className="md:col-span-5 md:justify-self-start" type="button" variant="outline" onClick={() => setDeemedValues(values => values.filter((_, i) => i !== index))}>이 자산 삭제</Button>
      </div>)}
      <Button type="button" variant="outline" onClick={() => setDeemedValues(values => [...values, { symbol: '', chain_id: '', contract: '', market_value: '' }])}>보유 자산 추가</Button>
    </fieldset>}
    <fieldset className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2"><legend className="px-2 text-sm font-medium">근거 자료</legend>
      <label className="flex flex-col gap-2 text-sm">근거 번호<input className={fieldClass} required pattern="[A-Za-z0-9][A-Za-z0-9._\\-]*" maxLength={160} value={sourceID} onChange={e => setSourceID(e.target.value)} /></label>
      <label className="flex flex-col gap-2 text-sm">자료 제목<input className={fieldClass} required maxLength={500} value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} /></label>
      <label className="flex flex-col gap-2 text-sm">작성·발급 주체<input className={fieldClass} required maxLength={200} value={issuer} onChange={e => setIssuer(e.target.value)} /></label>
      <label className="flex flex-col gap-2 text-sm">자료 날짜<input className={fieldClass} required type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)} /></label>
      <label className="flex flex-col gap-2 text-sm md:col-span-2">자료 SHA-256<input className={`${fieldClass} font-mono`} required pattern="[0-9a-f]{64}" minLength={64} maxLength={64} value={contentHash} onChange={e => setContentHash(e.target.value.trim().toLowerCase())} placeholder="64자리 소문자 해시" /></label>
    </fieldset>
    {create.error && <ErrorNotice error={create.error} />}
    <Button type="submit" disabled={create.isPending}>{create.isPending ? '불변 입력을 저장하는 중…' : snapshot ? '새 입력 버전 저장' : '첫 입력 버전 저장'}</Button>
  </form>;
}

export function TaxpayerInputs({ jurisdiction, year }: { jurisdiction: Jurisdiction; year: number }) {
  const latest = useLatestTaxpayerInputSnapshot(jurisdiction, year);
  const snapshot = latest.data;
  const missing = latest.error instanceof ApiRequestError && latest.error.code === 'NOT_FOUND';
  return <section className="rounded-xl border border-border bg-card p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold">납세자 확인 입력</h2><p className="mt-1 text-sm text-muted-foreground">법률 정책이 요구할 수 있는 사실과 근거를 변경 불가능한 버전으로 보존합니다. 저장 자체는 세액 계산이나 신고 승인을 의미하지 않습니다.</p></div>
      {snapshot && <span className="rounded-full bg-muted px-3 py-1 text-xs">현재 버전 {snapshot.revision}</span>}
    </div>
    {latest.isLoading && <p role="status" className="text-sm">최근 입력 버전을 확인하는 중…</p>}
    {latest.error && !missing && <><ErrorNotice error={latest.error} /><Button variant="outline" onClick={() => latest.refetch()}>입력 다시 불러오기</Button></>}
    {snapshot && <dl className="grid gap-2 rounded-md bg-muted p-3 text-xs sm:grid-cols-[8rem_1fr]">
      <dt className="text-muted-foreground">저장 시각</dt><dd>{new Date(snapshot.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</dd>
      <dt className="text-muted-foreground">내용 검증값</dt><dd className="break-all">{snapshot.content_digest}</dd>
      {snapshot.supersedes_snapshot_id && <><dt className="text-muted-foreground">이전 버전</dt><dd className="break-all">{snapshot.supersedes_snapshot_id}</dd></>}
    </dl>}
    {(missing || snapshot) && <TaxpayerInputForm key={snapshot?.id ?? 'new'} jurisdiction={jurisdiction} year={year} snapshot={snapshot} />}
  </section>;
}
