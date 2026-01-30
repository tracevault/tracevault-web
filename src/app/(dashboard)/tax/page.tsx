'use client';

import { useState } from 'react';
import {
  FileText,
  Download,
  Calculator,
  Calendar,
  ChevronDown,
  Info,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue, StatusIndicator } from '@/components/ui/data-card';

// Mock data
const taxYears = [2027, 2026, 2025];

const taxSummary = {
  year: 2027,
  jurisdiction: 'Korea',
  totalGain: '₩15,820,000',
  totalLoss: '₩2,340,000',
  netGain: '₩13,480,000',
  deduction: '₩2,500,000',
  taxableGain: '₩10,980,000',
  estimatedTax: '₩2,415,600',
  effectiveRate: '22%',
  status: 'calculated',
};

const monthlyBreakdown = [
  { month: '1월', gain: '₩2,150,000', loss: '₩0', net: '₩2,150,000' },
  { month: '2월', gain: '₩1,820,000', loss: '₩340,000', net: '₩1,480,000' },
  { month: '3월', gain: '₩3,450,000', loss: '₩1,200,000', net: '₩2,250,000' },
  { month: '4월', gain: '₩890,000', loss: '₩0', net: '₩890,000' },
  { month: '5월', gain: '₩2,100,000', loss: '₩500,000', net: '₩1,600,000' },
  { month: '6월', gain: '₩1,560,000', loss: '₩300,000', net: '₩1,260,000' },
];

const taxLots = [
  {
    id: '1',
    asset: 'BTC',
    acquired: '2026-03-15',
    quantity: '0.5',
    costBasis: '₩32,500,000',
    status: 'open',
    holdingPeriod: '320일',
  },
  {
    id: '2',
    asset: 'ETH',
    acquired: '2026-05-22',
    quantity: '3.0',
    costBasis: '₩12,150,000',
    status: 'open',
    holdingPeriod: '252일',
  },
  {
    id: '3',
    asset: 'BTC',
    acquired: '2025-11-10',
    quantity: '0.75',
    costBasis: '₩45,000,000',
    sold: '2027-01-15',
    proceeds: '₩52,500,000',
    gain: '₩7,500,000',
    status: 'closed',
    holdingPeriod: '432일',
  },
];

const reports = [
  {
    id: '1',
    name: '2027년 세금 요약 보고서',
    format: 'PDF',
    size: '245 KB',
    generated: '2027-01-30',
  },
  {
    id: '2',
    name: '2027년 거래 내역 (CSV)',
    format: 'CSV',
    size: '128 KB',
    generated: '2027-01-30',
  },
  {
    id: '3',
    name: '2027년 Tax Lot 상세',
    format: 'JSON',
    size: '89 KB',
    generated: '2027-01-30',
  },
];

