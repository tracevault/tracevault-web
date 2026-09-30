import { apiClient } from './client';
import type { SyncProgress, SyncStatusResponse } from '@/types';

export interface SyncWatcherOptions {
  onProgress: (progress: SyncProgress) => void;
  onCompleted?: (progress: SyncProgress) => void;
  onError?: (message: string) => void;
  maxFailures?: number;
  intervalMs?: number;
  maxDurationMs?: number;
}

/** Authenticated, bounded polling. Cancelling the view never cancels the durable job. */
export function watchSync(connectionId: string, options: SyncWatcherOptions): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  const started = Date.now();
  const stop = () => { controller.abort(); if (timer) clearTimeout(timer); };
  const fail = (message: string) => { stop(); options.onError?.(message); };
  const poll = async () => {
    if (controller.signal.aborted) return;
    if (Date.now() - started >= (options.maxDurationMs ?? 35 * 60_000)) {
      fail('상태 조회 시간이 초과되었습니다. 연결 목록에서 다시 확인해주세요.'); return;
    }
    try {
      const response = await apiClient<SyncStatusResponse>(`/api/v1/connections/${encodeURIComponent(connectionId)}/status`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      if (controller.signal.aborted) return;
      if (!['idle', 'syncing', 'completed', 'failed'].includes(response.status) || !Number.isInteger(response.events_synced) || response.events_synced < 0) {
        throw new Error('잘못된 동기화 상태 응답입니다');
      }
      failures = 0;
      const progress = { ...response, connection_id: connectionId };
      options.onProgress(progress);
      if (response.status === 'completed') { stop(); options.onCompleted?.(progress); return; }
      if (response.status === 'failed') { fail(response.error_message || '동기화에 실패했습니다'); return; }
    } catch (error) {
      if (controller.signal.aborted) return;
      failures++;
      if (failures >= (options.maxFailures ?? 3)) { fail(error instanceof Error ? error.message : '상태 조회에 실패했습니다'); return; }
    }
    timer = setTimeout(poll, (options.intervalMs ?? 2000) * Math.max(1, failures));
  };
  void poll();
  return stop;
}
