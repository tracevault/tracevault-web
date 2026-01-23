'use client';

import { useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useSyncProgress } from '@/hooks';
import type { SyncStatus } from '@/types';

interface SyncProgressProps {
  connectionId: string;
  onCompleted?: () => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

const statusMessages: Record<SyncStatus, string> = {
  idle: '대기 중',
  starting: '동기화 시작 중...',
  fetching_trades: '거래 내역 가져오는 중...',
  fetching_deposits: '입금 내역 가져오는 중...',
  fetching_withdrawals: '출금 내역 가져오는 중...',
  processing: '데이터 처리 중...',
  completed: '동기화 완료',
  failed: '동기화 실패',
};

export function SyncProgress({
  connectionId,
  onCompleted,
  onError,
  autoConnect = true,
}: SyncProgressProps) {
  const { progress, isConnected, error, connect, disconnect } = useSyncProgress(
    connectionId,
    {
      onCompleted: (prog) => {
        onCompleted?.();
      },
      onError: (err) => {
        onError?.(err);
      },
    }
  );

  useEffect(() => {
    if (autoConnect && connectionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connectionId, connect, disconnect]);

  if (!progress && !isConnected) {
    if (error) {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4" />
        <span>동기화 대기 중...</span>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>연결 중...</span>
      </div>
    );
  }

  const statusMessage = statusMessages[progress.status] || progress.message;
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : isFailed ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <span
            className={
              isCompleted
                ? 'text-green-600'
                : isFailed
                  ? 'text-destructive'
                  : ''
            }
          >
            {statusMessage}
          </span>
        </div>
        <span className="text-muted-foreground">
          {progress.progress_percent.toFixed(0)}%
        </span>
      </div>

      <Progress
        value={progress.progress_percent}
        className={isFailed ? 'bg-destructive/20' : undefined}
      />

      {progress.items_total > 0 && (
        <div className="text-xs text-muted-foreground">
          {progress.items_processed} / {progress.items_total} 항목 처리됨
        </div>
      )}

      {progress.error && (
        <div className="text-xs text-destructive">{progress.error}</div>
      )}
    </div>
  );
}

// Compact version for use in cards/lists
export function SyncProgressCompact({
  connectionId,
}: {
  connectionId: string;
}) {
  const { progress, isConnected } = useSyncProgress(connectionId, {
    autoReconnect: false,
  });

  if (!isConnected || !progress) {
    return null;
  }

  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  return (
    <div className="flex items-center gap-2">
      {isCompleted ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : isFailed ? (
        <XCircle className="h-4 w-4 text-destructive" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <Progress value={progress.progress_percent} className="h-1 w-16" />
      <span className="text-xs text-muted-foreground">
        {progress.progress_percent.toFixed(0)}%
      </span>
    </div>
  );
}
