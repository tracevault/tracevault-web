'use client';

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue, StatusIndicator } from '@/components/ui/data-card';

// Mock data for demonstration
const portfolioSummary = {
  totalValue: '₩125,432,500',
  totalValueUSD: '$94,250',
  change24h: '+2.34%',
  change24hValue: '+₩2,872,000',
  isPositive: true,
};

const assetAllocation = [
  { asset: 'BTC', name: 'Bitcoin', amount: '1.25', value: '₩81,250,000', percentage: 64.8, color: '#F7931A' },
  { asset: 'ETH', name: 'Ethereum', amount: '8.5', value: '₩34,850,000', percentage: 27.8, color: '#627EEA' },
  { asset: 'SOL', name: 'Solana', amount: '45.2', value: '₩8,332,500', percentage: 6.6, color: '#00FFA3' },
  { asset: 'USDT', name: 'Tether', amount: '1,000', value: '₩1,000,000', percentage: 0.8, color: '#26A17B' },
];

const exchangeBreakdown = [
  { exchange: 'Upbit', value: '₩65,200,000', percentage: 52, assets: 3 },
  { exchange: 'Binance', value: '₩45,000,000', percentage: 36, assets: 4 },
  { exchange: 'Bithumb', value: '₩15,232,500', percentage: 12, assets: 2 },
];

const recentActivity = [
  { type: 'deposit', asset: 'BTC', amount: '+0.05', time: '2시간 전' },
  { type: 'trade', asset: 'ETH', amount: '-1.0', time: '5시간 전' },
  { type: 'reward', asset: 'SOL', amount: '+2.1', time: '1일 전' },
];

export default function PortfolioPage() {
  const [timeRange, setTimeRange] = useState('24h');

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
        <Button variant="outline" size="sm" className="border-[#EEEEEE]" aria-label="포트폴리오 데이터 새로고침">
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
              {portfolioSummary.totalValue}
            </div>
            <div className="mt-1 text-sm text-white/60">
              ≈ {portfolioSummary.totalValueUSD}
            </div>
          </div>
          <div className="sm:text-right">
            <div
              className={`flex items-center gap-1 text-lg font-medium ${
                portfolioSummary.isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}
            >
              {portfolioSummary.isPositive ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {portfolioSummary.change24h}
            </div>
            <div className="text-sm text-white/60">
              {portfolioSummary.change24hValue}
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
            <div className="mb-6 flex h-3 sm:h-4 overflow-hidden rounded-full">
              {assetAllocation.map((asset) => (
                <div
                  key={asset.asset}
                  style={{
                    width: `${asset.percentage}%`,
                    backgroundColor: asset.color,
                  }}
                  title={`${asset.asset}: ${asset.percentage}%`}
                />
              ))}
            </div>

            {/* Asset List */}
            <div className="space-y-4">
              {assetAllocation.map((asset) => (
                <div
                  key={asset.asset}
                  className="flex items-center justify-between border-b border-[#EEEEEE] pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: asset.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-black">{asset.asset}</div>
                      <div className="text-xs sm:text-sm text-[#666666] truncate">{asset.name}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono font-medium text-sm sm:text-base">{asset.value}</div>
                    <div className="text-xs sm:text-sm text-[#666666]">
                      <span className="hidden sm:inline">{asset.amount} {asset.asset} · </span>{asset.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Exchange Breakdown */}
          <div className="overflow-hidden rounded-lg border border-[#EEEEEE]">
            <SectionHeader title="By Exchange" marker="●" />
            <div className="p-4 space-y-3">
              {exchangeBreakdown.map((ex) => (
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
              ))}
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
          <DataValue value="9" label="보유 자산 종류" />
        </DataCard>
        <DataCard>
          <DataValue value="3" label="연결된 거래소" />
        </DataCard>
        <DataCard>
          <DataValue value="127" label="총 거래 수" />
        </DataCard>
        <DataCard>
          <DataValue
            value="+18.5%"
            label="총 수익률"
            trend="up"
          />
        </DataCard>
      </section>
    </div>
  );
}
