'use client';

import {
  RefreshCw,
  Trash2,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConnectionStatus } from './ConnectionStatus';
import { SyncProgressCompact } from './SyncProgress';
import { getExchangeInfo } from '@/lib/exchanges';
import { capabilityMessage } from '@/lib/exchangeCapabilities';
import type { Connection, ExchangeType, ExchangeCapability } from '@/types';

interface ExchangeCardProps {
  connection?: Connection;
  capability?: ExchangeCapability;
  exchange: ExchangeType;
  onConnect?: () => void;
  onSync?: () => void;
  onDelete?: () => void;
  onReplace?: () => void;
  isDeleting?: boolean;
  isSyncing?: boolean;
}

export function ExchangeCard({
  connection,
  capability,
  exchange,
  onConnect,
  onSync,
  onDelete,
  onReplace,
  isDeleting = false,
  isSyncing = false,
}: ExchangeCardProps) {
  const exchangeInfo = getExchangeInfo(exchange);
  const available = capability?.availability === 'available';
  const features = capability ? { trades: capability.trades, deposits: capability.deposits, withdrawals: capability.withdrawals } : {};
  const isConnected = !!connection && connection.status !== 'disconnected';

  const formatLastSynced = (dateStr: string | undefined) => {
    if (!dateStr) return '동기화된 적 없음';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  return (
    <Card className="overflow-hidden" data-connection-id={connection?.id}>
      <CardHeader className="grid-cols-1 border-b pb-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-muted-foreground">
                {exchangeInfo.name[0]}
              </div>
            </div>
            <div className="min-w-0">
              <CardTitle className="break-all text-lg">{exchangeInfo.name}{connection?.label ? ` · ${connection.label}` : ''}</CardTitle>
              <CardDescription className="text-xs">
                {connection ? <span className="break-all">계정 번호 {connection.id}</span> : exchangeInfo.description}
              </CardDescription>
            </div>
          </div>
          {connection && <ConnectionStatus status={connection.status} className="shrink-0 whitespace-nowrap" />}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <p className="mb-3 text-sm text-muted-foreground" role="status">{capabilityMessage(capability)}</p>
        {isConnected ? (
          <div className="space-y-3">
            {/* Last synced info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>마지막 동기화: {formatLastSynced(connection.last_sync_at)}</span>
            </div>

            {/* Sync progress if syncing */}
            <SyncProgressCompact connectionId={connection.id} />

            {/* Features */}
            <div className="flex flex-wrap gap-1">
              {Object.entries(features).map(
                ([feature, enabled]) =>
                  enabled && (
                    <span
                      key={feature}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {feature === 'trades'
                        ? '거래 이력'
                        : feature === 'deposits'
                          ? '입금 이력'
                          : feature === 'withdrawals'
                            ? '출금 이력'
                            : '잔액'}
                    </span>
                  )
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {connection ? '연결이 해제되었습니다. 기존 거래 내역은 보관됩니다.' : available ? `${exchangeInfo.name}의 API Key를 등록하여 거래 내역을 동기화하세요.` : '현재 자동 연결을 사용할 수 없습니다.'}
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(features).map(
                ([feature, enabled]) =>
                  enabled && (
                    <span
                      key={feature}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {feature === 'trades'
                        ? '거래 이력'
                        : feature === 'deposits'
                          ? '입금 이력'
                          : feature === 'withdrawals'
                            ? '출금 이력'
                            : '잔액'}
                    </span>
                  )
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-4">
        <a
          href={exchangeInfo.apiDocsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          API 가이드
        </a>

        <div className="flex flex-wrap justify-end gap-2">
          {isConnected ? (
            <>
              {connection.credential_revision && onReplace && <Button variant="outline" size="sm" onClick={onReplace} disabled={!available || isSyncing || connection.status === 'syncing'}>키 교체</Button>}
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={!available || isSyncing || connection.status === 'syncing'}
              >
                <RefreshCw
                  className={`mr-1 h-4 w-4 ${isSyncing || connection.status === 'syncing' ? 'animate-spin' : ''}`}
                />
                동기화
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {isDeleting ? '삭제 중...' : '해제'}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConnect} disabled={!available}>
              {connection ? '다시 연결' : '연결하기'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
