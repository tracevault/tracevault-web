'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { SyncStatusResponse } from '@/types';
import type { components } from '@/types/generated/http';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useSyncProgress } from '@/hooks/useSyncProgress';

interface SyncProgressProps {
  connectionId: string;
  onCompleted?: () => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export function SyncProgress({ connectionId, onCompleted, onError, autoConnect = true }: SyncProgressProps) {
  const { progress, error, connect, disconnect } = useSyncProgress(connectionId, { onCompleted, onError });
  useEffect(() => {
    if (autoConnect) connect();
    return disconnect;
  }, [autoConnect, connect, disconnect]);
  const failed = !!error || progress?.status === 'failed';
  const complete = progress?.status === 'completed';
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        {failed ? <XCircle className="h-4 w-4 text-destructive" /> : complete ?
          <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        <span>{error || (complete ? '수집 완료' : progress?.status === 'idle' ? '동기화 대기 중' : '동기화 진행 중…')}</span>
      </div>
      {progress && progress.events_pending > 0 && <p className="text-xs text-muted-foreground">원장으로 전송 대기: {progress.events_pending}건</p>}
      {progress && progress.events_failed > 0 && <p className="text-xs text-destructive">전송 전 검증 실패: {progress.events_failed}건 — 수집 기록 검토가 필요합니다.</p>}
      {progress && <p className="text-xs text-muted-foreground">저장된 거래·입출금 내역: {progress.events_synced}건</p>}
    </div>
  );
}

export function SyncProgressCompact({ connectionId }: { connectionId: string }) {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ['connections', connectionId, 'status'],
    queryFn: () => apiClient<SyncStatusResponse>(`/api/v1/connections/${encodeURIComponent(connectionId)}/status`),
    staleTime: 5000,
    refetchInterval: query => query.state.data?.status === 'syncing' || (query.state.data?.events_pending ?? 0) > 0 ? 2000 : false,
  });
  const ingestion = useQuery({
    queryKey: ['ledger', 'ingestion', connectionId],
    queryFn: () => apiClient<components['schemas']['IngestionStatus']>(`/api/v1/ledger/ingestion?connection_id=${encodeURIComponent(connectionId)}`),
    staleTime: 5000,
    // Delivery can lag Collector's acknowledgment. Keep checking while the card is visible.
    refetchInterval: query => (query.state.data?.pending ?? 0) > 0 ? 2000 : 15000,
  });
  const retry = useMutation({
    mutationFn: () => apiClient<components['schemas']['RetryIngestionResult']>('/api/v1/ledger/ingestion/retry', {
      method: 'POST', body: JSON.stringify({ connection_id: connectionId }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger', 'ingestion', connectionId] }),
  });
  useEffect(() => {
    if (data?.status) void queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === 'connections' && (query.queryKey.length === 1 || query.queryKey[1] === 'retained') });
  }, [data?.status, queryClient]);
  if (error) return <p className="text-xs text-destructive">동기화 상태를 확인할 수 없습니다.</p>;
  if (!data) return null;
  return <div className="space-y-1 text-xs" role="status" aria-live="polite">
    {data.status === 'syncing' && <p className="text-muted-foreground">거래 내역을 수집하는 중입니다…</p>}
    {data.status === 'failed' && <p className="text-destructive">{data.error_message || '수집에 실패했습니다.'}</p>}
    {data.events_pending > 0 && <p className="text-muted-foreground">원장으로 전송 대기: {data.events_pending}건</p>}
    {data.events_failed > 0 && <p className="text-destructive">전송 전 검증 실패: {data.events_failed}건 — 수집 기록 검토가 필요합니다.</p>}
    {ingestion.error && <p className="text-destructive">원장 반영 상태를 확인할 수 없습니다.</p>}
    {ingestion.data && <p className="text-muted-foreground">원장 반영: {ingestion.data.complete}건 · 처리 대기: {ingestion.data.pending}건</p>}
    {(ingestion.data?.failed ?? 0) > 0 && <div className="space-y-1">
      <p className="text-destructive">원장 처리 실패: {ingestion.data!.failed}건. 처리 완료 전에는 잔액과 보고서를 확정할 수 없습니다.</p>
      <button type="button" disabled={retry.isPending} onClick={() => retry.mutate()} className="underline disabled:opacity-50">
        {retry.isPending ? '재시도 요청 중…' : '실패한 내역 다시 처리'}
      </button>
    </div>}
    {retry.error && <p className="text-destructive">재시도를 요청하지 못했습니다. 잠시 후 다시 시도하세요.</p>}
  </div>;
}
