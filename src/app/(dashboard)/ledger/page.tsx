'use client';

import { useState, useMemo } from 'react';
import { EventTrace } from '@/components/ledger/event-trace';
import {
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCcw,
  Filter,
  Download,
  Search,
  Loader2,
  Gift,
  Repeat,
  AlertCircle,
  CircleDollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue } from '@/components/ui/data-card';
import { useLedgerEvents, useRefreshLedger, useReclassifyEvent } from '@/hooks';
import { ApiRequestError, type EventType, type LedgerEvent, type ReclassifyEventRequest } from '@/types';
import { formatAmount, formatValuationTotal } from '@/lib/amount';

const PAGE_SIZE = 20;

const typeConfig: Record<EventType, { icon: typeof ArrowDownLeft; color: string; label: string }> = {
  BUY: { icon: ArrowDownLeft, color: 'text-[#22C55E]', label: '매수' },
  SELL: { icon: ArrowUpRight, color: 'text-[#EF4444]', label: '매도' },
  TRANSFER: { icon: RefreshCcw, color: 'text-[#666666]', label: '이체' },
  REWARD: { icon: Gift, color: 'text-[#3B82F6]', label: '보상' },
  AIRDROP: { icon: Gift, color: 'text-[#8B5CF6]', label: '에어드롭' },
  SWAP: { icon: Repeat, color: 'text-[#F59E0B]', label: '스왑' },
  CORRECTION: { icon: AlertCircle, color: 'text-[#6B7280]', label: '수정' },
  FEE: { icon: CircleDollarSign, color: 'text-[#DC2626]', label: '네트워크 수수료' },
};

// Helper to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' UTC';
}

