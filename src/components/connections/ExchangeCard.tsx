'use client';

import Image from 'next/image';
import {
  RefreshCw,
  Trash2,
  ExternalLink,
  Clock,
  AlertCircle,
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
import type { Connection, ExchangeType } from '@/types';

interface ExchangeCardProps {
  connection?: Connection;
  exchange: ExchangeType;
  onConnect?: () => void;
  onSync?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  isSyncing?: boolean;
}

export function ExchangeCard({
  connection,
  exchange,
  onConnect,
  onSync,
  onDelete,
  isDeleting = false,
  isSyncing = false,
}: ExchangeCardProps) {
  const exchangeInfo = getExchangeInfo(exchange);
  const isConnected = !!connection && connection.status !== 'disconnected';

  const formatLastSynced = (dateStr: string | null) => {
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
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-muted">
              <Image
                src={exchangeInfo.logoUrl}
                alt={exchangeInfo.name}
                fill
                className="object-contain p-1"
                onError={(e) => {
                  // Fallback to text if image fails
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-muted-foreground">
                {exchangeInfo.name[0]}
              </div>
            </div>
            <div>
              <CardTitle className="text-lg">{exchangeInfo.name}</CardTitle>
              <CardDescription className="text-xs">
                {exchangeInfo.description}
              </CardDescription>
            </div>
          </div>
          {connection && <ConnectionStatus status={connection.status} />}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isConnected ? (
          <div className="space-y-3">
            {/* Last synced info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>마지막 동기화: {formatLastSynced(connection.last_synced_at)}</span>
            </div>

            {/* Error message if any */}
            {connection.error_message && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{connection.error_message}</span>
              </div>
            )}

            {/* Sync progress if syncing */}
            {connection.status === 'syncing' && (
              <SyncProgressCompact connectionId={connection.id} />
            )}

            {/* Features */}
            <div className="flex flex-wrap gap-1">
              {Object.entries(exchangeInfo.features).map(
                ([feature, enabled]) =>
                  enabled && (
                    <span
                      key={feature}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {feature === 'trades'
                        ? '거래'
                        : feature === 'deposits'
                          ? '입금'
                          : feature === 'withdrawals'
                            ? '출금'
                            : '잔액'}
                    </span>
                  )
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {exchangeInfo.name}의 API Key를 등록하여 거래 내역을 자동으로
              동기화하세요.
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(exchangeInfo.features).map(
                ([feature, enabled]) =>
                  enabled && (
                    <span
                      key={feature}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {feature === 'trades'
                        ? '거래'
                        : feature === 'deposits'
                          ? '입금'
                          : feature === 'withdrawals'
                            ? '출금'
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

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing || connection.status === 'syncing'}
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
            <Button size="sm" onClick={onConnect}>
              연결하기
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
