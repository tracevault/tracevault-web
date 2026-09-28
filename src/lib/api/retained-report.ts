import { apiClient } from './client';
import { reportPath } from '@/lib/report-link';
import type { AccountingReport, AccountingReportList, AccountingRunResult } from '@/types/tax';

export async function findRetainedReport(reportId: string, runId: string, signal: AbortSignal) {
  if (!reportPath(reportId, runId)) throw new Error('올바르지 않은 보고서 링크입니다.');
  const result = await apiClient<AccountingRunResult>(`/api/v1/tax/accounting-runs/${runId}?check_current=false`, { signal });
  if (result.run.id !== runId) throw new Error('계산 결과가 링크와 일치하지 않습니다.');
  let cursor = ''; const seen = new Set<string>();
  while (true) {
    signal.throwIfAborted();
    const query = new URLSearchParams({ run_id: runId, limit: '100' });
    if (cursor) query.set('before_report_id', cursor);
    const page = await apiClient<AccountingReportList>(`/api/v1/tax/accounting-reports?${query}`, { signal });
    const report: AccountingReport | undefined = page.reports.find(r => r.id === reportId);
    if (report) {
      if (report.run_id !== runId || report.purpose !== 'ACCOUNTING_ONLY') throw new Error('보고서가 링크의 계산 결과와 일치하지 않습니다.');
      return { report, run: result.run };
    }
    if (!page.has_more) throw new Error('이 계정의 계산 결과에서 해당 보고서를 찾을 수 없습니다.');
    if (!page.next_before_report_id || seen.has(page.next_before_report_id)) throw new Error('보고서 목록을 계속 불러올 수 없습니다. 다시 시도해 주세요.');
    cursor = page.next_before_report_id; seen.add(cursor);
  }
}
