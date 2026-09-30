'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue } from '@/components/ui/data-card';
import { usePortfolio, usePortfolioHistory, useConnections, useLedgerEvents } from '@/hooks';
import { assetIdentity, formatAmount, valuationDifference } from '@/lib/amount';
import type { PortfolioHistoryQueryParams } from '@/types';
import { QueryError, Loading } from '@/components/ui/query-state';

function displayTime(timestamp: string) {
  return new Date(timestamp).toLocaleString('ko-KR', { timeZone: 'UTC' }) + ' UTC';
}
const statusLabels: Record<string, string> = { idle: '동기화 대기', syncing: '동기화 중', completed: '동기화 완료', failed: '동기화 실패' };

export default function PortfolioPage() {
  const portfolio = usePortfolio('KRW');
  const connections = useConnections();
  const events = useLedgerEvents({ limit: 5 });
  const [dates, setDates] = useState(() => {
    const to = new Date();
    const from = new Date(to); from.setUTCDate(from.getUTCDate() - 7);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  });
  const [range, setRange] = useState<PortfolioHistoryQueryParams>();
  const [historyPageTokens, setHistoryPageTokens] = useState(['']);
  const [historyPageIndex, setHistoryPageIndex] = useState(0);
  const [rangeError, setRangeError] = useState('');
  const history = usePortfolioHistory(range ? { ...range, page_size: 10, page_token: historyPageTokens[historyPageIndex] || undefined } : undefined);
  const snapshots = history.data?.snapshots;
  let difference: string | undefined;
  if (!history.isError && snapshots && snapshots.length > 1) {
    try { difference = formatAmount(valuationDifference(snapshots[0].total_value_local, snapshots[snapshots.length - 1].total_value_local), snapshots[0].local_currency); }
    catch { difference = '변동액을 계산할 수 없습니다'; }
  }

  function submitHistory(event: FormEvent) {
    event.preventDefault();
    const from = new Date(`${dates.from}T00:00:00Z`), to = new Date(`${dates.to}T00:00:00Z`);
    const count = (to.getTime() - from.getTime()) / 86400000;
    if (!Number.isFinite(count) || count < 0 || count >= 1000 || to.getTime() > Date.now()) {
      setRangeError('시작일과 종료일을 확인해주세요. 최대 1,000일이며 미래 날짜는 조회할 수 없습니다.'); return;
    }
    setRangeError('');
    const next = { from_date: from.toISOString(), to_date: to.toISOString(), granularity: 'DAY' as const, local_currency: 'KRW' };
    const sameRange = range?.from_date === next.from_date && range.to_date === next.to_date;
    setHistoryPageTokens(['']);
    setHistoryPageIndex(0);
    setRange(next);
    if (sameRange && historyPageIndex === 0) void history.refetch();
  }
  function refresh() {
    void portfolio.refetch(); void connections.refetch(); void events.refetch();
    if (range) void history.refetch();
  }
  const assets = portfolio.data?.assets;

  return <div className="space-y-6">
    <header className="flex items-start justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Portfolio</h1><p className="mt-1 text-sm text-gray-600">자산 현황 및 평가 내역</p></div>
      <Button variant="outline" onClick={refresh} aria-label="포트폴리오 데이터 새로고침"><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />새로고침</Button>
    </header>

    {portfolio.isPending ? <Loading /> : portfolio.isError ? <QueryError error={portfolio.error} retry={() => void portfolio.refetch()} /> : portfolio.data && <>
      <DataCard className="bg-black text-white" hover={false}>
        <p className="text-sm text-white/60">총 자산 가치</p>
        <p className="mt-2 break-all font-mono text-2xl sm:text-3xl" data-testid="portfolio-total">{formatAmount(portfolio.data.total_value_local, portfolio.data.local_currency)}</p>
        <p className="mt-2 break-all font-mono text-sm text-white/70">{formatAmount(portfolio.data.total_value_usd, 'USD')}</p>
        <p className="mt-4 text-xs text-white/60">평가 시각: {displayTime(portfolio.data.timestamp)}</p>
      </DataCard>
      <section className="overflow-hidden rounded-lg border border-gray-200" aria-label="보유 자산">
        <SectionHeader title="보유 자산" marker="◆" />
        {!assets?.length ? <p className="p-6 text-gray-600">보유 자산이 없습니다. <Link href="/connections" className="underline">거래소 연결 및 동기화</Link></p> :
          <div className="divide-y divide-gray-100">{assets.map(asset => <div key={assetIdentity(asset.asset_id)} className="grid gap-3 p-4 sm:grid-cols-2">
            <div><p className="font-semibold">{asset.asset_id.symbol}</p><p className="break-all text-xs text-gray-600">{asset.asset_id.chain_id || '체인 미지정'}{asset.asset_id.contract ? ` · ${asset.asset_id.contract}` : ''}</p>
              <p className="mt-1 break-all font-mono text-sm">수량 {formatAmount(asset.balance)}</p></div>
            <div className="sm:text-right"><p className="break-all font-mono">{formatAmount(asset.value_local, portfolio.data!.local_currency)}</p>
              <p className="text-sm text-gray-600">비중 {Number.isFinite(asset.percentage) ? asset.percentage.toFixed(2) + '%' : '확인 필요'}</p></div>
          </div>)}</div>}
      </section>
      <section className="overflow-hidden rounded-lg border border-gray-200" aria-label="계정별 자산 배분">
        <SectionHeader title="계정별 자산 배분" marker="★" />
        {!portfolio.data.allocation_complete && <div role="status" className="border-b border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          일부 원장 기록에 계정 정보가 없어 전체 금액을 계정별로 나눌 수 없습니다. 아래 미귀속 금액을 확인해주세요.
        </div>}
        {!portfolio.data.accounts.length ? <p className="p-4 text-sm text-gray-600">계정에 귀속된 보유 자산이 없습니다.</p> :
          <div className="grid gap-4 p-4 lg:grid-cols-2">{portfolio.data.accounts.map(account => <article key={account.account.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-semibold">{account.account.label || account.account.identifier}</h2><p className="text-xs text-gray-600">{account.account.exchange_id || account.account.chain_id || account.account.type} · #{account.account.id.slice(-6)}</p></div>
              <p className="text-sm text-gray-600">{Number.isFinite(account.percentage) ? account.percentage.toFixed(2) + '%' : '확인 필요'}</p>
            </div>
            <p className="mt-3 break-all font-mono">{formatAmount(account.total_value_local, portfolio.data.local_currency)}</p>
            <ul className="mt-3 divide-y text-sm">{account.assets.map(asset => <li key={assetIdentity(asset.asset_id)} className="flex justify-between gap-3 py-2"><span>{asset.asset_id.symbol} <span className="font-mono text-xs text-gray-500">{formatAmount(asset.balance)}</span></span><span className="break-all font-mono text-right">{formatAmount(asset.value_local, portfolio.data!.local_currency)}</span></li>)}</ul>
          </article>)}</div>}
        {!portfolio.data.allocation_complete && <div className="border-t border-gray-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">미귀속 자산</h2><p className="break-all font-mono text-sm">{formatAmount(portfolio.data.unattributed_value_local, portfolio.data.local_currency)}</p></div>
          {!portfolio.data.unattributed_assets.length ? <p className="mt-2 text-sm text-gray-600">이 Ledger는 계정 배분 정보를 제공하지 않습니다.</p> : <ul className="mt-3 divide-y text-sm">{portfolio.data.unattributed_assets.map(asset => <li key={assetIdentity(asset.asset_id)} className="flex justify-between gap-3 py-2"><span>{asset.asset_id.symbol} <span className="font-mono text-xs text-gray-500">{formatAmount(asset.balance)}</span></span><span className="break-all font-mono text-right">{formatAmount(asset.value_local, portfolio.data!.local_currency)}</span></li>)}</ul>}
        </div>}
      </section>
    </>}

    <section className="overflow-hidden rounded-lg border border-gray-200" aria-label="과거 평가 내역">
      <SectionHeader title="과거 평가 내역" marker="◆" />
      <form onSubmit={submitHistory} className="flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1 text-sm"><span className="block">시작일</span><input type="date" required value={dates.from} onChange={e => setDates({ ...dates, from: e.target.value })} className="rounded border p-2" /></label>
        <label className="space-y-1 text-sm"><span className="block">종료일</span><input type="date" required value={dates.to} onChange={e => setDates({ ...dates, to: e.target.value })} className="rounded border p-2" /></label>
        <Button type="submit" disabled={history.isFetching}>조회</Button>
      </form>
      <p className="px-4 pb-4 text-xs text-gray-600">각 날짜 00:00 UTC의 보유 수량과 해당 날짜의 시세로 평가합니다. 평가액 변동에는 입출금이 포함됩니다.</p>
      {rangeError && <p role="alert" className="px-4 pb-4 text-sm text-red-700">{rangeError}</p>}
      {!range ? <p className="p-4 text-sm text-gray-600">조회할 기간을 선택해주세요.</p> : history.isFetching ? <Loading /> : history.isError ? <QueryError error={history.error} retry={() => void history.refetch()} /> : snapshots && <>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm"><span>{historyPageIndex + 1}페이지 · 페이지당 최대 10개</span><div className="flex gap-2"><Button variant="outline" disabled={history.isFetching || historyPageIndex === 0} onClick={() => setHistoryPageIndex(index => Math.max(0, index - 1))}>이전</Button><Button variant="outline" disabled={history.isFetching || !history.data?.has_more || !history.data.next_page_token} onClick={() => { const token = history.data?.next_page_token; if (!token) return; setHistoryPageTokens(tokens => [...tokens.slice(0, historyPageIndex + 1), token]); setHistoryPageIndex(index => index + 1); }}>다음</Button></div></div>
        {difference && <p className="break-all p-4 text-sm">현재 페이지 평가액 변동: <span className="font-mono">{difference}</span></p>}
        {!snapshots.length ? <p className="p-4 text-sm text-gray-600">해당 기간의 평가 내역이 없습니다.</p> : <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">날짜별 원화 및 달러 평가액</caption><thead><tr><th className="p-3">평가 시점 (UTC)</th><th className="p-3">원화 평가액</th><th className="p-3">달러 평가액</th></tr></thead><tbody>{snapshots.map(point => <tr key={point.timestamp} className="border-t"><td className="whitespace-nowrap p-3">{point.timestamp.slice(0, 10)}</td><td className="break-all p-3 font-mono">{formatAmount(point.total_value_local, point.local_currency)}</td><td className="break-all p-3 font-mono">{formatAmount(point.total_value_usd, 'USD')}</td></tr>)}</tbody></table></div>}
      </>}
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="overflow-hidden rounded-lg border border-gray-200" aria-label="거래소 연결">
        <SectionHeader title="거래소 연결" marker="●" />
        {connections.isPending ? <Loading /> : connections.isError ? <QueryError error={connections.error} retry={() => void connections.refetch()} /> : !connections.data?.length ? <p className="p-4 text-sm text-gray-600">연결된 거래소가 없습니다.</p> : <ul className="divide-y">{connections.data.map(connection => <li key={connection.id} className="flex justify-between gap-3 p-4 text-sm"><span>{connection.exchange} <span className="text-gray-500">#{connection.id.slice(-6)}</span></span><span>{statusLabels[connection.status] || connection.status}</span></li>)}</ul>}
        <Link href="/connections" className="block p-4 text-sm underline">연결 및 동기화 관리</Link>
      </section>
      <section className="overflow-hidden rounded-lg border border-gray-200" aria-label="최근 원장 기록">
        <SectionHeader title="최근 원장 기록" marker="▶" />
        {events.isPending ? <Loading /> : events.isError ? <QueryError error={events.error} retry={() => void events.refetch()} /> : !events.data?.events.length ? <p className="p-4 text-sm text-gray-600">기록된 거래가 없습니다.</p> : <ul className="divide-y">{events.data.events.map(event => <li key={event.id} className="space-y-1 p-4 text-sm"><Link href="/ledger" className="font-medium underline">{event.event_type} · {event.asset_id.symbol}</Link><p className="break-all font-mono">수량 {formatAmount(event.amount)}</p><p className="text-xs text-gray-500">{displayTime(event.event_time)}</p></li>)}</ul>}
      </section>
    </div>
    <section className="grid gap-3 sm:grid-cols-3" aria-label="포트폴리오 요약 통계">
      <DataCard><DataValue value={portfolio.isError || !assets ? '—' : assets.length} label="보유 자산 종류" /></DataCard>
      <DataCard><DataValue value={connections.isError || !connections.data ? '—' : connections.data.length} label="거래소 연결 수" /></DataCard>
      <DataCard><DataValue value={events.isError || !events.data ? '—' : events.data.pagination.total.toLocaleString('ko-KR')} label="원장 기록 수" /></DataCard>
    </section>
  </div>;
}
