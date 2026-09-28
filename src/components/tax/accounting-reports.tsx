'use client';

import { useEffect, useRef, useState } from 'react';
import { ProofRequest } from '@/components/proof/proof-request';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/types';
import { downloadAccountingReport, useAccountingReports, useCreateAccountingReport } from '@/hooks/useAccountingReports';
import type { AccountingReport, AccountingReportFormat, AccountingRun } from '@/types/tax';

function date(value: string) { return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }); }
function errorText(error: unknown) {
  if (error instanceof ApiRequestError) {
    const messages: Record<string, string> = {
      FAILED_PRECONDITION: '현재 입력으로 보고서를 생성할 수 없습니다. 거래·설정·환율을 확인하고 새 계산 결과를 만들어 주세요.',
      CONFLICT: '처리 중 계산 설정이 변경되었습니다. 새 계산 결과를 선택해 다시 시도해 주세요.',
      SERVICE_UNAVAILABLE: '보고서 처리에 필요한 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      DEADLINE_EXCEEDED: '보고서 처리 시간이 초과되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      NOT_FOUND: '이 계정에서 해당 보고서나 계산 결과를 찾을 수 없습니다.',
    };
    if (messages[error.code]) return messages[error.code];
  }
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

export function AccountingReports({ run }: { run: AccountingRun }) {
  const [format, setFormat] = useState<AccountingReportFormat>('PDF');
  const [cursors, setCursors] = useState<string[]>([]);
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const [saved, setSaved] = useState('');
  const active = useRef<AbortController | null>(null);
  const reports = useAccountingReports(run.id, cursors.at(-1));
  const create = useCreateAccountingReport();
  useEffect(() => () => { active.current?.abort(); }, []);

  async function download(report: AccountingReport) {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setDownloading(report.id); setDownloadError(null); setSaved('');
    try {
      const blob = await downloadAccountingReport(report, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = report.filename;
      document.body.appendChild(link); link.click(); link.remove();
      // Let the browser consume the object URL before releasing its retained bytes.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved(`${report.format} 파일을 확인하여 브라우저에 전달했습니다.`);
    } catch (error) {
      if (!controller.signal.aborted) setDownloadError(error);
    } finally {
      if (!controller.signal.aborted) setDownloading('');
    }
  }

  return <section className="space-y-4 border-t border-border pt-5" aria-label="거래 손익 보고서">
    <ProofRequest kind="ACCOUNTING_RUN" reference={run.id} expectedDigest={run.content_digest} />
    <h3 className="font-semibold">거래 손익 보고서</h3>
    <p className="text-sm text-muted-foreground">선택한 계산 결과를 파일로 보존합니다. 생성 전에 거래·설정·환율을 다시 확인하며, 변경된 결과는 새 계산이 필요합니다. 저장된 파일은 과거 기록이며 세액 계산서나 신고서가 아닙니다.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-2 text-sm">보고서 형식<select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={format} onChange={e => setFormat(e.target.value as AccountingReportFormat)}><option value="PDF">PDF · 손익 요약 (영문)</option><option value="CSV">CSV · 전체 상세와 근거</option><option value="JSON">JSON · 전체 상세와 근거</option></select></label>
      <Button disabled={create.isPending} onClick={() => create.mutate({ run_id: run.id, expected_run_digest: run.content_digest, format }, { onSuccess: () => setCursors([]) })}>{create.isPending ? '입력을 확인하고 보고서 생성 중…' : '보고서 생성'}</Button>
      <Button variant="outline" disabled={reports.isFetching} onClick={() => reports.refetch()}>보고서 목록 새로고침</Button>
    </div>
    {create.isPending && <p role="status" className="text-sm">거래량과 환율 확인에 따라 수 분이 걸릴 수 있습니다.</p>}
    {create.error && <p role="alert" className="text-sm text-red-600 break-words">{errorText(create.error)}</p>}
    {create.data && !create.isPending && !create.error && <p role="status" className="text-sm">{create.data.format} 보고서가 보존되었습니다. 같은 입력·형식이면 기존 파일을 반환합니다.</p>}
    {reports.isLoading && <p role="status" className="text-sm">저장된 보고서를 불러오는 중…</p>}
    {reports.error && <p role="alert" className="text-sm text-red-600 break-words">{errorText(reports.error)}</p>}
    {reports.data && <>
      {reports.data.reports.length === 0 ? <p className="text-sm text-muted-foreground">이 계산 결과의 저장된 보고서가 없습니다.</p> : <ul className="space-y-3">{reports.data.reports.map(report => <li key={report.id} className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">{report.format} · {date(report.created_at)} 저장</p><Button variant="outline" disabled={!!downloading} onClick={() => download(report)}>{downloading === report.id ? '파일 확인 중…' : `${report.format} 다운로드`}</Button></div>
        <p className="text-xs text-muted-foreground">생성 전 입력 확인: {date(report.checked_at)} · 이후 변경은 반영되지 않습니다.</p>
        <p className="text-xs text-muted-foreground break-all">{report.filename} · {report.size_bytes} bytes</p>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">파일 검증 정보</summary><p className="mt-2 break-all">{report.sha256}</p><p className="mt-1">{report.report_version} · 회계 기록</p></details>
      </li>)}</ul>}
      <div className="flex gap-2"><Button variant="outline" disabled={!cursors.length || reports.isFetching} onClick={() => setCursors(c => c.slice(0, -1))}>더 최근 보고서</Button><Button variant="outline" disabled={!reports.data.has_more || reports.isFetching} onClick={() => { if (reports.data?.next_before_report_id) setCursors(c => [...c, reports.data.next_before_report_id!]); }}>더 오래된 보고서</Button></div>
    </>}
    {downloadError != null && <p role="alert" className="text-sm text-red-600 break-words">{errorText(downloadError)}</p>}
    {saved && <p role="status" className="text-sm">{saved}</p>}
    <p className="text-xs text-muted-foreground">CSV의 정확한 값과 전체 거래 정보는 함께 저장된 payload_json 열에도 보존됩니다. 스프레드시트에서 숫자로 자동 변환하면 정밀도가 달라질 수 있습니다.</p>
  </section>;
}