export default function TaxPage() {
  const [selectedYear, setSelectedYear] = useState(2027);
  const [activeTab, setActiveTab] = useState<'summary' | 'lots' | 'reports'>('summary');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Tax Reports</h1>
          <p className="mt-1 text-sm text-[#666666]">
            세금 계산 및 리포트 생성
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative">
            <label htmlFor="tax-year-select" className="sr-only">세금 연도 선택</label>
            <select
              id="tax-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none rounded-md border border-[#EEEEEE] bg-white px-3 sm:px-4 py-2 pr-8 sm:pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
              aria-label="세금 연도 선택"
            >
              {taxYears.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 sm:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" aria-hidden="true" />
          </div>
          <Button className="bg-black text-white hover:bg-black/90" aria-label="세금 재계산 실행">
            <Calculator className="h-4 w-4 sm:mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">세금 재계산</span>
          </Button>
        </div>
      </header>

      {/* Tax Status Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/5 px-4 py-3">
        <CheckCircle className="h-5 w-5 text-[#22C55E]" />
        <div className="flex-1">
          <span className="font-medium text-black">
            {selectedYear}년 세금 계산 완료
          </span>
          <span className="ml-2 text-sm text-[#666666]">
            마지막 업데이트: 2027-01-30 14:32
          </span>
        </div>
        <Badge variant="outline" className="border-[#22C55E] text-[#22C55E]">
          한국 (22%)
        </Badge>
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="세금 요약">
        <DataCard>
          <DataValue value={taxSummary.totalGain} label="총 실현 이익" trend="up" />
        </DataCard>
        <DataCard>
          <DataValue value={taxSummary.totalLoss} label="총 실현 손실" trend="down" />
        </DataCard>
        <DataCard>
          <DataValue value={taxSummary.taxableGain} label="과세 대상 금액" />
        </DataCard>
        <DataCard className="bg-black text-white col-span-2 md:col-span-1" hover={false}>
          <div className="text-[11px] uppercase tracking-[0.5px] text-white/60">
            예상 세금
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-medium tabular-nums" aria-label={`예상 세금 ${taxSummary.estimatedTax}`}>
            {taxSummary.estimatedTax}
          </div>
          <div className="mt-1 text-sm text-white/60">
            실효세율 {taxSummary.effectiveRate}
          </div>
        </DataCard>
      </section>

      {/* Tab Navigation */}
      <div
        className="flex gap-1 border-b border-[#EEEEEE] overflow-x-auto"
        role="tablist"
        aria-label="세금 정보 탭"
      >
        {[
          { id: 'summary', label: '월별 요약', icon: Calendar },
          { id: 'lots', label: 'Tax Lots', icon: FileText },
          { id: 'reports', label: '리포트', icon: Download },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 sm:gap-2 border-b-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-black focus:ring-inset ${
              activeTab === tab.id
                ? 'border-black text-black'
                : 'border-transparent text-[#666666] hover:text-black'
            }`}
          >
            <tab.icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <div
          role="tabpanel"
          id="tabpanel-summary"
          aria-labelledby="tab-summary"
          className="overflow-hidden rounded-lg border border-[#EEEEEE]"
        >
          <SectionHeader
            title="Monthly Breakdown"
            marker="◆"
            meta={`${selectedYear}년`}
          />

          <div className="overflow-x-auto">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 border-b border-[#EEEEEE] bg-[#FAFAFA] px-4 sm:px-6 py-3 text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-[#666666] min-w-[320px]">
              <div>월</div>
              <div className="text-right">실현 이익</div>
              <div className="text-right">실현 손실</div>
              <div className="text-right">순이익</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#EEEEEE]">
              {monthlyBreakdown.map((row) => (
                <div
                  key={row.month}
                  className="grid grid-cols-4 gap-2 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 transition-colors hover:bg-[#FAFAFA] min-w-[320px]"
                >
                  <div className="font-medium text-sm">{row.month}</div>
                  <div className="text-right font-mono text-xs sm:text-sm text-[#22C55E]">{row.gain}</div>
                  <div className="text-right font-mono text-xs sm:text-sm text-[#EF4444]">
                    {row.loss === '₩0' ? '-' : row.loss}
                  </div>
                  <div className="text-right font-mono text-xs sm:text-sm font-medium">{row.net}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 border-t border-[#EEEEEE] bg-[#FAFAFA] px-4 sm:px-6 py-3 sm:py-4 font-medium min-w-[320px]">
              <div className="text-sm">합계</div>
              <div className="text-right font-mono text-xs sm:text-sm text-[#22C55E]">
                {taxSummary.totalGain}
              </div>
              <div className="text-right font-mono text-xs sm:text-sm text-[#EF4444]">
                {taxSummary.totalLoss}
              </div>
              <div className="text-right font-mono text-xs sm:text-sm">{taxSummary.netGain}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lots' && (
        <div
          role="tabpanel"
          id="tabpanel-lots"
          aria-labelledby="tab-lots"
          className="overflow-hidden rounded-lg border border-[#EEEEEE]"
        >
          <SectionHeader
            title="Tax Lots"
            marker="●"
            meta={`${taxLots.length}개 로트`}
          />

          {/* Mobile Card View */}
          <div className="divide-y divide-[#EEEEEE] md:hidden">
            {taxLots.map((lot) => (
              <div key={lot.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{lot.asset}</span>
                    <Badge
                      variant="outline"
                      className={
                        lot.status === 'open'
                          ? 'border-[#3B82F6] text-[#3B82F6]'
                          : 'border-[#666666] text-[#666666]'
                      }
                    >
                      {lot.status === 'open' ? '보유 중' : '처분 완료'}
                    </Badge>
                  </div>
                  <span className="font-mono text-sm">{lot.quantity}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#666666]">취득: {lot.acquired}</span>
                  <span className="font-mono">{lot.costBasis}</span>
                </div>
                {lot.gain && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#666666]">손익</span>
                    <span className="font-mono text-[#22C55E]">{lot.gain}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            {/* Table Header */}
            <div className="grid grid-cols-7 gap-4 border-b border-[#EEEEEE] bg-[#FAFAFA] px-6 py-3 text-[11px] font-medium uppercase tracking-wide text-[#666666] min-w-[800px]">
              <div>자산</div>
              <div>취득일</div>
              <div className="text-right">수량</div>
              <div className="text-right">취득가</div>
              <div className="text-right">처분가</div>
              <div className="text-right">손익</div>
              <div>상태</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#EEEEEE]">
              {taxLots.map((lot) => (
                <div
                  key={lot.id}
                  className="grid grid-cols-7 gap-4 px-6 py-4 transition-colors hover:bg-[#FAFAFA] min-w-[800px]"
                >
                  <div className="font-medium">{lot.asset}</div>
                  <div className="text-sm text-[#666666]">{lot.acquired}</div>
                  <div className="text-right font-mono">{lot.quantity}</div>
                  <div className="text-right font-mono text-sm">{lot.costBasis}</div>
                  <div className="text-right font-mono text-sm">
                    {lot.proceeds || '-'}
                  </div>
                  <div
                    className={`text-right font-mono text-sm ${
                      lot.gain ? 'text-[#22C55E]' : 'text-[#666666]'
                    }`}
                  >
                    {lot.gain || '-'}
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        lot.status === 'open'
                          ? 'border-[#3B82F6] text-[#3B82F6]'
                          : 'border-[#666666] text-[#666666]'
                      }
                    >
                      {lot.status === 'open' ? '보유 중' : '처분 완료'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div
          role="tabpanel"
          id="tabpanel-reports"
          aria-labelledby="tab-reports"
          className="overflow-hidden rounded-lg border border-[#EEEEEE]"
        >
          <SectionHeader
            title="Available Reports"
            marker="★"
            meta="다운로드 가능"
          />

          <div className="divide-y divide-[#EEEEEE]">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 transition-colors hover:bg-[#FAFAFA]"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#666666] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm sm:text-base truncate">{report.name}</div>
                    <div className="text-xs sm:text-sm text-[#666666]">
                      {report.format} · {report.size} · {report.generated}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#EEEEEE] self-end sm:self-auto"
                  aria-label={`${report.name} 다운로드`}
                >
                  <Download className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">다운로드</span>
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t border-[#EEEEEE] bg-[#FAFAFA] px-4 sm:px-6 py-4">
            <Button className="bg-black text-white hover:bg-black/90 w-full sm:w-auto" aria-label="새 세금 리포트 생성">
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" />새 리포트 생성
            </Button>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] px-3 sm:px-4 py-3">
        <Info className="mt-0.5 h-5 w-5 text-[#666666] flex-shrink-0" />
        <div className="text-xs sm:text-sm text-[#666666]">
          <strong className="text-black">참고:</strong> 이 계산은 참고용이며, 실제 세금
          신고 시에는 세무사와 상담하시기 바랍니다. 한국 가상자산 과세는 2027년부터
          시행되며, 연간 250만원 공제 후 22% (지방세 포함) 세율이 적용됩니다.
        </div>
      </div>
    </div>
  );
}
