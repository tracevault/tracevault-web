'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Link2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExchangeCard } from './ExchangeCard';
import { ConnectExchangeModal } from './ConnectExchangeModal';
import {
  useConnections,
  useDeleteConnection,
  useStartSync,
  useRefreshConnections,
} from '@/hooks';
import { getAllExchanges } from '@/lib/exchanges';
import type { ExchangeType, Connection } from '@/types';

export function ConnectionsPage() {
  const [selectedExchange, setSelectedExchange] = useState<ExchangeType | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(
    null
  );

  const { data: connections, isLoading, error, refetch } = useConnections();
  const deleteConnection = useDeleteConnection();
  const refreshConnections = useRefreshConnections();

  const exchanges = getAllExchanges();

  // Map connections by exchange type
  const connectionsByExchange = new Map<ExchangeType, Connection>();
  connections?.forEach((conn) => {
    connectionsByExchange.set(conn.exchange, conn);
  });

  const handleConnect = (exchange: ExchangeType) => {
    setSelectedExchange(exchange);
    setModalOpen(true);
  };

  const handleSync = async (connectionId: string) => {
    setSyncingConnectionId(connectionId);
    try {
      // Note: useStartSync needs to be called at component level,
      // so we use direct API call here for simplicity
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/connections/${connectionId}/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error('동기화 시작 실패');
      }

      toast.success('동기화 시작', {
        description: '데이터 동기화를 시작합니다.',
      });

      // Refresh connections to update status
      refreshConnections();
    } catch (err) {
      toast.error('동기화 실패', {
        description: err instanceof Error ? err.message : '오류가 발생했습니다',
      });
    } finally {
      setSyncingConnectionId(null);
    }
  };

  const handleDelete = async (connectionId: string, exchangeName: string) => {
    if (
      !confirm(`${exchangeName} 연결을 해제하시겠습니까? 동기화된 데이터는 유지됩니다.`)
    ) {
      return;
    }

    try {
      await deleteConnection.mutateAsync(connectionId);
      toast.success('연결 해제됨', {
        description: `${exchangeName} 연결이 해제되었습니다.`,
      });
    } catch (err) {
      toast.error('연결 해제 실패', {
        description: err instanceof Error ? err.message : '오류가 발생했습니다',
      });
    }
  };

  const handleModalSuccess = () => {
    refetch();
    setModalOpen(false);
    setSelectedExchange(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>오류</AlertTitle>
        <AlertDescription>
          연결 정보를 불러오는 중 오류가 발생했습니다.
          <Button
            variant="link"
            className="ml-2 h-auto p-0"
            onClick={() => refetch()}
          >
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const connectedCount = connections?.filter(
    (c) => c.status !== 'disconnected'
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">거래소 연결</h1>
          <p className="text-muted-foreground">
            거래소 API를 연결하여 거래 내역을 자동으로 동기화하세요.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
        <Link2 className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-2xl font-bold">{connectedCount}</p>
          <p className="text-sm text-muted-foreground">
            연결된 거래소 / {exchanges.length} 지원
          </p>
        </div>
      </div>

      {/* Exchange Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exchanges.map((exchange) => {
          const connection = connectionsByExchange.get(exchange.id);
          return (
            <ExchangeCard
              key={exchange.id}
              exchange={exchange.id}
              connection={connection}
              onConnect={() => handleConnect(exchange.id)}
              onSync={() => connection && handleSync(connection.id)}
              onDelete={() =>
                connection && handleDelete(connection.id, exchange.name)
              }
              isDeleting={deleteConnection.isPending}
              isSyncing={syncingConnectionId === connection?.id}
            />
          );
        })}
      </div>

      {/* Help text */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="font-medium">API Key 발급 안내</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          각 거래소의 API 관리 페이지에서 API Key를 발급받으세요.
          읽기 전용 권한만 필요하며, 출금 권한은 절대 부여하지 마세요.
        </p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          <li>Upbit: 업비트 앱 또는 웹사이트 → 마이페이지 → Open API 관리</li>
          <li>Bithumb: 빗썸 웹사이트 → 마이페이지 → API 관리</li>
          <li>Binance: 바이낸스 → 계정 → API 관리</li>
        </ul>
      </div>

      {/* Connect Modal */}
      <ConnectExchangeModal
        exchange={selectedExchange}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
