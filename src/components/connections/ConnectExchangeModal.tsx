'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiKeyForm } from './ApiKeyForm';
import { SyncProgress } from './SyncProgress';
import { getExchangeInfo } from '@/lib/exchanges';
import {
  useCrypto,
  useCreateConnection,
  useTestConnection,
  useStartSync,
} from '@/hooks';
import type { ExchangeType } from '@/types';

interface ConnectExchangeModalProps {
  exchange: ExchangeType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ModalState = 'form' | 'syncing' | 'completed' | 'error';

export function ConnectExchangeModal({
  exchange,
  open,
  onOpenChange,
  onSuccess,
}: ConnectExchangeModalProps) {
  const [modalState, setModalState] = useState<ModalState>('form');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { encrypt, isReady: isCryptoReady, error: cryptoError } = useCrypto();
  const createConnection = useCreateConnection();
  const testConnection = useTestConnection();

  const exchangeInfo = exchange ? getExchangeInfo(exchange) : null;

  const handleClose = () => {
    // Reset state when closing
    setModalState('form');
    setConnectionId(null);
    setError(null);
    onOpenChange(false);
  };

  const handleTest = async (data: { apiKey: string; secretKey: string }) => {
    if (!exchange) return { success: false, message: '거래소가 선택되지 않았습니다' };

    try {
      const encrypted = await encrypt(data.apiKey, data.secretKey);

      const result = await testConnection.mutateAsync({
        exchange,
        encrypted_api_key: encrypted.encryptedApiKey,
        encrypted_secret_key: encrypted.encryptedSecretKey,
        iv: encrypted.iv,
        ephemeral_public_key: encrypted.ephemeralPublicKey,
      });

      return {
        success: result.success,
        message: result.success
          ? '연결 테스트 성공! API Key가 유효합니다.'
          : result.message || '연결 테스트 실패',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '연결 테스트 중 오류가 발생했습니다';
      return { success: false, message };
    }
  };

  const handleSubmit = async (data: { apiKey: string; secretKey: string }) => {
    if (!exchange) return;

    setError(null);

    try {
      // Encrypt API keys
      const encrypted = await encrypt(data.apiKey, data.secretKey);

      // Create connection
      const response = await createConnection.mutateAsync({
        exchange,
        encrypted_api_key: encrypted.encryptedApiKey,
        encrypted_secret_key: encrypted.encryptedSecretKey,
        iv: encrypted.iv,
        ephemeral_public_key: encrypted.ephemeralPublicKey,
      });

      setConnectionId(response.connection.id);

      // If sync started automatically, show sync progress
      if (response.sync_started) {
        setModalState('syncing');
        toast.success(`${exchangeInfo?.name} 연결 완료`, {
          description: '동기화를 시작합니다...',
        });
      } else {
        setModalState('completed');
        toast.success(`${exchangeInfo?.name} 연결 완료`);
        onSuccess?.();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '연결 중 오류가 발생했습니다';
      setError(message);
      toast.error('연결 실패', { description: message });
    }
  };

  const handleSyncCompleted = () => {
    setModalState('completed');
    toast.success('동기화 완료', {
      description: `${exchangeInfo?.name} 데이터 동기화가 완료되었습니다.`,
    });
    onSuccess?.();
  };

  const handleSyncError = (errorMessage: string) => {
    setModalState('error');
    setError(errorMessage);
    toast.error('동기화 실패', { description: errorMessage });
  };

  if (!exchange || !exchangeInfo) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-muted">
              <Image
                src={exchangeInfo.logoUrl}
                alt={exchangeInfo.name}
                fill
                className="object-contain p-1"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-muted-foreground">
                {exchangeInfo.name[0]}
              </div>
            </div>
            <div>
              <DialogTitle>{exchangeInfo.name} 연결</DialogTitle>
              <DialogDescription>
                API Key를 입력하여 거래소를 연결하세요.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {modalState === 'form' && (
            <ApiKeyForm
              exchange={exchange}
              onSubmit={handleSubmit}
              onTest={handleTest}
              isSubmitting={createConnection.isPending}
              isTesting={testConnection.isPending}
              error={error || cryptoError}
              isCryptoReady={isCryptoReady}
            />
          )}

          {modalState === 'syncing' && connectionId && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                거래 데이터를 동기화하는 중입니다. 데이터 양에 따라 몇 분이 소요될
                수 있습니다.
              </p>
              <SyncProgress
                connectionId={connectionId}
                onCompleted={handleSyncCompleted}
                onError={handleSyncError}
              />
            </div>
          )}

          {modalState === 'completed' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium">연결 완료!</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {exchangeInfo.name}가 성공적으로 연결되었습니다.
                </p>
              </div>
            </div>
          )}

          {modalState === 'error' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <svg
                  className="h-6 w-6 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium">동기화 실패</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error || '데이터 동기화 중 오류가 발생했습니다.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
