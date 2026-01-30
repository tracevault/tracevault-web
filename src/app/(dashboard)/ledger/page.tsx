'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue } from '@/components/ui/data-card';
import { useLedgerEvents, useRefreshLedger } from '@/hooks';
import type { EventType, LedgerEvent, Amount } from '@/types';

const PAGE_SIZE = 20;

const typeConfig: Record<EventType, { icon: typeof ArrowDownLeft; color: string; label: string }> = {
  BUY: { icon: ArrowDownLeft, color: 'text-[#22C55E]', label: '매수' },
  SELL: { icon: ArrowUpRight, color: 'text-[#EF4444]', label: '매도' },
  TRANSFER: { icon: RefreshCcw, color: 'text-[#666666]', label: '이체' },
  REWARD: { icon: Gift, color: 'text-[#3B82F6]', label: '보상' },
  AIRDROP: { icon: Gift, color: 'text-[#8B5CF6]', label: '에어드롭' },
  SWAP: { icon: Repeat, color: 'text-[#F59E0B]', label: '스왑' },
  CORRECTION: { icon: AlertCircle, color: 'text-[#6B7280]', label: '수정' },
};

// Helper to format Amount to display string
function formatAmount(amount: Amount | undefined): string {
  if (!amount) return '-';
  const value = parseFloat(amount.value);
  if (amount.scale > 8) {
    return value.toFixed(8);
  }
  return value.toLocaleString('ko-KR', { maximumFractionDigits: amount.scale });
}

// Helper to format price in KRW
function formatKRW(amount: Amount | undefined): string {
  if (!amount) return '-';
  const value = parseFloat(amount.value);
  return `₩${value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
}

// Helper to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LedgerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [page, setPage] = useState(0);

  const refreshLedger = useRefreshLedger();

  // Fetch ledger events with pagination and filters
  const {
    data: eventsData,
    isLoading,
    isError,
    error,
  } = useLedgerEvents({
    event_type: selectedType || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const events = eventsData?.events || [];
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

  // Calculate stats from events
  const stats = useMemo(() => {
    let totalBuy = 0;
    let totalSell = 0;
    let transferCount = 0;

    events.forEach((event) => {
      const localValue = parseFloat(event.value_snapshot?.price_local?.value || '0');
      const amount = parseFloat(event.amount.value);
      const total = localValue * amount;

      if (event.event_type === 'BUY') totalBuy += total;
      else if (event.event_type === 'SELL') totalSell += total;
      else if (event.event_type === 'TRANSFER') transferCount++;
    });

    return {
      total: pagination?.total || events.length,
      totalBuy,
      totalSell,
      transferCount,
    };
  }, [events, pagination?.total]);

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
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-black">Ledger</h1>
        <p className="mt-1 text-sm text-[#666666]">
          모든 거래 내역을 조회하고 관리합니다
        </p>
      </header>

      {/* Stats Overview */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="거래 통계 요약">
        <DataCard>
          <DataValue value={stats.total.toLocaleString()} label="총 거래 수" size="lg" />
        </DataCard>
        <DataCard>
          <DataValue
            value={`₩${(stats.totalBuy / 1000000).toFixed(1)}M`}
            label="총 매수 금액"
            size="lg"
          />
        </DataCard>
        <DataCard>
          <DataValue
            value={`₩${(stats.totalSell / 1000000).toFixed(1)}M`}
            label="총 매도 금액"
            size="lg"
          />
        </DataCard>
        <DataCard>
          <DataValue value={stats.transferCount.toString()} label="이체 횟수" size="lg" />
        </DataCard>
      </section>

      {/* Filters & Search */}
      <section className="mb-4 space-y-3 md:space-y-0 md:flex md:items-center md:justify-between" aria-label="거래 필터">
        <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" aria-hidden="true" />
            <Input
              placeholder="자산 또는 출처 검색..."
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
          meta={`Updated ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
        />

        {/* Mobile Card View */}
        <div className="divide-y divide-[#EEEEEE] md:hidden">
          {filteredEvents.map((event) => {
            const config = typeConfig[event.event_type] || typeConfig.TRANSFER;
            const Icon = config.icon;

            return (
              <div key={event.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <Badge
                      variant="outline"
                      className={`border-current ${config.color} bg-transparent`}
                    >
                      {config.label}
                    </Badge>
                    <span className="font-medium text-black">{event.asset_id.symbol}</span>
                  </div>
                  <span className="font-mono text-sm font-medium">{formatAmount(event.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#666666]">{event.source}</span>
                  <span className="font-mono font-medium">
                    {formatKRW(event.value_snapshot?.price_local)}
                  </span>
                </div>
                <div className="text-xs text-[#999999]">{formatDate(event.event_time)}</div>
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
            <div className="text-right">가격</div>
            <div className="text-right">금액</div>
            <div>출처</div>
            <div>일시</div>
          </div>

          {/* Transaction Rows */}
          <div className="divide-y divide-[#EEEEEE]">
            {filteredEvents.map((event) => {
              const config = typeConfig[event.event_type] || typeConfig.TRANSFER;
              const Icon = config.icon;
              const amount = parseFloat(event.amount.value);
              const priceLocal = parseFloat(event.value_snapshot?.price_local?.value || '0');
              const total = amount * priceLocal;

              return (
                <div
                  key={event.id}
                  className="grid grid-cols-7 gap-4 px-6 py-4 transition-colors hover:bg-[#FAFAFA] min-w-[800px]"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <Badge
                      variant="outline"
                      className={`border-current ${config.color} bg-transparent`}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-black">{event.asset_id.symbol}</span>
                  </div>
                  <div className="text-right font-mono text-sm">{formatAmount(event.amount)}</div>
                  <div className="text-right font-mono text-sm text-[#666666]">
                    {formatKRW(event.value_snapshot?.price_local)}
                  </div>
                  <div className="text-right font-mono text-sm font-medium">
                    {event.event_type === 'TRANSFER' ? '-' : `₩${total.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`}
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
            ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, pagination.total)}건 / 총 ${pagination.total}건`
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