export default function LedgerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [page, setPage] = useState(0);
  const [audit, setAudit] = useState(false);
  const [tracing, setTracing] = useState<string>();
  const [editing, setEditing] = useState<LedgerEvent>();
  const [replacement, setReplacement] = useState<ReclassifyEventRequest['new_event_type']>('TRANSFER');
  const [reason, setReason] = useState('');
  const reclassify = useReclassifyEvent();
  function beginClassification(event: LedgerEvent) {
    reclassify.reset(); setEditing(event); setReason('');
    setReplacement(event.event_type === 'CORRECTION' ? 'TRANSFER' : event.event_type);
  }

  const refreshLedger = useRefreshLedger();

  // Fetch ledger events with pagination and filters
  const {
    data: eventsData,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
  } = useLedgerEvents({
    effective_classification: !audit,
    event_type: selectedType || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const events = useMemo(() => eventsData?.events || [], [eventsData]);
  const pagination = eventsData?.pagination;

  // Client-side search filter (for asset symbol and source)
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(
      (event) =>
        event.asset_id.symbol.toLowerCase().includes(query) ||
        event.source.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  // These valuations cover the visible page, not the complete account history.
  const stats = useMemo(() => {
    const totalFor = (type: EventType) => formatValuationTotal(filteredEvents
      .filter(event => event.event_type === type)
      .map(event => ({ quantity: event.amount, price: event.value_snapshot?.price_local, currency: event.value_snapshot?.local_currency })));
    return {
      total: pagination?.total ?? events.length,
      totalBuy: totalFor('BUY'),
      totalSell: totalFor('SELL'),
      transferCount: filteredEvents.filter(event => event.event_type === 'TRANSFER').length,
    };
  }, [filteredEvents, events.length, pagination?.total]);

  const handleRefresh = () => {
    refreshLedger();
  };

  const handlePrevPage = () => {
    if (page > 0) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (pagination?.has_more) setPage(page + 1);
  };

  const handleTypeFilter = (type: EventType) => {
    setSelectedType(selectedType === type ? null : type);
    setPage(0); // Reset to first page when filter changes
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#666666]" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-[#EF4444] mb-4" />
        <h2 className="text-lg font-semibold text-black mb-2">데이터를 불러올 수 없습니다</h2>
        <p className="text-sm text-[#666666] mb-4">
          {error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'}
        </p>
        <Button onClick={handleRefresh} variant="outline">
          다시 시도
        </Button>
        {!audit && <Button className="mt-3" variant="outline" onClick={() => {setAudit(true); setPage(0);}}>원본·정정 이력 열기</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-black">Ledger</h1>
        <p className="mt-1 text-sm text-[#666666]">
          모든 거래 내역을 조회하고 관리합니다. 거래 일시는 UTC 기준입니다.
        </p>
      </header>

      <section className="mb-6 space-y-3" aria-label="원장 조회 방식">
        <div className="flex gap-2"><Button variant={!audit ? 'default' : 'outline'} aria-pressed={!audit} onClick={() => {setAudit(false); setPage(0); setSelectedType(null); setEditing(undefined);}}>정정 반영 거래</Button><Button variant={audit ? 'default' : 'outline'} aria-pressed={audit} onClick={() => {setAudit(true); setPage(0); setSelectedType(null); setEditing(undefined);}}>원본·정정 이력</Button></div>
        <p className="text-xs text-gray-600">{audit ? '저장된 원본과 정정 기록입니다. 이 화면의 원본 분류는 변경되지 않습니다.' : '최신 정정을 원래 거래 시점에 반영합니다. 금액·수량은 보존되며 과거 잔액도 다시 계산됩니다.'}</p>
      </section>
      {editing && <form className="mb-6 space-y-3 rounded border p-4" aria-label="거래 분류 정정" onSubmit={event => {
        event.preventDefault();
        reclassify.mutate({eventId: editing.id, data: {new_event_type: replacement, reason, expected_revision: editing.classification_revision ?? 0}}, {onSuccess: () => setEditing(undefined)});
      }}>
        <h2 className="font-semibold">{editing.asset_id.symbol} 거래 분류 정정 · 현재 버전 {editing.classification_revision ?? 0}</h2>
        <p className="text-sm text-gray-600">원본은 유지하고 변경 사유를 새 이력으로 저장합니다.{audit && ' 이미 정정된 거래는 정정 반영 화면에서 변경해주세요.'}</p>
        <label className="block text-sm">새 분류<select aria-label="새 분류" className="ml-3 rounded border p-2" value={replacement} onChange={event => setReplacement(event.target.value as ReclassifyEventRequest['new_event_type'])}>{(['BUY','SELL','TRANSFER','REWARD','AIRDROP','SWAP','FEE'] as const).map(type => <option key={type} value={type}>{typeConfig[type].label}</option>)}</select></label>
        <label className="block text-sm">정정 사유<textarea className="mt-1 block w-full rounded border p-2" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
        {reclassify.isError && <p role="alert" className="text-sm text-red-700">{reclassify.error instanceof ApiRequestError && reclassify.error.code === 'CONFLICT' ? '다른 정정이 먼저 저장되었습니다. 취소한 뒤 새로고침하고 다시 확인해주세요.' : '정정을 저장할 수 없습니다. 거래 계정·상대 자산과 분류를 확인해주세요.'}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={reclassify.isPending || !reason.trim()}>정정 저장</Button><Button type="button" variant="outline" disabled={reclassify.isPending} onClick={() => setEditing(undefined)}>취소</Button></div>
      </form>}
      {tracing && <EventTrace key={tracing} eventId={tracing} onClose={() => setTracing(undefined)} />}
      {/* Stats Overview */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="거래 통계 요약">
        <DataCard>
          <DataValue value={stats.total.toLocaleString()} label="선택 유형의 전체 기록 수" size="lg" />
        </DataCard>
        <DataCard>
          <DataValue
            value={stats.totalBuy}
            label="표시된 매수 평가액 · 수수료 제외"
            size="sm"
            className="break-all"
          />
        </DataCard>
        <DataCard>
          <DataValue
            value={stats.totalSell}
            label="표시된 매도 평가액 · 수수료 제외"
            size="sm"
            className="break-all"
          />
        </DataCard>
        <DataCard>
          <DataValue value={stats.transferCount.toString()} label="표시된 이체 횟수" size="lg" />
        </DataCard>
      </section>

      {/* Filters & Search */}
      <section className="mb-4 space-y-3 md:space-y-0 md:flex md:items-center md:justify-between" aria-label="거래 필터">
        <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" aria-hidden="true" />
            <Input
              placeholder="현재 페이지 자산·출처 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 border-[#EEEEEE] pl-9"
              aria-label="거래 검색"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="거래 유형 필터">
            {(['BUY', 'SELL', 'TRANSFER', 'REWARD', 'SWAP'] as EventType[]).map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeFilter(type)}
                className={selectedType === type ? 'bg-black text-white' : 'border-[#EEEEEE]'}
                aria-pressed={selectedType === type}
                aria-label={`${typeConfig[type].label} 필터`}
              >
                {typeConfig[type].label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-[#EEEEEE]"
            onClick={handleRefresh}
            aria-label="새로고침"
          >
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">새로고침</span>
          </Button>
          <Button variant="outline" size="sm" className="border-[#EEEEEE]" aria-label="추가 필터 열기">
            <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">필터</span>
          </Button>
          <Button variant="outline" size="sm" className="border-[#EEEEEE]" aria-label="거래 내역 내보내기">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">내보내기</span>
          </Button>
        </div>
      </section>

      {/* Transaction List */}
      <div className="overflow-hidden rounded-lg border border-[#EEEEEE]">
        <SectionHeader
          title="Transaction History"
          marker="●"
          meta={dataUpdatedAt ? `조회 ${new Date(dataUpdatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : undefined}
        />

        {/* Mobile Card View */}
        <div className="divide-y divide-[#EEEEEE] md:hidden">
          {filteredEvents.map((event) => {
            const config = typeConfig[event.event_type] || typeConfig.TRANSFER;
            const Icon = config.icon;

            return (
              <div key={event.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <Badge
                      variant="outline"
                      className={`border-current ${config.color} bg-transparent`}
                    >
                      {config.label}
                    </Badge>
                    <span className="font-medium text-black">{event.asset_id.symbol}</span>
                  </div>
                  <span className="break-all font-mono text-sm font-medium">{formatAmount(event.amount)}</span>
                </div>
                <div className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-[#666666]">{event.source}</span>
                  <span className="break-all font-mono font-medium">
                    {formatAmount(event.value_snapshot?.price_local, event.value_snapshot?.local_currency)}
                  </span>
                </div>
                {(event.asset_id.chain_id || event.asset_id.contract) && <p className="break-all text-xs text-[#666666]">{event.asset_id.chain_id || '체인 미지정'} · {event.asset_id.contract || '네이티브 자산'}</p>}
                {event.fee_amount && event.fee_asset_id && <p className="break-all text-xs text-[#666666]">수수료 {formatAmount(event.fee_amount)} {event.fee_asset_id.symbol}{event.fee_asset_id.chain_id ? ` · ${event.fee_asset_id.chain_id}` : ''}{event.fee_asset_id.contract ? ` · ${event.fee_asset_id.contract}` : ''}</p>}
                <div className="text-xs text-[#999999]">{formatDate(event.event_time)}</div>
                {event.replacement_event_type && <p className="break-all text-xs">정정 → {typeConfig[event.replacement_event_type].label} · 버전 {event.classification_revision} · {event.correction_reason}<br />기록 시각 {formatDate(event.created_at)}</p>}
                {event.event_type !== 'CORRECTION' && <Button variant="outline" size="sm" onClick={() => beginClassification(event)}>{audit ? '분류 복구' : '분류 정정'}</Button>}
                    <Button variant="outline" size="sm" onClick={() => setTracing(event.correction_of || event.id)}>출처 추적</Button>
              </div>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          {/* Table Header */}
          <div className="grid grid-cols-7 gap-4 border-b border-[#EEEEEE] bg-[#FAFAFA] px-6 py-3 text-[11px] font-medium uppercase tracking-wide text-[#666666] min-w-[800px]">
            <div>유형</div>
            <div>자산</div>
            <div className="text-right">수량</div>
            <div className="text-right">평가 단가</div>
            <div className="text-right">평가액 · 수수료 제외</div>
            <div>출처</div>
            <div>일시</div>
          </div>

          {/* Transaction Rows */}
          <div className="divide-y divide-[#EEEEEE]">
            {filteredEvents.map((event) => {
              const config = typeConfig[event.event_type] || typeConfig.TRANSFER;
              const Icon = config.icon;

              return (
                <div
                  key={event.id}
                  className="grid grid-cols-7 gap-4 px-6 py-4 transition-colors hover:bg-[#FAFAFA] min-w-[800px]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <Badge
                      variant="outline"
                      className={`border-current ${config.color} bg-transparent`}
                    >
                      {config.label}
                    </Badge>
                    {event.event_type !== 'CORRECTION' && <Button variant="outline" size="sm" onClick={() => beginClassification(event)}>{audit ? '분류 복구' : '분류 정정'}</Button>}
                    <Button variant="outline" size="sm" onClick={() => setTracing(event.correction_of || event.id)}>출처 추적</Button>
                    {event.replacement_event_type && <p className="w-full break-all text-xs">→ {typeConfig[event.replacement_event_type].label} · 버전 {event.classification_revision}<br />{event.correction_reason}<br />기록 시각 {formatDate(event.created_at)}</p>}
                  </div>
                  <div className="space-y-1 break-all">
                    <span className="font-medium text-black">{event.asset_id.symbol}</span>
                    {(event.asset_id.chain_id || event.asset_id.contract) && <p className="text-xs text-[#666666]">{event.asset_id.chain_id || '체인 미지정'} · {event.asset_id.contract || '네이티브 자산'}</p>}
                  </div>
                  <div className="break-all text-right font-mono text-sm">{formatAmount(event.amount)}</div>
                  <div className="break-all text-right font-mono text-sm text-[#666666]">
                    {formatAmount(event.value_snapshot?.price_local, event.value_snapshot?.local_currency)}
                  </div>
                  <div className="break-all text-right font-mono text-sm font-medium">
                    {formatValuationTotal([{ quantity: event.amount, price: event.value_snapshot?.price_local, currency: event.value_snapshot?.local_currency }])}
                    {event.fee_amount && event.fee_asset_id && <p className="mt-1 text-xs font-normal text-[#666666]">수수료 {formatAmount(event.fee_amount)} {event.fee_asset_id.symbol}{event.fee_asset_id.chain_id ? ` · ${event.fee_asset_id.chain_id}` : ''}{event.fee_asset_id.contract ? ` · ${event.fee_asset_id.contract}` : ''}</p>}
                  </div>
                  <div className="text-sm text-[#666666]">{event.source}</div>
                  <div className="text-sm text-[#999999]">{formatDate(event.event_time)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {filteredEvents.length === 0 && (
          <div className="px-6 py-12 text-center text-[#666666]">
            <p>거래 내역이 없습니다</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-[#666666]">
        <span>
          {pagination
            ? `${pagination.total ? page * PAGE_SIZE + 1 : 0}-${Math.min((page + 1) * PAGE_SIZE, pagination.total)}건 / 총 ${pagination.total}건`
            : `총 ${filteredEvents.length}건`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-[#EEEEEE]"
            disabled={page === 0}
            onClick={handlePrevPage}
          >
            이전
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[#EEEEEE]"
            disabled={!pagination?.has_more}
            onClick={handleNextPage}
          >
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
