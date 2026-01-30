'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCcw,
  Filter,
  Download,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue, DataRow, StatusIndicator } from '@/components/ui/data-card';

// Mock data for demonstration
const mockTransactions = [
  {
    id: '1',
    type: 'BUY',
    asset: 'BTC',
    amount: '0.05',
    price: '₩3,250,000',
    total: '₩162,500,000',
    exchange: 'Upbit',
    date: '2026-01-30 14:32:15',
    status: 'confirmed',
  },
  {
    id: '2',
    type: 'SELL',
    asset: 'ETH',
    amount: '2.5',
    price: '₩4,120,000',
    total: '₩10,300,000',
    exchange: 'Binance',
    date: '2026-01-29 09:15:42',
    status: 'confirmed',
  },
  {
    id: '3',
    type: 'TRANSFER',
    asset: 'BTC',
    amount: '0.1',
    price: '-',
    total: '-',
    exchange: 'Upbit → Binance',
    date: '2026-01-28 18:22:01',
    status: 'confirmed',
  },
  {
    id: '4',
    type: 'REWARD',
    asset: 'SOL',
    amount: '5.2',
    price: '₩185,000',
    total: '₩962,000',
    exchange: 'Staking',
    date: '2026-01-27 00:00:00',
    status: 'confirmed',
  },
  {
    id: '5',
    type: 'BUY',
    asset: 'ETH',
    amount: '1.0',
    price: '₩4,050,000',
    total: '₩4,050,000',
    exchange: 'Bithumb',
    date: '2026-01-25 11:45:33',
    status: 'confirmed',
  },
];

const typeConfig = {
  BUY: { icon: ArrowDownLeft, color: 'text-[#22C55E]', label: '매수' },
  SELL: { icon: ArrowUpRight, color: 'text-[#EF4444]', label: '매도' },
  TRANSFER: { icon: RefreshCcw, color: 'text-[#666666]', label: '이체' },
  REWARD: { icon: ArrowDownLeft, color: 'text-[#3B82F6]', label: '보상' },
};

export default function LedgerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const filteredTransactions = mockTransactions.filter((tx) => {
    const matchesSearch =
      tx.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.exchange.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || tx.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-0">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">Ledger</h1>
        <p className="mt-1 text-sm text-[#666666]">
          모든 거래 내역을 조회하고 관리합니다
        </p>
      </div>

      {/* Stats Overview */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <DataCard>
          <DataValue value="127" label="총 거래 수" size="lg" />
        </DataCard>
        <DataCard>
          <DataValue value="₩45.2M" label="총 매수 금액" size="lg" />
        </DataCard>
        <DataCard>
          <DataValue value="₩12.8M" label="총 매도 금액" size="lg" />
        </DataCard>
        <DataCard>
          <DataValue value="23" label="이체 횟수" size="lg" />
        </DataCard>
      </div>

      {/* Filters & Search */}
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
            <Input
              placeholder="자산 또는 거래소 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 border-[#EEEEEE] pl-9"
            />
          </div>
          <div className="flex gap-1">
            {['BUY', 'SELL', 'TRANSFER', 'REWARD'].map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(selectedType === type ? null : type)}
                className={selectedType === type ? 'bg-black text-white' : 'border-[#EEEEEE]'}
              >
                {typeConfig[type as keyof typeof typeConfig].label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-[#EEEEEE]">
            <Filter className="mr-2 h-4 w-4" />
            필터
          </Button>
          <Button variant="outline" size="sm" className="border-[#EEEEEE]">
            <Download className="mr-2 h-4 w-4" />
            내보내기
          </Button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="overflow-hidden rounded-lg border border-[#EEEEEE]">
        <SectionHeader
          title="Transaction History"
          marker="●"
          meta={`Updated ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
        />

        {/* Table Header */}
        <div className="grid grid-cols-7 gap-4 border-b border-[#EEEEEE] bg-[#FAFAFA] px-6 py-3 text-[11px] font-medium uppercase tracking-wide text-[#666666]">
          <div>유형</div>
          <div>자산</div>
          <div className="text-right">수량</div>
          <div className="text-right">가격</div>
          <div className="text-right">금액</div>
          <div>거래소</div>
          <div>일시</div>
        </div>

        {/* Transaction Rows */}
        <div className="divide-y divide-[#EEEEEE]">
          {filteredTransactions.map((tx) => {
            const config = typeConfig[tx.type as keyof typeof typeConfig];
            const Icon = config.icon;

            return (
              <div
                key={tx.id}
                className="grid grid-cols-7 gap-4 px-6 py-4 transition-colors hover:bg-[#FAFAFA]"
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
                  <span className="font-medium text-black">{tx.asset}</span>
                </div>
                <div className="text-right font-mono text-sm">{tx.amount}</div>
                <div className="text-right font-mono text-sm text-[#666666]">
                  {tx.price}
                </div>
                <div className="text-right font-mono text-sm font-medium">
                  {tx.total}
                </div>
                <div className="text-sm text-[#666666]">{tx.exchange}</div>
                <div className="text-sm text-[#999999]">{tx.date}</div>
              </div>
            );
          })}
        </div>

        {filteredTransactions.length === 0 && (
          <div className="px-6 py-12 text-center text-[#666666]">
            <p>검색 결과가 없습니다</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-[#666666]">
        <span>총 {filteredTransactions.length}건</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-[#EEEEEE]" disabled>
            이전
          </Button>
          <Button variant="outline" size="sm" className="border-[#EEEEEE]">
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
