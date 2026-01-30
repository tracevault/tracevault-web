'use client';

import { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Calculator,
  Calendar,
  ChevronDown,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { DataCard, DataValue } from '@/components/ui/data-card';
import {
  useTaxSummary,
  useTaxLots,
  useTaxReports,
  useCalculateTax,
  useGenerateTaxReport,
  downloadTaxReport,
} from '@/hooks';
import type { Amount, TaxLot, TaxReport } from '@/types';

// Available tax years
const taxYears = [2027, 2026, 2025];

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

// Helper to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// Helper to format datetime
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper to calculate holding period in days
function getHoldingPeriod(acquiredDate: string, soldDate?: string): string {
  const acquired = new Date(acquiredDate);
  const end = soldDate ? new Date(soldDate) : new Date();
  const days = Math.floor((end.getTime() - acquired.getTime()) / (1000 * 60 * 60 * 24));
  return `${days}일`;
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaxPage() {
  const [selectedYear, setSelectedYear] = useState(2027);
  const [activeTab, setActiveTab] = useState<'summary' | 'lots' | 'reports'>('summary');

  // Fetch tax summary
  const {
    data: taxSummary,
    isLoading: isLoadingSummary,
    isError: isErrorSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useTaxSummary(selectedYear);

  // Fetch tax lots
  const {
    data: taxLotsData,
    isLoading: isLoadingLots,
    isError: isErrorLots,
    error: lotsError,
    refetch: refetchLots,
  } = useTaxLots({ include_consumed: true, limit: 100 });

  // Fetch tax reports
  const {
    data: reports,
    isLoading: isLoadingReports,
    isError: isErrorReports,
    error: reportsError,
    refetch: refetchReports,
  } = useTaxReports(selectedYear);

  // Mutations
  const calculateTax = useCalculateTax();
  const generateReport = useGenerateTaxReport();

  // Handle recalculate
  const handleRecalculate = async () => {
    await calculateTax.mutateAsync({
      tax_year: selectedYear,
      jurisdiction: 'KOREA',
      cost_basis_method: 'FIFO',
    });
    refetchSummary();
    refetchLots();
  };

  // Handle generate report
  const handleGenerateReport = async (format: 'PDF' | 'CSV' | 'JSON') => {
    await generateReport.mutateAsync({
      tax_year: selectedYear,
      jurisdiction: 'KOREA',
      report_type: format === 'PDF' ? 'SUMMARY' : format === 'CSV' ? 'TRANSACTIONS' : 'TAX_LOTS',
      format,
    });
    refetchReports();
  };

  // Handle download
  const handleDownload = (report: TaxReport) => {
    downloadTaxReport(report);
  };

  // Handle refresh all
  const handleRefresh = () => {
    refetchSummary();
    refetchLots();
    refetchReports();
  };

  const taxLots = taxLotsData?.lots || [];
  const isLoading = isLoadingSummary || isLoadingLots || isLoadingReports;
  const hasError = isErrorSummary || isErrorLots || isErrorReports;
  const errorMessage =
    summaryError instanceof Error
      ? summaryError.message
      : lotsError instanceof Error
        ? lotsError.message
        : reportsError instanceof Error
          ? reportsError.message
          : '알 수 없는 오류가 발생했습니다';

  // Tax rate display
  const taxRateDisplay = useMemo(() => {
    if (!taxSummary) return '22%';
    return `${(taxSummary.tax_rate * 100).toFixed(0)}%`;
  }, [taxSummary]);

  // Jurisdiction display
  const jurisdictionDisplay = useMemo(() => {
    if (!taxSummary) return '한국';
    return taxSummary.currency === 'KRW' ? '한국' : taxSummary.currency;
  }, [taxSummary]);

  // Loading state
  if (isLoading && !taxSummary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#666666]" />
      </div>
    );
  }

  // Error state
  if (hasError && !taxSummary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-[#EF4444] mb-4" />
        <h2 className="text-lg font-semibold text-black mb-2">데이터를 불러올 수 없습니다</h2>
        <p className="text-sm text-[#666666] mb-4">{errorMessage}</p>
        <Button onClick={handleRefresh} variant="outline">
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Tax Reports</h1>
          <p className="mt-1 text-sm text-[#666666]">세금 계산 및 리포트 생성</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            className="border-[#EEEEEE]"
            onClick={handleRefresh}
            aria-label="데이터 새로고침"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="relative">
            <label htmlFor="tax-year-select" className="sr-only">
              세금 연도 선택
            </label>
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
            <ChevronDown
              className="pointer-events-none absolute right-2 sm:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]"
              aria-hidden="true"
            />
          </div>
          <Button
            className="bg-black text-white hover:bg-black/90"
            aria-label="세금 재계산 실행"
            onClick={handleRecalculate}
            disabled={calculateTax.isPending}
          >
            {calculateTax.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
            ) : (
              <Calculator className="h-4 w-4 sm:mr-2" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">세금 재계산</span>
          </Button>
        </div>
      </header>

      {/* Tax Status Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/5 px-4 py-3">
        <CheckCircle className="h-5 w-5 text-[#22C55E]" />
        <div className="flex-1">
          <span className="font-medium text-black">{selectedYear}년 세금 계산 완료</span>
          <span className="ml-2 text-sm text-[#666666]">
            마지막 업데이트: {new Date().toLocaleDateString('ko-KR')}
          </span>
        </div>
        <Badge variant="outline" className="border-[#22C55E] text-[#22C55E]">
          {jurisdictionDisplay} ({taxRateDisplay})
        </Badge>
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="세금 요약">
        <DataCard>
          <DataValue
            value={formatAmount(taxSummary?.total_proceeds, taxSummary?.currency)}
            label="총 실현 이익"
            trend="up"
          />
        </DataCard>
        <DataCard>
          <DataValue
            value={formatAmount(taxSummary?.realized_loss, taxSummary?.currency)}
            label="총 실현 손실"
            trend="down"
          />
        </DataCard>
        <DataCard>
          <DataValue
            value={formatAmount(taxSummary?.taxable_income, taxSummary?.currency)}
            label="과세 대상 금액"
          />
        </DataCard>
        <DataCard className="bg-black text-white col-span-2 md:col-span-1" hover={false}>
          <div className="text-[11px] uppercase tracking-[0.5px] text-white/60">예상 세금</div>
          <div
            className="mt-1 text-xl sm:text-2xl font-medium tabular-nums"
            aria-label={`예상 세금 ${formatAmount(taxSummary?.tax_amount, taxSummary?.currency)}`}
          >
            {formatAmount(taxSummary?.tax_amount, taxSummary?.currency)}
          </div>
          <div className="mt-1 text-sm text-white/60">실효세율 {taxRateDisplay}</div>
        </DataCard>
      </section>

      {/* Tab Navigation */}
      <div
        className="flex gap-1 border-b border-[#EEEEEE] overflow-x-auto"
        role="tablist"
        aria-label="세금 정보 탭"
      >
        {[
          { id: 'summary', label: '요약', icon: Calendar },
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
          <SectionHeader title="Tax Summary" marker="◆" meta={`${selectedYear}년`} />

          <div className="p-4 sm:p-6 space-y-4">
            {taxSummary ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-[#666666]">총 매도 수익</div>
                    <div className="font-mono font-medium">
                      {formatAmount(taxSummary.total_proceeds, taxSummary.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-[#666666]">총 취득 원가</div>
                    <div className="font-mono font-medium">
                      {formatAmount(taxSummary.total_cost_basis, taxSummary.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-[#666666]">실현 이익</div>
                    <div className="font-mono font-medium text-[#22C55E]">
                      {formatAmount(taxSummary.realized_gain, taxSummary.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-[#666666]">실현 손실</div>
                    <div className="font-mono font-medium text-[#EF4444]">
                      {formatAmount(taxSummary.realized_loss, taxSummary.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-[#666666]">순이익</div>
                    <div className="font-mono font-medium">
                      {formatAmount(taxSummary.net_gain, taxSummary.currency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-[#666666]">과세 소득</div>
                    <div className="font-mono font-medium">
                      {formatAmount(taxSummary.taxable_income, taxSummary.currency)}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#EEEEEE] pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">예상 납부 세액</div>
                    <div className="text-xl font-mono font-bold">
                      {formatAmount(taxSummary.tax_amount, taxSummary.currency)}
                    </div>
                  </div>
                  <div className="text-sm text-[#666666] mt-1">
                    세율: {(taxSummary.tax_rate * 100).toFixed(0)}% (지방세 포함)
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-[#666666]">
                세금 계산 데이터가 없습니다. &quot;세금 재계산&quot; 버튼을 클릭하세요.
              </div>
            )}
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
          <SectionHeader title="Tax Lots" marker="●" meta={`${taxLots.length}개 로트`} />

          {isLoadingLots ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#666666]" />
            </div>
          ) : taxLots.length === 0 ? (
            <div className="py-12 text-center text-[#666666]">Tax Lot 데이터가 없습니다</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="divide-y divide-[#EEEEEE] md:hidden">
                {taxLots.map((lot: TaxLot) => (
                  <div key={lot.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lot.asset_id.symbol}</span>
                        <Badge
                          variant="outline"
                          className={
                            lot.is_consumed
                              ? 'border-[#666666] text-[#666666]'
                              : 'border-[#3B82F6] text-[#3B82F6]'
                          }
                        >
                          {lot.is_consumed ? '처분 완료' : '보유 중'}
                        </Badge>
                      </div>
                      <span className="font-mono text-sm">{formatAmount(lot.quantity)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#666666]">취득: {formatDate(lot.acquired_at)}</span>
                      <span className="font-mono">{formatAmount(lot.cost_basis, 'KRW')}</span>
                    </div>
                    <div className="text-xs text-[#999999]">
                      보유기간: {getHoldingPeriod(lot.acquired_at, lot.consumed_at || undefined)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-6 gap-4 border-b border-[#EEEEEE] bg-[#FAFAFA] px-6 py-3 text-[11px] font-medium uppercase tracking-wide text-[#666666] min-w-[700px]">
                  <div>자산</div>
                  <div>취득일</div>
                  <div className="text-right">수량</div>
                  <div className="text-right">취득가</div>
                  <div className="text-right">보유기간</div>
                  <div>상태</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-[#EEEEEE]">
                  {taxLots.map((lot: TaxLot) => (
                    <div
                      key={lot.id}
                      className="grid grid-cols-6 gap-4 px-6 py-4 transition-colors hover:bg-[#FAFAFA] min-w-[700px]"
                    >
                      <div className="font-medium">{lot.asset_id.symbol}</div>
                      <div className="text-sm text-[#666666]">{formatDate(lot.acquired_at)}</div>
                      <div className="text-right font-mono">{formatAmount(lot.quantity)}</div>
                      <div className="text-right font-mono text-sm">
                        {formatAmount(lot.cost_basis, 'KRW')}
                      </div>
                      <div className="text-right text-sm text-[#666666]">
                        {getHoldingPeriod(lot.acquired_at, lot.consumed_at || undefined)}
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className={
                            lot.is_consumed
                              ? 'border-[#666666] text-[#666666]'
                              : 'border-[#3B82F6] text-[#3B82F6]'
                          }
                        >
                          {lot.is_consumed ? '처분 완료' : '보유 중'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div
          role="tabpanel"
          id="tabpanel-reports"
          aria-labelledby="tab-reports"
          className="overflow-hidden rounded-lg border border-[#EEEEEE]"
        >
          <SectionHeader title="Available Reports" marker="★" meta="다운로드 가능" />

          {isLoadingReports ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#666666]" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="py-12 text-center text-[#666666]">
              생성된 리포트가 없습니다. 아래 버튼을 클릭하여 새 리포트를 생성하세요.
            </div>
          ) : (
            <div className="divide-y divide-[#EEEEEE]">
              {reports.map((report: TaxReport) => (
                <div
                  key={report.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 transition-colors hover:bg-[#FAFAFA]"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#666666] flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm sm:text-base truncate">
                        {report.tax_year}년 {report.report_type === 'SUMMARY' ? '세금 요약' : report.report_type === 'TRANSACTIONS' ? '거래 내역' : 'Tax Lot 상세'} 보고서
                      </div>
                      <div className="text-xs sm:text-sm text-[#666666]">
                        {report.format} · {formatFileSize(report.file_size || 0)} · {formatDateTime(report.generated_at)}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#EEEEEE] self-end sm:self-auto"
                    aria-label={`${report.report_type} 리포트 다운로드`}
                    onClick={() => handleDownload(report)}
                  >
                    <Download className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                    <span className="hidden sm:inline">다운로드</span>
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[#EEEEEE] bg-[#FAFAFA] px-4 sm:px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-black text-white hover:bg-black/90"
                aria-label="PDF 세금 리포트 생성"
                onClick={() => handleGenerateReport('PDF')}
                disabled={generateReport.isPending}
              >
                {generateReport.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                PDF 리포트
              </Button>
              <Button
                variant="outline"
                className="border-[#EEEEEE]"
                aria-label="CSV 거래 내역 생성"
                onClick={() => handleGenerateReport('CSV')}
                disabled={generateReport.isPending}
              >
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                CSV 내역
              </Button>
              <Button
                variant="outline"
                className="border-[#EEEEEE]"
                aria-label="JSON Tax Lot 생성"
                onClick={() => handleGenerateReport('JSON')}
                disabled={generateReport.isPending}
              >
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                JSON Lots
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] px-3 sm:px-4 py-3">
        <Info className="mt-0.5 h-5 w-5 text-[#666666] flex-shrink-0" />
        <div className="text-xs sm:text-sm text-[#666666]">
          <strong className="text-black">참고:</strong> 이 계산은 참고용이며, 실제 세금 신고
          시에는 세무사와 상담하시기 바랍니다. 한국 가상자산 과세는 2027년부터 시행되며, 연간
          250만원 공제 후 22% (지방세 포함) 세율이 적용됩니다.
        </div>
      </div>
    </div>
  );
}
