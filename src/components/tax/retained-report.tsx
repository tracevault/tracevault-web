'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/stores';
import { ApiRequestError } from '@/types';
import { Button } from '@/components/ui/button';
import { findRetainedReport } from '@/lib/api/retained-report';
import { reportPath } from '@/lib/report-link';
import { downloadAccountingReport } from '@/hooks/useAccountingReports';

export function RetainedReport({ reportId, runId }: { reportId: string; runId: string }) {
  const owner = useAuthStore(s => s.user?.id);
  return owner ? <OwnedReport key={`${owner}:${reportId}:${runId}`} owner={owner} reportId={reportId} runId={runId} /> : <p role="status">계정을 확인하는 중…</p>;
}
function OwnedReport({ owner, reportId, runId }: { owner: string; reportId: string; runId: string }) {
  const valid = !!reportPath(reportId, runId);
  const result = useQuery({ queryKey: ['accounting-report-link', owner, reportId, runId], queryFn: ({ signal }) => findRetainedReport(reportId, runId, signal), enabled: valid, retry: false });
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => () => { active.current?.abort(); }, []);
  async function download() {
    if (!result.data || useAuthStore.getState().user?.id !== owner) return;
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setBusy(true); setError(''); setSaved(false);
    try {
      const report = result.data.report;
      const blob = await downloadAccountingReport(report, controller.signal);
      controller.signal.throwIfAborted();
      if (useAuthStore.getState().user?.id !== owner) return;
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = report.filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved(true);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '파일을 내려받지 못했습니다.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const failure = result.error instanceof ApiRequestError && result.error.code === 'NOT_FOUND' ? '이 계정에서 해당 보고서를 찾을 수 없습니다.' : result.error?.message;
  return <section className="mx-auto max-w-3xl space-y-5">
    <h1 className="text-2xl font-semibold">저장된 거래 손익 보고서</h1>
    <p className="text-sm text-muted-foreground">알림에 연결된 과거 파일을 확인합니다. 새 계산이나 파일 생성을 실행하지 않습니다. 확정 세액 계산서나 신고서가 아닙니다.</p>
    {!valid && <p role="alert">올바르지 않은 보고서 링크입니다.</p>}
    {result.isLoading && <p role="status">보고서를 찾는 중…</p>}
    {failure && <p role="alert">{failure}</p>}
    {result.data && <div className="rounded-xl border p-5 space-y-3">
      <h2 className="font-semibold">{result.data.run.profile.tax_year}년 · {result.data.report.format}</h2>
      <p className="break-all text-sm">{result.data.report.filename}</p>
      <p className="text-sm">저장 시각: {new Date(result.data.report.created_at).toLocaleString('ko-KR')}</p>
      <p className="text-sm text-muted-foreground">저장 이후 변경된 거래나 설정은 이 파일에 반영되지 않습니다.</p>
      <Button disabled={busy} onClick={download}>{busy ? '파일 확인 중…' : `${result.data.report.format} 다운로드`}</Button>
      {saved && <p role="status">파일을 검증하여 브라우저에 전달했습니다.</p>}
      {error && <p role="alert">{error}</p>}
    </div>}
    <Link href="/tax" className="underline text-sm">연도별 계산과 보고서 목록으로 이동</Link>
  </section>;
}
