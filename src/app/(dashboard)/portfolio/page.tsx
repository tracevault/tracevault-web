'use client';

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue } from '@/components/ui/data-card';
import { usePortfolio, usePortfolioHistory, useConnections } from '@/hooks';
import type { Amount, PortfolioAsset } from '@/types';

// Color palette for assets
const assetColors: Record<string, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  SOL: '#00FFA3',
  USDT: '#26A17B',
  USDC: '#2775CA',
  BNB: '#F3BA2F',
  XRP: '#23292F',
  ADA: '#0D1E30',
  DOGE: '#C2A633',
  DOT: '#E6007A',
};

function getAssetColor(symbol: string): string {
  return assetColors[symbol] || `hsl(${symbol.charCodeAt(0) * 37 % 360}, 60%, 50%)`;
}

// Helper to format Amount to display string
function formatAmount(amount: Amount | undefined, currency?: string): string {
  if (!amount) return '-';
  const value = parseFloat(amount.value);

  if (currency === 'KRW') {
    return `₩${value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
  } else if (currency === 'USD') {
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  return value.toLocaleString('ko-KR', { maximumFractionDigits: amount.scale });
}

// Helper to format compact number (e.g., 125.4M)
function formatCompact(amount: Amount | undefined, currency?: string): string {
  if (!amount) return '-';
  const value = parseFloat(amount.value);
  const prefix = currency === 'KRW' ? '₩' : currency === 'USD' ? '$' : '';

  if (value >= 1_000_000_000) {
    return `${prefix}${(value / 1_000_000_000).toFixed(1)}B`;
  } else if (value >= 1_000_000) {
    return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `${prefix}${(value / 1_000).toFixed(1)}K`;
  }
  return `${prefix}${value.toFixed(0)}`;
}

export default function PortfolioPage() {
  const [timeRange, setTimeRange] = useState('24h');

  // Fetch portfolio data
  const {
    data: portfolio,
    isLoading: isLoadingPortfolio,
    isError: isErrorPortfolio,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = usePortfolio('KRW');

  // Fetch connections for exchange breakdown
  const { data: connections } = useConnections();

  // Calculate 24h change (would need portfolio history for real calculation)
  const portfolioChange = useMemo(() => {
    // TODO: Calculate from portfolio history when available
    return {
      percentage: '+2.34%',
      value: '₩2,872,000',
      isPositive: true,
    };
  }, []);

  // Group assets by exchange (simulated - real implementation would need exchange info per asset)
  const exchangeBreakdown = useMemo(() => {
    if (!connections) return [];

    // Simulated breakdown based on connections
    const totalValue = parseFloat(portfolio?.total_value_local?.value || '0');

    return connections.map((conn, index) => ({
      exchange: conn.exchange.charAt(0).toUpperCase() + conn.exchange.slice(1),
      value: formatAmount(
        { value: (totalValue * (0.5 - index * 0.15)).toString(), scale: 0 },
        'KRW'
      ),
      percentage: Math.round((0.5 - index * 0.15) * 100),
      assets: Math.floor(Math.random() * 5) + 1,
    }));
  }, [connections, portfolio]);

  // Recent activity (would need events API for real data)
  const recentActivity = useMemo(() => {
    // Placeholder - would come from ledger events
    return [
      { type: 'deposit', asset: 'BTC', amount: '+0.05', time: '2시간 전' },
      { type: 'trade', asset: 'ETH', amount: '-1.0', time: '5시간 전' },
      { type: 'reward', asset: 'SOL', amount: '+2.1', time: '1일 전' },
    ];
  }, []);

  const handleRefresh = () => {
    refetchPortfolio();
  };

  // Loading state
  if (isLoadingPortfolio) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#666666]" />
      </div>
    );
  }

  // Error state
  if (isErrorPortfolio) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-[#EF4444] mb-4" />
        <h2 className="text-lg font-semibold text-black mb-2">포트폴리오를 불러올 수 없습니다</h2>
        <p className="text-sm text-[#666666] mb-4">
          {portfolioError instanceof Error ? portfolioError.message : '알 수 없는 오류가 발생했습니다'}
        </p>
        <Button onClick={handleRefresh} variant="outline">
          다시 시도
        </Button>
      </div>
    );
  }

  const assets = portfolio?.assets || [];
  const totalValueLocal = formatAmount(portfolio?.total_value_local, portfolio?.local_currency);
  const totalValueUsd = formatAmount(portfolio?.total_value_usd, 'USD');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black">Portfolio</h1>
          <p className="mt-1 text-sm text-[#666666]">
            자산 현황 및 포트폴리오 분석
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-[#EEEEEE]"
          onClick={handleRefresh}
          aria-label="포트폴리오 데이터 새로고침"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          새로고침
        </Button>
      </header>

      {/* Total Value Card */}
      <DataCard className="bg-black text-white" hover={false}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-xs sm:text-sm uppercase tracking-wide text-white/60">
              총 자산 가치
            </div>
            <div className="mt-2 text-3xl sm:text-4xl font-bold tabular-nums">
              {totalValueLocal}
            </div>
            <div className="mt-1 text-sm text-white/60">
              ≈ {totalValueUsd}
            </div>
          </div>
          <div className="sm:text-right">
            <div
              className={`flex items-center gap-1 text-lg font-medium ${
                portfolioChange.isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}
            >
              {portfolioChange.isPositive ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {portfolioChange.percentage}
            </div>
            <div className="text-sm text-white/60">
              {portfolioChange.value}
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="기간 선택">
          {['24h', '7d', '30d', '1y', 'All'].map((range) => (
            <Button
              key={range}
              variant="ghost"
              size="sm"
              onClick={() => setTimeRange(range)}
              className={`${
                timeRange === range
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              aria-pressed={timeRange === range}
              aria-label={`${range} 기간 보기`}
            >
              {range}
            </Button>
          ))}
        </div>
      </DataCard>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Asset Allocation */}
        <div className="lg:col-span-2 overflow-hidden rounded-lg border border-[#EEEEEE]">
          <SectionHeader title="Asset Allocation" marker="◆" />

          <div className="p-4 sm:p-6">
            {/* Visual Bar */}
            {assets.length > 0 && (
              <div className="mb-6 flex h-3 sm:h-4 overflow-hidden rounded-full">
                {assets.map((asset) => (
                  <div
                    key={asset.asset_id.symbol}
                    style={{
                      width: `${asset.percentage}%`,
                      backgroundColor: getAssetColor(asset.asset_id.symbol),
                    }}
                    title={`${asset.asset_id.symbol}: ${asset.percentage.toFixed(1)}%`}
                  />
                ))}
              </div>
            )}

            {/* Asset List */}
            <div className="space-y-4">
              {assets.length === 0 ? (
                <div className="py-8 text-center text-[#666666]">
                  보유 자산이 없습니다
                </div>
              ) : (
                assets.map((asset) => (
                  <div
                    key={asset.asset_id.symbol}
                    className="flex items-center justify-between border-b border-[#EEEEEE] pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getAssetColor(asset.asset_id.symbol) }}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-black">{asset.asset_id.symbol}</div>
                        <div className="text-xs sm:text-sm text-[#666666] truncate">
                          {asset.asset_id.chain_id || 'Native'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono font-medium text-sm sm:text-base">
                        {formatAmount(asset.value_local, portfolio?.local_currency)}
                      </div>
                      <div className="text-xs sm:text-sm text-[#666666]">
                        <span className="hidden sm:inline">
                          {formatAmount(asset.balance)} {asset.asset_id.symbol} ·{' '}
                        </span>
                        {asset.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Exchange Breakdown */}
          <div className="overflow-hidden rounded-lg border border-[#EEEEEE]">
            <SectionHeader title="By Exchange" marker="●" />
            <div className="p-4 space-y-3">
              {exchangeBreakdown.length === 0 ? (
                <div className="py-4 text-center text-sm text-[#666666]">
                  연결된 거래소가 없습니다
                </div>
              ) : (
                exchangeBreakdown.map((ex) => (
                  <div key={ex.exchange} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{ex.exchange}</span>
                      <span className="text-[#666666]">{ex.value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-[#EEEEEE]">
                        <div
                          className="h-full rounded-full bg-black"
                          style={{ width: `${ex.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-[#666666]">{ex.percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="overflow-hidden rounded-lg border border-[#EEEEEE]">
            <SectionHeader title="Recent Activity" marker="▶" />
            <div className="divide-y divide-[#EEEEEE]">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{activity.asset}</span>
                    <span
                      className={`font-mono text-sm ${
                        activity.amount.startsWith('+')
                          ? 'text-[#22C55E]'
                          : 'text-[#EF4444]'
                      }`}
                    >
                      {activity.amount}
                    </span>
                  </div>
                  <span className="text-xs text-[#999999]">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="포트폴리오 요약 통계">
        <DataCard>
          <DataValue value={assets.length.toString()} label="보유 자산 종류" />
        </DataCard>
        <DataCard>
          <DataValue value={(connections?.length || 0).toString()} label="연결된 거래소" />
        </DataCard>
        <DataCard>
          <DataValue value="-" label="총 거래 수" />
        </DataCard>
        <DataCard>
          <DataValue
            value={portfolioChange.percentage}
            label="총 수익률"
            trend={portfolioChange.isPositive ? 'up' : 'down'}
          />
        </DataCard>
      </section>
    </div>
  );
}
