'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Link2, AlertCircle, Plus, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExchangeCard } from './ExchangeCard';
import { ConnectExchangeModal } from './ConnectExchangeModal';
import { ReplaceCredentialsModal } from './ReplaceCredentialsModal';
import { ConnectWalletModal } from './ConnectWalletModal';
import { WalletCard } from './WalletCard';
import {
  useConnectionList,
  useExchangeCapabilities,
  useDeleteConnection,
  useRefreshConnections,
  useRemoveWallet,
  useWalletCapabilities,
} from '@/hooks';
import { apiClient } from '@/lib/api';
import { getAllExchanges } from '@/lib/exchanges';
import type { ExchangeType, Connection } from '@/types';

export function ConnectionsPage() {
  const [selectedExchange, setSelectedExchange] = useState<ExchangeType | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [reconnectTarget, setReconnectTarget] = useState<Connection | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<Connection | null>(null);
  const [syncingConnectionIds, setSyncingConnectionIds] = useState<Set<string>>(new Set());
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const { data: connectionList, isLoading, error, refetch } = useConnectionList(true);
  const capabilityQuery = useExchangeCapabilities();
  const walletCapabilityQuery = useWalletCapabilities();
  const capabilities = capabilityQuery.isError ? undefined : capabilityQuery.data?.exchanges;
  const capabilityFor = (exchange: ExchangeType) => capabilities?.find(row => row.exchange === exchange);
  const canOpenSelected = !!selectedExchange && capabilityFor(selectedExchange)?.availability === 'available';
  useEffect(() => {
    // External capability revocation must erase the credential form and keep it closed.
    if (modalOpen && !canOpenSelected) setModalOpen(false);
  }, [modalOpen, canOpenSelected]);
  const connections = connectionList?.connections;
  const replacementCurrent = connections?.find(row => row.id === replacementTarget?.id);
  const canReplaceSelected = !!replacementTarget && !!replacementTarget.credential_revision && replacementCurrent?.credential_revision === replacementTarget.credential_revision && replacementCurrent.status !== 'disconnected' && replacementCurrent.status !== 'syncing' && capabilityFor(replacementTarget.exchange)?.availability === 'available';
  useEffect(() => { if (replacementTarget && !canReplaceSelected) setReplacementTarget(null); }, [replacementTarget, canReplaceSelected]);
  const deleteConnection = useDeleteConnection();
  const removeWallet = useRemoveWallet();
  const refreshConnections = useRefreshConnections();

  const exchanges = getAllExchanges();

  const handleConnect = (exchange: ExchangeType, target: Connection | null = null) => {
    if (capabilityFor(exchange)?.availability !== 'available') return;
    setReconnectTarget(target);
    setSelectedExchange(exchange);
    setModalOpen(true);
  };

  const handleSync = async (connectionId: string) => {
    const connection = connections?.find(row => row.id === connectionId);
    if (!connection || capabilityFor(connection.exchange)?.availability !== 'available') return;
    setSyncingConnectionIds(current => new Set(current).add(connectionId));
    try {
      await apiClient(`/api/v1/connections/${connectionId}/sync`, { method: 'POST', body: JSON.stringify({}) });

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
      setSyncingConnectionIds(current => { const next = new Set(current); next.delete(connectionId); return next; });
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

  const connectedCount = connections?.filter(connection => connection.status !== 'disconnected').length || 0;
  const wallets = connectionList?.wallets ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">연결 관리</h1>
          <p className="text-muted-foreground">
            거래소 계정과 블록체인 지갑을 한 곳에서 관리하세요.
          </p>
        </div>
        <Button variant="outline" onClick={() => { refetch(); capabilityQuery.refetch(); }}>
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
            거래소 {connectedCount}개 · 지갑 {wallets.length}개 · {capabilities ? `자동 연결 가능 거래소 ${capabilities.filter(row => row.availability === 'available').length}곳` : '지원 정보 확인 중'}
          </p>
        </div>
      </div>

      {(capabilityQuery.isError || capabilityQuery.isPending) && (
        <Alert><AlertTitle>거래소 지원 정보</AlertTitle><AlertDescription>
          {capabilityQuery.isPending ? '현재 연결 가능한 기능을 확인하고 있습니다.' : '지원 정보를 확인할 수 없습니다. 기존 계정은 계속 확인하고 연결을 해제할 수 있습니다.'}
          <Button variant="link" disabled={capabilityQuery.isFetching} onClick={() => capabilityQuery.refetch()}>다시 확인</Button>
        </AlertDescription></Alert>
      )}

      {connectionList?.multiple_accounts_enabled && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">계정 확인을 지원하는 거래소에서 다른 계정을 추가할 수 있습니다.</p>
          <div className="flex flex-wrap gap-2">
            {exchanges.filter(exchange => capabilityFor(exchange.id)?.availability === 'available' && connections?.some(connection => connection.exchange === exchange.id)).map(exchange => (
              <Button key={exchange.id} variant="outline" onClick={() => handleConnect(exchange.id)}>{exchange.name} 계정 추가</Button>
            ))}
          </div>
        </div>
      )}

      {/* Exchange Cards */}
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">거래소</h2><p className="text-sm text-muted-foreground">읽기 전용 API Key로 거래 내역을 가져옵니다.</p></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exchanges.flatMap((exchange) => {
          const accounts = connections?.filter(connection => connection.exchange === exchange.id) ?? [];
          return (accounts.length ? accounts : [undefined]).map(connection => (
            <ExchangeCard
              key={connection?.id ?? exchange.id}
              exchange={exchange.id}
              capability={capabilityFor(exchange.id)}
              connection={connection}
              onConnect={() => handleConnect(exchange.id, connection ?? null)}
              onReplace={() => { if (connection && capabilityFor(exchange.id)?.availability === 'available' && connection.status !== 'syncing') setReplacementTarget(connection); }}
              onSync={() => connection && handleSync(connection.id)}
              onDelete={() => connection && handleDelete(connection.id, `${exchange.name} ${connection.label || connection.id}`)}
              isDeleting={deleteConnection.isPending && deleteConnection.variables === connection?.id}
              isSyncing={connection ? syncingConnectionIds.has(connection.id) : false}
            />
          ));
        })}
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <div><h2 className="flex items-center gap-2 text-xl font-semibold"><WalletCards className="h-5 w-5" />지갑</h2><p className="text-sm text-muted-foreground">서명 소유권과 읽기 전용 주소를 명확히 구분합니다.</p></div>
          <Button onClick={() => setWalletModalOpen(true)} disabled={walletCapabilityQuery.isError}><Plus />지갑 추가</Button>
        </div>
        {walletCapabilityQuery.isError && <Alert variant="destructive"><AlertTitle>지갑 지원 정보를 확인할 수 없습니다</AlertTitle><AlertDescription><Button variant="link" onClick={() => walletCapabilityQuery.refetch()}>다시 확인</Button></AlertDescription></Alert>}
        {wallets.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">연결된 지갑이 없습니다.</div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{wallets.map(wallet => <WalletCard key={wallet.id} wallet={wallet} removing={removeWallet.isPending && removeWallet.variables === wallet.id} onRemove={async () => {
          if (!confirm(`${wallet.label || wallet.address} 연결을 삭제하시겠습니까? 기존 Ledger 기록은 유지됩니다.`)) return;
          try { await removeWallet.mutateAsync(wallet.id); toast.success('지갑 연결이 삭제되었습니다.'); }
          catch (err) { toast.error('지갑 삭제 실패', { description: err instanceof Error ? err.message : '오류가 발생했습니다' }); }
        }} />)}</div>}
      </div>

      {/* Help text */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="font-medium">API Key 발급 안내</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          연결 가능한 거래소의 API 관리 페이지에서 API Key를 발급받으세요.
          읽기 전용 권한만 필요하며, 출금 권한은 절대 부여하지 마세요.
        </p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          <li>Upbit: 업비트 앱 또는 웹사이트 → 마이페이지 → Open API 관리</li>
          <li>Bithumb: 빗썸 웹사이트 → 마이페이지 → API 관리</li>
          <li>Binance: 바이낸스 → 계정 → API 관리</li>
          <li>Kraken: Kraken Pro → 설정 → API → API 키 만들기</li>
        </ul>
      </div>

      {/* Connect Modal */}
      {replacementTarget && canReplaceSelected && <ReplaceCredentialsModal connection={replacementTarget} onClose={() => setReplacementTarget(null)} />}
      {modalOpen && canOpenSelected && <ConnectExchangeModal
        reconnectTarget={reconnectTarget}
        exchange={selectedExchange}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleModalSuccess}
      />}
      <ConnectWalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} onSuccess={() => refetch()} />
    </div>
  );
}
